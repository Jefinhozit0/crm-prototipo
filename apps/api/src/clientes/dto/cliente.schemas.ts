import { z } from 'zod';
import { PerfilInvestidor, StatusCliente } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';
import { cpfValido } from '../cpf';

// Aceita só dígitos ou com formatação clássica; valida dígito verificador.
const cpfSchema = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().length(11, 'CPF deve ter 11 dígitos').refine(cpfValido, 'CPF inválido'));

const ufSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(/^[A-Z]{2}$/, 'UF inválida'));

export const clienteCreateSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).toLowerCase(),
  telefone: z.string().trim().min(8).max(30).optional(),
  cpf: cpfSchema,
  cidade: z.string().trim().min(2).max(80).optional(),
  uf: ufSchema.optional(),
  // Perfil inicial (antes da suitability). Depois só muda via suitability.
  perfil: z.nativeEnum(PerfilInvestidor).optional().default('MODERADO'),
  patrimonio: z.number().finite().min(0).max(1e15).optional().default(0),
  status: z.nativeEnum(StatusCliente).optional().default('PROSPECTO'),
  responsavelId: z.string().cuid().optional(),
});

// Update não permite: CPF (imutável) e perfil (só muda aplicando suitability,
// pra manter o perfil sempre lastreado num questionário registrado).
export const clienteUpdateSchema = clienteCreateSchema
  .omit({ cpf: true, perfil: true })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Informe ao menos um campo para atualizar');

export const clienteQuerySchema = paginationSchema.extend({
  perfil: z.nativeEnum(PerfilInvestidor).optional(),
  status: z.nativeEnum(StatusCliente).optional(),
  responsavelId: z.string().cuid().optional(),
  uf: ufSchema.optional(),
  q: z.string().trim().min(1).max(80).optional(), // busca por nome/email
  sort: z
    .enum(['nome', '-nome', 'patrimonio', '-patrimonio', 'createdAt', '-createdAt'])
    .optional()
    .default('-createdAt'),
});

export type ClienteCreateDto = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdateDto = z.infer<typeof clienteUpdateSchema>;
export type ClienteQueryDto = z.infer<typeof clienteQuerySchema>;
