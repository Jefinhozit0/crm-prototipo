import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstagioPipeline, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, diffCampos } from '../auditoria/auditoria.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeLead } from '../common/serializers';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { escopoLead, resolverResponsavel } from '../auth/escopo';
import { ClientesService } from '../clientes/clientes.service';
import type {
  ConverterLeadDto,
  LeadBoardQueryDto,
  LeadCreateDto,
  LeadQueryDto,
  LeadUpdateDto,
  MoverEstagioDto,
} from './dto/lead.schemas';

const includeRel = {
  responsavel: { select: { id: true, nome: true, email: true } },
  cliente: { select: { id: true, nome: true } },
} satisfies Prisma.LeadInclude;

const ESTAGIOS: EstagioPipeline[] = [
  'PROSPECCAO',
  'QUALIFICACAO',
  'PROPOSTA',
  'NEGOCIACAO',
  'FECHADO',
  'PERDIDO',
];

// Teto de cards no Kanban — acima disso, usar a listagem paginada
const LIMITE_BOARD = 500;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly clientes: ClientesService,
  ) {}

  async list(user: AuthUser, query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {
      ...escopoLead(user),
      ...(query.estagio && { estagio: query.estagio }),
      ...(query.responsavelId && user.role !== 'ASSESSOR' && { responsavelId: query.responsavelId }),
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
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: includeRel,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return buildPage(data.map(sanitizeLead), total, query);
  }

  /** Agrupa leads por estágio — alimenta o Kanban do Pipeline */
  async board(user: AuthUser, query: LeadBoardQueryDto) {
    const where: Prisma.LeadWhereInput = {
      ...escopoLead(user),
      ...(query.responsavelId && user.role !== 'ASSESSOR' && { responsavelId: query.responsavelId }),
    };
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: includeRel,
      take: LIMITE_BOARD,
    });

    return ESTAGIOS.map((estagio) => {
      const itens = leads.filter((l) => l.estagio === estagio).map(sanitizeLead);
      const total = itens.reduce((acc, l) => acc + l.valorEstimado, 0);
      return { estagio, total, count: itens.length, itens };
    });
  }

  async findById(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, ...escopoLead(user) },
      include: {
        ...includeRel,
        estagioHistorico: {
          orderBy: { criadoEm: 'desc' },
          take: 20,
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    return sanitizeLead(lead);
  }

  async create(user: AuthUser, dto: LeadCreateDto, ctx?: ContextoRequisicao) {
    const { responsavelId, ...rest } = dto;
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: { ...rest, responsavelId: resolverResponsavel(user, responsavelId) },
        include: includeRel,
      });
      await tx.estagioHistorico.create({
        data: { leadId: lead.id, estagio: lead.estagio, notas: 'Lead criado' },
      });
      await this.auditoria.registrarEm(tx, {
        acao: 'CRIACAO',
        entidade: 'Lead',
        entidadeId: lead.id,
        userId: user.id,
        diff: { estagio: lead.estagio, origem: lead.origem },
        contexto: ctx,
      });
      return sanitizeLead(lead);
    });
  }

  async update(user: AuthUser, id: string, dto: LeadUpdateDto, ctx?: ContextoRequisicao) {
    const antes = await this.garantirNoEscopo(user, id);
    const data: Prisma.LeadUncheckedUpdateInput = { ...dto };
    if (dto.responsavelId !== undefined) {
      data.responsavelId = resolverResponsavel(user, dto.responsavelId);
    }
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({ where: { id }, data, include: includeRel });
      const diff = diffCampos(antes, dto);
      if (Object.keys(diff.depois).length > 0) {
        await this.auditoria.registrarEm(tx, {
          acao: 'ATUALIZACAO',
          entidade: 'Lead',
          entidadeId: id,
          userId: user.id,
          diff,
          contexto: ctx,
        });
      }
      return sanitizeLead(lead);
    });
  }

  /** Move o lead pra outro estágio e registra no histórico atomicamente */
  async moverEstagio(user: AuthUser, id: string, dto: MoverEstagioDto, ctx?: ContextoRequisicao) {
    const antes = await this.garantirNoEscopo(user, id);
    if (antes.clienteId) {
      throw new ConflictException('Lead já convertido em cliente: o estágio fica como Fechado');
    }
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          estagio: dto.estagio,
          fechadoEm: dto.estagio === 'FECHADO' || dto.estagio === 'PERDIDO' ? new Date() : null,
        },
        include: includeRel,
      });
      await tx.estagioHistorico.create({
        data: { leadId: id, estagio: dto.estagio, notas: dto.notas },
      });
      await this.auditoria.registrarEm(tx, {
        acao: 'ATUALIZACAO',
        entidade: 'Lead',
        entidadeId: id,
        userId: user.id,
        diff: { antes: { estagio: antes.estagio }, depois: { estagio: dto.estagio } },
        contexto: ctx,
      });
      return sanitizeLead(lead);
    });
  }

  async remove(user: AuthUser, id: string, ctx?: ContextoRequisicao) {
    const antes = await this.garantirNoEscopo(user, id);
    // O lead convertido é a origem registrada do cliente — não some
    if (antes.clienteId) {
      throw new ConflictException('Lead já convertido em cliente não pode ser excluído');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.delete({ where: { id } });
      await this.auditoria.registrarEm(tx, {
        acao: 'EXCLUSAO',
        entidade: 'Lead',
        entidadeId: id,
        userId: user.id,
        diff: { nome: antes.nome, estagio: antes.estagio },
        contexto: ctx,
      });
    });
    return { id, deleted: true };
  }

  /**
   * Converte o lead em cliente numa única transação: cria o cliente (mesmas
   * regras do cadastro), vincula o lead, fecha o funil e registra o histórico.
   * O cliente herda o responsável do lead e nasce PROSPECTO, sem suitability.
   */
  async converter(user: AuthUser, id: string, dto: ConverterLeadDto, ctx?: ContextoRequisicao) {
    const lead = await this.garantirNoEscopo(user, id);
    if (lead.clienteId) throw new ConflictException('Este lead já foi convertido em cliente');
    if (lead.estagio === 'PERDIDO') {
      throw new UnprocessableEntityException(
        'Lead perdido não pode ser convertido. Mova-o de volta ao funil antes.',
      );
    }
    const email = dto.email ?? lead.email;
    if (!email) {
      throw new UnprocessableEntityException('Informe o e-mail: o lead não tem e-mail cadastrado');
    }

    return this.prisma.$transaction(async (tx) => {
      const cliente = await this.clientes.criarEm(
        tx,
        user,
        {
          ...dto,
          nome: dto.nome ?? lead.nome,
          email,
          telefone: dto.telefone ?? lead.telefone ?? undefined,
          patrimonio: dto.patrimonio ?? Number(lead.valorEstimado.toString()),
          perfil: 'MODERADO',
          status: 'PROSPECTO',
          responsavelId: lead.responsavelId ?? undefined,
        },
        ctx,
        lead.id,
      );
      const atualizado = await tx.lead.update({
        where: { id },
        data: {
          clienteId: cliente.id,
          estagio: 'FECHADO',
          fechadoEm: lead.fechadoEm ?? new Date(),
        },
        include: includeRel,
      });
      await tx.estagioHistorico.create({
        data: { leadId: id, estagio: 'FECHADO', notas: 'Convertido em cliente' },
      });
      await this.auditoria.registrarEm(tx, {
        acao: 'ATUALIZACAO',
        entidade: 'Lead',
        entidadeId: id,
        userId: user.id,
        diff: {
          antes: { estagio: lead.estagio, clienteId: null },
          depois: { estagio: 'FECHADO', clienteId: cliente.id },
        },
        contexto: ctx,
      });
      return { lead: sanitizeLead(atualizado), cliente };
    });
  }

  private async garantirNoEscopo(user: AuthUser, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, ...escopoLead(user) } });
    if (!lead) throw new NotFoundException('Lead não encontrado');
    return lead;
  }
}
