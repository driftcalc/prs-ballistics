// Values the app guessed (twist, sight height) are never hidden: Shoot, the
// range card and stage cards say so until the shooter checks them.
import { expect, test, type Page } from '@playwright/test'
import { seedData } from './seed.ts'

const note = (page: Page) => page.locator('[data-guess-note]')

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
})

test('setup skipped: Shoot says twist and sight height are guesses until confirmed in Rifles', async ({ page }) => {
  await page.goto('#/shoot')
  await page.getByRole('button', { name: 'Set up my rifle' }).click()
  await page.getByRole('button', { name: /^Skip/ }).click() // load
  await page.getByRole('button', { name: /^Skip/ }).click() // scope & zero
  // The typical load has no bullet length, so spin drift is off and the twist doesn't matter yet.
  await expect(note(page)).toHaveText('Sight height 2 in is a guess — check it in Rifles')

  // Adding a bullet length turns spin drift on: now the guessed twist matters too.
  await note(page).getByRole('link').click()
  await page.getByText('More: bullet size').click()
  await page.locator('[name="bulletLengthIn"]').fill('1.35', { timeout: 5_000 })
  await page.goto('#/shoot')
  await expect(note(page)).toHaveText('Twist 1:8 and sight height 2 in are guesses — check them in Rifles')

  await note(page).getByRole('link').click()
  await expect(page.locator('[data-guessed-banner]')).toBeVisible()
  // The twist box is shown straight away (not hidden under "More").
  await expect(page.locator('[name="twistIn"]')).toBeVisible()
  await page.getByRole('button', { name: 'These are right' }).click()
  await expect(page.locator('[data-guessed-banner]')).toHaveCount(0)

  await page.goto('#/shoot')
  await expect(note(page)).toBeHidden()
})

test('setup done: twist asked on step 2, nothing left as a guess', async ({ page }) => {
  await page.goto('#/shoot')
  await page.getByRole('button', { name: 'Set up my rifle' }).click()
  await page.getByRole('button', { name: /^Next/ }).click()
  await page.locator('[name="twistIn"]').fill('10')
  await page.getByRole('button', { name: /^Done/ }).click()
  await expect(page.locator('[data-readout="elev"] [data-part="num"]')).toHaveText(/\d+\.\d/, { timeout: 15_000 })
  await expect(note(page)).toBeHidden()
  const rifle = await page.evaluate(() => JSON.parse(localStorage.getItem('prs.data')!).profiles[0])
  expect(rifle.rifle.twistIn).toBe(10)
  expect(rifle.guessed).toBeUndefined()
})

test('rifles saved before the update are flagged; changing the twist confirms it', async ({ page }) => {
  // The field-test data is saved as version 8 with twist 1:8 and sight height 2 in.
  await page.addInitScript((data) => {
    if (!localStorage.getItem('prs.data')) localStorage.setItem('prs.data', data)
  }, JSON.stringify(seedData({ theme: 'dark', glove: false, leftHanded: false })))
  await page.goto('#/shoot')
  await expect(note(page)).toContainText('Twist 1:8')

  // Range card and stage card say it too.
  await page.goto('#/card/r1')
  await expect(page.locator('[data-card-guessed]')).toContainText('Twist 1:8')
  await page.goto('#/match/m1/card/1')
  await expect(page.locator('[data-card-guessed]')).toContainText('Guessed: twist 1:8')

  // Typing the real twist (and sight height) confirms them.
  await page.goto('#/rifles/r1')
  await page.locator('[name="twistIn"]').fill('7.5')
  await page.locator('[name="sightHeightIn"]').fill('1.9')
  await page.goto('#/shoot')
  await expect(note(page)).toBeHidden()
})
