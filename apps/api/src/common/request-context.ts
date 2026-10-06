import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

export type RequestComContexto = Request & {
  requestId?: string;
  user?: AuthUser;
};

export type ContextoRequisicao = {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};

const REQUEST_ID_HEADER = 'x-request-id';
// Aceita id vindo do proxy/cliente só se for "bem comportado" (evita log injection)
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{8,64}$/;

/** Gera/propaga o X-Request-Id e devolve no response pra correlação de suporte. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const recebido = req.header(REQUEST_ID_HEADER);
  const requestId = recebido && REQUEST_ID_VALIDO.test(recebido) ? recebido : randomUUID();
  (req as RequestComContexto).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

/**
 * Log de acesso estruturado (uma linha JSON por request).
 * Propositalmente NÃO registra query string, body, cookies nem headers de auth —
 * podem conter CPF, valores financeiros ou tokens.
 */
export function accessLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const r = req as RequestComContexto;
    const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    logJson(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'http', {
      requestId: r.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(duracaoMs),
      userId: r.user?.id,
    });
  });
  next();
}

export function logJson(
  level: 'info' | 'warn' | 'error',
  msg: string,
  fields: Record<string, unknown> = {},
) {
  if (process.env.NODE_ENV === 'test') return;
  const linha = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') process.stderr.write(linha + '\n');
  else process.stdout.write(linha + '\n');
}

export function contextoDaRequisicao(req: Request | undefined): ContextoRequisicao {
  if (!req) return { ip: null, userAgent: null, requestId: null };
  return {
    ip: req.ip ?? null,
    userAgent: req.header('user-agent')?.slice(0, 255) ?? null,
    requestId: (req as RequestComContexto).requestId ?? null,
  };
}
