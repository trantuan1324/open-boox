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
