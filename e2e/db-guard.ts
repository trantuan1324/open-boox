// prepare.ts drops the whole public schema, so it must only ever touch a database reserved for E2E.
export function assertE2eDatabase(targetUrl: string, devUrl: string | undefined): void {
  const name = new URL(targetUrl).pathname.slice(1);
  if (!name.endsWith('_e2e')) {
    throw new Error(`Refusing to reset database "${name}": the E2E database name must end with _e2e`);
  }
  if (devUrl !== undefined && devUrl === targetUrl) {
    throw new Error('Refusing to reset: DATABASE_URL_E2E equals DATABASE_URL in .env');
  }
}
