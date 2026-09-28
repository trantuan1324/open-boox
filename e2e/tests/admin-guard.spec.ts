import { test } from '@playwright/test';
import { loginAs } from './helpers';

test('a signed-in customer opening /admin is sent to the home page', async ({ browser }) => {
  const customer = await loginAs(browser, 'CUSTOMER');
  await customer.goto('/admin');
  await customer.waitForURL((url) => url.pathname === '/');
});
