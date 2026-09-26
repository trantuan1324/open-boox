# M0 — Nền tảng: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo Open Boox chạy được end-to-end: Postgres trong Docker, API NestJS có auth cookie (register/login/refresh có grace period/logout/me), RBAC, pipeline lỗi thống nhất; web Next.js có design system, proxy refresh + chặn route, trang đăng nhập/đăng ký/tài khoản.

**Architecture:** pnpm + Turborepo. `packages/shared` (Zod schema, mã lỗi, kiểu) build ra CommonJS để cả hai app dùng. `apps/api` là NestJS modular monolith: global prefix `/api`, guard toàn cục (JWT → Roles), một exception filter duy nhất. `apps/web` là Next.js App Router, rewrite `/api/*` sang API để cùng origin; `proxy.ts` refresh token và điều hướng.

**Tech Stack:** Node 22, pnpm 10, Turborepo 2, TypeScript 5, NestJS 11 (Express 5), Prisma 6, PostgreSQL 17, Zod 4, argon2, @nestjs/jwt, Jest 30 + ts-jest + Supertest (API), Next.js 16, React 19, Tailwind CSS 4, react-hook-form 7 + @hookform/resolvers 5, jose 6, Vitest (shared, web).

**Spec:** `builder/spec/app_design.md` (mục 2, 3.1, 5, 6, 7, 8, 9, 10-M0)

## Global Constraints

- Node `22` (`.nvmrc`), pnpm `10` (ghi bằng `corepack use pnpm@10`), cài dependency bằng `pnpm add <pkg>@^<major>` đúng major ghi ở Tech Stack — không tự nâng major (Prisma giữ 6, TypeScript giữ 5, Postgres image giữ 17).
- Tên package: `@open-boox/shared`, `api`, `web`.
- Tiền là số nguyên VND; id `cuid`; timestamp `@db.Timestamptz(3)`.
- Cookie: `access_token` (15 phút) và `refresh_token` (7 ngày), `httpOnly`, `SameSite=Lax`, `Secure` khi `NODE_ENV=production`, **`Path=/`** cho cả hai.
- Refresh grace period: token đã xoay vòng còn dùng được khi `now − rotatedAt < 30s`; logout (`revokedAt`) vô hiệu ngay.
- JWT HS256, payload `{ sub, role }`, secret `JWT_ACCESS_SECRET`; refresh token là chuỗi ngẫu nhiên, DB lưu `HMAC-SHA256(JWT_REFRESH_SECRET, token)`.
- Định dạng lỗi: `{ statusCode, code, message, fields? }`; mã lỗi lấy từ `ERROR_CODES` trong `@open-boox/shared`.
- Mọi request `POST|PUT|PATCH|DELETE` phải có `Content-Type: application/json` (chấp nhận tham số như `; charset=utf-8`), ngược lại `415 UNSUPPORTED_MEDIA_TYPE`.
- Giao diện tiếng Việt; tiêu đề/nav/nhãn/nút VIẾT HOA weight 500; nền `#100904`, chữ `#ffedd7`, bề mặt `#382416`, viền nét đứt `#40372e`, Ember `#dc5000` chỉ cho chữ lỗi/trạng thái; bo góc card 12px, nút đặc 36px, nút ghost 22.5px, input 0px; không đổ bóng; font Inter (`latin`, `vietnamese`).
- ESLint chưa thiết lập ở M0 (thuộc M5 cùng CI); M0 kiểm tra bằng `typecheck` + test.

## Review Focus

1. **Body không phải JSON hợp lệ** (`{"name":` cụt, `text/plain`, `application/json; charset=utf-8`) — người dùng mong nhận JSON lỗi 400/415 đúng định dạng, không phải trang HTML hay 500; charset hợp lệ phải được chấp nhận. → test ở Task 4.
2. **Email khác hoa/thường hoặc có khoảng trắng** (`"  An@Mail.COM "`) — đăng ký rồi đăng nhập bằng `an@mail.com` phải được; đăng ký lại bằng biến thể khác phải bị `409 DUPLICATE`. → test ở Task 2 và Task 6.
3. **Open redirect qua `?next=`** (`https://evil.com`, `//evil.com`, `/\evil.com`) — sau đăng nhập phải về `/account`, không ra domain lạ. → test ở Task 11.
4. **So khớp tiền tố route** — `/accounting`, `/administrator` không bị chặn; `/account`, `/account/x`, `/admin` bị chặn. → test ở Task 11.
5. **Access token giả mạo role `ADMIN`** (ký bằng secret khác) hoặc hết hạn — API trả 401, proxy coi như chưa đăng nhập. → test ở Task 6 và Task 11.

## File Structure

```
.gitignore  .nvmrc  .env.example  README.md
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
docker-compose.yml  docker/postgres/init.sql

packages/shared/
  package.json tsconfig.json tsconfig.build.json
  src/index.ts          re-export
  src/roles.ts          ROLES, Role
  src/errors.ts         ERROR_CODES, ErrorCode, ApiErrorBody
  src/auth.ts           registerSchema, loginSchema, RegisterInput, LoginInput, PublicUser
  src/auth.test.ts

apps/api/
  package.json tsconfig.json tsconfig.build.json nest-cli.json jest.config.js
  prisma/schema.prisma  prisma/migrations/**  prisma/seed.ts
  src/main.ts                         bootstrap
  src/app.module.ts
  src/app.setup.ts                    configureApp(): prefix, middleware, filter
  src/config/env.ts                   getEnv()
  src/prisma/prisma.service.ts        PrismaService
  src/prisma/prisma.module.ts         @Global
  src/health/health.controller.ts
  src/common/errors/domain-error.ts   DomainError
  src/common/errors/error-status.ts   ERROR_STATUS
  src/common/errors/to-error-body.ts  toErrorBody()  (+ .spec.ts)
  src/common/errors/all-exceptions.filter.ts
  src/common/http/json-only.middleware.ts
  src/common/http/body-parse-error.handler.ts
  src/common/validation/zod-validation.pipe.ts
  src/auth/decorators/public.decorator.ts
  src/auth/decorators/roles.decorator.ts
  src/auth/decorators/current-user.decorator.ts
  src/auth/auth-user.ts               AuthUser, AccessClaims
  src/auth/refresh-token.policy.ts    isRefreshTokenUsable() (+ .spec.ts)
  src/auth/tokens.service.ts          TokensService
  src/auth/auth.service.ts            AuthService
  src/auth/auth.cookies.ts            setAuthCookies(), clearAuthCookies()
  src/auth/auth.controller.ts
  src/auth/guards/jwt-auth.guard.ts
  src/auth/guards/roles.guard.ts
  src/auth/auth.module.ts
  test/setup-env.ts test/global-setup.ts test/test-app.ts test/http-cookies.ts test/auth-helpers.ts
  test/health.e2e-spec.ts test/errors.e2e-spec.ts test/tokens.e2e-spec.ts test/auth.e2e-spec.ts test/rbac.e2e-spec.ts

apps/web/
  package.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts
  proxy.ts  proxy.test.ts
  app/theme.css app/globals.css app/layout.tsx app/page.tsx
  app/error.tsx app/not-found.tsx app/global-error.tsx
  app/(auth)/login/page.tsx app/(auth)/login/login-form.tsx
  app/(auth)/register/page.tsx app/(auth)/register/register-form.tsx
  app/account/page.tsx app/account/logout-button.tsx
  components/ui/button.tsx components/ui/text-field.tsx components/ui/page-title.tsx
  components/site-header.tsx
  lib/api/error.ts lib/api/server.ts lib/api/client.ts   (+ error.test.ts, client.test.ts)
  lib/errors/messages.ts lib/errors/form.ts
  lib/auth/session.ts lib/auth/route-access.ts lib/auth/set-cookie.ts  (+ .test.ts)
```

---

