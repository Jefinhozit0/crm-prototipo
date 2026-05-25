import { z } from 'zod';

export const aplicarSuitabilitySchema = z.object({
  clienteId: z.string().cuid(),
  respostas: z.record(z.string(), z.string()),
});

export type AplicarSuitabilityDto = z.infer<typeof aplicarSuitabilitySchema>;
