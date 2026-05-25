import { z } from 'zod';
import { PerfilInvestidor, StatusCliente } from '@prisma/client';
import { paginationSchema } from '../../common/pagination';

// CPF: aceita só dígitos ou com formatação clássica. Não validamos dígito verificador aqui (Fase posterior).
const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .pipe(z.string().length(11, 'CPF deve ter 11 dígitos'));

export const clienteCreateSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  telefone: z.string().min(8).max(30).optional(),
  cpf: cpfSchema,
  cidade: z.string().min(2).max(80).optional(),
  uf: z.string().length(2).toUpperCase().optional(),
  perfil: z.nativeEnum(PerfilInvestidor).optional().default('MODERADO'),
  patrimonio: z.number().min(0).optional().default(0),
  status: z.nativeEnum(StatusCliente).optional().default('PROSPECTO'),
  responsavelId: z.string().cuid().optional(),
});

// Update permite tudo menos CPF (CPF é imutável após criação)
export const clienteUpdateSchema = clienteCreateSchema
  .omit({ cpf: true })
  .partial();

export const clienteQuerySchema = paginationSchema.extend({
  perfil: z.nativeEnum(PerfilInvestidor).optional(),
  status: z.nativeEnum(StatusCliente).optional(),
  responsavelId: z.string().cuid().optional(),
  uf: z.string().length(2).toUpperCase().optional(),
  q: z.string().min(1).max(80).optional(), // busca por nome/email
  sort: z
    .enum(['nome', '-nome', 'patrimonio', '-patrimonio', 'createdAt', '-createdAt'])
    .optional()
    .default('-createdAt'),
});

export type ClienteCreateDto = z.infer<typeof clienteCreateSchema>;
export type ClienteUpdateDto = z.infer<typeof clienteUpdateSchema>;
export type ClienteQueryDto = z.infer<typeof clienteQuerySchema>;
