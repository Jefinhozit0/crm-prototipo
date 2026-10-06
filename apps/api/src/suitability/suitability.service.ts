import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { ContextoRequisicao } from '../common/request-context';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { escopoCliente, garantirClienteNoEscopo } from '../auth/escopo';
import {
  perfilDePontuacao,
  pontuar,
  QUESTIONARIO,
  VERSAO,
} from './questionario';
import type { AplicarSuitabilityDto } from './dto/suitability.schemas';

/** Validade da avaliação de perfil (prática de mercado: 24 meses). */
export const VALIDADE_SUITABILITY_MESES = 24;

export function calcularValidade(aplicadoEm: Date): Date {
  const d = new Date(aplicadoEm);
  d.setMonth(d.getMonth() + VALIDADE_SUITABILITY_MESES);
  return d;
}

@Injectable()
export class SuitabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Estrutura do questionário pro front. A pontuação de cada opção NÃO é
   * enviada: exibir os pontos durante a aplicação induz a resposta "que dá o
   * perfil desejado" e compromete a validade da suitability.
   */
  getQuestionario() {
    return {
      versao: VERSAO,
      perguntas: QUESTIONARIO.map((p) => ({
        ...p,
        opcoes: p.opcoes.map(({ id, label }) => ({ id, label })),
      })),
    };
  }

  async aplicar(user: AuthUser, dto: AplicarSuitabilityDto, ctx?: ContextoRequisicao) {
    const cliente = await garantirClienteNoEscopo(this.prisma, user, dto.clienteId, {
      id: true,
      perfil: true,
    });

    let pontuacao: number;
    let detalhe: Record<string, unknown>;
    try {
      const r = pontuar(dto.respostas);
      pontuacao = r.pontuacao;
      detalhe = r.detalhe;
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Respostas inválidas');
    }

    const perfilCalculado = perfilDePontuacao(pontuacao);
    const aplicadoEm = new Date();
    const validoAte = calcularValidade(aplicadoEm);

    // Só as perguntas do questionário são persistidas (ignora chaves extras)
    const respostasValidas = Object.fromEntries(
      QUESTIONARIO.map((p) => [p.id, dto.respostas[p.id]]),
    );

    // Suitability + perfil do cliente + auditoria: tudo ou nada
    const suitability = await this.prisma.$transaction(async (tx) => {
      const s = await tx.suitability.create({
        data: {
          clienteId: dto.clienteId,
          respostas: { ...respostasValidas, _detalhe: detalhe } as Prisma.InputJsonValue,
          pontuacao,
          perfilCalculado,
          versaoQuestionario: VERSAO,
          aplicadoEm,
          validoAte,
          aplicadoPorId: user.id,
        },
      });
      await tx.cliente.update({
        where: { id: dto.clienteId },
        data: { perfil: perfilCalculado },
      });
      await this.auditoria.registrarEm(tx, {
        acao: 'APLICACAO_SUITABILITY',
        entidade: 'Suitability',
        entidadeId: s.id,
        userId: user.id,
        diff: {
          clienteId: dto.clienteId,
          versaoQuestionario: VERSAO,
          pontuacao,
          perfilAnterior: cliente.perfil,
          perfilNovo: perfilCalculado,
        },
        contexto: ctx,
      });
      return s;
    });

    return {
      suitability,
      perfilAnterior: cliente.perfil,
      perfilNovo: perfilCalculado,
      mudou: cliente.perfil !== perfilCalculado,
    };
  }

  async historico(user: AuthUser, clienteId: string) {
    await garantirClienteNoEscopo(this.prisma, user, clienteId);
    return this.prisma.suitability.findMany({
      where: { clienteId },
      orderBy: { aplicadoEm: 'desc' },
      include: { aplicadoPor: { select: { id: true, nome: true } } },
    });
  }

  async listarRecentes(user: AuthUser, limit: number) {
    return this.prisma.suitability.findMany({
      where: { cliente: escopoCliente(user) },
      take: limit,
      orderBy: { aplicadoEm: 'desc' },
      select: {
        id: true,
        pontuacao: true,
        perfilCalculado: true,
        versaoQuestionario: true,
        validoAte: true,
        aplicadoEm: true,
        cliente: { select: { id: true, nome: true, email: true } },
      },
    });
  }
}
