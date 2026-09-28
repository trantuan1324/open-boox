import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import { assertE2eDatabase } from './db-guard';
import { ENV_FILE, ROOT } from './env';

// Runs before `playwright test` (not as globalSetup): Playwright starts webServer before globalSetup, so the
// servers would boot on an old build and a stale database.
const target = process.env.DATABASE_URL!;
// Read the file itself: process.env.DATABASE_URL was just overridden by env.ts.
const devUrl = existsSync(ENV_FILE) ? parse(readFileSync(ENV_FILE)).DATABASE_URL : undefined;
assertE2eDatabase(target, devUrl);

function run(command: string, input?: string): void {
  execSync(command, { cwd: ROOT, input, stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'] });
}

// No `prisma migrate reset`: Prisma 6.19 refuses it when an AI agent runs it. The guard above replaces that prompt.
run('pnpm --filter api exec prisma migrate deploy'); // creates the database on the first run
run(`pnpm --filter api exec prisma db execute --stdin --url "${target}"`, 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
run('pnpm --filter api exec prisma migrate deploy');
run('pnpm --filter api db:seed');

if (process.env.E2E_SKIP_BUILD !== '1') {
  // Straight through pnpm, not turbo: turbo's strict env mode drops the overrides and its cache could
  // replay a web build that points at another API port.
  run('pnpm --filter @open-boox/shared build');
  run('pnpm --filter api build');
  run('pnpm --filter web build');
}
