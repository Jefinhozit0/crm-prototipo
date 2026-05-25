import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  perfilDePontuacao,
  pontuar,
  QUESTIONARIO,
  VERSAO,
} from './questionario';
import type { AplicarSuitabilityDto } from './dto/suitability.schemas';

@Injectable()
export class SuitabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devolve a estrutura do questionário pra renderizar no front */
  getQuestionario() {
    return {
      versao: VERSAO,
      perguntas: QUESTIONARIO,
    };
  }

  async aplicar(dto: AplicarSuitabilityDto, autorId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
      select: { id: true, perfil: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${dto.clienteId} não encontrado`);
    }

    let pontuacao: number;
    let detalhe: Record<string, unknown>;
    try {
      const r = pontuar(dto.respostas);
      pontuacao = r.pontuacao;
      detalhe = r.detalhe;
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Respostas inválidas',
      );
    }

    const perfilCalculado = perfilDePontuacao(pontuacao);
    const validoAte = new Date(Date.now() + 730 * 86400000); // 24 meses

    // Cria suitability + atualiza cliente.perfil em uma transação
    const [suitability] = await this.prisma.$transaction([
      this.prisma.suitability.create({
        data: {
          clienteId: dto.clienteId,
          respostas: {
            ...dto.respostas,
            _detalhe: detalhe,
          } as Prisma.InputJsonValue,
          pontuacao,
          perfilCalculado,
          versaoQuestionario: VERSAO,
          validoAte,
          aplicadoPorId: autorId,
        },
      }),
      this.prisma.cliente.update({
        where: { id: dto.clienteId },
        data: { perfil: perfilCalculado },
      }),
    ]);

    return {
      suitability,
      perfilAnterior: cliente.perfil,
      perfilNovo: perfilCalculado,
      mudou: cliente.perfil !== perfilCalculado,
    };
  }

  async historico(clienteId: string) {
    return this.prisma.suitability.findMany({
      where: { clienteId },
      orderBy: { aplicadoEm: 'desc' },
    });
  }

  async listarRecentes(limit = 20) {
    return this.prisma.suitability.findMany({
      take: limit,
      orderBy: { aplicadoEm: 'desc' },
      include: {
        cliente: { select: { id: true, nome: true, email: true } },
      },
    });
  }
}
