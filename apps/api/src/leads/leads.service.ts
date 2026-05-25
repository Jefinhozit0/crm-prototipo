import { Injectable, NotFoundException } from '@nestjs/common';
import { EstagioPipeline, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeLead } from '../common/serializers';
import type {
  LeadCreateDto,
  LeadQueryDto,
  LeadUpdateDto,
  MoverEstagioDto,
} from './dto/lead.schemas';

const includeRel = {
  responsavel: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {
      ...(query.estagio && { estagio: query.estagio }),
      ...(query.responsavelId && { responsavelId: query.responsavelId }),
      ...(query.origem && { origem: query.origem }),
      ...(query.q && {
        OR: [
          { nome: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        ...skipTake(query),
        orderBy: { createdAt: 'desc' },
        include: includeRel,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return buildPage(data.map(sanitizeLead), total, query);
  }

  /** Agrupa leads por estágio — ideal pra alimentar o Kanban do Pipeline */
  async board(responsavelId?: string) {
    const where: Prisma.LeadWhereInput = responsavelId ? { responsavelId } : {};
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeRel,
    });

    const estagios: EstagioPipeline[] = [
      'PROSPECCAO',
      'QUALIFICACAO',
      'PROPOSTA',
      'NEGOCIACAO',
      'FECHADO',
      'PERDIDO',
    ];

    return estagios.map((estagio) => {
      const itens = leads.filter((l) => l.estagio === estagio).map(sanitizeLead);
      const total = itens.reduce((acc, l) => acc + l.valorEstimado, 0);
      return { estagio, total, count: itens.length, itens };
    });
  }

  async findById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        ...includeRel,
        estagioHistorico: {
          orderBy: { criadoEm: 'desc' },
          take: 20,
        },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} não encontrado`);
    return sanitizeLead(lead);
  }

  async create(dto: LeadCreateDto) {
    const lead = await this.prisma.lead.create({
      data: dto,
      include: includeRel,
    });
    return sanitizeLead(lead);
  }

  async update(id: string, dto: LeadUpdateDto) {
    const lead = await this.prisma.lead.update({
      where: { id },
      data: dto,
      include: includeRel,
    });
    return sanitizeLead(lead);
  }

  /** Move o lead pra outro estágio e registra no histórico atomicamente */
  async moverEstagio(id: string, dto: MoverEstagioDto) {
    const [lead] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id },
        data: {
          estagio: dto.estagio,
          ...(dto.estagio === 'FECHADO' || dto.estagio === 'PERDIDO'
            ? { fechadoEm: new Date() }
            : {}),
        },
        include: includeRel,
      }),
      this.prisma.estagioHistorico.create({
        data: {
          leadId: id,
          estagio: dto.estagio,
          notas: dto.notas,
        },
      }),
    ]);
    return sanitizeLead(lead);
  }

  async remove(id: string) {
    await this.prisma.lead.delete({ where: { id } });
    return { id, deleted: true };
  }
}
