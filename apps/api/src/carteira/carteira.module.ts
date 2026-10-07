import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { contextoDaRequisicao } from '../common/request-context';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CarteiraService } from './carteira.service';
import {
  movimentacaoCreateSchema,
  movimentacaoQuerySchema,
  seriesQuerySchema,
  type MovimentacaoCreateDto,
  type MovimentacaoQueryDto,
  type SeriesQueryDto,
} from './dto/movimentacao.schemas';

@Controller()
export class CarteiraController {
  constructor(private readonly service: CarteiraService) {}

  @Get('clientes/:id/movimentacoes')
  listar(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Query(new ZodValidationPipe(movimentacaoQuerySchema)) query: MovimentacaoQueryDto,
  ) {
    return this.service.listar(user, id, query);
  }

  /** Aplicação ou resgate — atualiza a posição na mesma transação */
  @Post('clientes/:id/movimentacoes')
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.CREATED)
  registrar(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(movimentacaoCreateSchema)) body: MovimentacaoCreateDto,
    @Req() req: Request,
  ) {
    return this.service.registrar(user, id, body, contextoDaRequisicao(req));
  }

  /** Evolução mensal (patrimônio aplicado e captação) no escopo do usuário */
  @Get('carteira/series')
  series(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(seriesQuerySchema)) query: SeriesQueryDto,
  ) {
    return this.service.series(user, query);
  }
}

@Module({
  controllers: [CarteiraController],
  providers: [CarteiraService],
})
export class CarteiraModule {}
