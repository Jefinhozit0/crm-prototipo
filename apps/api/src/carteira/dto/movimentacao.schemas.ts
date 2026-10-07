import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';

// Tolerância pra relógio do navegador um pouco adiantado
const TOLERANCIA_FUTURO_MS = 5 * 60_000;

export const movimentacaoCreateSchema = z
  .object({
    // SALDO_INICIAL não entra por aqui: é só da migração/importação
    tipo: z.enum(['APLICACAO', 'RESGATE']),
    produtoId: z.string().cuid(),
    // Centavos exatos: até 2 casas decimais
    valor: z
      .number()
      .finite()
      .positive('Informe um valor maior que zero')
      .max(1e13)
      .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, 'Use no máximo 2 casas decimais'),
    // Data da operação; omitida = agora. Pode ser retroativa, nunca futura.
    data: z.coerce
      .date()
      .optional()
      .refine((d) => !d || d.getTime() <= Date.now() + TOLERANCIA_FUTURO_MS, 'A data não pode ser futura'),
    observacao: z.string().trim().max(500).optional(),
    // Execução de uma recomendação aprovada (só aplicação)
    recomendacaoId: z.string().cuid().optional(),
    // Cliente ciente de que o produto está acima do perfil / sem suitability válida
    cienciaDesenquadramento: z.boolean().optional().default(false),
  })
  .strict()
  .refine((v) => !(v.tipo === 'RESGATE' && v.recomendacaoId), {
    message: 'Recomendação só se vincula a aplicação',
    path: ['recomendacaoId'],
  });

export const movimentacaoQuerySchema = paginationSchema;

export const seriesQuerySchema = z.object({
  meses: z.coerce.number().int().min(1).max(24).default(12),
});

export type MovimentacaoCreateDto = z.infer<typeof movimentacaoCreateSchema>;
export type MovimentacaoQueryDto = z.infer<typeof movimentacaoQuerySchema>;
export type SeriesQueryDto = z.infer<typeof seriesQuerySchema>;
