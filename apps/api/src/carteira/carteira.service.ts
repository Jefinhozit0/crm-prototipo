import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type PerfilInvestidor, type TipoMovimentacao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { buildPage, skipTake } from '../common/pagination';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { escopoCliente, garantirClienteNoEscopo } from '../auth/escopo';
import { produtoAdequadoAoPerfil } from '../recomendacoes/regras';
import type {
  MovimentacaoCreateDto,
  MovimentacaoQueryDto,
  SeriesQueryDto,
} from './dto/movimentacao.schemas';

const includeMovimentacao = {
  produto: { select: { id: true, nome: true, categoria: true, emissor: true } },
  registradoPor: { select: { id: true, nome: true } },
} satisfies Prisma.MovimentacaoInclude;

type MovimentacaoComRelacoes = Prisma.MovimentacaoGetPayload<{ include: typeof includeMovimentacao }>;

function serializar(m: MovimentacaoComRelacoes) {
  return { ...m, valor: Number(m.valor.toString()) };
}

/** Sinal da movimentação no saldo: resgate subtrai, o resto soma */
function comSinal(tipo: TipoMovimentacao, valor: Prisma.Decimal) {
  return tipo === 'RESGATE' ? valor.negated() : valor;
}

// São Paulo não tem horário de verão desde 2019: o mês começa às 03:00 UTC.
const OFFSET_SP_HORAS = 3;

/** "2026-10" do instante, no fuso de São Paulo */
function mesSP(d: Date): string {
  const local = new Date(d.getTime() - OFFSET_SP_HORAS * 3_600_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Os últimos `n` meses (mais antigo primeiro) e o instante em que o primeiro começa */
function janelaDeMeses(n: number, agora = new Date()) {
  const local = new Date(agora.getTime() - OFFSET_SP_HORAS * 3_600_000);
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - i, 1));
    meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const [ano, mes] = meses[0].split('-').map(Number);
  return { meses, inicio: new Date(Date.UTC(ano, mes - 1, 1, OFFSET_SP_HORAS)) };
}

