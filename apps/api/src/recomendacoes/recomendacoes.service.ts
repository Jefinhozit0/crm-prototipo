import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusRecomendacao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import {
  AiEngineService,
  type AiEngineRequest,
} from './ai-engine.service';
import type {
  GenerateDto,
  RecomendacaoQueryDto,
  RecusarDto,
} from './dto/recomendacao.schemas';

const includeRecomendacao = {
  cliente: { select: { id: true, nome: true, perfil: true } },
  produto: { select: { id: true, nome: true, categoria: true, emissor: true } },
  aprovadoPor: { select: { id: true, nome: true } },
} satisfies Prisma.RecomendacaoInclude;

@Injectable()
export class RecomendacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
  ) {}

  /**
   * Roda o motor de IA pra um cliente.
   *
   * Estratégia:
   *   1. Marca recomendações PENDENTE antigas como EXPIRADA (preserva histórico)
   *   2. Monta o contexto a partir do Postgres (cliente, suitability, posições, catálogo)
   *   3. Chama o microsserviço Python via HTTP
   *   4. Persiste top-N como novas PENDENTEs
   */
  async generate(dto: GenerateDto) {
    const req = await this.buildAiEngineRequest(dto.clienteId, dto.topN);

    const result = await this.aiEngine.recommend(req);
    if (result.recomendacoes.length === 0) {
      return { geradas: 0, recomendacoes: [] };
    }

    // Expira antigas
    await this.prisma.recomendacao.updateMany({
      where: { clienteId: dto.clienteId, status: StatusRecomendacao.PENDENTE },
      data: { status: StatusRecomendacao.EXPIRADA },
    });

    const criadas = await Promise.all(
      result.recomendacoes.map((r) =>
        this.prisma.recomendacao.create({
          data: {
            clienteId: dto.clienteId,
            produtoId: r.produtoId,
            score: Number(r.score.toFixed(3)),
            justificativa: r.justificativa,
            payload: {
              fatores: r.fatores,
              pesos: r.pesos,
              contribs: r.contribs,
              geradoPor: result.engineVersion,
              descartadosDaRodada: result.descartados,
              totalAnalisados: result.totalAnalisados,
            } as Prisma.InputJsonValue,
            status: StatusRecomendacao.PENDENTE,
            expiraEm: new Date(Date.now() + 30 * 86400000), // 30 dias
          },
          include: includeRecomendacao,
        }),
      ),
    );

    return {
      geradas: criadas.length,
      recomendacoes: criadas.map(this.sanitize),
    };
  }

  async list(query: RecomendacaoQueryDto) {
    const where: Prisma.RecomendacaoWhereInput = {
      ...(query.clienteId && { clienteId: query.clienteId }),
      ...(query.status && { status: query.status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.recomendacao.findMany({
        where,
        ...skipTake(query),
        orderBy: [{ status: 'asc' }, { geradoEm: 'desc' }],
        include: includeRecomendacao,
      }),
      this.prisma.recomendacao.count({ where }),
    ]);

    return buildPage(data.map(this.sanitize), total, query);
  }

  async findById(id: string) {
    const r = await this.prisma.recomendacao.findUnique({
      where: { id },
      include: includeRecomendacao,
    });
    if (!r) throw new NotFoundException(`Recomendação ${id} não encontrada`);
    return this.sanitize(r);
  }

  async aprovar(id: string, userId: string) {
    const r = await this.prisma.recomendacao.update({
      where: { id },
      data: {
        status: StatusRecomendacao.APROVADA,
        aprovadoPorId: userId,
        aprovadoEm: new Date(),
        recusaMotivo: null,
      },
      include: includeRecomendacao,
    });
    return this.sanitize(r);
  }

  async recusar(id: string, userId: string, dto: RecusarDto) {
    const r = await this.prisma.recomendacao.update({
      where: { id },
      data: {
        status: StatusRecomendacao.RECUSADA,
        aprovadoPorId: userId,
        aprovadoEm: new Date(),
        recusaMotivo: dto.motivo,
      },
      include: includeRecomendacao,
    });
    return this.sanitize(r);
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Lê do Postgres tudo que o motor Python precisa e monta o request HTTP.
   * Aqui acontece a conversão de Decimal (Prisma) → number (JSON).
   */
  private async buildAiEngineRequest(
    clienteId: string,
    topN: number,
  ): Promise<AiEngineRequest> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        suitability: { orderBy: { aplicadoEm: 'desc' }, take: 1 },
        posicoes: { include: { produto: true } },
      },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${clienteId} não encontrado`);
    }

    const suit = cliente.suitability[0];
    const respostas = (suit?.respostas ?? {}) as Record<string, number>;

    const catalog = await this.prisma.produto.findMany({ where: { ativo: true } });

    return {
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        perfil: cliente.perfil,
        patrimonio: Number(cliente.patrimonio.toString()),
      },
      suitability: {
        perfilCalculado: suit?.perfilCalculado ?? cliente.perfil,
        horizonteAnos: Number(respostas.horizonte_anos ?? 5),
        toleranciaPerda: Number(respostas.tolerancia_perda ?? 15),
      },
      posicoes: cliente.posicoes.map((p) => ({
        produtoId: p.produtoId,
        categoria: p.produto.categoria,
        valor: Number(p.valor.toString()),
      })),
      catalog: catalog.map((p) => ({
        id: p.id,
        nome: p.nome,
        emissor: p.emissor,
        categoria: p.categoria,
        rentabilidadeAno: Number(p.rentabilidadeAno.toString()),
        risco: p.risco,
        tributacao: p.tributacao,
        perfilMinimo: p.perfilMinimo,
        liquidez: p.liquidez,
        taxaAdmin: p.taxaAdmin ? Number(p.taxaAdmin.toString()) : null,
        ativo: p.ativo,
      })),
      topN,
    };
  }

  private sanitize = <T extends { score: Prisma.Decimal }>(r: T) => ({
    ...r,
    score: Number(r.score.toString()),
  });
}
