import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import type { LoginInput, PublicUser, RegisterInput } from '@open-boox/shared';
import * as argon2 from 'argon2';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { TokensService } from './tokens.service';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, fullName: user.fullName, phone: user.phone, role: user.role };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await argon2.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: input.email, passwordHash, fullName: input.fullName, phone: input.phone },
      });
      return this.issue(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new DomainError('DUPLICATE', 'Email already registered', { email: 'Email đã được sử dụng' });
      }
      throw e;
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new DomainError('INVALID_CREDENTIALS');
    }
    return this.issue(user);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthResult> {
    if (!rawRefreshToken) throw new DomainError('UNAUTHENTICATED');
    const rotated = await this.tokens.rotateRefreshToken(rawRefreshToken);
    if (!rotated) throw new DomainError('UNAUTHENTICATED');
    const user = await this.prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user) throw new DomainError('UNAUTHENTICATED');
    return this.issue(user);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) await this.tokens.revokeRefreshToken(rawRefreshToken);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new DomainError('UNAUTHENTICATED');
    return toPublicUser(user);
  }

  private async issue(user: User): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.signAccessToken({ id: user.id, role: user.role }),
      this.tokens.issueRefreshToken(user.id),
    ]);
    return { user: toPublicUser(user), accessToken, refreshToken };
  }
}
