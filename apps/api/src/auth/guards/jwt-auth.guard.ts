import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DomainError } from '../../common/errors/domain-error';
import { ACCESS_COOKIE } from '../auth.cookies';
import type { AuthUser } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokensService } from '../tokens.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token: string | undefined = req.cookies?.[ACCESS_COOKIE];
    const claims = token ? await this.tokens.verifyAccessToken(token) : null;
    if (!claims) throw new DomainError('UNAUTHENTICATED');
    req.user = { id: claims.sub, role: claims.role };
    return true;
  }
}
