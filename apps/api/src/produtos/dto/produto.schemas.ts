import { z } from 'zod';
import { CategoriaProduto, PerfilInvestidor } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

export const produtoCreateSchema = z.object({
  nome: z.string().min(2).max(120),
  emissor: z.string().min(2).max(120),
  categoria: z.nativeEnum(CategoriaProduto),
  rentabilidadeAno: z.number().min(-100).max(1000),
  risco: z.number().int().min(1).max(5),
  perfilMinimo: z.nativeEnum(PerfilInvestidor),
  liquidez: z.string().min(1).max(30),
  taxaAdmin: z.number().min(0).max(100).optional(),
  taxaPerformance: z.number().min(0).max(100).optional(),
  ticker: z.string().min(2).max(30).optional(),
  ativo: z.boolean().optional().default(true),
  descricao: z.string().max(2000).optional(),
});

export const produtoUpdateSchema = produtoCreateSchema.partial();

export const produtoQuerySchema = paginationSchema.extend({
  categoria: z.nativeEnum(CategoriaProduto).optional(),
  perfilMinimo: z.nativeEnum(PerfilInvestidor).optional(),
  ativo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  riscoMax: z.coerce.number().int().min(1).max(5).optional(),
  q: z.string().min(1).max(80).optional(), // busca por nome/emissor/ticker
});

export type ProdutoCreateDto = z.infer<typeof produtoCreateSchema>;
export type ProdutoUpdateDto = z.infer<typeof produtoUpdateSchema>;
export type ProdutoQueryDto = z.infer<typeof produtoQuerySchema>;
