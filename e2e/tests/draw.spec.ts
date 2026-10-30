import { expect, test, type Page } from '@playwright/test';
import { joinPhone, openTv } from './support';

/** The artist picks their first word; returns it. */
async function chooseFirstWord(artist: Page) {
  await expect(artist.getByText('Your turn to draw!')).toBeVisible();
  const choice = artist.getByRole('button', { name: /^Draw / }).first();
  const word = (await choice.textContent())!;
  await choice.click();
  await expect(artist.getByLabel(`Your word: ${word}`)).toBeVisible();
  return word;
}

/** Drags a finger (well, a mouse) across the drawing pad: one stroke. */
async function scribble(artist: Page) {
  const box = (await artist.getByLabel('Drawing pad').boundingBox())!;
  await artist.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await artist.mouse.down();
  await artist.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7, { steps: 10 });
  await artist.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 10 });
  await artist.mouse.up();
}

async function guess(phone: Page, text: string) {
  await phone.getByPlaceholder('Your guess').fill(text);
  await phone.getByRole('button', { name: 'Guess', exact: true }).click();
}

/** Ana (the host) picks Draw & Guess with 45s to draw; both players get ready. */
async function startDraw(ana: Page, rui: Page, tv: Page) {
  await ana.getByRole('button', { name: 'Choose a game' }).click();
  // Draw & Guess opens the Creative category, one ▼ down from Quiz
  await ana.getByRole('button', { name: 'Next category' }).click();
  await expect(tv.getByRole('listitem').filter({ hasText: 'Draw & Guess' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await ana.getByRole('button', { name: 'Play' }).click();

  await expect(tv.getByRole('heading', { name: /Draw & Guess/ })).toBeVisible();
  await ana.getByRole('radio', { name: '45s' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Time to draw45s');
  await ana.getByRole('button', { name: 'Confirm' }).click();
  await rui.getByRole('button', { name: 'Ready' }).click();
}

test('a full game of Draw & Guess: choose, draw, guess, reveal, podium', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');
  await startDraw(ana, rui, tv);

  // Turn 1: Ana draws, Rui guesses
  await expect(tv.getByText('Ana is choosing a word…')).toBeVisible();
  await expect(rui.getByText('Ana is choosing a word…')).toBeVisible();
  const word = await chooseFirstWord(ana);

  const hint = tv.getByLabel('Word to guess');
  await expect(hint).toHaveText(word.replace(/[^ ]/g, '_'));
  await expect(rui.getByLabel('Word to guess')).toHaveText(word.replace(/[^ ]/g, '_'));

  // The stroke appears live on the TV
  const drawing = tv.getByRole('img', { name: 'Drawing' });
  await scribble(ana);
  await expect(drawing).toHaveAttribute('data-strokes', '1');
  await ana.getByRole('button', { name: 'Undo' }).click();
  await expect(drawing).toHaveAttribute('data-strokes', '0');
  await scribble(ana);
  await expect(drawing).toHaveAttribute('data-strokes', '1');

  // A wrong guess goes up on the TV for everyone to see
  await guess(rui, 'definitely not it');
  await expect(tv.getByRole('list', { name: 'Guesses' })).toContainText('Rui definitely not it');
  await expect(rui.getByText('Nope. Try again!')).toBeVisible();

  // The right one (whatever the case) ends the turn, since Rui is the only guesser
  await rui.waitForTimeout(600); // the guess cooldown
  await guess(rui, word.toUpperCase());
  await expect(tv.locator('.draw-answer')).toHaveText(`It was ${word}`);
  await expect(tv.getByRole('list', { name: 'Leaderboard' })).toContainText('Rui');
  await expect(rui.getByText('Nice guess!')).toBeVisible();
  await expect(ana.getByText('People guessed your drawing!')).toBeVisible();

  // Turn 2: Rui draws on a blank canvas, Ana guesses
  const ruisWord = await chooseFirstWord(rui);
  await expect(drawing).toHaveAttribute('data-strokes', '0');
  await guess(ana, ruisWord);
  await expect(ana.getByText('Nice guess!')).toBeVisible();

  // Final scores
  await expect(tv.getByRole('list', { name: 'Podium' }).getByRole('listitem')).toHaveCount(2);
  await expect(ana.getByText('Game over')).toBeVisible();
  await expect(rui.getByText(/You won!|You finished #2/)).toBeVisible();
});

test('the TV gets the drawing back after a refresh', async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'happy-bot');
  const rui = await joinPhone(browser, code, 'Rui', 'cat');
  await startDraw(ana, rui, tv);

  await chooseFirstWord(ana);
  await scribble(ana);
  await scribble(ana);
  const drawing = tv.getByRole('img', { name: 'Drawing' });
  await expect(drawing).toHaveAttribute('data-strokes', '2');

  await tv.reload();
  await expect(tv.getByRole('img', { name: 'Drawing' })).toHaveAttribute('data-strokes', '2');
});
