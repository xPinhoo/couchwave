import { devices, expect, type Browser, type Page } from '@playwright/test';
import { PHONE_URL, TV_URL } from '../playwright.config';

/** Opens the website on a "TV" (desktop) and creates a room. Returns the TV page and code. */
export async function openTv(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tv = await context.newPage();
  await tv.goto(`${TV_URL}/`);
  await tv.getByRole('link', { name: 'Create Game Room' }).click();

  const codeLabel = tv.getByLabel('Room code');
  await expect(codeLabel).toHaveText(/^[A-Z]{4}$/);
  return { tv, code: (await codeLabel.textContent())! };
}

/** Joins the room from a "phone" (mobile emulation) with a name and a preset avatar. */
export async function joinPhone(browser: Browser, code: string, name: string, avatar: string) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const phone = await context.newPage();
  await phone.goto(`${PHONE_URL}/?room=${code}`);

  await phone.getByPlaceholder('Your name').fill(name);
  await phone.getByRole('radio', { name: avatar, exact: true }).click();
  await phone.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(phone.getByText(/You're (the host|in)/)).toBeVisible();
  return phone;
}

/** The TV's player seats, as their visible text. */
export function seats(tv: Page) {
  return tv.getByRole('region', { name: 'Players' }).locator('.seat.taken');
}

/** The current trivia answers as written on the TV (without the shape symbols). */
export function tvChoices(tv: Page) {
  return tv.getByRole('list', { name: 'Choices' }).locator('.choice-text').allTextContents();
}

/** Taps an answer on a phone by its text. */
export async function answer(phone: Page, choice: string) {
  await phone.getByRole('button', { name: choice, exact: true }).click();
}

/**
 * Presses buttons on the host's phone remote in the games library ('Up', 'Down', 'Left',
 * 'Right', 'OK'), one at a time: each press changes what the phone shows, so wait for that
 * before the next one, or it could act on the old position.
 */
export async function remote(phone: Page, ...buttons: ('Up' | 'Down' | 'Left' | 'Right' | 'OK')[]) {
  for (const button of buttons) {
    const before = await phone.locator('body').innerText();
    await phone.getByRole('button', { name: button, exact: true }).click();
    await expect.poll(() => phone.locator('body').innerText()).not.toBe(before);
  }
}