### Task 1: Monorepo skeleton + Postgres

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`, `.env.example`, `docker-compose.yml`, `docker/postgres/init.sql`
- Modify: `.gitignore`

**Interfaces:**
- Produces: root scripts `dev`, `build`, `typecheck`, `test`, `db:setup` (db:setup hoàn thiện ở Task 8); DB `bookstore` và `bookstore_test` trên `localhost:5433`, user/pass `openboox/openboox`; file `.env` ở root (copy từ `.env.example`) được mọi app đọc qua `dotenv -e ../../.env`.

- [ ] **Step 1: Viết file cấu hình root**

`package.json`:
```json
{
  "name": "open-boox",
  "private": true,
  "scripts": {
    "dev": "docker compose up -d --wait db && turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "test": "docker compose up -d --wait db && turbo test"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["prisma", "@prisma/client", "@prisma/engines", "argon2"]
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`turbo.json`:
```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "cache": false }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": false
  }
}
```

`.nvmrc`:
```
22
```

`.env.example`:
```
DATABASE_URL=postgresql://openboox:openboox@localhost:5433/bookstore
DATABASE_URL_TEST=postgresql://openboox:openboox@localhost:5433/bookstore_test
JWT_ACCESS_SECRET=dev-access-secret-change-me-0123456789abcdef
JWT_REFRESH_SECRET=dev-refresh-secret-change-me-0123456789abcdef
API_PORT=4000
API_INTERNAL_URL=http://localhost:4000
SEED_ADMIN_EMAIL=admin@openboox.test
SEED_ADMIN_PASSWORD=admin12345
SEED_CUSTOMER_EMAIL=customer@openboox.test
SEED_CUSTOMER_PASSWORD=customer12345
```

`docker-compose.yml`:
```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: openboox
      POSTGRES_PASSWORD: openboox
      POSTGRES_DB: bookstore
    ports:
      - "5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openboox -d bookstore"]
      interval: 2s
      timeout: 3s
      retries: 20
volumes:
  pgdata: {}
```

`docker/postgres/init.sql`:
```sql
CREATE DATABASE bookstore_test;
```

Thêm vào cuối `.gitignore` (giữ 3 dòng hiện có):
```
node_modules/
dist/
.next/
.turbo/
coverage/
*.tsbuildinfo
next-env.d.ts
.env
```

- [ ] **Step 2: Cài công cụ và khởi động DB**

Run:
```bash
corepack enable && corepack use pnpm@10
pnpm add -D -w turbo@^2
cp .env.example .env
docker compose up -d --wait db
docker compose exec db psql -U openboox -d bookstore -c '\l' | grep bookstore
```
Expected: `package.json` có trường `packageManager: "pnpm@10.x.y"`; lệnh cuối in ra 2 dòng chứa `bookstore` và `bookstore_test`. Nếu cổng 5433 bận, báo lại thay vì tự đổi.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json .nvmrc .env.example docker-compose.yml docker/postgres/init.sql .gitignore
git commit -m "chore: monorepo skeleton with pnpm, turbo and postgres"
```

---

### Task 2: `packages/shared` — vai trò, mã lỗi, schema auth

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/tsconfig.build.json`, `packages/shared/src/{index,roles,errors,auth}.ts`
- Test: `packages/shared/src/auth.test.ts`

**Interfaces:**
- Produces (import từ `@open-boox/shared`):
  - `ROLES: readonly ['CUSTOMER','ADMIN']`, `type Role`
  - `ERROR_CODES` (tuple hằng), `type ErrorCode`, `interface ApiErrorBody { statusCode: number; code: ErrorCode; message: string; fields?: Record<string, string> }`
  - `registerSchema`, `loginSchema` (Zod 4), `type RegisterInput = z.output<typeof registerSchema>`, `type LoginInput = z.output<typeof loginSchema>`
  - `interface PublicUser { id: string; email: string; fullName: string; phone: string; role: Role }`

- [ ] **Step 1: Tạo package và cài dependency**

`packages/shared/package.json`:
```json
{
  "name": "@open-boox/shared",
  "version": "0.0.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "commonjs", "moduleResolution": "node10", "outDir": "dist", "declaration": true },
  "include": ["src"]
}
```

`packages/shared/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src" },
  "exclude": ["src/**/*.test.ts"]
}
```

Run:
```bash
pnpm --filter @open-boox/shared add zod@^4
pnpm --filter @open-boox/shared add -D typescript@^5 vitest@^3
```

- [ ] **Step 2: Viết test thất bại**

`packages/shared/src/auth.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

const valid = {
  email: '  An.Nguyen@Mail.COM ',
  password: 'matkhau123',
  fullName: '  Nguyễn An ',
  phone: '0912345678',
};

describe('registerSchema', () => {
  it('trims and lowercases the email, trims the name', () => {
    const out = registerSchema.parse(valid);
    expect(out.email).toBe('an.nguyen@mail.com');
    expect(out.fullName).toBe('Nguyễn An');
  });

  it('rejects a password shorter than 8 characters on the password field', () => {
    const r = registerSchema.safeParse({ ...valid, password: 'short' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['password']);
    expect(r.error?.issues[0]?.message).toBe('Mật khẩu tối thiểu 8 ký tự');
  });

  it.each(['912345678', '09123456789', '+84912345678', '09a2345678'])(
    'rejects phone %s',
    (phone) => {
      expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false);
    },
  );

  it('rejects a blank full name', () => {
    expect(registerSchema.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
  });

  it('rejects an invalid email with a Vietnamese message', () => {
    const r = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(r.error?.issues[0]?.message).toBe('Email không hợp lệ');
  });
});

describe('loginSchema', () => {
  it('normalizes the email the same way as registration', () => {
    expect(loginSchema.parse({ email: ' A@B.VN', password: 'x' }).email).toBe('a@b.vn');
  });

  it('requires a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.vn', password: '' }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter @open-boox/shared test`
Expected: FAIL — `Cannot find module './auth'` (hoặc tương đương).

- [ ] **Step 4: Viết mã**

`packages/shared/src/roles.ts`:
```ts
export const ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];
```

`packages/shared/src/errors.ts`:
```ts
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'LOAN_LIMIT_EXCEEDED',
  'OUT_OF_STOCK',
  'NO_COPY_AVAILABLE',
  'SUBSCRIPTION_INACTIVE',
  'SUBSCRIPTION_ALREADY_EXISTS',
  'ORDER_NOT_CANCELLABLE',
  'INVALID_SHIPMENT_TRANSITION',
  'LOAN_NOT_RETURNABLE',
  'DUPLICATE',
  'IN_USE',
  'UNSUPPORTED_MEDIA_TYPE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
```

`packages/shared/src/auth.ts`:
```ts
import { z } from 'zod';
import type { Role } from './roles';

const email = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));

export const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(8, 'Mật khẩu tối thiểu 8 ký tự')
    .max(72, 'Mật khẩu tối đa 72 ký tự'),
  fullName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập họ tên')
    .max(100, 'Họ tên tối đa 100 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

export type RegisterInput = z.output<typeof registerSchema>;
export type LoginInput = z.output<typeof loginSchema>;

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: Role;
}
```

`packages/shared/src/index.ts`:
```ts
export * from './roles';
export * from './errors';
export * from './auth';
```

- [ ] **Step 5: Chạy test, typecheck, build**

Run: `pnpm --filter @open-boox/shared test && pnpm --filter @open-boox/shared typecheck && pnpm --filter @open-boox/shared build`
Expected: tất cả PASS; có `packages/shared/dist/index.js` và `dist/index.d.ts`; `dist/` không chứa `auth.test.*`.

- [ ] **Step 6: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): roles, error codes and auth schemas"
```

---

### Task 3: API bootstrap — env, Prisma, health, test harness

**Files:**
- Create: `apps/api/{package.json,tsconfig.json,tsconfig.build.json,nest-cli.json,jest.config.js}`, `apps/api/prisma/schema.prisma`, `apps/api/src/{main.ts,app.module.ts,app.setup.ts}`, `apps/api/src/config/env.ts`, `apps/api/src/prisma/{prisma.service.ts,prisma.module.ts}`, `apps/api/src/health/health.controller.ts`, `apps/api/src/auth/decorators/public.decorator.ts`, `apps/api/test/{setup-env.ts,global-setup.ts,test-app.ts}`
- Generated: `apps/api/prisma/migrations/<timestamp>_init/migration.sql`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**
- Consumes: `.env` (Task 1), `@open-boox/shared` (Task 2).
- Produces:
  - `getEnv(): Env` với `Env = { NODE_ENV: 'development'|'test'|'production'; DATABASE_URL: string; JWT_ACCESS_SECRET: string; JWT_REFRESH_SECRET: string; API_PORT: number }`
  - `PrismaService extends PrismaClient` (global qua `PrismaModule`); model `User`, `RefreshToken`, enum `Role`
  - `configureApp(app: NestExpressApplication): void` — Task 4 sẽ bổ sung
  - `Public()` decorator, hằng `IS_PUBLIC_KEY = 'isPublic'`
  - Test harness: `createTestApp(opts?: { controllers?: Type<unknown>[] }): Promise<TestContext>`, `interface TestContext { app: NestExpressApplication; prisma: PrismaService; http: Server }`, `resetDb(prisma: PrismaService): Promise<void>`

- [ ] **Step 1: Tạo package, schema Prisma và cài dependency**

Viết `package.json` **và** `prisma/schema.prisma` (ở Step 2 bên dưới) **trước** khi chạy `pnpm add`, vì script `postinstall` gọi `prisma generate` cần có schema.

`apps/api/package.json`:
```json
{
  "name": "api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "dotenv -e ../../.env -- nest start --watch",
    "build": "prisma generate && nest build",
    "start": "dotenv -e ../../.env -- node dist/main.js",
    "typecheck": "tsc --noEmit",
    "test": "jest --runInBand",
    "postinstall": "prisma generate",
    "db:migrate": "dotenv -e ../../.env -- prisma migrate deploy",
    "db:migrate:dev": "dotenv -e ../../.env -- prisma migrate dev",
    "db:seed": "dotenv -e ../../.env -- tsx prisma/seed.ts"
  }
}
```

Run:
```bash
pnpm --filter api add @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/jwt@^11 reflect-metadata rxjs@^7 @prisma/client@^6 zod@^4 argon2 cookie-parser express@^5 "@open-boox/shared@workspace:*"
pnpm --filter api add -D @nestjs/cli@^11 @nestjs/testing@^11 prisma@^6 typescript@^5 jest@^30 ts-jest@^29 @types/jest@^30 supertest@^7 @types/supertest @types/express@^5 @types/cookie-parser @types/node@^22 dotenv dotenv-cli tsx
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node10",
    "outDir": "dist",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "types": ["node", "jest"]
  },
  "include": ["src", "test", "prisma"]
}
```

`apps/api/tsconfig.build.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src", "types": ["node"] },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`apps/api/nest-cli.json`:
```json
{ "sourceRoot": "src", "compilerOptions": { "tsConfigPath": "tsconfig.build.json", "deleteOutDir": true } }
```

`apps/api/jest.config.js`:
```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.e2e-spec.ts'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 20000,
};
```

- [ ] **Step 2: Prisma schema (tạo file trước lệnh `pnpm add` ở Step 1) và migration đầu tiên**

`apps/api/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  CUSTOMER
  ADMIN
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  fullName      String
  phone         String
  role          Role           @default(CUSTOMER)
  createdAt     DateTime       @default(now()) @db.Timestamptz(3)
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime  @db.Timestamptz(3)
  rotatedAt DateTime? @db.Timestamptz(3)
  revokedAt DateTime? @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @db.Timestamptz(3)

  @@index([userId])
}
```

Run: `pnpm --filter api db:migrate:dev --name init`
Expected: tạo `apps/api/prisma/migrations/<timestamp>_init/migration.sql` chứa `CREATE TABLE "User"` và `CREATE TABLE "RefreshToken"`; Prisma Client được generate.

- [ ] **Step 3: Viết test harness và test thất bại**

`apps/api/test/setup-env.ts`:
```ts
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
```

`apps/api/test/global-setup.ts`:
```ts
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';

export default function globalSetup(): void {
  config({ path: resolve(__dirname, '../../../.env') });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST is not set in .env');
  execSync('pnpm exec prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
```

