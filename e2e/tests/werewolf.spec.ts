import { expect, test, type Page } from '@playwright/test';
import { joinPhone, openTv, remote } from './support';

const ROLES = ['Werewolf', 'Seer', 'Doctor', 'Villager'] as const;

/** Taps the role card and reads the secret role off the phone. */
async function readRole(phone: Page) {
  await phone.getByRole('button', { name: 'Show my role' }).click();
  const card = phone.getByRole('button', { name: 'Hide my role' });
  const text = await card.innerText();
  return ROLES.find((role) => text.includes(role))!;
}

/** Picks a player (at night, or a vote) by name. */
const pick = (phone: Page, name: string) =>
  phone.getByRole('radio', { name: new RegExp(`^${name}`) }).click();

test('a game of Werewolf: secret roles, a night, a vote, and the village wins', async ({
  browser,
}) => {
  const { tv, code } = await openTv(browser);
  const names = ['Ana', 'Rui', 'Eva', 'Ivo', 'Zé'];
  const avatars = ['pilot', 'dino', 'cat', 'dog', 'student'];
  const phones: Page[] = [];
  for (const [i, name] of names.entries()) {
    phones.push(await joinPhone(browser, code, name, avatars[i]!));
  }
  const ana = phones[0]!;

  // Werewolf is the first game of the third tab, Social
  await expect(tv.getByRole('heading', { name: 'Choose a game' })).toBeVisible();
  await remote(ana, 'Up', 'Right', 'Right', 'OK', 'Down');
  await expect(tv.getByRole('listitem').filter({ hasText: 'Werewolf' })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await remote(ana, 'OK');
  await ana.getByRole('radio', { name: '1 min' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Time to talk1 min');
  await expect(ana.getByText('Roles: 1 🐺 Werewolf · 1 🔮 Seer · 1 💉 Doctor')).toBeVisible();
  await ana.getByRole('button', { name: 'Confirm' }).click();
  for (const phone of phones.slice(1)) await phone.getByRole('button', { name: 'Ready' }).click();

  // Everyone reads their secret role; the TV only knows how many of each there are
  await expect(tv.getByRole('heading', { name: 'Check your secret role' })).toBeVisible();
  await expect(tv.getByRole('list', { name: 'Roles in this game' })).toContainText('2 × Villager');
  const roles = new Map<Page, string>();
  for (const phone of phones) roles.set(phone, await readRole(phone));
  const by = (role: string) => phones.filter((phone) => roles.get(phone) === role);
  const nameOf = (phone: Page) => names[phones.indexOf(phone)]!;
  const [wolf] = by('Werewolf');
  const [seer] = by('Seer');
  const [doctor] = by('Doctor');
  const villagers = by('Villager');
  expect([wolf, seer, doctor].every(Boolean) && villagers.length === 2).toBe(true);

  for (const phone of phones) await phone.getByRole('button', { name: 'Got it' }).click();

  // The night: everyone picks someone. The werewolf eats the first villager
  await expect(tv.getByRole('heading', { name: 'Night falls on the village…' })).toBeVisible();
  const [victim, survivor] = villagers;
  await expect(victim!.getByText('🤔 Who do you suspect?')).toBeVisible();
  await pick(victim!, nameOf(wolf!));
  await pick(survivor!, nameOf(wolf!));
  await pick(doctor!, nameOf(doctor!));
  await pick(seer!, nameOf(wolf!));
  await expect(seer!.getByText('is a werewolf!')).toBeVisible();
  await expect(tv.getByText('4/5 done')).toBeVisible();
  await pick(wolf!, nameOf(victim!));

  // Dawn: the TV names the victim and their role
  await expect(tv.getByText('was eaten by the werewolves.')).toContainText(nameOf(victim!));
  await expect(tv.getByText('They were')).toContainText('Villager');
  await expect(victim!.getByText("You're dead")).toBeVisible();
  await expect(victim!.getByLabel("Everyone's role")).toContainText('Werewolf');

  // The day: the living are ready to vote
  await expect(tv.getByRole('heading', { name: 'Who is a werewolf?' })).toBeVisible();
  const living = phones.filter((phone) => phone !== victim);
  for (const phone of living) await phone.getByRole('button', { name: 'Ready to vote' }).click();

  // The vote: everyone else votes the werewolf out; the werewolf skips
  await expect(tv.getByRole('heading', { name: 'Time to vote!' })).toBeVisible();
  await wolf!.getByRole('radio', { name: '🤷 Skip the vote' }).click();
  for (const phone of living.filter((phone) => phone !== wolf)) await pick(phone, nameOf(wolf!));

  await expect(tv.getByRole('heading', { name: `${nameOf(wolf!)} is out!` })).toBeVisible();
  await expect(tv.getByRole('list', { name: 'Votes' })).toContainText('🤷 Skip1');
  await expect(tv.getByRole('heading', { name: 'The village wins!' })).toBeVisible();
  await expect(seer!.getByText('Your team won!')).toBeVisible();
  await expect(wolf!.getByText('Your team lost', { exact: false })).toBeVisible();

  // The host can play again
  await ana.getByRole('button', { name: 'Play again' }).click();
  await expect(tv.getByLabel('Settings')).toContainText('Time to talk1 min');
});
