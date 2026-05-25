import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca um endpoint como público (não exige JWT).
 * Usado em rotas como /auth/login e /health/live.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
