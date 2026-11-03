import { expect, test, type Page } from '@playwright/test';
import { joinPhone, openTv, remote } from './support';

const liarButton = (phone: Page) => phone.getByRole('button', { name: '🤥 Liar!' });
const cards = (phone: Page) => phone.getByRole('checkbox');

/** Whichever phone it is the turn of, once it's someone's turn. */
async function turnOf(phones: Page[]): Promise<Page> {
  await expect
    .poll(async () => {
      const buttons = await Promise.all(
        phones.map((phone) => phone.getByRole('button', { name: 'Play cards' }).count()),
      );
      return buttons.indexOf(1);
    })
    .toBeGreaterThanOrEqual(0);
  for (const phone of phones) {
    if (await phone.getByRole('button', { name: 'Play cards' }).count()) return phone;
  }
  throw new Error('Nobody has a turn');
}

test("a game of Liar's Table: secret hands, a play, a call, and a podium", async ({ browser }) => {
  const { tv, code } = await openTv(browser);
  const ana = await joinPhone(browser, code, 'Ana', 'pilot');
  const rui = await joinPhone(browser, code, 'Rui', 'dino');
  const phones = [ana, rui];

  // The second game of the third tab, Social
  await ana.getByRole('button', { name: 'Choose a game' }).click();
  await remote(ana, 'Up', 'Right', 'Right', 'OK', 'Down', 'Right');
  await expect(tv.getByRole('listitem').filter({ hasText: "Liar's Table" })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await remote(ana, 'OK');
  await ana.getByRole('radio', { name: '2', exact: true }).click();
  await ana.getByRole('radio', { name: '45s' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Lives2');
  await ana.getByRole('button', { name: 'Confirm' }).click();
  await rui.getByRole('button', { name: 'Ready' }).click();

  // A new hand: the table card on the TV, and five cards on each phone, but not on the TV
  await expect(tv.getByRole('heading', { name: /^This hand: / })).toBeVisible();
  await expect(cards(ana)).toHaveCount(5);
  await expect(cards(rui)).toHaveCount(5);
  await expect(tv.getByRole('checkbox')).toHaveCount(0);

  let turn = await turnOf(phones);
  let other = turn === ana ? rui : ana;
  await expect(liarButton(turn)).toHaveCount(0);
  await expect(turn.getByRole('button', { name: 'Play cards' })).toBeDisabled();

  // At most three cards at once
  for (const i of [0, 1, 2, 3]) await cards(turn).nth(i).click();
  await expect(turn.getByRole('button', { name: /^Play 3 as / })).toBeVisible();
  await turn.getByRole('button', { name: /^Play 3 as / }).click();

  // Face down on the TV, with the claim. The next player can call it
  const onTable = tv.getByLabel('Cards on the table');
  await expect(onTable.getByRole('listitem')).toHaveCount(3);
  await expect(tv.getByRole('heading', { name: / says: 3 / })).toBeVisible();
  await expect(cards(turn)).toHaveCount(2);
  await liarButton(other).click();

  // The cards flip, and someone pays for it
  await expect(tv.getByLabel('The cards').getByRole('listitem')).toHaveCount(3);
  await expect(tv.getByRole('heading', { name: /(was lying|told the truth)!$/ })).toBeVisible();
  await expect(tv.getByText(/loses a life/)).toBeVisible();
  await expect(other.getByText(/(was lying|told the truth)!$/)).toBeVisible();

  // Keep calling until someone is out: everyone's cards are dealt again each hand
  const podium = tv.getByRole('list', { name: 'Podium' });
  await expect(async () => {
    if (await podium.isVisible()) return;
    turn = await turnOf(phones);
    other = turn === ana ? rui : ana;
    await cards(turn).first().click();
    await turn.getByRole('button', { name: /^Play 1 as / }).click();
    await liarButton(other).click({ timeout: 3_000 });
    throw new Error('Not over yet');
  }).toPass({ timeout: 40_000 });

  await expect(tv.getByText(/is the last one standing$/)).toBeVisible();
  await expect(ana.getByText(/You won|wins$/)).toBeVisible();
  await expect(rui.getByText(/You won|wins$/)).toBeVisible();
  await expect(ana.getByRole('button', { name: 'Play again' })).toBeVisible();
});
