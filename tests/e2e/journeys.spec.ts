import { expect, test, type Page } from '@playwright/test';

/**
 * Key journeys against the seeded demo account (supabase/seed.sql). Run on a local stack:
 *   npx supabase db reset && E2E_BASE_URL=http://localhost:3000 npx playwright test
 * The demo credentials below are development seed values, not real accounts.
 */
/** The toast region (the app's only polite live region holding a status card). */
const toast = (page: Page) => page.locator('[aria-live="polite"] > [role="status"]');

const DEMO = { email: 'demo@pulsefit.test', password: 'pulsefit-demo' };

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password').fill(DEMO.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('protected routes redirect to sign-in when signed out', async ({ page }) => {
  await page.goto('/activity');
  await expect(page).toHaveURL(/\/login\?next=%2Factivity/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
});

test('rejects a wrong password with a safe message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
});

test('sign in, run a workout, end it early, see it in history, edit and delete it', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Activity Weekly Progress' })).toBeVisible();

  // Start a short workout from the library.
  await page.goto('/workouts?q=Stress');
  await page.getByRole('link', { name: 'Stress Relief Breathing' }).first().click();
  await page.getByRole('button', { name: 'Start workout' }).click();
  await expect(page).toHaveURL(/\/session\//);
  await expect(page.getByRole('heading', { name: 'Breathing' })).toBeVisible();

  // Record one set, skip the rest, then end the session early.
  await page.getByRole('button', { name: 'Mark set done now' }).click();
  await page.getByRole('button', { name: 'Skip rest' }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'End workout' }).last().click();
  await expect(page.getByRole('alertdialog')).toContainText('End workout?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'End workout' }).click();
  await expect(page).toHaveURL(/\/complete$/);
  await expect(page.getByRole('heading', { name: 'Session saved' })).toBeVisible();
  await page.getByRole('radio', { name: 'Just right' }).click();

  // History shows it as ended early; open, edit notes, then delete.
  await page.goto('/history');
  const row = page.getByRole('link', { name: /Stress Relief Breathing/ }).first();
  await expect(row).toContainText('Ended early');
  await row.click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Notes').fill('Felt calm after this.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Felt calm after this.')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete session' }).click();
  await expect(page).toHaveURL(/\/history$/);
});

test('create a body-weight goal and record, then delete, a measurement', async ({ page }) => {
  await signIn(page);
  await page.goto('/goals/new?type=body_weight');
  await expect(page.getByRole('radio', { name: /Body weight/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByText(/kg now · target/).first()).toBeVisible();

  await page.goto('/measurements');
  await page.getByRole('button', { name: 'Add weight entry' }).click();
  await page.getByLabel('Weight (kg)').fill('70.2');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(toast(page)).toContainText('Entry added');
  await expect(page.getByText('70.2 kg').first()).toBeVisible();
  await page.getByRole('button', { name: /Delete entry from/ }).first().click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(toast(page)).toContainText('Entry deleted');
});

test('sign out returns to sign-in and blocks protected pages', async ({ page }) => {
  await signIn(page);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/login\?next=%2Fhome/);
});
