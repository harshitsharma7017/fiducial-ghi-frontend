import { expect, test, type Page } from '@playwright/test';

// Mock mode's demo admin (src/lib/server/mock-mode.ts).
const ADMIN = {
  email: 'demo.admin@example.com',
  password: 'Fiducial-demo-2026',
};

/** This app's home: the GMC cases. Demo mode reads no live data, so the page says so. */
async function expectGmcCases(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Group Health' })).toBeVisible();
  await expect(page.getByText('Not available in demo mode').first()).toBeVisible();
  // The admin's permissions include the Admin group; Property screens are not in this app.
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Audit log' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Proposals' })).toHaveCount(0);
}

test('signs in as the demo admin and shows the GMC cases in light and dark', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/ghi$/);

  // The browser prefers light and the theme follows the system by default.
  await expectGmcCases(page);
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);

  await page.getByRole('button', { name: 'Theme' }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);

  // The choice is kept, and applied before the page paints: no light flash on reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await expectGmcCases(page);

  expect(pageErrors).toEqual([]);
});

// N1: the GPA list opens from the Employee Benefits group; in demo mode it reads no live data.
test('opens the GPA cases page from Employee Benefits in demo mode', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/ghi$/);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('link', { name: 'GPA (Personal Accident)' }).click();
  await expect(page).toHaveURL(/\/eb\/gpa$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Not available in demo mode')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

// N4: the Age Band Master opens from Masters; in demo mode it reads no live data.
test('opens Masters → Age bands in demo mode', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/ghi$/);

  await page.goto('/masters/age-bands');
  await expect(page.getByText('Not available in demo mode')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Age bands' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

// N8 to N11: the TPA claims, import, formats, claims analysis and renewal analysis pages open
// for the demo admin without errors; in demo mode they read no live data.
test('opens the TPA claims, claims analysis and renewal analysis pages in demo mode', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/ghi$/);

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Claims analysis' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Renewal analysis' })).toBeVisible();
  for (const [path, title] of [
    ['/claims/tpa', 'TPA claims'],
    ['/claims/tpa/import', 'Import a TPA file'],
    ['/claims/tpa/formats', 'TPA formats'],
    ['/claims-analysis', 'Claims analysis'],
    ['/renewal', 'Renewal analysis'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Not available in demo mode').first()).toBeVisible();
  }

  expect(pageErrors).toEqual([]);
});
