import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { RequestComContexto } from '../request-context';

type CorpoErro = {
  statusCode: number;
  message: string;
  error: string;
  requestId?: string;
  code?: string;
  errors?: unknown;
};

// Nomes de coluna → rótulo amigável (nunca expor "cpfHash" na mensagem)
const CAMPO_LABEL: Record<string, string> = {
  email: 'e-mail',
  cpfHash: 'CPF',
  ticker: 'ticker',
};

const NOME_STATUS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Filtro único de erros. Padroniza o corpo como
 * { statusCode, message, error, requestId } e garante que detalhes internos
 * (stack, SQL, mensagens do Prisma) fiquem só no log do servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Erros');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestComContexto>();
    const requestId = request?.requestId;

    const corpo = this.traduzir(exception, request);
    corpo.requestId = requestId;

    if (corpo.statusCode >= 500) {
      const err = exception as Error;
      this.logger.error(
        `[${requestId}] ${request?.method} ${request?.path} → ${corpo.statusCode}: ${err?.name}: ${err?.message}`,
        err?.stack,
      );
    }

    response.status(corpo.statusCode).json(corpo);
  }

  private traduzir(exception: unknown, request?: RequestComContexto): CorpoErro {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        return { statusCode: status, message: body, error: NOME_STATUS[status] ?? 'Error' };
      }
      const b = body as Record<string, unknown>;
      const msg = Array.isArray(b.message) ? b.message.join('; ') : String(b.message ?? '');
      return {
        statusCode: status,
        message: msg || NOME_STATUS[status] || 'Erro',
        error: String(b.error ?? NOME_STATUS[status] ?? 'Error'),
        ...(b.errors !== undefined && { errors: b.errors }),
        ...(typeof b.code === 'string' && { code: b.code }),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.traduzirPrisma(exception);
    }

    // Prisma 5 entrega violações de CHECK/RESTRICT do Postgres como "unknown"
    if (exception instanceof Prisma.PrismaClientUnknownRequestError) {
      if (/violates check constraint|code: "23514"/.test(exception.message)) {
        return {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'Valor fora das regras de integridade dos dados',
          error: NOME_STATUS[422],
        };
      }
      if (/violates RESTRICT|code: "23001"|violates foreign key/.test(exception.message)) {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Operação não permitida: o registro está vinculado a outros dados',
          error: NOME_STATUS[409],
        };
      }
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Banco de dados indisponível no momento. Tente novamente em instantes.',
        error: NOME_STATUS[503],
      };
    }

    if (exception instanceof SyntaxError && request?.method !== 'GET') {
      // JSON malformado no body (body-parser)
      return { statusCode: 400, message: 'Corpo da requisição inválido', error: NOME_STATUS[400] };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno. Informe o código de referência ao suporte.',
      error: NOME_STATUS[500],
    };
  }

  private traduzirPrisma(e: Prisma.PrismaClientKnownRequestError): CorpoErro {
    switch (e.code) {
      case 'P2002': {
        const campos = ((e.meta?.target as string[] | undefined) ?? [])
          .map((c) => CAMPO_LABEL[c] ?? c)
          .join(', ');
        return {
          statusCode: HttpStatus.CONFLICT,
          message: campos
            ? `Já existe um registro com este ${campos}`
            : 'Registro duplicado',
          error: NOME_STATUS[409],
          code: e.code,
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
          error: NOME_STATUS[404],
          code: e.code,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Operação não permitida: o registro está vinculado a outros dados',
          error: NOME_STATUS[409],
          code: e.code,
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Operação violaria a integridade de relacionamentos',
          error: NOME_STATUS[400],
          code: e.code,
        };
      case 'P1001':
      case 'P1002':
      case 'P1008':
      case 'P1017':
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Banco de dados indisponível no momento. Tente novamente em instantes.',
          error: NOME_STATUS[503],
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno. Informe o código de referência ao suporte.',
          error: NOME_STATUS[500],
        };
    }
  }
}
