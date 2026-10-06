import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { z, type ZodErrorMap, type ZodType } from 'zod';

/** Mensagens de validação em pt-BR (as mensagens customizadas dos schemas têm prioridade). */
export const errorMapPtBr: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === 'undefined') return { message: 'Campo obrigatório' };
      return { message: `Tipo inválido: esperado ${issue.expected}` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') return { message: 'E-mail inválido' };
      if (issue.validation === 'cuid') return { message: 'Identificador inválido' };
      if (issue.validation === 'url') return { message: 'URL inválida' };
      return { message: 'Formato inválido' };
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') return { message: `Mínimo de ${issue.minimum} caractere(s)` };
      if (issue.type === 'array') return { message: `Mínimo de ${issue.minimum} item(ns)` };
      return { message: `Valor mínimo: ${issue.minimum}` };
    case z.ZodIssueCode.too_big:
      if (issue.type === 'string') return { message: `Máximo de ${issue.maximum} caractere(s)` };
      if (issue.type === 'array') return { message: `Máximo de ${issue.maximum} item(ns)` };
      return { message: `Valor máximo: ${issue.maximum}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `Valor inválido. Opções: ${issue.options.join(', ')}` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Campo(s) não permitido(s): ${issue.keys.join(', ')}` };
    case z.ZodIssueCode.invalid_date:
      return { message: 'Data inválida' };
    case z.ZodIssueCode.not_finite:
      return { message: 'Número inválido' };
    default:
      return { message: ctx.defaultError };
  }
};

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  // Aceita schemas cujo input difere do output (ex.: campos com .default(), .coerce, transforms).
  constructor(private readonly schema: ZodType<T, any, any>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value, { errorMap: errorMapPtBr });
    if (!result.success) {
      throw new BadRequestException({
        message: 'Erro de validação',
        error: 'Bad Request',
        errors: result.error.flatten(),
      });
    }
    return result.data;
  }
}
