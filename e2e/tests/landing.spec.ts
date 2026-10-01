import { expect, type Page, test } from '@playwright/test';

// 404s from the cover image host are not landing bugs.
const IGNORED = /Failed to load resource/;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !IGNORED.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function scrollToBottom(page: Page): Promise<void> {
  await page.mouse.move(200, 200);
  for (let i = 0; i < 25; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
}

test('landing renders and scrolls to the bottom without errors', async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('region', { name: 'Thông báo' })).toBeVisible();
  await scrollToBottom(page);
  expect(errors).toEqual([]);
});

test('no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await scrollToBottom(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
