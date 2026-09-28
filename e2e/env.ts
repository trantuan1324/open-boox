import { resolve } from 'node:path';
import { config } from 'dotenv';

export const ROOT = resolve(__dirname, '..');
export const ENV_FILE = resolve(ROOT, '.env');
export const API_URL = 'http://localhost:4100';
export const WEB_URL = 'http://localhost:3100';

config({ path: ENV_FILE });

const e2eDatabaseUrl = process.env.DATABASE_URL_E2E;
if (!e2eDatabaseUrl) throw new Error('DATABASE_URL_E2E is not set (add it to .env, see .env.example)');

// Assigned, not merged: these must beat the dev values dotenv just loaded. Every child process (prisma, seed,
// builds, webServer) inherits process.env, and the dotenv-cli wrappers in api/web scripts never override it.
// API_INTERNAL_URL matters at build time (rewrites in next.config.ts) and at runtime (proxy.ts refresh call).
Object.assign(process.env, {
  DATABASE_URL: e2eDatabaseUrl,
  API_PORT: '4100',
  API_INTERNAL_URL: API_URL,
  WEB_INTERNAL_URL: WEB_URL,
});
