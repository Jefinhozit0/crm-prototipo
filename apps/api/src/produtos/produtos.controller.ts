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
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
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
  list(
    @Query(new ZodValidationPipe(produtoQuerySchema)) query: ProdutoQueryDto,
  ) {
    return this.service.list(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(produtoCreateSchema)) body: ProdutoCreateDto,
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(produtoUpdateSchema)) body: ProdutoUpdateDto,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
