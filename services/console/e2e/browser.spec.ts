import { type Browser, type Page, expect, test } from '@playwright/test';
import { A, ADMIN, resetFakes } from './helpers.ts';

test.beforeEach(resetFakes);

async function signInThroughPage(page: Page) {
  await page.goto(`${A}/comments`);
  await expect(page).toHaveURL(/\/login\?next=%2Fcomments/);
  await page.getByLabel('Dev sign-in (no Google check)').fill(ADMIN);
  await page.getByRole('button', { name: 'Dev sign-in' }).click();
  await expect(page).toHaveURL(`${A}/comments`);
}

async function flows(browser: Browser, javaScriptEnabled: boolean) {
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();
  await signInThroughPage(page);

  // Publish the oldest pending comment from the alt-web filter.
  await page.getByLabel('Site', { exact: true }).selectOption('alt-web');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/site=alt-web/);
  const card = page.locator('[data-comment="1"]');
  await expect(card).toContainText('Is the battery easy to replace?');
  await card.getByRole('button', { name: 'Publish' }).click();
  await expect(page.locator('[data-notice]')).toHaveText('Comment published.');
  await expect(page).toHaveURL(/status=pending&site=alt-web/);
  await expect(page.locator('[data-comment="1"]')).toHaveCount(0);
  await expect(page.locator('[data-menu-item="comments"] [data-pending]')).toHaveText('3');

  // Visits: range and metric.
  await page.getByRole('link', { name: 'Visits' }).click();
  await expect(page.locator('polyline')).toHaveCount(4);
  await page.getByRole('link', { name: '90 days' }).click();
  await expect(page).toHaveURL(/range=90/);
  await expect(page.locator('[data-point="alt-web"]')).toHaveCount(90);
  await page.getByRole('link', { name: 'Pageviews' }).click();
  await expect(page).toHaveURL(/range=90&metric=pageviews/);
  await expect(page.locator('svg[data-chart]')).toHaveAttribute('aria-label', /Daily pageviews per site, last 90 days/);
  await context.close();
}

test('sign in, publish a comment, switch the Visits range and metric', async ({ browser }) => {
  await flows(browser, true);
});

test('the same with JavaScript disabled', async ({ browser }) => {
  await flows(browser, false);
});

test('the chart shows a tooltip with every site for the day under the pointer', async ({ page }) => {
  await signInThroughPage(page);
  await page.goto(`${A}/visits?range=7`);
  const svg = page.locator('svg[data-chart]');
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  const tip = page.locator('[data-chart-tooltip]');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Alt Web:');
  await expect(tip).toContainText('Bon et gratuit:');
  await page.mouse.move(box.x - 20, box.y - 20);
  await expect(tip).toBeHidden();
});

test('the menu folds behind a button on a narrow screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await signInThroughPage(page);
  const menu = page.locator('[data-menu]');
  await expect(menu).toBeHidden();
  await page.getByText('Menu', { exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(page.locator('[data-menu-item="visits"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await context.close();
});

test('Search works with JavaScript disabled: range, metric and site', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signInThroughPage(page);
  await page.getByRole('link', { name: 'Search' }).click();
  await expect(page.locator('polyline')).toHaveCount(4);
  await page.getByRole('link', { name: '7 days' }).click();
  await expect(page.locator('[data-point="alt-web"]')).toHaveCount(7);
  await page.getByRole('link', { name: 'Impressions' }).click();
  await expect(page).toHaveURL(/range=7&metric=impressions/);
  await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Alt Web' }).click();
  await expect(page).toHaveURL(/range=7&metric=impressions&site=alt-web/);
  await expect(page.locator('[data-top-row]')).toHaveCount(2);
  await context.close();
});
