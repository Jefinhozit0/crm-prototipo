import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Catch-all: registra qualquer erro não tratado com stack completo e
 * retorna uma resposta JSON consistente em vez do "Internal server error" genérico.
 * Os filtros mais específicos (PrismaExceptionFilter) têm prioridade sobre este.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HttpExceptions (NotFound, BadRequest, etc.) — comportamento padrão
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
    }

    // Prisma errors conhecidos — repassa pro filter específico (não deve chegar aqui se já estiver registrado)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`[Prisma ${exception.code}] ${exception.message}`);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        message: `Erro Prisma (${exception.code}): ${exception.message}`,
        code: exception.code,
      });
    }

    // Qualquer outro erro: loga com stack e devolve detalhes
    const err = exception as Error;
    this.logger.error(
      `Erro não tratado em ${request.method} ${request.url}: ${err?.message ?? exception}`,
      err?.stack,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: err?.message ?? 'Internal server error',
      name: err?.name,
      // Em prod, esconda o stack. Aqui (dev) ajuda muito a debugar.
      ...(process.env.NODE_ENV !== 'production' && { stack: err?.stack }),
    });
  }
}
