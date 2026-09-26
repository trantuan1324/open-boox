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
