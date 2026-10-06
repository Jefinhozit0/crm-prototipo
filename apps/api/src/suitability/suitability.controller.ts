import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { contextoDaRequisicao } from '../common/request-context';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { SuitabilityService } from './suitability.service';
import {
  aplicarSuitabilitySchema,
  suitabilityRecentesQuerySchema,
  type AplicarSuitabilityDto,
  type SuitabilityRecentesQueryDto,
} from './dto/suitability.schemas';

@Controller('suitability')
export class SuitabilityController {
  constructor(private readonly service: SuitabilityService) {}

  /** Retorna as perguntas + opções pra renderizar o form (sem a pontuação) */
  @Get('questionario')
  questionario() {
    return this.service.getQuestionario();
  }

  /** Suitabilities mais recentes dentro do escopo do usuário */
  @Get()
  listarRecentes(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(suitabilityRecentesQuerySchema)) query: SuitabilityRecentesQueryDto,
  ) {
    return this.service.listarRecentes(user, query.limit);
  }

  /** Histórico de suitabilities de um cliente específico */
  @Get('cliente/:clienteId')
  historico(
    @CurrentUser() user: AuthUser,
    @Param('clienteId', IdParamPipe) clienteId: string,
  ) {
    return this.service.historico(user, clienteId);
  }

  /** Aplica o suitability: calcula score, define perfil, atualiza cliente */
  @Post()
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.CREATED)
  aplicar(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(aplicarSuitabilitySchema)) body: AplicarSuitabilityDto,
    @Req() req: Request,
  ) {
    return this.service.aplicar(user, body, contextoDaRequisicao(req));
  }
}
