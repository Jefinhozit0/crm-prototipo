import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { auditoriaQuerySchema, type AuditoriaQueryDto } from './auditoria.schemas';

@Controller('auditoria')
@Roles('ADMIN', 'COMPLIANCE')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  listar(@Query(new ZodValidationPipe(auditoriaQuerySchema)) query: AuditoriaQueryDto) {
    return this.service.listar(query);
  }
}
