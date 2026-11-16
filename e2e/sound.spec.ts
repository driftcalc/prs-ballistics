// Holds near or below the speed of sound carry a plain warning (the numbers
// never change); rimfire, which flies there all the time, never does.
import { expect, test, type Page } from '@playwright/test'
import { seedData } from './seed.ts'

const seed = (page: Page, change: (d: ReturnType<typeof seedData>) => void = () => undefined) =>
  page.addInitScript((data) => {
    if (!localStorage.getItem('prs.data')) localStorage.setItem('prs.data', data)
  }, JSON.stringify((() => {
    const d = seedData({ theme: 'dark', glove: false, leftHanded: false })
    change(d)
    return d
  })()))

async function shootAt(page: Page, yd: number) {
  await page.goto('#/shoot')
  await page.locator('[name="range"]').fill(String(yd))
  await page.locator('[name="range"]').blur()
  await expect(page.locator('[data-sub]')).toContainText(`${yd} yd`, { timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
})

test('centerfire: no note at 600 yd, "nearing" around 1100 yd, "below" at 2000 yd', async ({ page }) => {
  await seed(page)
  await shootAt(page, 600)
  await expect(page.locator('[data-sound-note]')).toBeEmpty()
  await shootAt(page, 1150)
  await expect(page.locator('[data-sound-note]')).toContainText('Nearing the speed of sound')
  await shootAt(page, 2000)
  await expect(page.locator('[data-sound-note]')).toContainText('Below the speed of sound here (Mach 0.')
})

test('rimfire never gets the note', async ({ page }) => {
  await seed(page, (d) => (d.shoot.profileId = 'r2'))
  await shootAt(page, 200)
  await expect(page.locator('[data-readout="elev"] [data-part="num"]')).toHaveText(/\d/)
  await expect(page.locator('[data-sound-note]')).toBeEmpty()
})

test('range card: a line where the bullet nears, then drops below, the speed of sound', async ({ page }) => {
  await seed(page)
  await page.goto('#/card/r1')
  await expect(page.locator('[data-sound-divider="near"]')).toHaveCount(1, { timeout: 15_000 })
  await expect(page.locator('[data-sound-divider="below"]')).toHaveCount(1)
  // The "below" line comes after the "near" one, and the rows keep their numbers.
  const rows = await page.locator('.range-table tbody tr').allTextContents()
  expect(rows.findIndex((t) => t.includes('Nearing'))).toBeLessThan(rows.findIndex((t) => t.includes('Below')))
  expect(rows.at(-1)).toMatch(/UP \d/)
})

test('stage cards: old cards ask for an update; the far target is labelled', async ({ page }) => {
  await seed(page, (d) => {
    // A card worked out by the previous version (no Mach figures).
    const s = d.matches[0].stages[1] as Record<string, unknown>
    s.card = {
      computedAt: new Date().toISOString(),
      profileName: '6.5 CM',
      rifle: d.profiles[0].rifle,
      conditions: d.conditions,
      windsMph: [5, 10],
      rows: (s.targets as { name: string; rangeYd: number }[]).map((t) => ({ ...t, elevationRad: 0.003, wind: [{ mph: 5, fromLeftRad: 0, fromRightRad: 0 }, { mph: 10, fromLeftRad: 0, fromRightRad: 0 }] })),
    }
  })
  await page.goto('#/match/m1')
  await expect(page.locator('[data-stale]')).toContainText('New in this version: speed-of-sound notes.', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Update all cards' }).click()
  await expect(page.locator('[data-stale]')).toHaveCount(0, { timeout: 15_000 })

  await page.goto('#/match/m1/card/2')
  const far = page.locator('.stage-row', { hasText: 'FAR' })
  await expect(far.locator('[data-row-sound]')).toHaveText('Below the speed of sound — less reliable', { timeout: 15_000 })
  await expect(page.locator('.stage-row', { hasText: 'T1' }).locator('[data-row-sound]')).toHaveCount(0)
})
