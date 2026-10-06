import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { contextoDaRequisicao } from '../common/request-context';
import { ACCESS_TTL_S, AuthService, REFRESH_TTL_S } from './auth.service';
import { loginSchema, type LoginDto } from './dto/auth.schemas';
import { Public } from './decorators/public.decorator';
import { CurrentUser, type AuthUser } from './decorators/current-user.decorator';

export const ACCESS_COOKIE = 'crm_at';
export const REFRESH_COOKIE = 'crm_rt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = contextoDaRequisicao(req);
    const user = await this.auth.validateLogin(dto, ctx);
    const tokens = await this.auth.issueTokens(user, { ctx });
    this.gravarCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (!rt) throw new UnauthorizedException('Sessão expirada. Faça login novamente.');

    const tokens = await this.auth.refresh(rt, contextoDaRequisicao(req));
    this.gravarCookies(res, tokens.accessToken, tokens.refreshToken);
    return { user: tokens.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Revoga a sessão no servidor (se o refresh for válido) e sempre limpa os cookies
    // — mesmo expirado, o usuário precisa conseguir sair.
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE], contextoDaRequisicao(req));
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  private cookieBase(): CookieOptions {
    const forcado = this.config.get<boolean | undefined>('COOKIE_SECURE');
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: forcado ?? this.config.get('NODE_ENV') === 'production',
      // path "/" é necessário: o proxy do Next checa a presença do crm_rt nas
      // rotas de página pra decidir se manda pro /login.
      path: '/',
    };
  }

  private gravarCookies(res: Response, access: string, refresh: string) {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, access, { ...base, maxAge: ACCESS_TTL_S * 1000 });
    res.cookie(REFRESH_COOKIE, refresh, { ...base, maxAge: REFRESH_TTL_S * 1000 });
  }
}
