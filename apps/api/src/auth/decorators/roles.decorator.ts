import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restringe um endpoint a uma ou mais roles.
 * Ex.: @Roles('ADMIN', 'COMPLIANCE')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
