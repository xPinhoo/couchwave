import { expect, test, type Page } from '@playwright/test';
import { joinPhone, openTv, remote } from './support';

/** Taps the palette at a spot, as fractions of its size. */
async function tapPalette(phone: Page, x: number, y: number) {
  const box = (await phone.getByLabel('Colour palette').boundingBox())!;
  await phone.mouse.click(box.x + box.width * x, box.y + box.height * y);
}

const hexCode = (phone: Page) => phone.getByLabel('Hex code');

test('a game of Guess the Color: mix a colour, see how close it was, and a podium', async ({
  browser,
}) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');

  // The second game of the first tab
  await ana.getByRole('button', { name: 'Choose a game' }).click();
  await remote(ana, 'Right');
  await expect(tv.getByRole('listitem').filter({ hasText: 'Guess the Color' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await remote(ana, 'OK');
  await ana.getByRole('radio', { name: '🏳️ Flags' }).click();
  await ana.getByRole('radio', { name: '45s' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Pictures🏳️ Flags');
  await ana.getByRole('button', { name: 'Confirm' }).click();
  await rui.getByRole('button', { name: 'Ready' }).click();

  await expect(tv.getByRole('heading', { name: 'Get ready!' })).toBeVisible();

  // Round 1: the TV shows the picture without its colour. Nothing to lock in until you mix one
  const picture = tv.getByRole('img', { name: /with its colour missing/ });
  await expect(picture).toBeVisible();
  await expect(tv.getByText('Round 1/3', { exact: false })).toBeVisible();
  const lockAna = ana.getByRole('button', { name: 'Lock it in' });
  await expect(lockAna).toBeDisabled();

  // Tapping different spots gives different colours, shown as a hex code
  await tapPalette(ana, 0.1, 0.4);
  await expect(hexCode(ana)).toHaveText(/^#[0-9A-F]{6}$/);
  const first = await hexCode(ana).innerText();
  await tapPalette(ana, 0.6, 0.5);
  await expect(hexCode(ana)).not.toHaveText(first);
  const chosen = await hexCode(ana).innerText();

  // The strength bar changes it too, and dragging works
  const bar = (await ana.getByLabel('Colour strength').boundingBox())!;
  await ana.mouse.move(bar.x + bar.width * 0.9, bar.y + bar.height / 2);
  await ana.mouse.down();
  await ana.mouse.move(bar.x + bar.width * 0.5, bar.y + bar.height / 2, { steps: 5 });
  await ana.mouse.up();
  await expect(hexCode(ana)).not.toHaveText(chosen);
  const mixed = await hexCode(ana).innerText();

  await lockAna.click();
  await expect(tv.getByText('1/2 locked in')).toBeVisible();
  await expect(ana.getByText('Locked in', { exact: false })).toBeVisible();
  // The TV doesn't show what anyone picked yet
  await expect(tv.getByText(mixed)).toHaveCount(0);

  await tapPalette(rui, 0.3, 0.3);
  await rui.getByRole('button', { name: 'Lock it in' }).click();

  // The reveal: the real colour, everyone's colour and how close it was
  const results = tv.getByRole('list', { name: 'How close everyone got' });
  await expect(results).toContainText(mixed);
  await expect(results).toContainText('%');
  await expect(tv.getByRole('img', { name: /with its colour missing/ })).toHaveCount(0);
  await expect(ana.getByLabel('The real one')).toBeVisible();
  await expect(ana.getByText('% close')).toBeVisible();

  // The other rounds start with a fresh palette: nothing to lock in until you mix again
  for (const round of [2, 3]) {
    await expect(tv.getByText(`Round ${round}/3`, { exact: false })).toBeVisible();
    await expect(tv.getByRole('img', { name: /with its colour missing/ })).toBeVisible();
    for (const phone of [ana, rui]) {
      const lock = phone.getByRole('button', { name: 'Lock it in' });
      await expect(lock).toBeDisabled();
      await tapPalette(phone, 0.5, 0.5);
      await lock.click();
    }
    await expect(results).toBeVisible();
  }

  // The podium, as in trivia
  await expect(tv.getByRole('list', { name: 'Podium' })).toBeVisible({ timeout: 15_000 });
  await expect(ana.getByRole('button', { name: 'Play again' })).toBeVisible();
  await expect(rui.getByText(/You won|You finished/)).toBeVisible();
});
