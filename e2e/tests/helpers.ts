import { type Browser, expect, type Page } from '@playwright/test';
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

export async function openOnlyShipment(
  admin: Page,
  type: 'ORDER_DELIVERY' | 'LOAN_DELIVERY' | 'LOAN_PICKUP',
): Promise<void> {
  await admin.goto(`/admin/shipments?type=${type}`);
  // The first link of the row is the "Ngày tạo" cell, which opens the shipment.
  await admin.locator('tbody tr').first().getByRole('link').first().click();
  await admin.waitForURL(/\/admin\/shipments\/[^/?]+$/);
}

export async function deliverShipment(admin: Page): Promise<void> {
  for (const status of ['PICKED_UP', 'IN_TRANSIT', 'DELIVERED']) {
    // selectOption waits until the option exists, i.e. until router.refresh() has shown the previous update.
    await admin.getByLabel('Trạng thái mới').selectOption(status);
    await admin.getByRole('button', { name: 'Cập nhật' }).click();
  }
  await expect(admin.getByText('Lần giao này đã kết thúc.')).toBeVisible();
}
