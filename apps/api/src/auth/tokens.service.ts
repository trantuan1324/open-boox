import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessClaims, AuthUser } from './auth-user';
import { ACCESS_TTL_SECONDS, isRefreshTokenUsable, REFRESH_TTL_MS } from './refresh-token.policy';

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  signAccessToken(user: AuthUser): Promise<string> {
    const claims: AccessClaims = { sub: user.id, role: user.role };
    return this.jwt.signAsync(claims, {
      secret: getEnv().JWT_ACCESS_SECRET,
      algorithm: 'HS256',
      expiresIn: ACCESS_TTL_SECONDS,
    });
  }

  async verifyAccessToken(token: string): Promise<AccessClaims | null> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, {
        secret: getEnv().JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
      return { sub: claims.sub, role: claims.role };
    } catch {
      return null;
    }
  }

  hashRefreshToken(raw: string): string {
    return createHmac('sha256', getEnv().JWT_REFRESH_SECRET).update(raw).digest('hex');
  }

  async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return raw;
  }

  async rotateRefreshToken(raw: string): Promise<{ userId: string } | null> {
    const now = new Date();
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hashRefreshToken(raw) } });
    if (!token || !isRefreshTokenUsable(token, now)) return null;
    if (!token.rotatedAt) {
      // Conditional update: concurrent refreshes race here, only the first sets rotatedAt,
      // the others are still inside the grace period and succeed too.
      await this.prisma.refreshToken.updateMany({
        where: { id: token.id, rotatedAt: null },
        data: { rotatedAt: now },
      });
    }
    return { userId: token.userId };
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashRefreshToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
