import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { ClientesModule } from './clientes/clientes.module';
import { LeadsModule } from './leads/leads.module';
import { ProdutosModule } from './produtos/produtos.module';
import { RecomendacoesModule } from './recomendacoes/recomendacoes.module';
import { SuitabilityModule } from './suitability/suitability.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
    }),
    TerminusModule,
    PrismaModule,
    AuthModule,
    ClientesModule,
    LeadsModule,
    ProdutosModule,
    RecomendacoesModule,
    SuitabilityModule,
  ],
  controllers: [HealthController],
  providers: [
    // Ordem: JwtAuthGuard primeiro (autenticação), RolesGuard depois (autorização).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
