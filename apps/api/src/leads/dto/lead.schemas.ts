import { z } from 'zod';
import { EstagioPipeline } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

export const leadCreateSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).toLowerCase().optional(),
  telefone: z.string().trim().min(8).max(30).optional(),
  origem: z.string().trim().min(2).max(60),
  estagio: z.nativeEnum(EstagioPipeline).optional().default('PROSPECCAO'),
  valorEstimado: z.number().finite().min(0).max(1e15).optional().default(0),
  observacoes: z.string().max(2000).optional(),
  responsavelId: z.string().cuid().optional(),
});

// Estágio não muda por PATCH: só via POST /leads/:id/mover-estagio, que grava
// o histórico do funil.
export const leadUpdateSchema = leadCreateSchema
  .omit({ estagio: true })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar');

export const leadQuerySchema = paginationSchema.extend({
  estagio: z.nativeEnum(EstagioPipeline).optional(),
  responsavelId: z.string().cuid().optional(),
  origem: z.string().trim().min(1).max(60).optional(),
  q: z.string().trim().min(1).max(80).optional(),
});

export const leadBoardQuerySchema = z.object({
  responsavelId: z.string().cuid().optional(),
});

export const moverEstagioSchema = z.object({
  estagio: z.nativeEnum(EstagioPipeline),
  notas: z.string().max(500).optional(),
});

export type LeadCreateDto = z.infer<typeof leadCreateSchema>;
export type LeadUpdateDto = z.infer<typeof leadUpdateSchema>;
export type LeadQueryDto = z.infer<typeof leadQuerySchema>;
export type LeadBoardQueryDto = z.infer<typeof leadBoardQuerySchema>;
export type MoverEstagioDto = z.infer<typeof moverEstagioSchema>;
