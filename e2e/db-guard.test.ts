import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertE2eDatabase } from './db-guard';

const E2E = 'postgresql://u:p@localhost:5433/bookstore_e2e';
const DEV = 'postgresql://u:p@localhost:5433/bookstore';

test('accepts an _e2e database that differs from the dev DATABASE_URL', () => {
  assert.doesNotThrow(() => assertE2eDatabase(E2E, DEV));
});

test('accepts an _e2e database when there is no .env to compare with', () => {
  assert.doesNotThrow(() => assertE2eDatabase(E2E, undefined));
});

test('rejects a database whose name does not end with _e2e', () => {
  assert.throws(() => assertE2eDatabase(DEV, undefined), /_e2e/);
});

test('rejects the suffix hidden in the query string', () => {
  assert.throws(() => assertE2eDatabase(`${DEV}?schema=x_e2e`, undefined), /_e2e/);
});

test('rejects a target equal to the dev DATABASE_URL', () => {
  assert.throws(() => assertE2eDatabase(E2E, E2E), /DATABASE_URL/);
});
