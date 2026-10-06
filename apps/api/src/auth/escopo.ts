import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient, UserRole } from '@prisma/client';
import type { AuthUser } from './decorators/current-user.decorator';

/**
 * Política de acesso a dados de clientes:
 *   ADMIN       — lê e altera tudo
 *   ASSESSOR    — lê e altera só a própria carteira (responsavelId = ele)
 *   COMPLIANCE  — lê tudo, não altera (decorator @Roles barra escrita)
 *   READONLY    — lê tudo, não altera
 */
export const ROLES_ESCRITA: UserRole[] = ['ADMIN', 'ASSESSOR'];

export function veTodaABase(user: AuthUser): boolean {
  return user.role !== 'ASSESSOR';
}

export function escopoCliente(user: AuthUser): Prisma.ClienteWhereInput {
  return veTodaABase(user) ? {} : { responsavelId: user.id };
}

export function escopoLead(user: AuthUser): Prisma.LeadWhereInput {
  return veTodaABase(user) ? {} : { responsavelId: user.id };
}

type PrismaLeitura = Pick<PrismaClient, 'cliente'> | Pick<Prisma.TransactionClient, 'cliente'>;

/**
 * Garante que o cliente existe E está no escopo do usuário.
 * Fora do escopo responde 404 (não 403) pra não revelar que o registro existe.
 */
export async function garantirClienteNoEscopo<S extends Prisma.ClienteSelect>(
  prisma: PrismaLeitura,
  user: AuthUser,
  clienteId: string,
  select?: S,
) {
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, ...escopoCliente(user) },
    select: (select ?? { id: true }) as S,
  });
  if (!cliente) throw new NotFoundException('Cliente não encontrado');
  return cliente as Prisma.ClienteGetPayload<{ select: S }>;
}

/** Assessor não pode atribuir carteira a outra pessoa. */
export function resolverResponsavel(user: AuthUser, responsavelId?: string): string | undefined {
  if (user.role === 'ADMIN') return responsavelId;
  if (responsavelId && responsavelId !== user.id) {
    throw new ForbiddenException('Apenas administradores podem atribuir clientes a outro assessor');
  }
  return user.id;
}
