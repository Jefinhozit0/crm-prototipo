import { z } from 'zod';
import { StatusRecomendacao } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

export const generateSchema = z.object({
  clienteId: z.string().cuid(),
  topN: z.number().int().min(1).max(10).optional().default(3),
});

export const recomendacaoQuerySchema = paginationSchema.extend({
  clienteId: z.string().cuid().optional(),
  status: z.nativeEnum(StatusRecomendacao).optional(),
});

export const recusarSchema = z.object({
  motivo: z.string().min(3).max(500),
});

export type GenerateDto = z.infer<typeof generateSchema>;
export type RecomendacaoQueryDto = z.infer<typeof recomendacaoQuerySchema>;
export type RecusarDto = z.infer<typeof recusarSchema>;
