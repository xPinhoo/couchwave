import { expect, test, type Page } from '@playwright/test';
import { joinPhone, openTv, remote, turnPhone } from './support';

/** Drags across the drawing pad with whatever tool is selected. */
async function scribble(phone: Page) {
  const box = (await phone.getByLabel('Drawing pad').boundingBox())!;
  await phone.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await phone.mouse.down();
  await phone.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 10 });
  await phone.mouse.up();
}

const done = (phone: Page) => phone.getByRole('button', { name: 'Done', exact: true }).click();

test('a full game of Drawing Phone: write, draw, guess, and the reveal', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');
  const eva = await joinPhone(browser, code, 'Eva', 'cat');
  const phones = [ana, rui, eva];

  // The library opened by itself at 3 players; Drawing Phone is the second Creative game
  await expect(tv.getByRole('heading', { name: 'Choose a game' })).toBeVisible();
  await remote(ana, 'Up', 'Right', 'OK', 'Down', 'Right');
  await expect(tv.getByRole('listitem').filter({ hasText: 'Drawing Phone' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await remote(ana, 'OK');
  await ana.getByRole('radio', { name: '30s' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Time to draw30s');
  await ana.getByRole('button', { name: 'Confirm' }).click();
  for (const phone of [rui, eva]) await phone.getByRole('button', { name: 'Ready' }).click();

  // Write: typed, random, typed. The TV only ticks people off
  await expect(tv.getByRole('heading', { name: 'Write a secret phrase' })).toBeVisible();
  await ana.getByPlaceholder('An elephant wearing a hat').fill('A cat on a bus');
  await done(ana);
  await expect(tv.getByText('1/3 done')).toBeVisible();
  await rui.getByRole('button', { name: '🎲 Give me a random one' }).click();
  await expect(rui.getByPlaceholder('An elephant wearing a hat')).not.toHaveValue('');
  await done(rui);
  await eva.getByPlaceholder('An elephant wearing a hat').fill('A dog on a plane');
  await done(eva);

  // Draw: everyone gets someone else's phrase. Ana uses a rectangle and the fill bucket
  await expect(tv.getByRole('heading', { name: 'Draw the phrase you got' })).toBeVisible();
  for (const phone of phones) {
    await expect(phone.getByText('Turn your phone sideways')).toBeVisible();
    await turnPhone(phone);
    await scribble(phone);
  }
  await ana.getByRole('radio', { name: 'Rectangle' }).click();
  await scribble(ana);
  await ana.getByRole('radio', { name: 'Fill' }).click();
  await ana.getByRole('radio', { name: 'Colour 4' }).click();
  await ana.getByLabel('Drawing pad').click({ position: { x: 5, y: 5 } });
  await ana.getByRole('button', { name: 'Undo' }).click();
  await ana.getByRole('button', { name: 'Redo' }).click();
  for (const phone of phones) await done(phone);

  // Guess: everyone sees a drawing on their own phone
  await expect(tv.getByRole('heading', { name: 'Guess the drawing you got' })).toBeVisible();
  for (const [i, phone] of phones.entries()) {
    await expect(phone.getByRole('img', { name: 'Drawing to guess' })).toBeVisible();
    await phone.getByPlaceholder('Your guess').fill(`guess ${i + 1}`);
    await done(phone);
  }

  // The reveal: the host can skip ahead from their phone
  await expect(tv.getByText('“A cat on a bus”')).toBeVisible();
  await expect(ana.getByText('Look at the TV!')).toBeVisible();
  await ana.getByRole('button', { name: 'Next ▶' }).click();
  await expect(tv.getByText('and drew this:')).toBeVisible();
  await expect(tv.getByRole('img', { name: 'Drawing' })).toHaveAttribute('data-ops', /^[1-9]/);
  // Skip through the rest; a click can land just as the reveal ends and the button goes
  const playAgain = ana.getByRole('button', { name: 'Play again' });
  while (!(await playAgain.isVisible())) {
    await ana
      .getByRole('button', { name: 'Next ▶' })
      .click({ timeout: 1_000 })
      .catch(() => {});
  }

  const summaries = tv.getByRole('list', { name: 'Every phrase' });
  await expect(summaries).toContainText('A cat on a bus');
  await expect(summaries).toContainText('A dog on a plane');
  await expect(summaries).toContainText('guess 1');
});
