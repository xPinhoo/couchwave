import { expect, test } from '@playwright/test';
import { joinPhone, openTv, seats } from './support';

test('the website links to a new game room', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'couchwave' })).toBeVisible();
  await page.getByRole('link', { name: 'Create Game Room' }).click();
  await expect(page).toHaveURL(/\/room$/);
  await expect(page.getByLabel('Room code')).toHaveText(/^[A-Z]{4}$/);
});

test('phones join with avatars; the first one is the host', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  await expect(tv.getByText('the first to join becomes the host')).toBeVisible();

  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');

  await expect(seats(tv)).toHaveText(['👑Ana', 'Rui']);
  await expect(seats(tv).first().locator('img')).toHaveAttribute('data-avatar', 'pilot');
  await expect(seats(tv).last().locator('img')).toHaveAttribute('data-avatar', 'dino');
  await expect(ana.getByText("You're the host 👑")).toBeVisible();
  await expect(rui.getByText('Waiting for Ana to start the game…')).toBeVisible();
  // The TV only displays: no controls at all
  await expect(tv.getByRole('button')).toHaveCount(0);
});

test('reactions float up on the TV', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'dino');

  await ana.getByRole('button', { name: 'React 🎉' }).click();
  await expect(tv.locator('.reaction')).toContainText('🎉');
});

test('the host can kick a player', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'cat');
  const rui = await joinPhone(browser, code, 'Rui', 'student');

  // Two taps: the first arms the button, the second confirms
  await ana.getByRole('button', { name: 'Kick Rui' }).click();
  await ana.getByRole('button', { name: 'Confirm kicking Rui' }).click();

  await expect(rui.getByText('The host removed you from the room.')).toBeVisible();
  await expect(seats(tv)).toHaveText(['👑Ana']);
});

test('a phone that reloads gets its seat back', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'fighter');

  await ana.reload();
  await expect(ana.getByText("You're the host 👑")).toBeVisible();
  await expect(seats(tv)).toHaveText(['👑Ana']);
});

test('the TV can refresh and keep its room', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  await joinPhone(browser, code, 'Ana', 'droid');

  await tv.reload();
  await expect(tv.getByLabel('Room code')).toHaveText(code);
  await expect(seats(tv)).toHaveText(['👑Ana']);
});
