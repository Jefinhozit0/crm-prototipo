import { z } from 'zod';
import { EstagioPipeline } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

export const leadCreateSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().toLowerCase().optional(),
  telefone: z.string().min(8).max(30).optional(),
  origem: z.string().min(2).max(60),
  estagio: z.nativeEnum(EstagioPipeline).optional().default('PROSPECCAO'),
  valorEstimado: z.number().min(0).optional().default(0),
  observacoes: z.string().max(2000).optional(),
  responsavelId: z.string().cuid().optional(),
});

export const leadUpdateSchema = leadCreateSchema.partial();

export const leadQuerySchema = paginationSchema.extend({
  estagio: z.nativeEnum(EstagioPipeline).optional(),
  responsavelId: z.string().cuid().optional(),
  origem: z.string().min(1).max(60).optional(),
  q: z.string().min(1).max(80).optional(),
});

export const moverEstagioSchema = z.object({
  estagio: z.nativeEnum(EstagioPipeline),
  notas: z.string().max(500).optional(),
});

export type LeadCreateDto = z.infer<typeof leadCreateSchema>;
export type LeadUpdateDto = z.infer<typeof leadUpdateSchema>;
export type LeadQueryDto = z.infer<typeof leadQuerySchema>;
export type MoverEstagioDto = z.infer<typeof moverEstagioSchema>;
