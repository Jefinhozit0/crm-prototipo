import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { SuitabilityService } from './suitability.service';
import {
  aplicarSuitabilitySchema,
  type AplicarSuitabilityDto,
} from './dto/suitability.schemas';

@Controller('suitability')
export class SuitabilityController {
  constructor(private readonly service: SuitabilityService) {}

  /** Retorna as 10 perguntas + opções pra renderizar o form */
  @Get('questionario')
  questionario() {
    return this.service.getQuestionario();
  }

  /** Lista as suitabilities mais recentes (todas as clientes) */
  @Get()
  listarRecentes(@Query('limit') limit?: string) {
    return this.service.listarRecentes(limit ? Number(limit) : 20);
  }

  /** Histórico de suitabilities de um cliente específico */
  @Get('cliente/:clienteId')
  historico(@Param('clienteId') clienteId: string) {
    return this.service.historico(clienteId);
  }

  /** Aplica o suitability: calcula score, define perfil, atualiza cliente */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  aplicar(
    @Body(new ZodValidationPipe(aplicarSuitabilitySchema)) body: AplicarSuitabilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.aplicar(body, user.id);
  }
}
