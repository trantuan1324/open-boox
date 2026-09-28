import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
// Suites log in/register far more than 10 times a minute; rate-limit.e2e-spec.ts restores the defaults.
process.env.AUTH_LOGIN_RATE_LIMIT = '1000';
process.env.AUTH_REGISTER_RATE_LIMIT = '1000';
// No web app runs under test: keep RevalidationService a no-op (revalidation.e2e-spec.ts spies on it).
delete process.env.WEB_INTERNAL_URL;
delete process.env.REVALIDATE_SECRET;
