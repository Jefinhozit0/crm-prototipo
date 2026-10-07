import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService, diffCampos } from '../auditoria/auditoria.service';
import { buildPage, skipTake } from '../common/pagination';
import { sanitizeCliente } from '../common/serializers';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  escopoCliente,
  garantirClienteNoEscopo,
  resolverResponsavel,
} from '../auth/escopo';
import { hashCpf, hashCpfLegado, maskCpf } from './cpf';
import type {
  ClienteCreateDto,
  ClienteQueryDto,
  ClienteUpdateDto,
} from './dto/cliente.schemas';

const includeResponsavel = {
  responsavel: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.ClienteInclude;

// Só pra dev: em produção o boot falha sem CPF_HASH_SECRET (config/env.ts)
const SEGREDO_CPF_DEV = 'dev-somente-local-cpf-hash-secret';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser, query: ClienteQueryDto) {
    const where: Prisma.ClienteWhereInput = {
      ...escopoCliente(user),
      ...(query.perfil && { perfil: query.perfil }),
      ...(query.status && { status: query.status }),
      // Filtro por responsável só faz sentido pra quem vê a base toda
      ...(query.responsavelId && user.role !== 'ASSESSOR' && { responsavelId: query.responsavelId }),
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
    // id como desempate deixa a paginação estável quando o campo de ordenação empata
    const orderBy: Prisma.ClienteOrderByWithRelationInput[] = [
      { [sortField]: sortDir },
      { id: 'asc' },
    ];

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

  async findById(user: AuthUser, id: string) {
    await garantirClienteNoEscopo(this.prisma, user, id);
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id },
      include: includeResponsavel,
    });
    return sanitizeCliente(cliente);
  }

  /**
   * Cliente + carteira atual + última suitability + recomendações recentes.
   * Dado financeiro sensível: o acesso é registrado na auditoria.
   */
  async findDetalhado(user: AuthUser, id: string, ctx?: ContextoRequisicao) {
    await garantirClienteNoEscopo(this.prisma, user, id);
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
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
          select: {
            id: true,
            pontuacao: true,
            perfilCalculado: true,
            versaoQuestionario: true,
            validoAte: true,
            aplicadoEm: true,
            aplicadoPor: { select: { id: true, nome: true } },
          },
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

    await this.auditoria.registrar({
      acao: 'ACESSO_DADO_SENSIVEL',
      entidade: 'Cliente',
      entidadeId: id,
      userId: user.id,
      diff: { recurso: 'carteira_detalhada' },
      contexto: ctx,
    });

    const { suitability, posicoes, recomendacoes, ...rest } = cliente;
    const ultima = suitability[0];

    return {
      ...sanitizeCliente(rest),
      suitability: ultima
        ? { ...ultima, vencida: ultima.validoAte.getTime() <= Date.now() }
        : null,
      posicoes: posicoes.map((p) => ({
        id: p.id,
        produto: p.produto,
        valor: Number(p.valor.toString()),
        adquiridoEm: p.adquiridoEm,
      })),
      recomendacoes: recomendacoes.map(({ payload: _payload, ...r }) => ({
        ...r,
        // Pendente com prazo vencido é exibida como expirada (mesma regra de /recomendacoes)
        status:
          r.status === 'PENDENTE' && r.expiraEm && r.expiraEm.getTime() <= Date.now()
            ? ('EXPIRADA' as const)
            : r.status,
        score: Number(r.score.toString()),
      })),
    };
  }

  async create(user: AuthUser, dto: ClienteCreateDto, ctx?: ContextoRequisicao) {
    return this.prisma.$transaction((tx) => this.criarEm(tx, user, dto, ctx));
  }

  /**
   * Cria o cliente dentro de uma transação existente — usado também pela
   * conversão de lead, pra que cliente e lead mudem juntos ou nada mude.
   * `origemLeadId` só entra na auditoria.
   */
  async criarEm(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    dto: ClienteCreateDto,
    ctx?: ContextoRequisicao,
    origemLeadId?: string,
  ) {
    const { cpf, responsavelId, ...rest } = dto;
    const cpfHash = hashCpf(cpf, this.segredoCpf());

    // Duplicata também contra o formato legado (sha256 puro) de registros antigos
    const existente = await tx.cliente.findFirst({
      where: { cpfHash: { in: [cpfHash, hashCpfLegado(cpf)] } },
      select: { id: true },
    });
    if (existente) throw new ConflictException('Já existe um cliente com este CPF');

    const cliente = await tx.cliente.create({
      data: {
        ...rest,
        responsavelId: resolverResponsavel(user, responsavelId),
        cpfHash,
        cpfMasked: maskCpf(cpf),
      },
      include: includeResponsavel,
    });
    await this.auditoria.registrarEm(tx, {
      acao: 'CRIACAO',
      entidade: 'Cliente',
      entidadeId: cliente.id,
      userId: user.id,
      diff: {
        status: cliente.status,
        perfil: cliente.perfil,
        responsavelId: cliente.responsavelId,
        ...(origemLeadId && { origemLeadId }),
      },
      contexto: ctx,
    });
    return sanitizeCliente(cliente);
  }

  async update(user: AuthUser, id: string, dto: ClienteUpdateDto, ctx?: ContextoRequisicao) {
    const antes = await garantirClienteNoEscopo(this.prisma, user, id, {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      cidade: true,
      uf: true,
      patrimonio: true,
      status: true,
      responsavelId: true,
    });

    // Entrar ou sair de INATIVO equivale à exclusão lógica (DELETE), que é só do ADMIN
    const mudaStatus = dto.status !== undefined && dto.status !== antes.status;
    if (mudaStatus && (dto.status === 'INATIVO' || antes.status === 'INATIVO') && user.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas administradores podem inativar ou reativar clientes');
    }

    const data: Prisma.ClienteUncheckedUpdateInput = { ...dto };
    if (dto.responsavelId !== undefined) {
      data.responsavelId = resolverResponsavel(user, dto.responsavelId);
    }

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.update({
        where: { id },
        data,
        include: includeResponsavel,
      });
      const diff = diffCampos(antes, dto);
      if (Object.keys(diff.depois).length > 0) {
        await this.auditoria.registrarEm(tx, {
          acao: 'ATUALIZACAO',
          entidade: 'Cliente',
          entidadeId: id,
          userId: user.id,
          diff,
          contexto: ctx,
        });
      }
      return sanitizeCliente(cliente);
    });
  }

  /**
   * Exclusão LÓGICA: o cliente vira INATIVO. Suitability e recomendações são
   * registros que precisam ser retidos (CVM 30) — não podem ser apagados.
   */
  async remove(user: AuthUser, id: string, ctx?: ContextoRequisicao) {
    const antes = await garantirClienteNoEscopo(this.prisma, user, id, { id: true, status: true });
    await this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({ where: { id }, data: { status: 'INATIVO' } });
      await this.auditoria.registrarEm(tx, {
        acao: 'EXCLUSAO',
        entidade: 'Cliente',
        entidadeId: id,
        userId: user.id,
        diff: { tipo: 'logica', statusAnterior: antes.status, statusNovo: 'INATIVO' },
        contexto: ctx,
      });
    });
    return { id, inativado: true };
  }

  private segredoCpf(): string {
    return this.config.get<string>('CPF_HASH_SECRET') || SEGREDO_CPF_DEV;
  }
}
