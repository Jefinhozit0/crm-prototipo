import { Injectable, Logger } from '@nestjs/common';
import type { AcaoAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuditoriaQueryDto } from './auditoria.schemas';

export type RegistroAuditoria = {
  acao: AcaoAuditoria;
  entidade: string;
  entidadeId?: string | null;
  userId?: string | null;
  /** Antes/depois ou metadados. NUNCA incluir senha, token ou CPF em claro. */
  diff?: Prisma.InputJsonValue;
  contexto?: ContextoRequisicao;
};

type Cliente = Pick<Prisma.TransactionClient, 'auditoria'>;

const CAMPOS_PROIBIDOS = new Set(['senha', 'password', 'senhaHash', 'cpf', 'token', 'refreshToken', 'accessToken']);

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra dentro da transação recebida. Se a auditoria falhar, a operação
   * de negócio também falha — usar pra ações reguladas (aprovação, suitability).
   */
  async registrarEm(tx: Cliente, r: RegistroAuditoria) {
    await tx.auditoria.create({ data: this.montar(r) });
  }

  /**
   * Registro "best effort" — não derruba o fluxo principal se o banco de
   * auditoria falhar (ex.: login, leitura de dado sensível). Falha vai pro log.
   */
  async registrar(r: RegistroAuditoria) {
    try {
      await this.prisma.auditoria.create({ data: this.montar(r) });
    } catch (e) {
      this.logger.error(
        `Falha ao registrar auditoria ${r.acao} ${r.entidade}: ${(e as Error).message}`,
      );
    }
  }

  async listar(q: AuditoriaQueryDto) {
    const where: Prisma.AuditoriaWhereInput = {
      ...(q.acao && { acao: q.acao }),
      ...(q.entidade && { entidade: q.entidade }),
      ...(q.entidadeId && { entidadeId: q.entidadeId }),
      ...(q.userId && { userId: q.userId }),
      ...((q.de || q.ate) && {
        criadoEm: { ...(q.de && { gte: q.de }), ...(q.ate && { lte: q.ate }) },
      }),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        ...skipTake(q),
        orderBy: { criadoEm: 'desc' },
        include: { user: { select: { id: true, nome: true, email: true } } },
      }),
      this.prisma.auditoria.count({ where }),
    ]);
    return buildPage(data, total, q);
  }

  private montar(r: RegistroAuditoria): Prisma.AuditoriaUncheckedCreateInput {
    return {
      acao: r.acao,
      entidade: r.entidade,
      entidadeId: r.entidadeId ?? null,
      userId: r.userId ?? null,
      diff: r.diff === undefined ? undefined : removerCamposProibidos(r.diff),
      ip: r.contexto?.ip ?? null,
      userAgent: r.contexto?.userAgent ?? null,
      requestId: r.contexto?.requestId ?? null,
    };
  }
}

/** Rede de segurança: remove chaves sensíveis mesmo que alguém passe sem querer. */
export function removerCamposProibidos(v: Prisma.InputJsonValue): Prisma.InputJsonValue {
  if (Array.isArray(v)) return v.map((x) => removerCamposProibidos(x as Prisma.InputJsonValue));
  if (v && typeof v === 'object') {
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const [k, val] of Object.entries(v)) {
      if (CAMPOS_PROIBIDOS.has(k)) continue;
      if (val === undefined) continue;
      out[k] = removerCamposProibidos(val as Prisma.InputJsonValue);
    }
    return out;
  }
  return v;
}

/** Diff só dos campos que mudaram — pra trilha de ATUALIZACAO. */
export function diffCampos(
  antes: object,
  mudancas: object,
): { antes: Prisma.InputJsonObject; depois: Prisma.InputJsonObject } {
  const anterior = antes as Record<string, unknown>;
  const a: Record<string, Prisma.InputJsonValue | null> = {};
  const d: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [k, novo] of Object.entries(mudancas)) {
    if (novo === undefined) continue;
    const velho = normalizar(anterior[k]);
    const n = normalizar(novo);
    if (JSON.stringify(velho) !== JSON.stringify(n)) {
      a[k] = velho;
      d[k] = n;
    }
  }
  return { antes: a, depois: d };
}

function normalizar(v: unknown): Prisma.InputJsonValue | null {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return v.toISOString();
  // Prisma.Decimal → number (comparável com o number que vem do DTO)
  if (typeof v === 'object' && 'toFixed' in v) return Number(String(v));
  return v as Prisma.InputJsonValue;
}
