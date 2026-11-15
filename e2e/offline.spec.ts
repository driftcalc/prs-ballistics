// Works with no signal: open the app once (it saves itself on the phone),
// switch the network off, reload, and use every tab.
import { expect, test } from '@playwright/test'
import { seedData } from './seed.ts'

test('works fully offline after the first visit', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.addInitScript((data) => {
    if (!localStorage.getItem('prs.data')) localStorage.setItem('prs.data', data)
  }, JSON.stringify(seedData({ theme: 'dark', glove: false, leftHanded: false })))

  // First visit online: wait until the offline copy is installed and in charge.
  await page.goto('#/shoot')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))
  })
  // Let it finish saving everything (the ballistics engine file included).
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()

  // Shoot: a real hold, worked out with no network.
  await expect(page.locator('[data-readout="elev"] [data-part="num"]')).toHaveText(/\d+\.\d/, { timeout: 15_000 })
  // Every tab opens.
  for (const [hash, sel] of [
    ['#/match', '.match-list'],
    ['#/match/m1/card/1', '.stage-card'],
    ['#/card/r1', '.range-table'],
    ['#/log', '.log-list'],
    ['#/rifles', '.rifle-list'],
  ] as const) {
    await page.evaluate((h) => (location.hash = h), hash)
    await expect(page.locator(sel).first(), `${hash} offline`).toBeVisible({ timeout: 15_000 })
  }
  // The range card has real numbers, not errors.
  await page.evaluate(() => (location.hash = '#/card/r1'))
  await expect(page.locator('.range-table tbody tr').nth(10)).toContainText(/UP \d/)
  await context.setOffline(false)
})
