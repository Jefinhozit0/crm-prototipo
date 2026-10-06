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
import { ProdutosService } from './produtos.service';
import {
  produtoCreateSchema,
  produtoQuerySchema,
  produtoUpdateSchema,
  type ProdutoCreateDto,
  type ProdutoQueryDto,
  type ProdutoUpdateDto,
} from './dto/produto.schemas';

@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  list(@Query(new ZodValidationPipe(produtoQuerySchema)) query: ProdutoQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findById(@Param('id', IdParamPipe) id: string) {
    return this.service.findById(id);
  }

  // Catálogo é curado pela área de produtos — assessor só consulta
  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(produtoCreateSchema)) body: ProdutoCreateDto,
    @Req() req: Request,
  ) {
    return this.service.create(user, body, contextoDaRequisicao(req));
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Body(new ZodValidationPipe(produtoUpdateSchema)) body: ProdutoUpdateDto,
    @Req() req: Request,
  ) {
    return this.service.update(user, id, body, contextoDaRequisicao(req));
  }

  /** Desativa o produto (exclusão lógica) */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', IdParamPipe) id: string,
    @Req() req: Request,
  ) {
    return this.service.remove(user, id, contextoDaRequisicao(req));
  }
}
