import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';
