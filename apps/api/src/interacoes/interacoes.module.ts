import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Prisma, TipoInteracao } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { buildPage, paginationSchema, skipTake } from '../common/pagination';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { escopoCliente } from '../auth/escopo';

const interacaoQuerySchema = paginationSchema.extend({
  clienteId: z.string().cuid().optional(),
  tipo: z.nativeEnum(TipoInteracao).optional(),
});
type InteracaoQueryDto = z.infer<typeof interacaoQuerySchema>;

@Injectable()
export class InteracoesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Linha do tempo de interações (somente leitura), no escopo do usuário */
  async list(user: AuthUser, q: InteracaoQueryDto) {
    const where: Prisma.InteracaoWhereInput = {
      cliente: escopoCliente(user),
      ...(q.clienteId && { clienteId: q.clienteId }),
      ...(q.tipo && { tipo: q.tipo }),
    };
    const [data, total] = await Promise.all([
      this.prisma.interacao.findMany({
        where,
        ...skipTake(q),
        orderBy: [{ data: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          tipo: true,
          assunto: true,
          resumo: true,
          data: true,
          cliente: { select: { id: true, nome: true } },
          autor: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.interacao.count({ where }),
    ]);
    return buildPage(data, total, q);
  }
}

@Controller('interacoes')
export class InteracoesController {
  constructor(private readonly service: InteracoesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(interacaoQuerySchema)) query: InteracaoQueryDto,
  ) {
    return this.service.list(user, query);
  }
}

@Module({
  controllers: [InteracoesController],
  providers: [InteracoesService],
})
export class InteracoesModule {}
