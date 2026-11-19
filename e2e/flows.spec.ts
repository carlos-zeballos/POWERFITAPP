import { test, expect, type Page } from '@playwright/test';

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `e2e/screens/${test.info().project.name}-${name}.png`, fullPage: true });

async function login(page: Page, who: string) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo').fill(`${who}@powerfit.test`);
  await page.locator('input[type="password"]').fill('PowerFit2026!');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' }).first()).toBeVisible();
}

const noHScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('public site: brand, SEO and contact', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'PowerFit' })).toBeVisible();
  expect(await page.locator('script[type="application/ld+json"]').textContent()).toContain('ExerciseGym');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png/);
  await expect(page.locator('a[href^="https://wa.me/"]').first()).toBeVisible();
  await expect(page.locator('h2')).toHaveCount(5);
  expect(await noHScroll(page)).toBe(true);
  await shot(page, 'home');
});

test('staff renews in fewer than three taps', async ({ page }, info) => {
  test.skip(info.project.name !== 'm360', 'The flow mutates the seed and only needs one mobile run.');
  await login(page, 'recepcion');
  await expect(page.locator('main h1')).toBeVisible();
  const card = page.getByRole('listitem').first();
  await shot(page, 'recepcion');
  let taps = 0;
  await card.getByRole('button', { name: 'Renovar' }).tap();
  taps++;
  await card.getByRole('button', { name: /Confirmar/ }).tap();
  taps++;
  await expect(page.getByRole('status')).toBeVisible();
  expect(taps).toBeLessThan(3);
  await page.goto('/app/socios');
  await page.getByPlaceholder('Buscar por nombre, celular o código de 4 dígitos').fill('9000');
  const socioDemo = page.locator('li').filter({ hasText: 'Socio Demo' }).first();
  await expect(socioDemo).toBeVisible();
  await socioDemo.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByRole('heading', { name: 'Socio Demo' })).toBeVisible();
});

test('member reads membership, inbox, and offline state', async ({ page }) => {
  await login(page, 'socio');
  await expect(page.getByRole('progressbar')).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  await shot(page, 'socio');
  await page.reload();
  await expect(page.getByRole('progressbar')).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event('offline')));
  await expect(page.getByRole('status')).toBeVisible();
  await page.context().setOffline(false);
  await page.goto('/app/avisos');
  await expect(page.locator('main h1')).toBeVisible();
});

test('owner sees metrics and downloads CSV', async ({ page }) => {
  await login(page, 'propietario');
  await expect(page.locator('main h1')).toBeVisible();
  expect(await noHScroll(page)).toBe(true);
  await shot(page, 'panel');
  const dl = page.waitForEvent('download');
  await page.locator('a[href$="/reports/members.csv"]').click();
  expect((await dl).suggestedFilename()).toMatch(/^socios-.*\.csv$/);
  await page.goto('/app/socios');
  await page.getByPlaceholder('Buscar por nombre, celular o código de 4 dígitos').fill('9000');
  const socioDemo = page.locator('li').filter({ hasText: 'Socio Demo' }).first();
  await expect(socioDemo).toBeVisible();
  await socioDemo.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByRole('heading', { name: 'Socio Demo' })).toBeVisible();
});
