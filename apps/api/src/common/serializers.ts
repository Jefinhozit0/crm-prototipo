import type { Prisma } from '@prisma/client';

/**
 * Converte campos Decimal do Prisma para number puro, deixando a resposta
 * JSON limpa. Para wealth management de produção, prefira string para
 * preservar precisão — number é seguro até R$ 9 quadrilhões.
 */
export function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number(value.toString());
}

/**
 * Remove campos sensíveis de objetos antes de retornar pela API.
 * cpfHash NUNCA pode sair daqui.
 */
export function sanitizeCliente<T extends { cpfHash?: string; patrimonio?: Prisma.Decimal | number }>(
  cliente: T,
): Omit<T, 'cpfHash'> & { patrimonio: number } {
  const { cpfHash: _cpfHash, patrimonio, ...rest } = cliente;
  return {
    ...rest,
    patrimonio:
      typeof patrimonio === 'number'
        ? patrimonio
        : decimalToNumber(patrimonio as Prisma.Decimal) ?? 0,
  } as Omit<T, 'cpfHash'> & { patrimonio: number };
}

export function sanitizeProduto<T extends { rentabilidadeAno?: Prisma.Decimal; taxaAdmin?: Prisma.Decimal | null; taxaPerformance?: Prisma.Decimal | null }>(
  p: T,
): Omit<T, 'rentabilidadeAno' | 'taxaAdmin' | 'taxaPerformance'> & {
  rentabilidadeAno: number;
  taxaAdmin: number | null;
  taxaPerformance: number | null;
} {
  const { rentabilidadeAno, taxaAdmin, taxaPerformance, ...rest } = p;
  return {
    ...rest,
    rentabilidadeAno: decimalToNumber(rentabilidadeAno as Prisma.Decimal) ?? 0,
    taxaAdmin: decimalToNumber(taxaAdmin as Prisma.Decimal | null),
    taxaPerformance: decimalToNumber(taxaPerformance as Prisma.Decimal | null),
  } as Omit<T, 'rentabilidadeAno' | 'taxaAdmin' | 'taxaPerformance'> & {
    rentabilidadeAno: number;
    taxaAdmin: number | null;
    taxaPerformance: number | null;
  };
}

export function sanitizeLead<T extends { valorEstimado?: Prisma.Decimal }>(
  l: T,
): Omit<T, 'valorEstimado'> & { valorEstimado: number } {
  const { valorEstimado, ...rest } = l;
  return {
    ...rest,
    valorEstimado: decimalToNumber(valorEstimado as Prisma.Decimal) ?? 0,
  } as Omit<T, 'valorEstimado'> & { valorEstimado: number };
}
