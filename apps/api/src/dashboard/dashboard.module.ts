import { Controller, Get, Injectable, Module } from '@nestjs/common';
import type { PerfilInvestidor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { escopoCliente, escopoLead } from '../auth/escopo';

const PERFIS: PerfilInvestidor[] = ['CONSERVADOR', 'MODERADO', 'ARROJADO', 'AGRESSIVO'];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * KPIs reais da carteira no escopo do usuário. Séries históricas (evolução de
   * AUM, captação) ainda não existem no modelo de dados — o front as exibe
   * marcadas como demonstrativas.
   */
  async resumo(user: AuthUser) {
    const clientes = escopoCliente(user);
    const agora = new Date();

    const [aum, declarado, clientesAtivos, porPerfil, leadsAbertos, pendentes, ativosComSuit] =
      await Promise.all([
        // AUM = o que está aplicado na casa (posições, a custo), de qualquer status
        this.prisma.posicao.aggregate({
          where: { cliente: clientes },
          _sum: { valor: true },
        }),
        // Patrimônio declarado pelos clientes ativos (inclui o que está fora da casa)
        this.prisma.cliente.aggregate({
          where: { ...clientes, status: 'ATIVO' },
          _sum: { patrimonio: true },
        }),
        this.prisma.cliente.count({ where: { ...clientes, status: 'ATIVO' } }),
        this.prisma.cliente.groupBy({
          by: ['perfil'],
          where: { ...clientes, status: { in: ['ATIVO', 'PROSPECTO'] } },
          _count: { _all: true },
        }),
        this.prisma.lead.aggregate({
          where: { ...escopoLead(user), estagio: { notIn: ['FECHADO', 'PERDIDO'] } },
          _count: { _all: true },
          _sum: { valorEstimado: true },
        }),
        this.prisma.recomendacao.count({
          where: {
            cliente: clientes,
            status: 'PENDENTE',
            OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }],
          },
        }),
        // Clientes ativos com ao menos uma suitability ainda válida
        this.prisma.cliente.count({
          where: {
            ...clientes,
            status: 'ATIVO',
            suitability: { some: { validoAte: { gt: agora } } },
          },
        }),
      ]);

    const totalPerfil = porPerfil.reduce((acc, p) => acc + p._count._all, 0);

    return {
      aumTotal: Number(aum._sum.valor?.toString() ?? 0),
      patrimonioDeclarado: Number(declarado._sum.patrimonio?.toString() ?? 0),
      clientesAtivos,
      leadsAbertos: leadsAbertos._count._all,
      valorPipeline: Number(leadsAbertos._sum.valorEstimado?.toString() ?? 0),
      recomendacoesPendentes: pendentes,
      // Ativos sem suitability vigente: não podem receber recomendação (CVM 30)
      clientesSemSuitabilityValida: clientesAtivos - ativosComSuit,
      distribuicaoPerfil: PERFIS.map((perfil) => {
        const n = porPerfil.find((p) => p.perfil === perfil)?._count._all ?? 0;
        return {
          perfil,
          quantidade: n,
          pct: totalPerfil > 0 ? Math.round((n / totalPerfil) * 1000) / 10 : 0,
        };
      }),
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('resumo')
  resumo(@CurrentUser() user: AuthUser) {
    return this.service.resumo(user);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
