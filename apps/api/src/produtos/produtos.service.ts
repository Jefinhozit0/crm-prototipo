import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeProduto } from '../common/serializers';
import type {
  ProdutoCreateDto,
  ProdutoQueryDto,
  ProdutoUpdateDto,
} from './dto/produto.schemas';

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

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
        orderBy: [{ ativo: 'desc' }, { rentabilidadeAno: 'desc' }],
      }),
      this.prisma.produto.count({ where }),
    ]);

    return buildPage(data.map(sanitizeProduto), total, query);
  }

  async findById(id: string) {
    const produto = await this.prisma.produto.findUnique({ where: { id } });
    if (!produto) throw new NotFoundException(`Produto ${id} não encontrado`);
    return sanitizeProduto(produto);
  }

  async create(data: ProdutoCreateDto) {
    const produto = await this.prisma.produto.create({ data });
    return sanitizeProduto(produto);
  }

  async update(id: string, data: ProdutoUpdateDto) {
    const produto = await this.prisma.produto.update({ where: { id }, data });
    return sanitizeProduto(produto);
  }

  async remove(id: string) {
    await this.prisma.produto.delete({ where: { id } });
    return { id, deleted: true };
  }
}
