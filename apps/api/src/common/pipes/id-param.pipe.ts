import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// IDs gerados pelo Prisma com @default(cuid()): "c" + 24 caracteres [a-z0-9]
const CUID = /^c[a-z0-9]{20,32}$/;

/** Valida :id de rota antes de chegar no banco. Uso: @Param('id', IdParamPipe) */
@Injectable()
export class IdParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID.test(value)) {
      throw new BadRequestException('Identificador inválido');
    }
    return value;
  }
}