`apps/api/test/test-app.ts`:
```ts
import type { Server } from 'node:http';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  http: Server;
}

export async function createTestApp(opts: { controllers?: Type<unknown>[] } = {}): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: opts.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), http: app.getHttpServer() };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} CASCADE`);
}
```

`apps/api/test/health.e2e-spec.ts`:
```ts
import request from 'supertest';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('GET /api/health', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns ok under the /api prefix', async () => {
    await request(ctx.http).get('/api/health').expect(200, { status: 'ok' });
  });

  it('can truncate all tables in the test database', async () => {
    await expect(resetDb(ctx.prisma)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: Chạy test để thấy thất bại**

Run: `pnpm --filter api test -- test/health.e2e-spec.ts`
Expected: FAIL — không tìm thấy `../src/app.module`.

- [ ] **Step 5: Viết mã**

`apps/api/src/config/env.ts`:
```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  API_PORT: z.coerce.number().int().positive().default(4000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
```

`apps/api/src/prisma/prisma.service.ts`:
```ts
import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
```

`apps/api/src/auth/decorators/public.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

`apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

`apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class AppModule {}
```

`apps/api/src/app.setup.ts`:
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(json({ limit: '100kb' }));
  app.use(cookieParser());
}
```

`apps/api/src/main.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { getEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  await app.listen(getEnv().API_PORT);
}

void bootstrap();
```

- [ ] **Step 6: Chạy test và typecheck**

Run: `pnpm --filter api test -- test/health.e2e-spec.ts && pnpm --filter api typecheck`
Expected: 2 test PASS (globalSetup in log `migrations have been applied` hoặc `No pending migrations`); typecheck không lỗi.

- [ ] **Step 7: Chạy thử server thật**

Run: `pnpm --filter api build && (pnpm --filter api start & sleep 4; curl -s localhost:4000/api/health; kill %1)`
Expected: in ra `{"status":"ok"}`.

- [ ] **Step 8: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): nest bootstrap, prisma schema, health check and test harness"
```

---

### Task 4: Pipeline lỗi thống nhất

**Files:**
- Create: `apps/api/src/common/errors/{domain-error.ts,error-status.ts,to-error-body.ts,all-exceptions.filter.ts}`, `apps/api/src/common/http/{json-only.middleware.ts,body-parse-error.handler.ts}`, `apps/api/src/common/validation/zod-validation.pipe.ts`
- Modify: `apps/api/src/app.setup.ts`
- Test: `apps/api/src/common/errors/to-error-body.spec.ts`, `apps/api/test/errors.e2e-spec.ts`

**Interfaces:**
- Consumes: `ErrorCode`, `ApiErrorBody` (Task 2); `configureApp`, `createTestApp`, `Public` (Task 3).
- Produces:
  - `class DomainError extends Error { constructor(code: ErrorCode, message?: string, fields?: Record<string,string>); readonly code; readonly fields?; get status(): number }`
  - `ERROR_STATUS: Record<ErrorCode, number>`
  - `toErrorBody(exception: unknown): ApiErrorBody`
  - `AllExceptionsFilter` (đăng ký trong `configureApp`)
  - `class ZodValidationPipe<T extends ZodType> { constructor(schema: T) }` — dùng `@Body(new ZodValidationPipe(schema))`; lỗi → `DomainError('VALIDATION_ERROR', …, fields)` với key là path nối bằng `.`, giá trị là message đầu tiên của path đó
  - `jsonOnly` (Express middleware), `bodyParseErrorHandler` (Express error middleware)

- [ ] **Step 1: Viết unit test thất bại cho `toErrorBody`**

`apps/api/src/common/errors/to-error-body.spec.ts`:
```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError } from './domain-error';
import { toErrorBody } from './to-error-body';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('toErrorBody', () => {
  it('maps a DomainError using ERROR_STATUS and keeps fields', () => {
    expect(toErrorBody(new DomainError('VALIDATION_ERROR', 'bad', { email: 'Email không hợp lệ' }))).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'bad',
      fields: { email: 'Email không hợp lệ' },
    });
  });

  it('maps business conflicts to 409', () => {
    expect(toErrorBody(new DomainError('OUT_OF_STOCK')).statusCode).toBe(409);
    expect(toErrorBody(new DomainError('INVALID_SHIPMENT_TRANSITION')).statusCode).toBe(409);
  });

  it.each([
    ['P2002', 409, 'DUPLICATE'],
    ['P2003', 409, 'IN_USE'],
    ['P2025', 404, 'NOT_FOUND'],
  ])('maps Prisma %s to %i %s', (code, status, errorCode) => {
    expect(toErrorBody(prismaError(code))).toMatchObject({ statusCode: status, code: errorCode });
  });

  it('maps an unknown Prisma error code to 500', () => {
    expect(toErrorBody(prismaError('P1001'))).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });

  it('maps Nest HttpExceptions by status', () => {
    expect(toErrorBody(new ForbiddenException())).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(toErrorBody(new NotFoundException())).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
  });

  it('hides the message of unexpected errors', () => {
    expect(toErrorBody(new Error('secret internals'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
```

- [ ] **Step 2: Viết e2e test thất bại**

`apps/api/test/errors.e2e-spec.ts`:
```ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import request from 'supertest';
import { z } from 'zod';
import { Public } from '../src/auth/decorators/public.decorator';
import { DomainError } from '../src/common/errors/domain-error';
import { ZodValidationPipe } from '../src/common/validation/zod-validation.pipe';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, type TestContext } from './test-app';

const echoSchema = z.object({ name: z.string().min(1, 'Bắt buộc') });

@Public()
@Controller('test-errors')
class ErrorsTestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('echo')
  echo(@Body(new ZodValidationPipe(echoSchema)) body: z.output<typeof echoSchema>) {
    return body;
  }

  @Get('domain')
  domain(): never {
    throw new DomainError('OUT_OF_STOCK', 'Hết hàng');
  }

  @Get('missing')
  async missing(): Promise<void> {
    await this.prisma.user.update({ where: { id: 'does-not-exist' }, data: { fullName: 'x' } });
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internals');
  }
}

describe('error pipeline', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [ErrorsTestController] });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('accepts valid JSON', async () => {
    await request(ctx.http).post('/api/test-errors/echo').send({ name: 'An' }).expect(201, { name: 'An' });
  });

  it('accepts application/json with a charset parameter', async () => {
    await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify({ name: 'An' }))
      .expect(201, { name: 'An' });
  });

  it('returns field errors for schema violations', async () => {
    const res = await request(ctx.http).post('/api/test-errors/echo').send({ name: '' }).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR', fields: { name: 'Bắt buộc' } });
  });

  it('rejects non-JSON content types with 415', async () => {
    const res = await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'text/plain')
      .send('name=An')
      .expect(415);
    expect(res.body).toMatchObject({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('rejects a POST with no content type with 415', async () => {
    const res = await request(ctx.http).post('/api/test-errors/echo').expect(415);
    expect(res.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('turns malformed JSON into a 400 JSON error', async () => {
    const res = await request(ctx.http)
      .post('/api/test-errors/echo')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('maps domain errors', async () => {
    const res = await request(ctx.http).get('/api/test-errors/domain').expect(409);
    expect(res.body).toEqual({ statusCode: 409, code: 'OUT_OF_STOCK', message: 'Hết hàng' });
  });

  it('maps Prisma record-not-found to 404', async () => {
    const res = await request(ctx.http).get('/api/test-errors/missing').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('hides internals on unexpected errors', async () => {
    const res = await request(ctx.http).get('/api/test-errors/boom').expect(500);
    expect(res.body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(ctx.http).get('/api/does-not-exist').expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter api test -- to-error-body errors.e2e`
Expected: FAIL — không tìm thấy `./domain-error`, `../src/common/errors/domain-error`.

- [ ] **Step 4: Viết mã**

`apps/api/src/common/errors/error-status.ts`:
```ts
import type { ErrorCode } from '@open-boox/shared';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  LOAN_LIMIT_EXCEEDED: 409,
  OUT_OF_STOCK: 409,
  NO_COPY_AVAILABLE: 409,
  SUBSCRIPTION_INACTIVE: 409,
  SUBSCRIPTION_ALREADY_EXISTS: 409,
  ORDER_NOT_CANCELLABLE: 409,
  INVALID_SHIPMENT_TRANSITION: 409,
  LOAN_NOT_RETURNABLE: 409,
  DUPLICATE: 409,
  IN_USE: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL_ERROR: 500,
};
```

`apps/api/src/common/errors/domain-error.ts`:
```ts
import type { ErrorCode } from '@open-boox/shared';
import { ERROR_STATUS } from './error-status';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}
```

`apps/api/src/common/errors/to-error-body.ts`:
```ts
import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiErrorBody, ErrorCode } from '@open-boox/shared';
import { DomainError } from './domain-error';
import { ERROR_STATUS } from './error-status';

const PRISMA_CODES: Record<string, ErrorCode> = {
  P2002: 'DUPLICATE',
  P2003: 'IN_USE',
  P2025: 'NOT_FOUND',
};

const HTTP_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

const INTERNAL: ApiErrorBody = { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };

export function toErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof DomainError) {
    const body: ApiErrorBody = { statusCode: exception.status, code: exception.code, message: exception.message };
    if (exception.fields) body.fields = exception.fields;
    return body;
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const code = PRISMA_CODES[exception.code];
    return code ? { statusCode: ERROR_STATUS[code], code, message: code } : INTERNAL;
  }
  if (exception instanceof HttpException) {
    const code = HTTP_CODES[exception.getStatus()];
    return code ? { statusCode: exception.getStatus(), code, message: exception.message } : INTERNAL;
  }
  return INTERNAL;
}
```

`apps/api/src/common/errors/all-exceptions.filter.ts`:
```ts
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { toErrorBody } from './to-error-body';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
```

`apps/api/src/common/http/json-only.middleware.ts`:
```ts
import type { ApiErrorBody } from '@open-boox/shared';
import type { NextFunction, Request, Response } from 'express';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function jsonOnly(req: Request, res: Response, next: NextFunction): void {
  if (!WRITE_METHODS.has(req.method)) return next();
  const mediaType = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (mediaType === 'application/json') return next();
  const body: ApiErrorBody = {
    statusCode: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Content-Type must be application/json',
  };
  res.status(415).json(body);
}
```

`apps/api/src/common/http/body-parse-error.handler.ts`:
```ts
import type { ApiErrorBody } from '@open-boox/shared';
import type { NextFunction, Request, Response } from 'express';
import { toErrorBody } from '../errors/to-error-body';

function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof (err as { type: unknown }).type === 'string' &&
    (err as { type: string }).type.startsWith('entity.')
  );
}

// Express error middleware: runs for errors thrown by json() before Nest's router is reached.
export function bodyParseErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isBodyParserError(err)) {
    const body: ApiErrorBody = { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Malformed JSON body' };
    res.status(400).json(body);
    return;
  }
  const body = toErrorBody(err);
  res.status(body.statusCode).json(body);
}
```

`apps/api/src/common/validation/zod-validation.pipe.ts`:
```ts
import type { PipeTransform } from '@nestjs/common';
import type { z, ZodError, ZodType } from 'zod';
import { DomainError } from '../errors/domain-error';

export function toFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new DomainError('VALIDATION_ERROR', 'Invalid request body', toFieldErrors(result.error));
  }
}
```

Thay toàn bộ `apps/api/src/app.setup.ts`:
```ts
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { bodyParseErrorHandler } from './common/http/body-parse-error.handler';
import { jsonOnly } from './common/http/json-only.middleware';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.use(jsonOnly);
  app.use(json({ limit: '100kb' }));
  app.use(bodyParseErrorHandler);
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
}
```

- [ ] **Step 5: Chạy toàn bộ test API**

Run: `pnpm --filter api test && pnpm --filter api typecheck`
Expected: tất cả PASS (health, to-error-body, errors.e2e). Nếu test malformed JSON trả HTML, kiểm tra `createTestApp` và `main.ts` đều tạo app với `{ bodyParser: false }`.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): unified error pipeline, zod validation and json-only guard"
```

---

### Task 5: Chính sách refresh token + `TokensService`

**Files:**
- Create: `apps/api/src/auth/{auth-user.ts,refresh-token.policy.ts,tokens.service.ts,auth.module.ts}`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/auth/refresh-token.policy.spec.ts`, `apps/api/test/tokens.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `getEnv` (Task 3); `Role` (Task 2).
- Produces:
  - `REFRESH_GRACE_MS = 30_000`, `REFRESH_TTL_MS = 7 ngày`, `ACCESS_TTL_SECONDS = 900`
  - `isRefreshTokenUsable(t: { expiresAt: Date; rotatedAt: Date | null; revokedAt: Date | null }, now: Date): boolean`
  - `interface AuthUser { id: string; role: Role }`, `interface AccessClaims { sub: string; role: Role }`
  - `TokensService`:
    - `signAccessToken(user: AuthUser): Promise<string>`
    - `verifyAccessToken(token: string): Promise<AccessClaims | null>`
    - `hashRefreshToken(raw: string): string`
    - `issueRefreshToken(userId: string): Promise<string>` (trả chuỗi thô)
    - `rotateRefreshToken(raw: string): Promise<{ userId: string } | null>`
    - `revokeRefreshToken(raw: string): Promise<void>`
  - `AuthModule` (Task 6 thêm controller, service, guard)

- [ ] **Step 1: Viết unit test thất bại**

`apps/api/src/auth/refresh-token.policy.spec.ts`:
```ts
import { isRefreshTokenUsable, REFRESH_GRACE_MS } from './refresh-token.policy';

const now = new Date('2026-09-26T10:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const inFuture = new Date(now.getTime() + 60_000);
const base = { expiresAt: inFuture, rotatedAt: null, revokedAt: null };

describe('isRefreshTokenUsable', () => {
  it('accepts a fresh token', () => {
    expect(isRefreshTokenUsable(base, now)).toBe(true);
  });

  it('rejects a revoked token even if never rotated', () => {
    expect(isRefreshTokenUsable({ ...base, revokedAt: ago(1) }, now)).toBe(false);
  });

  it('rejects an expired token', () => {
    expect(isRefreshTokenUsable({ ...base, expiresAt: now }, now)).toBe(false);
  });

  it('accepts a token rotated inside the grace period', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(REFRESH_GRACE_MS - 1) }, now)).toBe(true);
  });

  it('rejects a token rotated exactly at the end of the grace period', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(REFRESH_GRACE_MS) }, now)).toBe(false);
  });

  it('rejects a recently rotated token that was also revoked', () => {
    expect(isRefreshTokenUsable({ ...base, rotatedAt: ago(1000), revokedAt: ago(500) }, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Viết integration test thất bại**

`apps/api/test/tokens.e2e-spec.ts`:
```ts
import { TokensService } from '../src/auth/tokens.service';
import { createTestApp, resetDb, type TestContext } from './test-app';

describe('TokensService', () => {
  let ctx: TestContext;
  let tokens: TokensService;
  let userId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokensService);
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    const user = await ctx.prisma.user.create({
      data: { email: 'a@b.vn', passwordHash: 'x', fullName: 'A', phone: '0900000000' },
    });
    userId = user.id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('stores only an HMAC of the refresh token', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    const row = await ctx.prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(raw);
    expect(row.tokenHash).toBe(tokens.hashRefreshToken(raw));
  });

  it('rotates once and keeps the old token usable during the grace period', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    expect(await tokens.rotateRefreshToken(raw)).toEqual({ userId });
    const firstRotation = (await ctx.prisma.refreshToken.findFirstOrThrow()).rotatedAt;
    expect(firstRotation).not.toBeNull();

    expect(await tokens.rotateRefreshToken(raw)).toEqual({ userId });
    expect((await ctx.prisma.refreshToken.findFirstOrThrow()).rotatedAt).toEqual(firstRotation);
  });

  it('rejects the old token after the grace period', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    await ctx.prisma.refreshToken.updateMany({ data: { rotatedAt: new Date(Date.now() - 31_000) } });
    expect(await tokens.rotateRefreshToken(raw)).toBeNull();
  });

  it('rejects a revoked token immediately', async () => {
    const raw = await tokens.issueRefreshToken(userId);
    await tokens.revokeRefreshToken(raw);
    expect(await tokens.rotateRefreshToken(raw)).toBeNull();
  });

  it('rejects an unknown token', async () => {
    expect(await tokens.rotateRefreshToken('not-a-real-token')).toBeNull();
  });

  it('signs access tokens that verify, and rejects tampered ones', async () => {
    const token = await tokens.signAccessToken({ id: userId, role: 'CUSTOMER' });
    expect(await tokens.verifyAccessToken(token)).toMatchObject({ sub: userId, role: 'CUSTOMER' });
    expect(await tokens.verifyAccessToken(token.slice(0, -2) + 'xx')).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter api test -- refresh-token.policy tokens.e2e`
Expected: FAIL — không tìm thấy `./refresh-token.policy`, `../src/auth/tokens.service`.

- [ ] **Step 4: Viết mã**

`apps/api/src/auth/auth-user.ts`:
```ts
import type { Role } from '@open-boox/shared';

export interface AuthUser {
  id: string;
  role: Role;
}

export interface AccessClaims {
  sub: string;
  role: Role;
}
```

`apps/api/src/auth/refresh-token.policy.ts`:
```ts
export const REFRESH_GRACE_MS = 30_000;
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCESS_TTL_SECONDS = 15 * 60;

export interface RefreshTokenState {
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export function isRefreshTokenUsable(token: RefreshTokenState, now: Date): boolean {
  if (token.revokedAt) return false;
  if (token.expiresAt.getTime() <= now.getTime()) return false;
  if (token.rotatedAt && now.getTime() - token.rotatedAt.getTime() >= REFRESH_GRACE_MS) return false;
  return true;
}
```

`apps/api/src/auth/tokens.service.ts`:
```ts
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
```

`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TokensService } from './tokens.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [TokensService],
  exports: [TokensService],
})
export class AuthModule {}
```

Sửa `apps/api/src/app.module.ts` — thêm `AuthModule` vào `imports`:
```ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 5: Chạy test**

Run: `pnpm --filter api test && pnpm --filter api typecheck`
Expected: tất cả PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): refresh token policy with 30s grace and tokens service"
```

---

### Task 6: Endpoint auth + guard JWT toàn cục + cookie

**Files:**
- Create: `apps/api/src/auth/{auth.service.ts,auth.cookies.ts,auth.controller.ts}`, `apps/api/src/auth/guards/jwt-auth.guard.ts`, `apps/api/src/auth/decorators/current-user.decorator.ts`, `apps/api/test/http-cookies.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `TokensService`, `AuthUser`, `ACCESS_TTL_SECONDS`, `REFRESH_TTL_MS` (Task 5); `DomainError`, `ZodValidationPipe` (Task 4); `registerSchema`, `loginSchema`, `PublicUser` (Task 2); `IS_PUBLIC_KEY`, `Public` (Task 3).
- Produces:
  - HTTP: `POST /api/auth/register` → 201 `PublicUser` + cookie; `POST /api/auth/login` → 200 `PublicUser` + cookie; `POST /api/auth/refresh` → 200 `PublicUser` + cookie mới (lỗi → 401 và xóa cookie); `POST /api/auth/logout` → 204 + xóa cookie; `GET /api/auth/me` → 200 `PublicUser`
  - `ACCESS_COOKIE = 'access_token'`, `REFRESH_COOKIE = 'refresh_token'`, `setAuthCookies(res, { accessToken, refreshToken })`, `clearAuthCookies(res)`
  - `JwtAuthGuard` (APP_GUARD) đặt `req.user: AuthUser`; mọi route yêu cầu đăng nhập trừ khi có `@Public()`
  - `@CurrentUser()` param decorator → `AuthUser`
  - Test helper `cookiesFrom(res): Record<string, string>`, `cookieHeader(cookies: Record<string, string>): string`, `setCookieLines(res): string[]`

- [ ] **Step 1: Viết helper cookie cho test**

`apps/api/test/http-cookies.ts`:
```ts
import type { Response } from 'supertest';

export function setCookieLines(res: Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : [String(raw)];
}

export function cookiesFrom(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of setCookieLines(res)) {
    const [pair] = line.split(';');
    const eq = pair!.indexOf('=');
    out[pair!.slice(0, eq)] = pair!.slice(eq + 1);
  }
  return out;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
```

- [ ] **Step 2: Viết e2e test thất bại**

`apps/api/test/auth.e2e-spec.ts`:
```ts
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { cookieHeader, cookiesFrom, setCookieLines } from './http-cookies';
import { createTestApp, resetDb, type TestContext } from './test-app';

const newUser = { email: '  An@Mail.COM ', password: 'matkhau123', fullName: 'Nguyễn An', phone: '0912345678' };

describe('auth endpoints', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const register = () => request(ctx.http).post('/api/auth/register').send(newUser);

  describe('register', () => {
    it('creates a user, returns the public profile and sets both cookies', async () => {
      const res = await register().expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'an@mail.com',
        fullName: 'Nguyễn An',
        phone: '0912345678',
        role: 'CUSTOMER',
      });
      const lines = setCookieLines(res);
      for (const name of ['access_token', 'refresh_token']) {
        const line = lines.find((l) => l.startsWith(`${name}=`));
        expect(line).toBeDefined();
        expect(line).toMatch(/HttpOnly/);
        expect(line).toMatch(/SameSite=Lax/);
        expect(line).toMatch(/Path=\//);
        expect(line).not.toMatch(/Secure/);
      }
    });

    it('rejects the same email with different casing as DUPLICATE on the email field', async () => {
      await register().expect(201);
      const res = await request(ctx.http)
        .post('/api/auth/register')
        .send({ ...newUser, email: 'an@mail.com' })
        .expect(409);
      expect(res.body).toMatchObject({ code: 'DUPLICATE', fields: { email: 'Email đã được sử dụng' } });
    });

    it('returns field errors for invalid input', async () => {
      const res = await request(ctx.http)
        .post('/api/auth/register')
        .send({ ...newUser, password: 'short', phone: '123' })
        .expect(400);
      expect(Object.keys(res.body.fields).sort()).toEqual(['password', 'phone']);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register().expect(201);
    });

    it('logs in with a differently-cased email', async () => {
      const res = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'AN@mail.com', password: 'matkhau123' })
        .expect(200);
      expect(res.body.email).toBe('an@mail.com');
      expect(cookiesFrom(res).access_token).toBeTruthy();
    });

    it('uses one error for wrong password and unknown email', async () => {
      const wrong = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'an@mail.com', password: 'sai-mat-khau' })
        .expect(401);
      const unknown = await request(ctx.http)
        .post('/api/auth/login')
        .send({ email: 'nobody@mail.com', password: 'matkhau123' })
        .expect(401);
      expect(wrong.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body).toEqual(wrong.body);
    });
  });

  describe('me', () => {
    it('returns the current user with a valid access cookie', async () => {
      const cookies = cookiesFrom(await register());
      const res = await request(ctx.http)
        .get('/api/auth/me')
        .set('Cookie', cookieHeader({ access_token: cookies.access_token! }))
        .expect(200);
      expect(res.body.email).toBe('an@mail.com');
    });

    it('returns 401 UNAUTHENTICATED without a cookie', async () => {
      const res = await request(ctx.http).get('/api/auth/me').expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('rejects an ADMIN token signed with a different secret', async () => {
      const registered = await register();
      const forged = await new JwtService().signAsync(
        { sub: registered.body.id, role: 'ADMIN' },
        { secret: 'attacker-secret-attacker-secret-0000', algorithm: 'HS256', expiresIn: 900 },
      );
      await request(ctx.http).get('/api/auth/me').set('Cookie', `access_token=${forged}`).expect(401);
    });
  });

  describe('refresh', () => {
    const refresh = (refreshToken: string) =>
      request(ctx.http)
        .post('/api/auth/refresh')
        .set('Content-Type', 'application/json')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .send('{}');

    it('issues new cookies and keeps the old token usable during the grace period', async () => {
      const original = cookiesFrom(await register()).refresh_token!;
      const first = await refresh(original).expect(200);
      expect(cookiesFrom(first).refresh_token).toBeTruthy();
      expect(cookiesFrom(first).refresh_token).not.toBe(original);
      await refresh(original).expect(200);
    });

    it('lets three concurrent refreshes with the same token all succeed', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      const results = await Promise.all([refresh(token), refresh(token), refresh(token)]);
      expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    });

    it('rejects a rotated token after the grace period and clears cookies', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      await refresh(token).expect(200);
      await ctx.prisma.refreshToken.updateMany({
        where: { rotatedAt: { not: null } },
        data: { rotatedAt: new Date(Date.now() - 31_000) },
      });
      const res = await refresh(token).expect(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
      expect(cookiesFrom(res)).toMatchObject({ access_token: '', refresh_token: '' });
    });

    it('returns 401 without a refresh cookie', async () => {
      await request(ctx.http).post('/api/auth/refresh').send({}).expect(401);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token immediately and clears cookies', async () => {
      const token = cookiesFrom(await register()).refresh_token!;
      const res = await request(ctx.http)
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${token}`)
        .send({})
        .expect(204);
      expect(cookiesFrom(res)).toMatchObject({ access_token: '', refresh_token: '' });
      await request(ctx.http)
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${token}`)
        .send({})
        .expect(401);
    });
  });

  it('keeps /api/health public now that the JWT guard is global', async () => {
    await request(ctx.http).get('/api/health').expect(200);
  });
});
```

- [ ] **Step 3: Chạy test để thấy thất bại**

Run: `pnpm --filter api test -- auth.e2e`
Expected: FAIL — `POST /api/auth/register` trả 404.

- [ ] **Step 4: Viết mã**

`apps/api/src/auth/auth.cookies.ts`:
```ts
import type { Response } from 'express';
import { getEnv } from '../config/env';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS } from './refresh-token.policy';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

function baseOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: getEnv().NODE_ENV === 'production', path: '/' };
}

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...baseOptions(), maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
```

`apps/api/src/auth/auth.service.ts`:
```ts
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
```

`apps/api/src/auth/decorators/current-user.decorator.ts`:
```ts
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
```

`apps/api/src/auth/guards/jwt-auth.guard.ts`:
```ts
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
```

`apps/api/src/auth/auth.controller.ts`:
```ts
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
```

Thay `apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokensService } from './tokens.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [TokensService, AuthService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
  exports: [TokensService],
})
export class AuthModule {}
```

Ghi chú: `errors.e2e-spec.ts` (Task 4) vẫn qua vì `ErrorsTestController` có `@Public()`.

- [ ] **Step 5: Chạy toàn bộ test**

Run: `pnpm --filter api test && pnpm --filter api typecheck`
Expected: tất cả PASS. Nếu test "clears cookies" thấy giá trị khác `''`, kiểm tra `clearAuthCookies` được gọi trước `throw`.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat(api): cookie-based auth endpoints with global jwt guard"
```

---

### Task 7: RBAC — `@Roles` + `RolesGuard`

**Files:**
- Create: `apps/api/src/auth/decorators/roles.decorator.ts`, `apps/api/src/auth/guards/roles.guard.ts`, `apps/api/test/auth-helpers.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/test/rbac.e2e-spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard` đặt `req.user` (Task 6); `DomainError` (Task 4); `Role` (Task 2).
- Produces:
  - `Roles(...roles: Role[])`, `ROLES_KEY = 'roles'`
  - `RolesGuard` (APP_GUARD, chạy sau `JwtAuthGuard`): route có `@Roles` mà role không khớp → `403 FORBIDDEN`
  - Test helper `loginAs(ctx: TestContext, role: Role, email?: string): Promise<string>` trả chuỗi `Cookie` header — dùng cho mọi milestone sau

