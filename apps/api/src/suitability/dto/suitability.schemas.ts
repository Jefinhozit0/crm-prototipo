import { z } from 'zod';

export const aplicarSuitabilitySchema = z.object({
  clienteId: z.string().cuid(),
  // perguntaId → opcaoId. Conteúdo validado contra o questionário no service.
  respostas: z
    .record(z.string().max(40), z.string().max(10))
    .refine((r) => Object.keys(r).length <= 30, 'Respostas demais'),
});

export const suitabilityRecentesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AplicarSuitabilityDto = z.infer<typeof aplicarSuitabilitySchema>;
export type SuitabilityRecentesQueryDto = z.infer<typeof suitabilityRecentesQuerySchema>;
