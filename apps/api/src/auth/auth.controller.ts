import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  type LoginInput,
  loginSchema,
  type PublicUser,
  REFRESH_COOKIE,
  type RegisterInput,
  registerSchema,
} from '@open-boox/shared';
import type { Request, Response } from 'express';
import { getEnv } from '../config/env';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { clearAuthCookies, setAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: () => getEnv().AUTH_REGISTER_RATE_LIMIT, ttl: 60_000 } })
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.register(body);
    setAuthCookies(res, result);
    return result.user;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: () => getEnv().AUTH_LOGIN_RATE_LIMIT, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const result = await this.auth.login(body);
    setAuthCookies(res, result);
    return result.user;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<PublicUser> {
    try {
      const result = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      setAuthCookies(res, result);
      return result.user;
    } catch (e) {
      clearAuthCookies(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    clearAuthCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }
}
