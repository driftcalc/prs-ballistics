// Forms behave honestly in the real app: mistakes stay explained on screen, and
// messages never describe the app's own starting values as yours.
import { expect, test } from '@playwright/test'
import { seedData } from './seed.ts'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
})

test('stage editor keeps explaining a target with no distance after Done', async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('prs.data')) localStorage.setItem('prs.data', data)
  }, JSON.stringify(seedData({ theme: 'dark', glove: false, leftHanded: false, empty: 'stages' })))
  await page.goto('#/match/m1/stage/new')

  await page.locator('[name="targets"]').fill('barricade 412, 6l2m')
  await page.getByRole('button', { name: 'Done', exact: true }).click()

  // Not saved, and the reason is still on screen.
  await expect(page).toHaveURL(/stage\/new$/)
  await expect(page.locator('[data-problems]')).toContainText('6L2M has no distance.')
  await page.waitForTimeout(300)
  await expect(page.locator('[data-problems]')).toContainText('6L2M has no distance.')

  // Typing a fix clears the old message.
  await page.locator('[name="targets"]').fill('barricade 412, plate 612')
  await expect(page.locator('[data-problems]')).toBeEmpty()
})

test("first-run factory picker doesn't call the app's starting values yours", async ({ page }) => {
  await page.goto('#/shoot')
  await page.getByRole('button', { name: 'Set up my rifle' }).click()
  await page.getByRole('button', { name: 'Pick factory ammo' }).click()
  await page.locator('[name="factorySearch"]').fill('308')
  await page.locator('.factory-item', { hasText: 'Federal Gold Medal 175' }).click()

  await expect(page.locator('.factory-preview')).toBeVisible()
  await expect(page.locator('.factory-preview .replaces')).toHaveCount(0)
  await page.getByRole('button', { name: 'Use these values' }).click()
  const notes = await page.evaluate(() => JSON.parse(localStorage.getItem('prs.data')!).profiles[0].notes)
  expect(notes ?? '').toBe('')

  // Picking a different load now does replace real values, and says so.
  await page.getByRole('button', { name: 'Pick factory ammo' }).click()
  await page.locator('[name="factorySearch"]').fill('308')
  await page.locator('.factory-item', { hasText: 'Lapua 155' }).click()
  await expect(page.locator('.factory-preview .replaces')).toContainText('MV 2600 fps')
})
