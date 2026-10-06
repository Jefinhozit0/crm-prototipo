import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Sem log de queries: parâmetros podem conter dados pessoais/financeiros
    super({ log: [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }] });
  }

  async onModuleInit() {
    // Banco fora do ar no boot não derruba a API: o Prisma reconecta sob demanda,
    // as rotas respondem 503 e /api/health/ready sinaliza indisponibilidade.
    try {
      await this.$connect();
      this.logger.log('Prisma conectado ao banco');
    } catch (e) {
      this.logger.error(`Banco indisponível no boot: ${(e as Error).message.split('\n')[0]}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
