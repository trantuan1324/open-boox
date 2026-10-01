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

test('hero has the page heading and shows its tagline after the intro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Open Boox');
  await expect(page.locator('.obx-hero__tagline')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chọn gói mượn ↗' })).toBeVisible();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('hero content is visible straight away', async ({ page }) => {
    await page.goto('/');
    // Shorter than the 2s CSS fallback, so this proves nothing was hidden in the first place.
    await expect(page.getByRole('link', { name: 'Chọn gói mượn ↗' })).toBeVisible({ timeout: 500 });
    await expect(page.locator('.obx-nav')).toBeVisible({ timeout: 500 });
  });
});

const navPill = (page: Page) =>
  page.getByRole('navigation', { name: 'Chính' }).getByRole('link', { name: 'Sách', exact: true });

async function scrollBy(page: Page, dy: number): Promise<void> {
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(1200);
}

test.describe('nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(1500); // hero intro
  });

  test('nav pills hide on scroll down and come back on scroll up', async ({ page }) => {
    await expect(navPill(page)).toBeInViewport();
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await scrollBy(page, -300);
    await expect(navPill(page)).toBeInViewport();
  });

  test('keyboard focus brings hidden nav pills back', async ({ page }) => {
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await navPill(page).focus();
    await expect(navPill(page)).toBeInViewport();
  });

  test('nav still works after resizing across the desktop breakpoint', async ({ page }) => {
    await scrollBy(page, 1500);
    await expect(navPill(page)).not.toBeInViewport();
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(navPill(page)).toBeInViewport();
    await page.setViewportSize({ width: 1440, height: 900 });
    await scrollBy(page, -6000);
    await expect(navPill(page)).toBeInViewport();
  });
});