- [ ] **Step 1: Viết helper và test thất bại**

`apps/api/test/auth-helpers.ts`:
```ts
import type { Role } from '@open-boox/shared';
import * as argon2 from 'argon2';
import request from 'supertest';
import { cookieHeader, cookiesFrom } from './http-cookies';
import type { TestContext } from './test-app';

export async function loginAs(ctx: TestContext, role: Role, email = `${role.toLowerCase()}@test.vn`): Promise<string> {
  const password = 'matkhau123';
  await ctx.prisma.user.create({
    data: { email, passwordHash: await argon2.hash(password), fullName: role, phone: '0900000000', role },
  });
  const res = await request(ctx.http).post('/api/auth/login').send({ email, password }).expect(200);
  return cookieHeader(cookiesFrom(res));
}
```

`apps/api/test/rbac.e2e-spec.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import request from 'supertest';
import type { AuthUser } from '../src/auth/auth-user';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { Roles } from '../src/auth/decorators/roles.decorator';
import { loginAs } from './auth-helpers';
import { createTestApp, resetDb, type TestContext } from './test-app';

@Controller('test-rbac')
class RbacTestController {
  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { ok: true };
  }

  @Get('any')
  any(@CurrentUser() user: AuthUser) {
    return { role: user.role };
  }
}

describe('RBAC', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ controllers: [RbacTestController] });
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns 401 for anonymous callers before checking roles', async () => {
    const res = await request(ctx.http).get('/api/test-rbac/admin').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('returns 403 FORBIDDEN for a customer on an admin route', async () => {
    const cookie = await loginAs(ctx, 'CUSTOMER');
    const res = await request(ctx.http).get('/api/test-rbac/admin').set('Cookie', cookie).expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows an admin on an admin route', async () => {
    const cookie = await loginAs(ctx, 'ADMIN');
    await request(ctx.http).get('/api/test-rbac/admin').set('Cookie', cookie).expect(200, { ok: true });
  });

  it('allows any logged-in role on routes without @Roles', async () => {
    const cookie = await loginAs(ctx, 'CUSTOMER');
    await request(ctx.http).get('/api/test-rbac/any').set('Cookie', cookie).expect(200, { role: 'CUSTOMER' });
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter api test -- rbac.e2e`
Expected: FAIL — không tìm thấy `../src/auth/decorators/roles.decorator`.

- [ ] **Step 3: Viết mã**

`apps/api/src/auth/decorators/roles.decorator.ts`:
```ts
import { SetMetadata } from '@nestjs/common';
import type { Role } from '@open-boox/shared';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

`apps/api/src/auth/guards/roles.guard.ts`:
```ts
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@open-boox/shared';
import { DomainError } from '../../common/errors/domain-error';
import type { AuthUser } from '../auth-user';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) throw new DomainError('FORBIDDEN');
    return true;
  }
}
```

Sửa `providers` trong `apps/api/src/auth/auth.module.ts` (thứ tự quan trọng: JWT trước, Roles sau):
```ts
  providers: [
    TokensService,
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
```
và thêm import `import { RolesGuard } from './guards/roles.guard';`.

- [ ] **Step 4: Chạy toàn bộ test**

Run: `pnpm --filter api test && pnpm --filter api typecheck`
Expected: tất cả PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): role-based access control guard"
```

---

### Task 8: Seed tài khoản mẫu, `db:setup`, README

**Files:**
- Create: `apps/api/prisma/seed.ts`, `README.md`
- Modify: `package.json` (root — thêm script `db:setup`)

**Interfaces:**
- Consumes: env `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD` (Task 1); schema (Task 3).
- Produces: `pnpm db:setup` idempotent; M1 sẽ mở rộng `seed.ts` (thêm sách/gói) — giữ hàm `main()` là điểm vào duy nhất.

- [ ] **Step 1: Viết seed**

`apps/api/prisma/seed.ts`:
```ts
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env`);
  return value;
}

async function upsertUser(email: string, password: string, fullName: string, role: Role): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);
  await prisma.user.upsert({
    where: { email: normalized },
    update: { passwordHash, role },
    create: { email: normalized, passwordHash, fullName, phone: '0900000000', role },
  });
}

async function main(): Promise<void> {
  await upsertUser(requireEnv('SEED_ADMIN_EMAIL'), requireEnv('SEED_ADMIN_PASSWORD'), 'Quản trị viên', Role.ADMIN);
  await upsertUser(
    requireEnv('SEED_CUSTOMER_EMAIL'),
    requireEnv('SEED_CUSTOMER_PASSWORD'),
    'Khách hàng mẫu',
    Role.CUSTOMER,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

Thêm vào `scripts` của `package.json` root:
```json
    "db:setup": "docker compose up -d --wait db && pnpm --filter api db:migrate && pnpm --filter api db:seed"
```

- [ ] **Step 2: Chạy seed hai lần và kiểm tra idempotent**

Run:
```bash
pnpm db:setup && pnpm db:setup
docker compose exec db psql -U openboox -d bookstore -tAc 'SELECT email, role FROM "User" ORDER BY email'
```
Expected: đúng 2 dòng: `admin@openboox.test|ADMIN` và `customer@openboox.test|CUSTOMER`.

- [ ] **Step 3: Đăng nhập admin qua API thật**

Run:
```bash
pnpm --filter api build
(pnpm --filter api start & sleep 4; curl -s -i -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@openboox.test","password":"admin12345"}' | grep -iE '^HTTP|set-cookie|"role"'; kill %1)
```
Expected: `HTTP/1.1 200`, hai dòng `Set-Cookie` (`access_token`, `refresh_token`), body có `"role":"ADMIN"`.

- [ ] **Step 4: Viết README**

`README.md`:
````markdown
# Open Boox

Trang web sách: mượn theo gói đăng ký, mua sách, giao tận nơi. Dự án học tập — thiết kế ở `builder/spec/app_design.md`.

## Yêu cầu

- Node 22 (`nvm use`), pnpm 10 (`corepack enable`), Docker

## Chạy lần đầu

```bash
pnpm install
cp .env.example .env
pnpm db:setup
pnpm dev
```

- Web: http://localhost:3000 — API: http://localhost:4000/api
- Tài khoản mẫu: xem `SEED_*` trong `.env`

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm dev` | Bật Postgres (Docker, cổng 5433) + chạy web và API |
| `pnpm db:setup` | Migrate + seed DB dev (chạy lại an toàn) |
| `pnpm test` | Unit + integration (API dùng DB `bookstore_test`) |
| `pnpm typecheck` | Kiểm tra kiểu toàn repo |
````

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/seed.ts package.json README.md
git commit -m "chore: seed sample accounts, db:setup script and readme"
```

---

### Task 9: Web bootstrap — Next.js, Tailwind, design system, layout

**Files:**
- Create: `apps/web/{package.json,tsconfig.json,next.config.ts,postcss.config.mjs,vitest.config.ts}`, `apps/web/app/{theme.css,globals.css,layout.tsx,page.tsx,error.tsx,not-found.tsx,global-error.tsx}`, `apps/web/components/ui/{button.tsx,text-field.tsx,page-title.tsx}`, `apps/web/components/site-header.tsx`

**Interfaces:**
- Consumes: `@open-boox/shared` (Task 2); API ở `API_INTERNAL_URL` (Task 3).
- Produces:
  - Rewrite `/api/:path*` → `${API_INTERNAL_URL}/api/:path*`
  - Tailwind color utilities: `bg-walnut-shadow`, `bg-bark-brown`, `text-warm-cream`, `border-cork-border`, `text-ember-accent`, `text-driftwood`; font `font-sans` = Inter
  - `Button({ variant?: 'filled' | 'ghost', ...ButtonHTMLAttributes })`
  - `TextField` (forwardRef, props `label: string; error?: string` + `InputHTMLAttributes`)
  - `PageTitle({ children })` — h1 41px, leading 0.9, VIẾT HOA
  - `SiteHeader` (Task 10 đổi thành async đọc user)
  - Alias `@/*` → `apps/web/*`

- [ ] **Step 1: Tạo package và cài dependency**

`apps/web/package.json`:
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "dotenv -e ../../.env -- next dev --port 3000",
    "build": "dotenv -e ../../.env -- next build",
    "start": "dotenv -e ../../.env -- next start --port 3000",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

Run:
```bash
pnpm --filter web add next@^16 react@^19 react-dom@^19 jose@^6 react-hook-form@^7 @hookform/resolvers@^5 zod@^4 server-only "@open-boox/shared@workspace:*"
pnpm --filter web add -D typescript@^5 @types/react@^19 @types/react-dom@^19 @types/node@^22 tailwindcss@^4 @tailwindcss/postcss@^4 vitest@^3 dotenv-cli
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "es2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
```

`apps/web/postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`apps/web/vitest.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['node_modules/**', '.next/**'] },
});
```

- [ ] **Step 2: Design tokens và CSS gốc**

Run: `cp ui_design/theme.css apps/web/app/theme.css`
(File `theme.css` gốc không có lỗi `#40372`; lỗi đó chỉ nằm ở `ui_design/variables.css`, không dùng trong app. Không sửa gì trong `ui_design/`.)

