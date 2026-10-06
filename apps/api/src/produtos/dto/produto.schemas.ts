import { z } from 'zod';
import { CategoriaProduto, PerfilInvestidor, Tributacao } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

// Liquidez no formato que o motor entende: "D+0", "D+30", "No vencimento"...
const liquidezSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .refine(
    (v) => /^d\+\d{1,4}$/i.test(v) || /vencimento/i.test(v),
    'Liquidez deve ser "D+N" (ex.: D+30) ou conter "vencimento"',
  );

export const produtoCreateSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  emissor: z.string().trim().min(2).max(120),
  categoria: z.nativeEnum(CategoriaProduto),
  rentabilidadeAno: z.number().finite().min(-100).max(1000),
  risco: z.number().int().min(1).max(5),
  tributacao: z.nativeEnum(Tributacao).optional().default('TRIBUTADO'),
  perfilMinimo: z.nativeEnum(PerfilInvestidor),
  liquidez: liquidezSchema,
  taxaAdmin: z.number().finite().min(0).max(100).nullable().optional(),
  taxaPerformance: z.number().finite().min(0).max(100).nullable().optional(),
  ticker: z.string().trim().min(2).max(30).optional(),
  ativo: z.boolean().optional().default(true),
  descricao: z.string().max(2000).optional(),
});

export const produtoUpdateSchema = produtoCreateSchema
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar');

export const produtoQuerySchema = paginationSchema.extend({
  categoria: z.nativeEnum(CategoriaProduto).optional(),
  perfilMinimo: z.nativeEnum(PerfilInvestidor).optional(),
  ativo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  riscoMax: z.coerce.number().int().min(1).max(5).optional(),
  q: z.string().trim().min(1).max(80).optional(), // busca por nome/emissor/ticker
});

export type ProdutoCreateDto = z.infer<typeof produtoCreateSchema>;
export type ProdutoUpdateDto = z.infer<typeof produtoUpdateSchema>;
export type ProdutoQueryDto = z.infer<typeof produtoQuerySchema>;
