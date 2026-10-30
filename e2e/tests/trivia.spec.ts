import { expect, test } from '@playwright/test';
import { answer, joinPhone, openTv, remote, tvChoices } from './support';

test('a full game of trivia: library, setup, ready-up, questions, podium, play again', async ({
  browser,
}) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');

  // Library: the host browses with their phone, the TV follows
  await ana.getByRole('button', { name: 'Choose a game' }).click();
  await expect(tv.getByRole('heading', { name: 'Choose a game' })).toBeVisible();
  // Like a TV remote: the arrows move between tabs and cards and stop at the edges, and the
  // tab only changes on OK
  await expect(ana.getByRole('button', { name: 'Left', exact: true })).toBeDisabled();
  await remote(ana, 'Up', 'Right');
  await expect(tv.locator('.category-tabs .shown')).toHaveText(/Quiz/);
  await remote(ana, 'OK');
  await expect(tv.locator('.category-tabs .shown')).toHaveText(/Creative/);
  await remote(ana, 'Down', 'Right', 'Right');
  await expect(tv.getByRole('listitem').filter({ hasText: 'Bluff' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(ana.getByRole('button', { name: 'OK', exact: true })).toBeDisabled();
  await expect(ana.getByRole('button', { name: 'Right', exact: true })).toBeDisabled();
  await remote(ana, 'Up', 'Left', 'OK');
  await expect(tv.locator('.category-tabs .shown')).toHaveText(/Quiz/);
  await remote(ana, 'Down');
  await expect(tv.getByRole('listitem').filter({ hasText: 'Quick-fire trivia' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await remote(ana, 'OK');

  // Setup: settings appear live on the TV and on the other phone
  await ana.getByRole('radio', { name: '🌍 Geography' }).click();
  await ana.getByRole('radio', { name: '10s' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Geography');
  await expect(tv.getByLabel('Settings')).toContainText('10s');
  await expect(rui.getByText('10 questions · 10s each')).toBeVisible();
  await expect(tv.getByText('Ana is choosing the settings…')).toBeVisible();

  // Ready-up: the game starts by itself once everyone is ready
  await ana.getByRole('button', { name: 'Confirm' }).click();
  await expect(tv.getByText('Waiting for everyone to press Ready (1/2)')).toBeVisible();
  await rui.getByRole('button', { name: 'Ready' }).click();

  const answered = tv.getByRole('list', { name: 'Who has answered' });
  for (let round = 1; round <= 3; round++) {
    await expect(tv.getByText(`🌍 Geography · Question ${round}/3`)).toBeVisible();
    await expect(answered).toBeVisible();
    const choices = await tvChoices(tv);
    expect(choices).toHaveLength(4);

    // Ana answers: the TV ticks her off, without saying what she picked
    await answer(ana, choices[0]!);
    await expect(ana.getByText('Answer locked in')).toBeVisible();
    await expect(answered.getByRole('listitem').filter({ hasText: 'Ana' })).toHaveClass(/answered/);
    await expect(tv.getByLabel(/picked this/)).toHaveCount(0);

    // Rui answers: everyone has answered, so the reveal starts straight away
    await answer(rui, choices[1]!);
    await expect(tv.getByRole('list', { name: 'Leaderboard' })).toBeVisible();
    await expect(tv.locator('.choice.correct')).toHaveCount(1);
    await expect(tv.getByLabel('1 picked this')).toHaveCount(2);
    await expect(rui.getByText(/✓ Correct!|✗ Wrong/)).toBeVisible();
  }

  // Final scores: podium on the TV, rank on the phones
  await expect(tv.getByRole('list', { name: 'Podium' }).getByRole('listitem')).toHaveCount(2);
  await expect(ana.getByText('Game over')).toBeVisible();
  await expect(rui.getByText('Waiting for the host to pick the next game…')).toBeVisible();

  // Play again: back to setup with the same settings, nobody ready
  await ana.getByRole('button', { name: 'Play again' }).click();
  await expect(ana.getByRole('radio', { name: '🌍 Geography' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(
    tv.getByText('Waiting for everyone').or(tv.getByText('Ana is choosing the settings…')),
  ).toBeVisible();
});

test('the TV can refresh in the middle of a game', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'happy-bot');

  await ana.getByRole('button', { name: 'Choose a game' }).click();
  await ana.getByRole('button', { name: 'OK', exact: true }).click();
  await ana.getByRole('button', { name: 'Confirm' }).click();
  await expect(tv.getByText(/Question 1\/3/)).toBeVisible();

  await tv.reload();
  await expect(tv.getByText(/Question \d\/3/)).toBeVisible();
  await expect(tv.getByRole('heading', { level: 1 })).not.toBeEmpty();
});
