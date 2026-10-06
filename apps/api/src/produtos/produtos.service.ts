import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, diffCampos } from '../auditoria/auditoria.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeProduto } from '../common/serializers';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import type {
  ProdutoCreateDto,
  ProdutoQueryDto,
  ProdutoUpdateDto,
} from './dto/produto.schemas';

@Injectable()
export class ProdutosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async list(query: ProdutoQueryDto) {
    const where: Prisma.ProdutoWhereInput = {
      ...(query.categoria && { categoria: query.categoria }),
      ...(query.perfilMinimo && { perfilMinimo: query.perfilMinimo }),
      ...(query.ativo !== undefined && { ativo: query.ativo }),
      ...(query.riscoMax !== undefined && { risco: { lte: query.riscoMax } }),
      ...(query.q && {
        OR: [
          { nome: { contains: query.q, mode: 'insensitive' } },
          { emissor: { contains: query.q, mode: 'insensitive' } },
          { ticker: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.produto.findMany({
        where,
        ...skipTake(query),
        orderBy: [{ ativo: 'desc' }, { rentabilidadeAno: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.produto.count({ where }),
    ]);

    return buildPage(data.map(sanitizeProduto), total, query);
  }

  async findById(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return sanitizeProduto(produto);
  }

  async create(user: AuthUser, data: ProdutoCreateDto, ctx?: ContextoRequisicao) {
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({ data });
      await this.auditoria.registrarEm(tx, {
        acao: 'CRIACAO',
        entidade: 'Produto',
        entidadeId: produto.id,
        userId: user.id,
        diff: { nome: produto.nome, categoria: produto.categoria, perfilMinimo: produto.perfilMinimo },
        contexto: ctx,
      });
      return sanitizeProduto(produto);
    });
  }

  async update(user: AuthUser, id: string, data: ProdutoUpdateDto, ctx?: ContextoRequisicao) {
    const antes = await this.prisma.produto.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Produto não encontrado');
    return this.prisma.$transaction(async (tx) => {
      const produto = await tx.produto.update({ where: { id }, data });
      const diff = diffCampos(antes, data);
      if (Object.keys(diff.depois).length > 0) {
        await this.auditoria.registrarEm(tx, {
          acao: 'ATUALIZACAO',
          entidade: 'Produto',
          entidadeId: id,
          userId: user.id,
          diff,
          contexto: ctx,
        });
      }
      return sanitizeProduto(produto);
    });
  }

  /**
   * Desativa em vez de apagar: produto é referenciado por posições e por
   * recomendações históricas. Inativo some do catálogo e do motor de IA.
   */
  async remove(user: AuthUser, id: string, ctx?: ContextoRequisicao) {
    const antes = await this.prisma.produto.findUnique({ where: { id }, select: { ativo: true } });
    if (!antes) throw new NotFoundException('Produto não encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.produto.update({ where: { id }, data: { ativo: false } });
      await this.auditoria.registrarEm(tx, {
        acao: 'EXCLUSAO',
        entidade: 'Produto',
        entidadeId: id,
        userId: user.id,
        diff: { tipo: 'logica', ativoAnterior: antes.ativo },
        contexto: ctx,
      });
    });
    return { id, desativado: true };
  }
}
