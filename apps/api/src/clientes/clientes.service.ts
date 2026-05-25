import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeCliente } from '../common/serializers';
import type {
  ClienteCreateDto,
  ClienteQueryDto,
  ClienteUpdateDto,
} from './dto/cliente.schemas';

function hashCpf(cpf: string) {
  return crypto.createHash('sha256').update(cpf).digest('hex');
}

function maskCpf(cpf: string) {
  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

const includeResponsavel = {
  responsavel: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.ClienteInclude;

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ClienteQueryDto) {
    const where: Prisma.ClienteWhereInput = {
      ...(query.perfil && { perfil: query.perfil }),
      ...(query.status && { status: query.status }),
      ...(query.responsavelId && { responsavelId: query.responsavelId }),
      ...(query.uf && { uf: query.uf }),
      ...(query.q && {
        OR: [
          { nome: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const sortField = query.sort.replace(/^-/, '');
    const sortDir: Prisma.SortOrder = query.sort.startsWith('-') ? 'desc' : 'asc';
    const orderBy: Prisma.ClienteOrderByWithRelationInput = { [sortField]: sortDir };

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        ...skipTake(query),
        orderBy,
        include: includeResponsavel,
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return buildPage(data.map(sanitizeCliente), total, query);
  }

  async findById(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: includeResponsavel,
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} não encontrado`);
    return sanitizeCliente(cliente);
  }

  /**
   * Cliente + carteira atual + última suitability + recomendações recentes.
   * Endpoint dedicado pra tela de cliente individual.
   */
  async findDetalhado(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
      include: {
        ...includeResponsavel,
        posicoes: {
          include: { produto: { select: { id: true, nome: true, categoria: true, emissor: true } } },
          orderBy: { valor: 'desc' },
        },
        suitability: {
          orderBy: { aplicadoEm: 'desc' },
          take: 1,
        },
        recomendacoes: {
          include: {
            produto: { select: { id: true, nome: true, categoria: true, emissor: true } },
          },
          orderBy: [{ status: 'asc' }, { geradoEm: 'desc' }],
          take: 10,
        },
      },
    });
    if (!cliente) throw new NotFoundException(`Cliente ${id} não encontrado`);

    const { suitability, posicoes, recomendacoes, ...rest } = cliente;

    return {
      ...sanitizeCliente(rest),
      suitability: suitability[0]
        ? {
            ...suitability[0],
            // respostas vem como Json; transformar pra obj plano
          }
        : null,
      posicoes: posicoes.map((p) => ({
        id: p.id,
        produto: p.produto,
        valor: Number(p.valor.toString()),
        adquiridoEm: p.adquiridoEm,
      })),
      recomendacoes: recomendacoes.map((r) => ({
        ...r,
        score: Number(r.score.toString()),
      })),
    };
  }

  async create(dto: ClienteCreateDto) {
    const { cpf, ...rest } = dto;
    const cliente = await this.prisma.cliente.create({
      data: {
        ...rest,
        cpfHash: hashCpf(cpf),
        cpfMasked: maskCpf(cpf),
      },
      include: includeResponsavel,
    });
    return sanitizeCliente(cliente);
  }

  async update(id: string, dto: ClienteUpdateDto) {
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: dto,
      include: includeResponsavel,
    });
    return sanitizeCliente(cliente);
  }

  async remove(id: string) {
    await this.prisma.cliente.delete({ where: { id } });
    return { id, deleted: true };
  }
}
