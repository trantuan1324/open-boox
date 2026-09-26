import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { type LoginInput, loginSchema, type PublicUser, type RegisterInput, registerSchema } from '@open-boox/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth-user';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
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
