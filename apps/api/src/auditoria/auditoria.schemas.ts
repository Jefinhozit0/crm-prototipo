import { z } from 'zod';
import { AcaoAuditoria } from '@prisma/client';
import { paginationSchema } from '../common/pagination';

export const auditoriaQuerySchema = paginationSchema.extend({
  acao: z.nativeEnum(AcaoAuditoria).optional(),
  entidade: z.string().min(1).max(60).optional(),
  entidadeId: z.string().min(1).max(64).optional(),
  userId: z.string().cuid().optional(),
  de: z.coerce.date().optional(),
  ate: z.coerce.date().optional(),
});

export type AuditoriaQueryDto = z.infer<typeof auditoriaQuerySchema>;
