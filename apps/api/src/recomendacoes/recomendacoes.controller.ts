import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { RecomendacoesService } from './recomendacoes.service';
import {
  generateSchema,
  recomendacaoQuerySchema,
  recusarSchema,
  type GenerateDto,
  type RecomendacaoQueryDto,
  type RecusarDto,
} from './dto/recomendacao.schemas';

@Controller('recomendacoes')
export class RecomendacoesController {
  constructor(private readonly service: RecomendacoesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(recomendacaoQuerySchema)) query: RecomendacaoQueryDto,
  ) {
    return this.service.list(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body(new ZodValidationPipe(generateSchema)) body: GenerateDto) {
    return this.service.generate(body);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.aprovar(id, user.id);
  }

  @Patch(':id/recusar')
  recusar(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(recusarSchema)) body: RecusarDto,
  ) {
    return this.service.recusar(id, user.id, body);
  }
}
