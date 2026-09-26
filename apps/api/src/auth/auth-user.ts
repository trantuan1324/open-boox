import type { Role } from '@open-boox/shared';

export interface AuthUser {
  id: string;
  role: Role;
}

export interface AccessClaims {
  sub: string;
  role: Role;
}