`apps/web/app/globals.css`:
```css
@import "tailwindcss";
@import "./theme.css";

@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

html {
  background: var(--color-walnut-shadow);
  color: var(--color-warm-cream);
}

body {
  font-family: var(--font-sans);
  background: var(--color-walnut-shadow);
  color: var(--color-warm-cream);
}
```

- [ ] **Step 3: Component UI**

`apps/web/components/ui/button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'filled' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  filled: 'rounded-[36px] bg-bark-brown px-6 py-3.5',
  ghost: 'rounded-[22.5px] border border-warm-cream px-5 py-2',
};

export function Button({
  variant = 'filled',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`text-[14px] font-medium uppercase leading-none text-warm-cream disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
```

`apps/web/components/ui/text-field.tsx`:
```tsx
import { forwardRef, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField({ label, error, id, ...props }, ref) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[12px] font-medium uppercase">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className="rounded-none border-0 border-b border-warm-cream bg-transparent px-0.5 py-1 text-[16px] outline-none focus:border-ember-accent"
        {...props}
      />
      {error && <p className="text-[12px] text-ember-accent">{error}</p>}
    </div>
  );
});
```

`apps/web/components/ui/page-title.tsx`:
```tsx
import type { ReactNode } from 'react';

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[41px] font-medium uppercase leading-[0.9]">{children}</h1>;
}
```

`apps/web/components/site-header.tsx` (bản tĩnh; Task 10 thay):
```tsx
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-dashed border-cork-border px-6 py-5">
      <Link href="/" className="text-[14px] font-medium uppercase">
        Open Boox
      </Link>
      <nav className="flex gap-6 text-[12px] font-medium uppercase">
        <Link href="/login">Đăng nhập</Link>
        <Link href="/register">Đăng ký</Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Layout, landing, trang lỗi**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Open Boox',
  description: 'Mượn sách theo gói, mua sách và giao tận nơi.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

`apps/web/app/page.tsx`:
```tsx
const SERVICES = [
  { title: 'Mượn theo gói', body: 'Đăng ký một gói, giữ nhiều cuốn cùng lúc, trả cuốn này để mượn cuốn khác.' },
  { title: 'Mua sách', body: 'Chọn sách, thanh toán một lần, sách là của bạn.' },
  { title: 'Giao tận nơi', body: 'Chúng tôi giao sách đến cửa và đến lấy lại khi bạn trả.' },
];

export default function HomePage() {
  return (
    <section className="flex min-h-[calc(100vh-61px)] flex-col justify-between gap-12 px-6 py-12">
      <div className="flex flex-col gap-4">
        <p className="text-[12px] font-medium uppercase">Đọc nhiều hơn, sở hữu ít hơn.</p>
        <p className="text-[51px] font-medium uppercase leading-[0.9]">Open Boox</p>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {SERVICES.map((s) => (
          <li key={s.title} className="flex flex-col gap-3 border-t border-dashed border-cork-border pt-4">
            <h2 className="text-[24px] font-medium uppercase leading-[1.09]">{s.title}</h2>
            <p className="text-[18px] leading-[1.26]">{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/app/error.tsx`:
```tsx
'use client';

import { Button } from '@/components/ui/button';

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-[24px] font-medium uppercase">Đã có lỗi xảy ra</h1>
      <p className="text-[16px]">Vui lòng thử lại sau ít phút.</p>
      <Button variant="ghost" onClick={reset} className="self-start">
        Thử lại
      </Button>
    </div>
  );
}
```

`apps/web/app/not-found.tsx`:
```tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="text-[24px] font-medium uppercase">Không tìm thấy trang</h1>
      <Link href="/" className="text-[12px] font-medium uppercase underline">
        Về trang chủ
      </Link>
    </div>
  );
}
```

`apps/web/app/global-error.tsx`:
```tsx
'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ background: '#100904', color: '#ffedd7', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ textTransform: 'uppercase', fontWeight: 500 }}>Đã có lỗi xảy ra</h1>
        <button onClick={reset} style={{ color: 'inherit', textTransform: 'uppercase' }}>
          Thử lại
        </button>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Build và typecheck**

Run: `pnpm --filter web build && pnpm --filter web typecheck`
Expected: build thành công, route `/` được liệt kê; typecheck không lỗi. (Next có thể tự chỉnh `tsconfig.json` như `jsx: "react-jsx"` — chấp nhận và commit thay đổi đó.)

- [ ] **Step 6: Kiểm tra bằng mắt**

Run: `pnpm dev`, mở http://localhost:3000.
Expected: nền nâu đen `#100904`, chữ kem, header có viền nét đứt, tiêu đề "OPEN BOOX" lớn, ba dịch vụ; dấu tiếng Việt ở chữ in hoa hiển thị đúng. Dừng `pnpm dev`.

- [ ] **Step 7: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): next.js app with design system, layout and error pages"
```

---

### Task 10: Lớp gọi API phía web + header theo user

**Files:**
- Create: `apps/web/lib/api/{error.ts,server.ts,client.ts}`, `apps/web/lib/errors/{messages.ts,form.ts}`
- Modify: `apps/web/components/site-header.tsx`
- Test: `apps/web/lib/api/error.test.ts`, `apps/web/lib/api/client.test.ts`

**Interfaces:**
- Consumes: `ApiErrorBody`, `ErrorCode`, `isErrorCode`, `PublicUser` (Task 2); rewrite `/api` (Task 9).
- Produces:
  - `class ApiError extends Error { status: number; code: ErrorCode; fields?: Record<string,string>; static fromResponse(res: Response): Promise<ApiError> }`
  - `apiServer<T>(path: string, init?: RequestInit): Promise<T>` — mặc định `cache: 'no-store'`, 401 → `redirect('/login')`
  - `getCurrentUser(): Promise<PublicUser | null>`
  - `apiClient<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T>` — `path` tương đối với `/api` (vd. `'/auth/login'`)
  - `ERROR_MESSAGES: Record<ErrorCode, string>`, `messageFor(code: ErrorCode): string`
  - `applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, setFormError: (m: string) => void): void`

- [ ] **Step 1: Viết test thất bại**

`apps/web/lib/api/error.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ApiError } from './error';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ApiError.fromResponse', () => {
  it('reads code, message and fields from an API error body', async () => {
    const err = await ApiError.fromResponse(
      json(400, { statusCode: 400, code: 'VALIDATION_ERROR', message: 'bad', fields: { email: 'x' } }),
    );
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'bad', fields: { email: 'x' } });
  });

  it('falls back to INTERNAL_ERROR for a non-JSON body such as a proxy error page', async () => {
    const err = await ApiError.fromResponse(new Response('<html>Bad Gateway</html>', { status: 502 }));
    expect(err).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('falls back to UNAUTHENTICATED for a bare 401', async () => {
    const err = await ApiError.fromResponse(new Response('', { status: 401 }));
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('ignores unknown codes', async () => {
    const err = await ApiError.fromResponse(json(418, { code: 'TEAPOT', message: 'x' }));
    expect(err.code).toBe('INTERNAL_ERROR');
  });
});
```

`apps/web/lib/api/client.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { ApiError } from './error';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const unauthenticated = () => json(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'x' });

describe('apiClient', () => {
  const assign = vi.fn();
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/account', assign } });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    assign.mockReset();
  });

  it('sends JSON with the content-type header under /api', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));
    await apiClient('/things', { method: 'POST', body: { a: 1 } });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/things',
      expect.objectContaining({
        method: 'POST',
        body: '{"a":1}',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
      }),
    );
  });

  it('refreshes once on 401 and retries the original request', async () => {
    fetchMock
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(json(200, {}))
      .mockResolvedValueOnce(json(200, { value: 42 }));
    await expect(apiClient<{ value: number }>('/things')).resolves.toEqual({ value: 42 });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/things', '/api/auth/refresh', '/api/things']);
  });

  it('redirects to login with next when the refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(unauthenticated()).mockResolvedValueOnce(unauthenticated());
    await expect(apiClient('/things')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/login?next=%2Faccount');
  });

  it('never refreshes for /auth/* calls such as a wrong-password login', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' }));
    await expect(apiClient('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiClient('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter web test`
Expected: FAIL — không tìm thấy `./error`, `./client`.

- [ ] **Step 3: Viết mã**

`apps/web/lib/api/error.ts`:
```ts
import { type ApiErrorBody, type ErrorCode, isErrorCode } from '@open-boox/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    try {
      const body = (await res.json()) as Partial<ApiErrorBody>;
      if (isErrorCode(body.code)) {
        return new ApiError(res.status, body.code, body.message ?? body.code, body.fields);
      }
    } catch {
      // Body was not JSON (e.g. a proxy error page); fall through.
    }
    return new ApiError(res.status, res.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR', res.statusText);
  }
}
```

`apps/web/lib/api/client.ts`:
```ts
import { ApiError } from './error';

const JSON_HEADERS = { 'content-type': 'application/json' };

interface Options {
  method?: string;
  body?: unknown;
}

function send(path: string, { method = 'GET', body }: Options): Promise<Response> {
  const payload = body !== undefined ? JSON.stringify(body) : method === 'GET' ? undefined : '{}';
  return fetch(`/api${path}`, { method, headers: JSON_HEADERS, body: payload, credentials: 'same-origin' });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await ApiError.fromResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiClient<T>(path: string, options: Options = {}): Promise<T> {
  const res = await send(path, options);
  if (res.status !== 401 || path.startsWith('/auth/')) return parse<T>(res);

  const refreshed = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: '{}',
    credentials: 'same-origin',
  });
  if (refreshed.ok) return parse<T>(await send(path, options));

  window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  throw await ApiError.fromResponse(res);
}
```

`apps/web/lib/api/server.ts`:
```ts
import 'server-only';
import type { PublicUser } from '@open-boox/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from './error';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

