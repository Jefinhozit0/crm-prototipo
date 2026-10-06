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
import { ClientesService } from './clientes.service';
import {
  clienteCreateSchema,
  clienteQuerySchema,
  clienteUpdateSchema,
  type ClienteCreateDto,
  type ClienteQueryDto,
  type ClienteUpdateDto,
} from './dto/cliente.schemas';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(clienteQuerySchema)) query: ClienteQueryDto,
  ) {
    return this.service.list(user, query);
  }

  @Get(':id')
  findById(@CurrentUser() user: AuthUser, @Param('id', IdParamPipe) id: string) {
    return this.service.findById(user, id);
  }

  /** Cliente + carteira + suitability + recomendações em uma única request */
  @Get(':id/detalhado')
  findDetalhado(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.findDetalhado(user, id, contextoDaRequisicao(req));
  }

  @Post()
  @Roles('ADMIN', 'ASSESSOR')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(clienteCreateSchema)) body: ClienteCreateDto,
    @Req() req: Request,
  ) {
    return this.service.create(user, body, contextoDaRequisicao(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'ASSESSOR')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(clienteUpdateSchema)) body: ClienteUpdateDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, body, contextoDaRequisicao(req));
  }

  /** Exclusão lógica (inativa) — restrita a administradores */
  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.remove(user, id, contextoDaRequisicao(req));
  }
}
