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

test.describe('reduced motion scroll reveals', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every revealed heading ends fully visible', async ({ page }) => {
    await page.goto('/');
    const headings = page.locator('[data-anim-slant], [data-heading-reveal]');
    expect(await headings.count()).toBeGreaterThan(0);
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toHaveCSS('opacity', '1');
    }
  });
});

test('category dots select a slide', async ({ page }) => {
  await page.goto('/');
  const dots = page.getByRole('tablist', { name: 'Chọn thể loại' }).getByRole('tab');
  await dots.nth(2).scrollIntoViewIfNeeded();
  await dots.nth(2).click();
  await expect(dots.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Thể loại trước' }).click();
  await expect(dots.nth(1)).toHaveAttribute('aria-selected', 'true');
});

test('tabs follow the arrow keys', async ({ page }) => {
  await page.goto('/');
  const tablist = page.getByRole('tablist', { name: 'Cách dùng Open Boox' });
  await tablist.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500); // the one-time auto-advance has fired by now
  await tablist.getByRole('tab', { name: 'Mượn' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(tablist.getByRole('tab', { name: 'Mua' })).toHaveAttribute('aria-selected', 'true');
  await expect(tablist.getByRole('tab', { name: 'Mua' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(tablist.getByRole('tab', { name: 'Giao' })).toHaveAttribute('aria-selected', 'true');
});

test('how it works: the nav anchor scrolls there and the next button moves the stack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.getByRole('navigation', { name: 'Chính' }).getByRole('link', { name: 'Cách hoạt động' }).click();
  const section = page.locator('#cach-hoat-dong');
  await expect(section).toBeInViewport();
  const track = section.locator('.obx-how__track');
  const trackX = () => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(await trackX()).toBe(0);
  await section.getByRole('button', { name: 'Bước tiếp' }).click();
  await expect.poll(trackX).toBeLessThan(-100);
});

test('FAQ answers the shipping question with the configured fees', async ({ page }) => {
  await page.goto('/');
  const question = page.getByText('Phí giao bao nhiêu?');
  await question.scrollIntoViewIfNeeded();
  await question.click();
  await expect(page.getByText(/Hà Nội 20\.000 đ, các tỉnh khác 35\.000 đ/)).toBeVisible();
  // The footer sits inside <main>, so it has no contentinfo role; select it by class.
  await expect(page.locator('footer.obx-footer')).toContainText('© 2026 Open Boox');
});

test.describe('curtain', () => {
  const cta = (page: Page) => page.getByRole('link', { name: 'Chọn gói mượn ↗' });
  const curtain = (page: Page) => page.locator('[data-curtain]');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
  });

  test('CTA plays the curtain and lands on a usable /plans', async ({ page }) => {
    await cta(page).click();
    await expect(curtain(page)).not.toHaveAttribute('data-state', 'idle');
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.getByRole('link', { name: 'Sách', exact: true }).first().click({ trial: true });
  });

  test('back to the landing after a curtain navigation', async ({ page }) => {
    await cta(page).click();
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.locator('.obx-hero__tagline')).toBeVisible();
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle');
    await cta(page).click({ trial: true });
  });

  test('double click navigates once', async ({ page }) => {
    await cta(page).dblclick();
    await page.waitForURL('**/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle', { timeout: 5000 });
    await page.goBack();
    await page.waitForURL((url) => url.pathname === '/');
  });

  test('modifier click opens a new tab without the curtain', async ({ page, context }) => {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      cta(page).click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await popup.waitForURL('**/plans');
    expect(new URL(popup.url()).pathname).toBe('/plans');
    await expect(curtain(page)).toHaveAttribute('data-state', 'idle');
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('curtain with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('fades instead and still lands on /plans', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Chọn gói mượn ↗' }).click();
    await page.waitForURL('**/plans');
    await expect(page.locator('[data-curtain]')).toHaveAttribute('data-state', 'idle', { timeout: 3000 });
  });
});

test.describe('landing a11y and focus', () => {
  test('hero tagline is announced', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(await page.locator('.obx-hero__tagline').ariaSnapshot()).toContain('Đọc nhiều hơn. Sở hữu ít hơn.');
  });

  test('split headings keep word boundaries', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('heading', { name: 'Giữ nhiều cuốn cùng lúc' })).toBeAttached();
  });

  test('mobile menu is next in tab order', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Mở menu' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Đóng menu' })).toHaveAttribute('aria-expanded', 'true');
    await expect(navPill(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(navPill(page)).toBeFocused();
  });

  test('focused category slide is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.locator('.obx-cats__viewport').scrollIntoViewIfNeeded();
    await page.locator('.obx-cat').nth(2).focus();
    await page.waitForTimeout(1000);
    await expect(page.locator('.obx-cat').nth(2)).toBeInViewport({ ratio: 0.9 });
  });
});