async function forward(path: string, init: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: { ...init.headers, cookie: cookieHeader },
  });
}

export async function apiServer<T>(path: string, init: RequestInit = { cache: 'no-store' }): Promise<T> {
  const res = await forward(path, init);
  if (res.status === 401) redirect('/login');
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as T;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const res = await forward('/auth/me', { cache: 'no-store' });
  if (res.status === 401) return null;
  if (!res.ok) throw await ApiError.fromResponse(res);
  return (await res.json()) as PublicUser;
}
```

`apps/web/lib/errors/messages.ts`:
```ts
import type { ErrorCode } from '@open-boox/shared';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ, vui lòng kiểm tra lại.',
  UNAUTHENTICATED: 'Bạn cần đăng nhập để tiếp tục.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu.',
  LOAN_LIMIT_EXCEEDED: 'Bạn đã đạt số sách tối đa của gói.',
  OUT_OF_STOCK: 'Sách đã hết hàng.',
  NO_COPY_AVAILABLE: 'Hiện không còn bản sách để cho mượn.',
  SUBSCRIPTION_INACTIVE: 'Gói đăng ký chưa kích hoạt hoặc đã hết hạn.',
  SUBSCRIPTION_ALREADY_EXISTS: 'Bạn đã có gói đang hoạt động hoặc đang chờ thanh toán.',
  ORDER_NOT_CANCELLABLE: 'Đơn hàng không thể hủy ở trạng thái hiện tại.',
  INVALID_SHIPMENT_TRANSITION: 'Không thể chuyển sang trạng thái giao hàng này.',
  LOAN_NOT_RETURNABLE: 'Sách này không ở trạng thái có thể trả.',
  DUPLICATE: 'Dữ liệu đã tồn tại.',
  IN_USE: 'Dữ liệu đã phát sinh giao dịch, không thể xóa.',
  UNSUPPORTED_MEDIA_TYPE: 'Định dạng yêu cầu không được hỗ trợ.',
  INTERNAL_ERROR: 'Đã có lỗi xảy ra, vui lòng thử lại.',
};

export function messageFor(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}
```

`apps/web/lib/errors/form.ts`:
```ts
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/error';
import { messageFor } from './messages';

export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  setFormError: (message: string) => void,
): void {
  if (error instanceof ApiError && error.fields && Object.keys(error.fields).length > 0) {
    for (const [field, message] of Object.entries(error.fields)) setError(field as Path<T>, { message });
    return;
  }
  setFormError(messageFor(error instanceof ApiError ? error.code : 'INTERNAL_ERROR'));
}
```

Thay `apps/web/components/site-header.tsx`:
```tsx
import Link from 'next/link';
import { getCurrentUser } from '@/lib/api/server';

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="flex items-center justify-between border-b border-dashed border-cork-border px-6 py-5">
      <Link href="/" className="text-[14px] font-medium uppercase">
        Open Boox
      </Link>
      <nav className="flex gap-6 text-[12px] font-medium uppercase">
        {user ? (
          <Link href="/account">Tài khoản</Link>
        ) : (
          <>
            <Link href="/login">Đăng nhập</Link>
            <Link href="/register">Đăng ký</Link>
          </>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Chạy test, typecheck, build**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build`
Expected: 9 test PASS; typecheck và build thành công (các route giờ là dynamic vì header đọc cookie — đúng như thiết kế).

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): api client/server helpers, error messages and user-aware header"
```

---

### Task 11: Proxy — refresh token và chặn route

**Files:**
- Create: `apps/web/lib/auth/{session.ts,route-access.ts,set-cookie.ts}`, `apps/web/proxy.ts`
- Test: `apps/web/lib/auth/session.test.ts`, `apps/web/lib/auth/route-access.test.ts`, `apps/web/lib/auth/set-cookie.test.ts`, `apps/web/proxy.test.ts`

**Interfaces:**
- Consumes: `Role` (Task 2); API `POST /api/auth/refresh` trả `Set-Cookie` (Task 6).
- Produces:
  - `interface SessionClaims { sub: string; role: Role; exp: number }`
  - `verifyAccessToken(token: string | undefined, secret: string): Promise<SessionClaims | null>`
  - `REFRESH_THRESHOLD_SECONDS = 60`, `needsRefresh(claims: SessionClaims | null, nowSeconds: number): boolean`
  - `type AccessDecision = { type: 'allow' } | { type: 'redirect'; to: string }`
  - `decideAccess(pathname: string, search: string, session: { role: Role } | null): AccessDecision`
  - `safeNextPath(raw: string | null | undefined, fallback?: string): string` (mặc định `'/account'`)
  - `parseSetCookie(raw: string): { name: string; value: string } | null`
  - `proxy(request: NextRequest): Promise<NextResponse>`, `config.matcher`

- [ ] **Step 1: Viết test thất bại**

`apps/web/lib/auth/session.test.ts`:
```ts
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { needsRefresh, verifyAccessToken } from './session';

const SECRET = 'test-access-secret-0123456789abcdef-xyz';
const key = (s: string) => new TextEncoder().encode(s);
const now = () => Math.floor(Date.now() / 1000);

function sign(payload: Record<string, unknown>, expInSeconds: number, secret = SECRET) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setExpirationTime(now() + expInSeconds)
    .sign(key(secret));
}

describe('verifyAccessToken', () => {
  it('returns claims for a valid token', async () => {
    const token = await sign({ role: 'ADMIN' }, 900);
    expect(await verifyAccessToken(token, SECRET)).toMatchObject({ sub: 'user-1', role: 'ADMIN' });
  });

  it('rejects an ADMIN token signed with another secret', async () => {
    const token = await sign({ role: 'ADMIN' }, 900, 'attacker-secret-attacker-secret-0000');
    expect(await verifyAccessToken(token, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    expect(await verifyAccessToken(await sign({ role: 'CUSTOMER' }, -10), SECRET)).toBeNull();
  });

  it('rejects an unknown role and a missing token', async () => {
    expect(await verifyAccessToken(await sign({ role: 'ROOT' }, 900), SECRET)).toBeNull();
    expect(await verifyAccessToken(undefined, SECRET)).toBeNull();
  });
});

describe('needsRefresh', () => {
  it('is true without a session or when under 60 seconds remain', () => {
    expect(needsRefresh(null, 1000)).toBe(true);
    expect(needsRefresh({ sub: 'u', role: 'CUSTOMER', exp: 1059 }, 1000)).toBe(true);
  });

  it('is false with 60 seconds or more remaining', () => {
    expect(needsRefresh({ sub: 'u', role: 'CUSTOMER', exp: 1060 }, 1000)).toBe(false);
  });
});
```

`apps/web/lib/auth/route-access.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decideAccess, safeNextPath } from './route-access';

const customer = { role: 'CUSTOMER' as const };
const admin = { role: 'ADMIN' as const };

describe('decideAccess', () => {
  it.each(['/', '/books', '/accounting', '/administrator', '/login'])('allows %s anonymously', (path) => {
    expect(decideAccess(path, '', null)).toEqual({ type: 'allow' });
  });

  it.each(['/account', '/account/orders', '/checkout', '/borrow/confirm', '/admin', '/admin/orders'])(
    'sends anonymous users on %s to login',
    (path) => {
      expect(decideAccess(path, '', null)).toEqual({
        type: 'redirect',
        to: `/login?next=${encodeURIComponent(path)}`,
      });
    },
  );

  it('keeps the query string in next', () => {
    expect(decideAccess('/account/orders', '?page=2', null)).toEqual({
      type: 'redirect',
      to: '/login?next=%2Faccount%2Forders%3Fpage%3D2',
    });
  });

  it('sends customers away from /admin to home', () => {
    expect(decideAccess('/admin/orders', '', customer)).toEqual({ type: 'redirect', to: '/' });
  });

  it('lets customers into /account and admins into /admin', () => {
    expect(decideAccess('/account', '', customer)).toEqual({ type: 'allow' });
    expect(decideAccess('/admin', '', admin)).toEqual({ type: 'allow' });
  });
});

describe('safeNextPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeNextPath('/account/orders?page=2')).toBe('/account/orders?page=2');
  });

  it.each([undefined, null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'account'])(
    'falls back to /account for %s',
    (raw) => {
      expect(safeNextPath(raw)).toBe('/account');
    },
  );
});
```

`apps/web/lib/auth/set-cookie.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSetCookie } from './set-cookie';

describe('parseSetCookie', () => {
  it('reads name and value, ignoring attributes', () => {
    expect(parseSetCookie('access_token=abc.def=; Path=/; HttpOnly')).toEqual({ name: 'access_token', value: 'abc.def=' });
  });

  it('returns an empty value for a cleared cookie', () => {
    expect(parseSetCookie('refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT')).toEqual({
      name: 'refresh_token',
      value: '',
    });
  });

  it('returns null for garbage', () => {
    expect(parseSetCookie('=nope')).toBeNull();
    expect(parseSetCookie('novalue')).toBeNull();
  });
});
```

`apps/web/proxy.test.ts`:
```ts
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

const SECRET = 'test-access-secret-0123456789abcdef-xyz';

function token(role: string, expInSeconds: number) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setExpirationTime(Math.floor(Date.now() / 1000) + expInSeconds)
    .sign(new TextEncoder().encode(SECRET));
}

function refreshResponse(status: number, setCookies: string[]) {
  const headers = new Headers();
  for (const c of setCookies) headers.append('set-cookie', c);
  return new Response(null, { status, headers });
}

describe('proxy', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('JWT_ACCESS_SECRET', SECRET);
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test');
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('redirects anonymous visitors of /account to login with next', async () => {
    const res = await proxy(new NextRequest('http://localhost/account?tab=1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Faccount%3Ftab%3D1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call refresh when the access token is fresh', async () => {
    const fresh = await token('CUSTOMER', 900);
    const res = await proxy(
      new NextRequest('http://localhost/account', { headers: { cookie: `access_token=${fresh}; refresh_token=r1` } }),
    );
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a near-expiry token and forwards the new cookies to the request and the browser', async () => {
    const renewed = await token('CUSTOMER', 900);
    fetchMock.mockResolvedValueOnce(
      refreshResponse(200, [`access_token=${renewed}; Path=/; HttpOnly`, 'refresh_token=r2; Path=/; HttpOnly']),
    );
    const old = await token('CUSTOMER', 30);
    const res = await proxy(
      new NextRequest('http://localhost/account', { headers: { cookie: `access_token=${old}; refresh_token=r1` } }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test/api/auth/refresh',
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ cookie: expect.stringContaining('refresh_token=r1') }) }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([
      `access_token=${renewed}; Path=/; HttpOnly`,
      'refresh_token=r2; Path=/; HttpOnly',
    ]);
    // Next.js forwards overridden request cookies to Server Components via this header.
    expect(res.headers.get('x-middleware-request-cookie')).toContain(`access_token=${renewed}`);
  });

  it('lets public pages render when the refresh call fails at the network level', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const res = await proxy(new NextRequest('http://localhost/books', { headers: { cookie: 'refresh_token=r1' } }));
    expect(res.status).toBe(200);
  });

  it('forwards cleared cookies and redirects to login when refresh is rejected on a protected page', async () => {
    fetchMock.mockResolvedValueOnce(
      refreshResponse(401, ['access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT']),
    );
    const res = await proxy(new NextRequest('http://localhost/account', { headers: { cookie: 'refresh_token=stale' } }));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Faccount');
    expect(res.headers.getSetCookie()).toHaveLength(2);
  });

  it('treats a forged ADMIN token as anonymous', async () => {
    const forged = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(new TextEncoder().encode('attacker-secret-attacker-secret-0000'));
    const res = await proxy(new NextRequest('http://localhost/admin', { headers: { cookie: `access_token=${forged}` } }));
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fadmin');
  });

  it('sends a customer away from /admin', async () => {
    const customer = await token('CUSTOMER', 900);
    const res = await proxy(new NextRequest('http://localhost/admin', { headers: { cookie: `access_token=${customer}` } }));
    expect(res.headers.get('location')).toBe('http://localhost/');
  });
});
```

- [ ] **Step 2: Chạy test để thấy thất bại**

Run: `pnpm --filter web test`
Expected: FAIL — không tìm thấy `./session`, `./route-access`, `./set-cookie`, `./proxy`.

- [ ] **Step 3: Viết mã**

`apps/web/lib/auth/session.ts`:
```ts
import type { Role } from '@open-boox/shared';
import { jwtVerify } from 'jose';

export interface SessionClaims {
  sub: string;
  role: Role;
  exp: number;
}

export const REFRESH_THRESHOLD_SECONDS = 60;

export async function verifyAccessToken(token: string | undefined, secret: string): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.role !== 'CUSTOMER' && payload.role !== 'ADMIN') return null;
    return { sub: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

export function needsRefresh(claims: SessionClaims | null, nowSeconds: number): boolean {
  return !claims || claims.exp - nowSeconds < REFRESH_THRESHOLD_SECONDS;
}
```

`apps/web/lib/auth/route-access.ts`:
```ts
import type { Role } from '@open-boox/shared';

export type AccessDecision = { type: 'allow' } | { type: 'redirect'; to: string };

const LOGIN_REQUIRED = ['/account', '/checkout', '/borrow'];
const ALLOW: AccessDecision = { type: 'allow' };

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function decideAccess(pathname: string, search: string, session: { role: Role } | null): AccessDecision {
  const adminOnly = under(pathname, '/admin');
  const loginRequired = adminOnly || LOGIN_REQUIRED.some((prefix) => under(pathname, prefix));
  if (!loginRequired) return ALLOW;
  if (!session) return { type: 'redirect', to: `/login?next=${encodeURIComponent(pathname + search)}` };
  if (adminOnly && session.role !== 'ADMIN') return { type: 'redirect', to: '/' };
  return ALLOW;
}

export function safeNextPath(raw: string | null | undefined, fallback = '/account'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}
```

`apps/web/lib/auth/set-cookie.ts`:
```ts
export function parseSetCookie(raw: string): { name: string; value: string } | null {
  const pair = raw.split(';', 1)[0] ?? '';
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  return { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() };
}
```

`apps/web/proxy.ts`:
```ts
import { type NextRequest, NextResponse } from 'next/server';
import { decideAccess } from './lib/auth/route-access';
import { needsRefresh, verifyAccessToken } from './lib/auth/session';
import { parseSetCookie } from './lib/auth/set-cookie';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

async function callRefresh(request: NextRequest): Promise<string[] | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  try {
    const res = await fetch(`${apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
      body: '{}',
    });
    return res.headers.getSetCookie();
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.JWT_ACCESS_SECRET ?? '';
  let claims = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, secret);
  const setCookies: string[] = [];

  if (needsRefresh(claims, Math.floor(Date.now() / 1000)) && request.cookies.has(REFRESH_COOKIE)) {
    const refreshed = await callRefresh(request);
    for (const raw of refreshed ?? []) {
      const cookie = parseSetCookie(raw);
      if (!cookie) continue;
      setCookies.push(raw);
      // Mutating request.cookies rewrites the cookie header that Server Components receive in this request.
      if (cookie.value) request.cookies.set(cookie.name, cookie.value);
      else request.cookies.delete(cookie.name);
    }
    if (setCookies.length > 0) {
      claims = await verifyAccessToken(request.cookies.get(ACCESS_COOKIE)?.value, secret);
    }
  }

  const decision = decideAccess(request.nextUrl.pathname, request.nextUrl.search, claims);
  const response =
    decision.type === 'redirect'
      ? NextResponse.redirect(new URL(decision.to, request.url))
      : NextResponse.next({ request: { headers: request.headers } });
  for (const raw of setCookies) response.headers.append('set-cookie', raw);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Chạy test, typecheck, build**

