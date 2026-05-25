import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateLogin(dto: LoginDto): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.senhaHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return user;
  }

  async issueTokens(user: User): Promise<TokensResult> {
    const payload: AuthPayload = {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(
      { ...payload, type: 'access' },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: ACCESS_TTL,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { id: user.id, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TTL,
      },
    );

    return { accessToken, refreshToken, user: payload };
  }

  async refresh(refreshToken: string): Promise<TokensResult> {
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<{ id: string; type: string }>(
        refreshToken,
        { secret: this.config.get<string>('JWT_REFRESH_SECRET') },
      );
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException();
      }
      userId = payload.id;
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.ativo) {
      throw new UnauthorizedException('Usuário não disponível');
    }

    return this.issueTokens(user);
  }

  /** Gera hash bcrypt — exposto pro seed e endpoints futuros de criação de usuário */
  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
