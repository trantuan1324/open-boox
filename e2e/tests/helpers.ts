import type { Browser, Page } from '@playwright/test';
import { WEB_URL } from '../env';

const ACCOUNTS = {
  ADMIN: { email: 'SEED_ADMIN_EMAIL', password: 'SEED_ADMIN_PASSWORD', home: '/admin' },
  CUSTOMER: { email: 'SEED_CUSTOMER_EMAIL', password: 'SEED_CUSTOMER_PASSWORD', home: '/account' },
} as const;

// One browser context per role, so the customer and the admin keep separate cookies inside one test.
export async function loginAs(browser: Browser, role: keyof typeof ACCOUNTS): Promise<Page> {
  const account = ACCOUNTS[role];
  const context = await browser.newContext({ baseURL: WEB_URL });
  const page = await context.newPage();
  await page.goto(`/login?next=${account.home}`);
  await page.getByLabel('Email').fill(process.env[account.email]!);
  await page.getByLabel('Mật khẩu').fill(process.env[account.password]!);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((url) => url.pathname === account.home);
  return page;
}
