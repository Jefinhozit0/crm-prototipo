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
import { LeadsService } from './leads.service';
import {
  leadCreateSchema,
  leadQuerySchema,
  leadUpdateSchema,
  moverEstagioSchema,
  type LeadCreateDto,
  type LeadQueryDto,
  type LeadUpdateDto,
  type MoverEstagioDto,
} from './dto/lead.schemas';

@Controller('leads')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(leadQuerySchema)) query: LeadQueryDto) {
    return this.service.list(query);
  }

  @Get('board')
  board(@Query('responsavelId') responsavelId?: string) {
    return this.service.board(responsavelId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(leadCreateSchema)) body: LeadCreateDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(leadUpdateSchema)) body: LeadUpdateDto,
  ) {
    return this.service.update(id, body);
  }

  @Post(':id/mover-estagio')
  moverEstagio(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moverEstagioSchema)) body: MoverEstagioDto,
  ) {
    return this.service.moverEstagio(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
