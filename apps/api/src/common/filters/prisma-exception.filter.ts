import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const { status, message } = this.translate(exception);

    this.logger.warn(`[${exception.code}] ${message}`);

    response.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
    });
  }

  private translate(e: Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002': {
        const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
        return {
          status: HttpStatus.CONFLICT,
          message: `Já existe um registro com esse(s) valor(es) único(s): ${target}`,
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Violação de chave estrangeira — referência inválida',
        };
      case 'P2014':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Operação violaria a integridade de relacionamentos',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: `Erro do banco de dados (${e.code})`,
        };
    }
  }
}
