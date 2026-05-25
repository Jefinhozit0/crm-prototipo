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
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { loginSchema, type LoginDto } from './dto/auth.schemas';
import { Public } from './decorators/public.decorator';
import { CurrentUser, type AuthUser } from './decorators/current-user.decorator';

const ACCESS_COOKIE = 'crm_at';
const REFRESH_COOKIE = 'crm_rt';

// Cookies expirations in ms
const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15min
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

function cookieOpts(maxAge: number) {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
    maxAge,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateLogin(dto);
    const { accessToken, refreshToken, user: payload } = await this.auth.issueTokens(user);

    res.cookie(ACCESS_COOKIE, accessToken, cookieOpts(ACCESS_MAX_AGE));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts(REFRESH_MAX_AGE));

    return { user: payload };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rt = req.cookies?.[REFRESH_COOKIE];
    if (!rt) throw new UnauthorizedException('Refresh token ausente');

    const { accessToken, refreshToken, user } = await this.auth.refresh(rt);

    res.cookie(ACCESS_COOKIE, accessToken, cookieOpts(ACCESS_MAX_AGE));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOpts(REFRESH_MAX_AGE));

    return { user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    // Limpar cookie é sempre seguro — não exige token válido (ele pode estar expirado).
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
