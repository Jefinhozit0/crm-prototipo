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
    @Query(new ZodValidationPipe(clienteQuerySchema)) query: ClienteQueryDto,
  ) {
    return this.service.list(query);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  /** Cliente + carteira + suitability + recomendações em uma única request */
  @Get(':id/detalhado')
  findDetalhado(@Param('id') id: string) {
    return this.service.findDetalhado(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(clienteCreateSchema)) body: ClienteCreateDto,
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(clienteUpdateSchema)) body: ClienteUpdateDto,
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
