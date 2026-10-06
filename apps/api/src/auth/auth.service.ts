import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../common/request-context';
import { LoginThrottleService } from './login-throttle.service';
import type { LoginDto } from './dto/auth.schemas';

export type AuthPayload = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
};

export type TokensResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthPayload;
};

type RefreshClaims = { id: string; jti: string; fam: string; type: string };

export const ACCESS_TTL_S = 15 * 60; // 15 min
export const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 dias

// Se dois pedidos de refresh concorrentes (duas abas) usam o mesmo token, o
// segundo chega com o token já rotacionado. Dentro dessa janela isso é tratado
// como corrida benigna — fora dela, como reuso de token roubado.
const JANELA_CONCORRENCIA_MS = 30_000;

// Hash bcrypt de uma senha aleatória: usado quando o e-mail não existe, pra que
// o tempo de resposta não revele quais e-mails estão cadastrados.
const HASH_FICTICIO = '$2a$10$IhcTW65RCkRJvcNMDkOCj.1FZQrXljzTN5wjl..FZiERAnfrnZID2';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly throttle: LoginThrottleService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async validateLogin(dto: LoginDto, ctx?: ContextoRequisicao): Promise<User> {
    const ip = ctx?.ip ?? null;
    this.throttle.verificar(dto.email, ip);

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = await bcrypt.compare(dto.password, user?.senhaHash ?? HASH_FICTICIO);

    if (!user || !ok || !user.ativo) {
      this.throttle.registrarFalha(dto.email, ip);
      await this.auditoria.registrar({
        acao: 'LOGIN_FALHA',
        entidade: 'User',
        entidadeId: user?.id ?? null,
        userId: user?.id ?? null,
        diff: { motivo: !user ? 'usuario_inexistente' : !user.ativo ? 'usuario_inativo' : 'senha_incorreta' },
        contexto: ctx,
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }

    this.throttle.registrarSucesso(dto.email);
    await this.auditoria.registrar({
      acao: 'LOGIN',
      entidade: 'User',
      entidadeId: user.id,
      userId: user.id,
      contexto: ctx,
    });
    return user;
  }

  /** Emite access + refresh. Sem familiaId abre uma nova sessão (login). */
  async issueTokens(
    user: User,
    opts: { familiaId?: string; ctx?: ContextoRequisicao; jti?: string } = {},
  ): Promise<TokensResult> {
    const payload: AuthPayload = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
    };
    const jti = opts.jti ?? randomUUID();
    const familiaId = opts.familiaId ?? randomUUID();

    if (!opts.jti) {
      await this.prisma.refreshToken.create({
        data: {
          id: jti,
          userId: user.id,
          familiaId,
          expiraEm: new Date(Date.now() + REFRESH_TTL_S * 1000),
          ip: opts.ctx?.ip ?? null,
          userAgent: opts.ctx?.userAgent ?? null,
        },
      });
    }

    const accessToken = await this.jwt.signAsync(
      { ...payload, type: 'access' },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: ACCESS_TTL_S,
        algorithm: 'HS256',
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { id: user.id, jti, fam: familiaId, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TTL_S,
        algorithm: 'HS256',
      },
    );

    return { accessToken, refreshToken, user: payload };
  }

  /**
   * Rotação: cada refresh token só vale uma vez. Reapresentar um token já
   * rotacionado (fora da janela de concorrência) indica roubo — a sessão
   * inteira (família) é revogada e o evento é auditado.
   */
  async refresh(refreshToken: string, ctx?: ContextoRequisicao): Promise<TokensResult> {
    const claims = await this.verificarRefresh(refreshToken);
    if (!claims) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    const atual = await this.prisma.refreshToken.findUnique({ where: { id: claims.jti } });
    if (!atual || atual.userId !== claims.id || atual.familiaId !== claims.fam) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    if (atual.revogadoEm) {
      const concorrente =
        atual.substituidoPor !== null &&
        Date.now() - atual.revogadoEm.getTime() < JANELA_CONCORRENCIA_MS;
      if (concorrente) throw this.erroConcorrencia();

      await this.revogarFamilia(atual.familiaId);
      await this.auditoria.registrar({
        acao: 'REUSO_REFRESH_TOKEN',
        entidade: 'User',
        entidadeId: atual.userId,
        userId: atual.userId,
        diff: { familiaId: atual.familiaId },
        contexto: ctx,
      });
      throw new UnauthorizedException('Sessão encerrada por segurança. Faça login novamente.');
    }

    if (atual.expiraEm.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: claims.id } });
    if (!user || !user.ativo) {
      await this.revogarFamilia(atual.familiaId);
      throw new UnauthorizedException('Usuário não disponível');
    }

    const novoJti = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      // Condicional: só um pedido concorrente consegue rotacionar o mesmo token
      const { count } = await tx.refreshToken.updateMany({
        where: { id: atual.id, revogadoEm: null },
        data: { revogadoEm: new Date(), substituidoPor: novoJti },
      });
      if (count === 0) throw this.erroConcorrencia();
      await tx.refreshToken.create({
        data: {
          id: novoJti,
          userId: user.id,
          familiaId: atual.familiaId,
          expiraEm: new Date(Date.now() + REFRESH_TTL_S * 1000),
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
        },
      });
    });

    return this.issueTokens(user, { familiaId: atual.familiaId, ctx, jti: novoJti });
  }

  /** Revoga a sessão do refresh token (se válido) e audita o logout. */
  async logout(refreshToken: string | undefined, ctx?: ContextoRequisicao) {
    if (!refreshToken) return;
    const claims = await this.verificarRefresh(refreshToken);
    if (!claims) return;
    await this.revogarFamilia(claims.fam);
    await this.auditoria.registrar({
      acao: 'LOGOUT',
      entidade: 'User',
      entidadeId: claims.id,
      userId: claims.id,
      contexto: ctx,
    });
  }

  /** Gera hash bcrypt — exposto pro seed e endpoints futuros de criação de usuário */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  private async verificarRefresh(token: string): Promise<RefreshClaims | null> {
    try {
      const p = await this.jwt.verifyAsync<RefreshClaims>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
      });
      if (p.type !== 'refresh' || !p.jti || !p.fam || !p.id) return null;
      return p;
    } catch {
      return null;
    }
  }

  private async revogarFamilia(familiaId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familiaId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }

  private erroConcorrencia() {
    return new UnauthorizedException({
      statusCode: HttpStatus.UNAUTHORIZED,
      message: 'Sessão renovada em outra aba',
      error: 'Unauthorized',
      code: 'REFRESH_CONCORRENTE',
    });
  }
}
