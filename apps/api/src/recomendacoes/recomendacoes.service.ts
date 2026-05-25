import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusRecomendacao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import { produtoToIA, topRecomendacoes } from './ia/rule-engine';
import type { Contexto, PosicaoIA } from './ia/types';
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executa o motor de IA pra um cliente. Estratégia:
   * 1. Marca recomendações PENDENTE antigas como EXPIRADA (preserva histórico)
   * 2. Roda engine
   * 3. Persiste top-N como novas PENDENTEs
   */
  async generate(dto: GenerateDto) {
    const ctx = await this.buildContexto(dto.clienteId);
    const sugestoes = topRecomendacoes(ctx, dto.topN);

    if (sugestoes.length === 0) {
      return { geradas: 0, recomendacoes: [] };
    }

    // Transação: expira antigas + cria novas
    await this.prisma.recomendacao.updateMany({
      where: { clienteId: dto.clienteId, status: StatusRecomendacao.PENDENTE },
      data: { status: StatusRecomendacao.EXPIRADA },
    });

    const criadas = await Promise.all(
      sugestoes.map((s) =>
        this.prisma.recomendacao.create({
          data: {
            clienteId: dto.clienteId,
            produtoId: s.produto.id,
            score: Number(s.score.toFixed(3)),
            justificativa: s.justificativa,
            payload: {
              fatores: s.fatores,
              pesos: s.pesos,
              contribs: s.contribs,
              geradoPor: 'rule-engine-v1',
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

  private async buildContexto(clienteId: string): Promise<Contexto> {
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

    const posicoes: PosicaoIA[] = cliente.posicoes.map((p) => ({
      produtoId: p.produtoId,
      categoria: p.produto.categoria,
      valor: Number(p.valor.toString()),
    }));

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
      posicoes,
      catalog: catalog.map(produtoToIA),
    };
  }

  private sanitize = <T extends { score: Prisma.Decimal }>(r: T) => ({
    ...r,
    score: Number(r.score.toString()),
  });
}
