import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  // Aceita schemas cujo input difere do output (ex.: campos com .default(), .coerce, transforms).
  constructor(private readonly schema: ZodType<T, any, any>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Erro de validação',
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}