Run: `pnpm --filter web test && pnpm --filter web typecheck && pnpm --filter web build`
Expected: toàn bộ test PASS; build liệt kê `Proxy` (hoặc `Middleware`). Nếu test `x-middleware-request-cookie` thất bại do phiên bản Next đổi tên header nội bộ, in `[...res.headers]` ra, cập nhật đúng tên header đang chứa cookie request và ghi lại trong commit message.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): proxy with token refresh and route protection"
```

---

### Task 12: Trang đăng nhập, đăng ký, tài khoản

**Files:**
- Create: `apps/web/app/(auth)/login/{page.tsx,login-form.tsx}`, `apps/web/app/(auth)/register/{page.tsx,register-form.tsx}`, `apps/web/app/account/{page.tsx,logout-button.tsx}`

**Interfaces:**
- Consumes: `loginSchema`, `registerSchema`, `PublicUser` (Task 2); `apiClient`, `apiServer`, `applyApiError` (Task 10); `safeNextPath` (Task 11); `Button`, `TextField`, `PageTitle` (Task 9).
- Produces: route `/login?next=…`, `/register?next=…`, `/account`.

- [ ] **Step 1: Trang đăng nhập**

`apps/web/app/(auth)/login/login-form.tsx`:
```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/login', { method: 'POST', body: values });
      router.replace(next);
      router.refresh();
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
      <TextField
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        {...register('password')}
        error={errors.password?.message}
      />
      {formError && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Đăng nhập
      </Button>
      <p className="text-[14px]">
        Chưa có tài khoản?{' '}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium uppercase underline">
          Đăng ký
        </Link>
      </p>
    </form>
  );
}
```

`apps/web/app/(auth)/login/page.tsx`:
```tsx
import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-10 px-4 py-16">
      <PageTitle>Đăng nhập</PageTitle>
      <LoginForm next={safeNextPath(next)} />
    </div>
  );
}
```

- [ ] **Step 2: Trang đăng ký**

`apps/web/app/(auth)/register/register-form.tsx`:
```tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@open-boox/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { apiClient } from '@/lib/api/client';
import { applyApiError } from '@/lib/errors/form';

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiClient('/auth/register', { method: 'POST', body: values });
      router.replace(next);
      router.refresh();
    } catch (error) {
      applyApiError(error, setError, setFormError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <TextField label="Họ tên" autoComplete="name" {...register('fullName')} error={errors.fullName?.message} />
      <TextField
        label="Số điện thoại"
        type="tel"
        autoComplete="tel"
        {...register('phone')}
        error={errors.phone?.message}
      />
      <TextField label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
      <TextField
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        {...register('password')}
        error={errors.password?.message}
      />
      {formError && (
        <p role="alert" className="text-[14px] text-ember-accent">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="self-start">
        Tạo tài khoản
      </Button>
      <p className="text-[14px]">
        Đã có tài khoản?{' '}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium uppercase underline">
          Đăng nhập
        </Link>
      </p>
    </form>
  );
}
```

`apps/web/app/(auth)/register/page.tsx`:
```tsx
import { PageTitle } from '@/components/ui/page-title';
import { safeNextPath } from '@/lib/auth/route-access';
import { RegisterForm } from './register-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col gap-10 px-4 py-16">
      <PageTitle>Đăng ký</PageTitle>
      <RegisterForm next={safeNextPath(next)} />
    </div>
  );
}
```

- [ ] **Step 3: Trang tài khoản**

`apps/web/app/account/logout-button.tsx`:
```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await apiClient('/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" onClick={logout} disabled={pending} className="self-start">
      Đăng xuất
    </Button>
  );
}
```

`apps/web/app/account/page.tsx`:
```tsx
import type { PublicUser } from '@open-boox/shared';
import { PageTitle } from '@/components/ui/page-title';
import { apiServer } from '@/lib/api/server';
import { LogoutButton } from './logout-button';

export default async function AccountPage() {
  const user = await apiServer<PublicUser>('/auth/me');
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16">
      <PageTitle>Tài khoản</PageTitle>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-8 gap-y-4 rounded-[12px] border border-dashed border-cork-border p-6 text-[16px]">
        <dt className="text-[12px] font-medium uppercase">Họ tên</dt>
        <dd>{user.fullName}</dd>
        <dt className="text-[12px] font-medium uppercase">Email</dt>
        <dd>{user.email}</dd>
        <dt className="text-[12px] font-medium uppercase">Điện thoại</dt>
        <dd>{user.phone}</dd>
      </dl>
      <LogoutButton />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck và build**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: thành công; build liệt kê `/login`, `/register`, `/account`.

- [ ] **Step 5: Kiểm tra end-to-end bằng trình duyệt**

Run: `pnpm dev` (đã chạy `pnpm db:setup` ở Task 8), mở http://localhost:3000 và làm lần lượt:
1. Vào `/account` khi chưa đăng nhập → bị chuyển tới `/login?next=%2Faccount`.
2. Bấm "Đăng ký", gửi form trống → lỗi tiếng Việt hiện dưới từng ô.
3. Đăng ký `  Test@Mail.COM ` / `matkhau123` / `Người Thử` / `0912345678` → về `/account`, thấy email `test@mail.com`; header hiện "TÀI KHOẢN".
4. Đăng xuất → về `/`, header hiện "ĐĂNG NHẬP".
5. Đăng nhập sai mật khẩu → "Email hoặc mật khẩu không đúng."
6. Mở `/login?next=https://evil.com`, đăng nhập đúng → về `/account`.
7. Đăng nhập bằng `admin@openboox.test`, vào `/admin` → không bị chuyển về `/` (trang 404 là đúng — trang admin thuộc M3); đăng nhập bằng customer, vào `/admin` → về `/`.
8. DevTools → Application → Cookies: `access_token`, `refresh_token` đều HttpOnly, SameSite Lax, Path `/`. Xóa riêng `access_token`, tải lại `/account` → vẫn vào được và `access_token` mới xuất hiện (proxy đã refresh).

Expected: cả 8 bước đúng như mô tả. Dừng `pnpm dev`.

- [ ] **Step 6: Chạy toàn bộ kiểm tra của repo**

Run: `pnpm typecheck && pnpm test`
Expected: toàn bộ package PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): login, register and account pages"
```
