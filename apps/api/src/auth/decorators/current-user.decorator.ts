import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
};

/**
 * Injeta o usuário autenticado (do JWT) no handler.
 * Ex.: list(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
