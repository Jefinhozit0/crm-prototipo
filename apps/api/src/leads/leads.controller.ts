import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { IdParamPipe } from '../common/pipes/id-param.pipe';
import { contextoDaRequisicao } from '../common/request-context';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeadsService } from './leads.service';
import {
  converterLeadSchema,
  leadBoardQuerySchema,
  leadCreateSchema,
  leadQuerySchema,
  leadUpdateSchema,
  moverEstagioSchema,
  type ConverterLeadDto,
  type LeadBoardQueryDto,
  type LeadCreateDto,
  type LeadQueryDto,
  type LeadUpdateDto,
  type MoverEstagioDto,
} from './dto/lead.schemas';

@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(leadQuerySchema)) query: LeadQueryDto,
  ) {
    return this.service.list(user, query);
  }

  @Get('board')
  board(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(leadBoardQuerySchema)) query: LeadBoardQueryDto,
  ) {
    return this.service.board(user, query);
  }

  @Get(':id')
  findById(@CurrentUser() user: AuthUser, @Param('id', IdParamPipe) id: string) {
    return this.service.findById(user, id);
  }

  @Post()
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(leadCreateSchema)) body: LeadCreateDto,
    @Req() req: Request,
  ) {
    return this.service.create(user, body, contextoDaRequisicao(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'ASSESSOR')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(leadUpdateSchema)) body: LeadUpdateDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, body, contextoDaRequisicao(req));
  }

  @Post(':id/mover-estagio')
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.OK)
  moverEstagio(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(moverEstagioSchema)) body: MoverEstagioDto,
    @Req() req: Request,
  ) {
    return this.service.moverEstagio(user, id, body, contextoDaRequisicao(req));
  }

  /** Converte em cliente (cria o cliente e fecha o lead na mesma transação) */
  @Post(':id/converter')
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.CREATED)
  converter(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(converterLeadSchema)) body: ConverterLeadDto,
    @Req() req: Request,
  ) {
    return this.service.converter(user, id, body, contextoDaRequisicao(req));
  }

  @Delete(':id')
  @Roles('ADMIN', 'ASSESSOR')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.remove(user, id, contextoDaRequisicao(req));
  }
}
