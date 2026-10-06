import type { NextFunction, Request, Response } from 'express';
import type { RequestComContexto } from './request-context';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa em profundidade contra CSRF (a primeira camada é o cookie SameSite=Lax).
 *
 * Em métodos que alteram estado, se o browser mandou Origin e ela não é uma das
 * origens do front, rejeita. Sem Origin (curl, server-to-server com Bearer)
 * passa — esses clientes não carregam o cookie de sessão de um usuário logado.
 */
export function originCheckMiddleware(origensPermitidas: string[]) {
  const permitidas = new Set(origensPermitidas);
  return (req: Request, res: Response, next: NextFunction) => {
    if (METODOS_SEGUROS.has(req.method)) return next();
    const origin = req.header('origin');
    if (!origin || permitidas.has(origin)) return next();
    res.status(403).json({
      statusCode: 403,
      message: 'Origem da requisição não permitida',
      error: 'Forbidden',
      requestId: (req as RequestComContexto).requestId,
    });
  };
}
