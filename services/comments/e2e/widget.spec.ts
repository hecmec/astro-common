import { type BrowserContext, type Page, expect, test } from '@playwright/test';

const SERVICE = 'http://localhost:4398';

/** Signs in through the popup, by email link, and returns once the widget shows the reader. */
async function signInByEmail(page: Page, context: BrowserContext, email: string) {
  const w = page.locator('[data-bc-comments]');
  const popupPromise = page.waitForEvent('popup');
  await w.getByRole('button', { name: /Se connecter|Sign in/ }).click();
  const popup = await popupPromise;
  await popup.waitForURL(/\/auth\/start/);
  await popup.getByLabel(/adresse e-mail|email address/i).fill(email);
  await popup.getByRole('button', { name: /lien|link/i }).click();
  await expect(popup.getByText(email)).toBeVisible();

  // Open the link in another tab, as if on another device.
  const mails = (await (await page.request.get('/__test/mails')).json()) as { to: string; text: string }[];
  const link = mails.filter((m) => m.to === email).at(-1)!.text.match(/http:\/\/\S+/)![0];
  const other = await context.newPage();
  await other.goto(link);
  await other.getByRole('button', { name: /Se connecter|Sign in/ }).click();
  await expect(other.getByText(/connecté|signed in/i)).toBeVisible();
  await other.close();
  await popup.waitForEvent('close', { timeout: 10_000 });
}

async function adminPublishAll(context: BrowserContext, reply?: string) {
  const admin = await context.newPage();
  await admin.goto(`${SERVICE}/admin/login`);
  await admin.getByRole('button', { name: 'Dev sign-in' }).click();
  await expect(admin.getByRole('heading', { name: /Comments: pending/ })).toBeVisible();
  while (await admin.getByRole('button', { name: 'Publish' }).count()) {
    await admin.getByRole('button', { name: 'Publish' }).first().click();
  }
  if (reply) {
    await admin.goto(`${SERVICE}/admin?status=published`);
    await admin.getByLabel(/Public reply/).first().fill(reply);
    await admin.getByRole('button', { name: 'Save reply' }).first().click();
  }
  await admin.close();
}

test('a reader signs in, comments, reacts; the admin publishes and replies', async ({ page, context }) => {
  await page.goto('/tag/vrac/');
  const w = page.locator('[data-bc-comments]');
  await expect(w.getByRole('heading', { name: 'Vos réactions, vos commentaires' })).toBeVisible();
  await expect(w.getByText('Pas encore de commentaire')).toBeVisible();

  await signInByEmail(page, context, 'ana@example.org');

  await w.getByLabel('Choisissez le nom affiché avec vos commentaires').fill('Ana');
  await w.getByRole('button', { name: 'Enregistrer' }).click();

  await w.getByLabel('Votre commentaire', { exact: true }).fill('Très bonne adresse.\nVoir https://example.org <b>gras</b>');
  await w.getByRole('button', { name: 'Envoyer' }).click();
  await expect(w.getByText('Merci ! Votre commentaire apparaîtra une fois relu.')).toBeVisible();
  await expect(w.getByText('En attente de modération')).toBeVisible();

  await w.getByRole('button', { name: /Utile/ }).click();
  await expect(w.getByRole('button', { name: /Utile/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(w.getByRole('button', { name: /Utile/ })).toContainText('1');

  // Another visitor sees the reaction count but not the pending comment
  const visitor = await context.browser()!.newContext();
  const vpage = await visitor.newPage();
  await vpage.goto('http://localhost:4397/tag/vrac/');
  const vw = vpage.locator('[data-bc-comments]');
  await expect(vw.getByRole('button', { name: /Utile/ })).toContainText('1');
  await expect(vw.getByText('Très bonne adresse')).toHaveCount(0);

  await adminPublishAll(context, 'Merci Ana !');

  await vpage.reload();
  await expect(vw.getByText('Ana', { exact: true })).toBeVisible();
  await expect(vw.locator('.body').first()).toContainText('<b>gras</b>'); // shown as text
  await expect(vw.getByRole('link', { name: 'https://example.org' })).toHaveAttribute('rel', 'nofollow ugc noopener');
  await expect(vw.getByText('Réponse de Alt Web')).toBeVisible();
  await expect(vw.getByText('Merci Ana !')).toBeVisible();
  await visitor.close();

  // The session survives a reload; sign out ends it
  await page.reload();
  await expect(w.getByText('Connecté en tant que Ana')).toBeVisible();
  await w.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(w.getByRole('button', { name: /Se connecter/ })).toBeVisible();
});

test('the widget speaks the page language', async ({ page }) => {
  await page.goto('/other/?lang=de');
  await expect(page.locator('[data-bc-comments]').getByRole('heading', { name: 'Deine Reaktionen, deine Kommentare' })).toBeVisible();
  await page.goto('/other/?lang=en');
  await expect(page.locator('[data-bc-comments]').getByRole('heading', { name: 'Your reactions, your comments' })).toBeVisible();
});

test('baked comments are in the HTML and not shown twice', async ({ page, context, request }) => {
  await page.goto('/baked/shop/');
  await signInByEmail(page, context, 'bob@example.org');
  const w = page.locator('[data-bc-comments]');
  await w.getByLabel('Choose the name shown with your comments').fill('Bob');
  await w.getByRole('button', { name: 'Save' }).click();
  await w.getByLabel('Your comment', { exact: true }).fill('Old comment');
  await w.getByRole('button', { name: 'Send' }).click();
  await expect(w.getByText('Awaiting moderation')).toBeVisible();
  await adminPublishAll(context);
  await request.get('/__test/advance?days=8');

  await w.getByLabel('Your comment', { exact: true }).fill('Fresh comment');
  await w.getByRole('button', { name: 'Send' }).click();
  await expect(w.getByText('Awaiting moderation')).toBeVisible();
  await adminPublishAll(context);

  // Without JavaScript: the old comment is in the HTML, the fresh one is not
  const html = await (await request.get('/baked/shop/')).text();
  expect(html).toContain('Old comment');
  expect(html).not.toContain('Fresh comment');
  expect(html).toContain('data-cutoff=');

  await page.reload();
  await expect(page.locator('[data-bc-baked]').getByText('Old comment')).toBeVisible();
  await expect(w.getByText('Fresh comment')).toBeVisible();
  await expect(page.getByText('Old comment')).toHaveCount(1);
  // Most recent first: the fresh (live) comment is above the old (baked) one
  const fresh = await w.getByText('Fresh comment').boundingBox();
  const old = await page.locator('[data-bc-baked]').getByText('Old comment').boundingBox();
  expect(fresh!.y).toBeLessThan(old!.y);
});

test('the widget shows a notice when the service is down', async ({ page }) => {
  await page.goto('/down/');
  await expect(page.locator('[data-bc-comments]').getByText('Comments are unavailable right now.')).toBeVisible({ timeout: 8000 });
});

test('the widget shows nothing on a domain that is not allowed', async ({ page }) => {
  await page.goto('http://127.0.0.1:4397/tag/vrac/');
  await expect(page.locator('[data-bc-comments]')).toBeHidden();
  const res = await page.request.post(`${SERVICE}/auth/flows`, {
    headers: { origin: 'http://127.0.0.1:4397', 'content-type': 'application/json' },
    data: { site: 'alt-web' },
  });
  expect(res.status()).toBe(403);
});
