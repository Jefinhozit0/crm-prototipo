import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
import { ROLES_ESCRITA } from '../escopo';

const METODOS_LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  ASSESSOR: 'Assessor',
  COMPLIANCE: 'Compliance',
  READONLY: 'Somente leitura',
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, alvos)) return true;

    const req = ctx.switchToHttp().getRequest<{ method: string; user?: AuthUser }>();
    let required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, alvos);

    // Default seguro: sem @Roles, leitura é livre pra autenticados, mas escrita
    // exige ADMIN ou ASSESSOR. Evita que um endpoint novo esquecido sem @Roles
    // fique aberto pra READONLY/COMPLIANCE alterarem dados.
    if (!required || required.length === 0) {
      if (METODOS_LEITURA.has(req.method)) return true;
      required = ROLES_ESCRITA;
    }

    const user = req.user;
    if (!user) throw new ForbiddenException('Usuário não autenticado');
    if (user.role === 'ADMIN') return true;

    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `Seu perfil (${ROLE_LABEL[user.role]}) não tem permissão para esta ação`,
      );
    }
    return true;
  }
}
