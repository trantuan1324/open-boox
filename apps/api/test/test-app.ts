import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  http: string;
}

export async function createTestApp(opts: { controllers?: Type<unknown>[] } = {}): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
    controllers: opts.controllers ?? [],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app);
  // Listen ourselves instead of handing supertest the bare server: supertest would listen(0) on the
  // dual-stack wildcard '::' and then dial 127.0.0.1. macOS lets '::' take a port another process
  // holds on 127.0.0.1 (e.g. an IDE), and the kernel routes 127.0.0.1 traffic to that process.
  await app.listen(0, '127.0.0.1');
  return { app, prisma: app.get(PrismaService), http: await app.getUrl() };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} CASCADE`);
}