@Injectable()
export class CarteiraService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(user: AuthUser, clienteId: string, query: MovimentacaoQueryDto) {
    await garantirClienteNoEscopo(this.prisma, user, clienteId);
    const where: Prisma.MovimentacaoWhereInput = { clienteId };
    const [data, total] = await Promise.all([
      this.prisma.movimentacao.findMany({
        where,
        ...skipTake(query),
        orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }, { id: 'asc' }],
        include: includeMovimentacao,
      }),
      this.prisma.movimentacao.count({ where }),
    ]);
    return buildPage(data.map(serializar), total, query);
  }

  /**
   * Registra aplicação ou resgate e atualiza a posição na mesma transação.
   * A posição é sempre a soma das movimentações — nunca é editada direto.
   */
  async registrar(user: AuthUser, clienteId: string, dto: MovimentacaoCreateDto, ctx?: ContextoRequisicao) {
    return this.prisma.$transaction(async (tx) => {
      const cliente = await garantirClienteNoEscopo(tx, user, clienteId, { id: true, status: true });
      if (cliente.status === 'BLOQUEADO') {
        throw new UnprocessableEntityException('Cliente bloqueado não pode movimentar a carteira');
      }
      const produto = await tx.produto.findUnique({
        where: { id: dto.produtoId },
        select: { id: true, ativo: true, perfilMinimo: true },
      });
      if (!produto) throw new NotFoundException('Produto não encontrado');

      const data = dto.data ?? new Date();
      const chave = { clienteId_produtoId: { clienteId, produtoId: produto.id } };
      let desenquadrada: { motivo: string | null } = { motivo: null };
      let ativouCliente = false;

      if (dto.tipo === 'APLICACAO') {
        if (cliente.status === 'INATIVO') {
          throw new UnprocessableEntityException('Cliente inativo não recebe aplicações. Reative o cliente antes.');
        }
        if (!produto.ativo) {
          throw new UnprocessableEntityException('Produto desativado do catálogo não recebe aplicações');
        }

        desenquadrada = await this.desenquadrada(tx, clienteId, produto.perfilMinimo);
        if (desenquadrada.motivo && !dto.cienciaDesenquadramento) {
          throw new UnprocessableEntityException({
            message: `${desenquadrada.motivo} Registre a ciência do cliente para aplicar mesmo assim.`,
            code: 'DESENQUADRAMENTO',
          });
        }

        if (dto.recomendacaoId) {
          await this.executarRecomendacao(tx, dto.recomendacaoId, clienteId, produto.id);
        }

        await tx.posicao.upsert({
          where: chave,
          create: { clienteId, produtoId: produto.id, valor: dto.valor, adquiridoEm: data },
          update: { valor: { increment: dto.valor } },
        });

        // Dinheiro aplicado na casa: o prospecto vira cliente ativo
        if (cliente.status === 'PROSPECTO') {
          await tx.cliente.update({ where: { id: clienteId }, data: { status: 'ATIVO' } });
          ativouCliente = true;
        }
      } else {
        // Condicional e atômico: duas requisições simultâneas não deixam saldo negativo
        const { count } = await tx.posicao.updateMany({
          where: { clienteId, produtoId: produto.id, valor: { gte: dto.valor } },
          data: { valor: { decrement: dto.valor } },
        });
        if (count === 0) {
          const posicao = await tx.posicao.findUnique({ where: chave, select: { valor: true } });
          throw new UnprocessableEntityException(
            posicao
              ? `Saldo insuficiente: a posição neste produto é de R$ ${formatarBRL(posicao.valor)}`
              : 'O cliente não tem posição neste produto',
          );
        }
        // Resgate total encerra a posição
        await tx.posicao.deleteMany({ where: { clienteId, produtoId: produto.id, valor: { lte: 0 } } });
      }

      const mov = await tx.movimentacao.create({
        data: {
          clienteId,
          produtoId: produto.id,
          tipo: dto.tipo,
          valor: dto.valor,
          data,
          observacao: dto.observacao,
          desenquadrada: !!desenquadrada.motivo,
          recomendacaoId: dto.recomendacaoId,
          registradoPorId: user.id,
        },
        include: includeMovimentacao,
      });

      await this.auditoria.registrarEm(tx, {
        acao: 'CRIACAO',
        entidade: 'Movimentacao',
        entidadeId: mov.id,
        userId: user.id,
        diff: {
          clienteId,
          produtoId: produto.id,
          tipo: dto.tipo,
          valor: dto.valor,
          data: data.toISOString(),
          ...(desenquadrada.motivo && { desenquadrada: true, motivoDesenquadramento: desenquadrada.motivo }),
          ...(dto.recomendacaoId && { recomendacaoId: dto.recomendacaoId }),
        },
        contexto: ctx,
      });
      if (ativouCliente) {
        await this.auditoria.registrarEm(tx, {
          acao: 'ATUALIZACAO',
          entidade: 'Cliente',
          entidadeId: clienteId,
          userId: user.id,
          diff: { antes: { status: 'PROSPECTO' }, depois: { status: 'ATIVO' }, motivo: 'primeira aplicação' },
          contexto: ctx,
        });
      }

      return serializar(mov);
    });
  }

  /**
   * Evolução mensal da carteira no escopo do usuário: patrimônio aplicado ao
   * fim de cada mês (valor de custo) e captação (aplicações e resgates do mês;
   * saldo inicial não é captação). Meses no fuso de São Paulo.
   */
  async series(user: AuthUser, query: SeriesQueryDto) {
    const { meses, inicio } = janelaDeMeses(query.meses);
    const noEscopo: Prisma.MovimentacaoWhereInput = { cliente: escopoCliente(user) };
    const select = { tipo: true, valor: true, data: true } as const;

    const [anteriores, doPeriodo] = await Promise.all([
      this.prisma.movimentacao.findMany({ where: { ...noEscopo, data: { lt: inicio } }, select }),
      this.prisma.movimentacao.findMany({ where: { ...noEscopo, data: { gte: inicio } }, select }),
    ]);

    const zero = new Prisma.Decimal(0);
    let saldo = anteriores.reduce((acc, m) => acc.plus(comSinal(m.tipo, m.valor)), zero);
    const porMes = new Map(meses.map((m) => [m, { liquido: zero, entradas: zero, saidas: zero }]));
    for (const m of doPeriodo) {
      const b = porMes.get(mesSP(m.data));
      if (!b) continue; // data futura (não deveria existir)
      b.liquido = b.liquido.plus(comSinal(m.tipo, m.valor));
      if (m.tipo === 'APLICACAO') b.entradas = b.entradas.plus(m.valor);
      if (m.tipo === 'RESGATE') b.saidas = b.saidas.plus(m.valor);
    }

    return {
      base: 'custo' as const,
      meses: meses.map((mes) => {
        const b = porMes.get(mes)!;
        saldo = saldo.plus(b.liquido);
        return {
          mes,
          patrimonioAplicado: saldo.toNumber(),
          entradas: b.entradas.toNumber(),
          saidas: b.saidas.toNumber(),
          captacaoLiquida: b.entradas.minus(b.saidas).toNumber(),
        };
      }),
    };
  }

  /** Motivo do desenquadramento (CVM 30), ou { motivo: null } se a aplicação é adequada */
  private async desenquadrada(
    tx: Prisma.TransactionClient,
    clienteId: string,
    perfilMinimo: PerfilInvestidor,
  ): Promise<{ motivo: string | null }> {
    const suit = await tx.suitability.findFirst({
      where: { clienteId },
      orderBy: { aplicadoEm: 'desc' },
      select: { validoAte: true, perfilCalculado: true },
    });
    if (!suit) return { motivo: 'O cliente não tem suitability aplicada.' };
    if (suit.validoAte.getTime() <= Date.now()) return { motivo: 'A suitability do cliente está vencida.' };
    if (!produtoAdequadoAoPerfil(perfilMinimo, suit.perfilCalculado)) {
      return { motivo: 'O produto está acima do perfil do cliente.' };
    }
    return { motivo: null };
  }

  /** Aprovada → ATIVA. Condicional: a mesma recomendação não é executada duas vezes. */
  private async executarRecomendacao(
    tx: Prisma.TransactionClient,
    recomendacaoId: string,
    clienteId: string,
    produtoId: string,
  ) {
    const rec = await tx.recomendacao.findFirst({
      where: { id: recomendacaoId, clienteId },
      select: { produtoId: true },
    });
    if (!rec) throw new NotFoundException('Recomendação não encontrada para este cliente');
    if (rec.produtoId !== produtoId) {
      throw new UnprocessableEntityException('A recomendação é de outro produto');
    }
    const { count } = await tx.recomendacao.updateMany({
      where: { id: recomendacaoId, status: 'APROVADA' },
      data: { status: 'ATIVA' },
    });
    if (count === 0) {
      throw new ConflictException('Só uma recomendação aprovada (e ainda não executada) pode ser vinculada');
    }
  }
}

function formatarBRL(v: Prisma.Decimal) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v.toNumber());
}
