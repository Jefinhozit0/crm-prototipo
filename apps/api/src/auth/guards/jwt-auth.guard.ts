import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';

const ACCESS_COOKIE = 'crm_at';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Token de acesso ausente');
    }

    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = await this.jwt.verifyAsync<AuthUser & { type: string }>(token, {
        secret,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Tipo de token inválido');
      }

      req.user = {
        id: payload.id,
        email: payload.email,
        nome: payload.nome,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private extractToken(req: {
    cookies?: Record<string, string>;
    headers: { authorization?: string };
  }): string | null {
    // Prefere cookie httpOnly (fluxo web seguro)
    if (req.cookies?.[ACCESS_COOKIE]) {
      return req.cookies[ACCESS_COOKIE];
    }
    // Fallback: Authorization: Bearer <token> (curl, server-to-server)
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
