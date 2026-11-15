// Screenshots of every screen and empty state in Sun, Dark and Night, for the
// before/after comparison. Only runs when SHOTS_DIR is set:
//   SHOTS_DIR=some/folder npx playwright test e2e/screens.spec.ts
import { test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { seedData, type Theme } from './seed.ts'

const dir = process.env.SHOTS_DIR
type Seed = 'full' | 'empty' | 'stages' | 'none'

const go = async (p: Page, hash: string) => {
  await p.keyboard.press('Escape').catch(() => undefined)
  await p.evaluate(() => document.querySelector('.undo-toast')?.remove())
  await p.evaluate((h) => {
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'))
    else location.hash = h
  }, hash)
  await p.waitForTimeout(500)
}

const SCREENS: { id: string; title: string; seed: Seed; open: (p: Page) => Promise<void> }[] = [
  { id: '01-shoot', title: 'Shoot', seed: 'full', open: (p) => go(p, '#/shoot') },
  { id: '02-log-sheet', title: 'Log shot sheet', seed: 'full', open: async (p) => { await go(p, '#/shoot'); await p.click('[data-action="log-shot"]'); await p.waitForTimeout(900) } },
  { id: '03-settings', title: 'Settings', seed: 'full', open: async (p) => { await go(p, '#/shoot'); await p.click('[data-action="settings"]'); await p.waitForTimeout(400) } },
  { id: '04-match-list', title: 'Match list', seed: 'full', open: (p) => go(p, '#/match') },
  { id: '05-match', title: 'A match', seed: 'full', open: async (p) => { await go(p, '#/match/m1'); await p.waitForTimeout(1500) } },
  { id: '06-stage-entry', title: 'Stage entry', seed: 'full', open: (p) => go(p, '#/match/m1/stage/1') },
  { id: '07-stage-card', title: 'Stage card', seed: 'full', open: async (p) => { await go(p, '#/match/m1/card/1'); await p.waitForSelector('.stage-card') } },
  { id: '08-range-card', title: 'Range card', seed: 'full', open: async (p) => { await go(p, '#/card/r1'); await p.waitForSelector('.range-table') } },
  { id: '09-log', title: 'Log', seed: 'full', open: async (p) => { await go(p, '#/log'); await p.waitForTimeout(2500) } },
  { id: '10-truing-chart', title: 'Truing · chart', seed: 'full', open: async (p) => { await go(p, '#/log/true'); await p.locator('[data-action="next"]').first().click(); await p.waitForSelector('.chart', { timeout: 30_000 }) } },
  { id: '11-truing-verdict', title: 'Truing · verdict', seed: 'full', open: async (p) => { await go(p, '#/log/true'); await p.locator('[data-action="next"]').first().click(); await p.waitForSelector('.chart', { timeout: 30_000 }); await p.locator('[data-action="next"]').first().click(); await p.waitForTimeout(300) } },
  { id: '12-rifles', title: 'Rifles', seed: 'full', open: (p) => go(p, '#/rifles') },
  { id: '13-rifle-editor', title: 'Rifle editor', seed: 'full', open: (p) => go(p, '#/rifles/r1') },
  { id: '14-check', title: 'Check accuracy (empty)', seed: 'full', open: (p) => go(p, '#/check') },
  { id: '15-data', title: 'Data & backup', seed: 'full', open: (p) => go(p, '#/data') },
  { id: '16-empty-matches', title: 'Empty · no matches', seed: 'empty', open: (p) => go(p, '#/match') },
  { id: '17-empty-log', title: 'Empty · no shots logged', seed: 'empty', open: async (p) => { await go(p, '#/log'); await p.waitForTimeout(1500) } },
  { id: '18-empty-truing', title: 'Empty · no hits to true with', seed: 'empty', open: (p) => go(p, '#/log/true') },
  { id: '19-empty-stages', title: 'Empty · match with no stages', seed: 'stages', open: async (p) => { await go(p, '#/match/m1'); await p.waitForTimeout(500) } },
  { id: '20-first-run', title: 'First run', seed: 'none', open: (p) => go(p, '#/shoot') },
]

for (const theme of ['sun', 'dark', 'night'] as Theme[]) {
  test(`screens · ${theme}`, async ({ page }) => {
    test.skip(!dir, 'set SHOTS_DIR to take screenshots')
    mkdirSync(dir!, { recursive: true })
    await page.setViewportSize({ width: 375, height: 812 })
    let current: Seed | undefined
    for (const s of SCREENS) {
      if (s.seed !== current) {
        const data = seedData({ theme, glove: false, leftHanded: false, rifles: s.seed !== 'none', empty: s.seed === 'empty' ? 'all' : s.seed === 'stages' ? 'stages' : undefined })
        await page.goto('#/shoot')
        await page.evaluate((d) => localStorage.setItem('prs.data', d), JSON.stringify(data))
        await page.reload()
        await page.waitForTimeout(800)
        current = s.seed
      }
      await s.open(page)
      await page.screenshot({ path: `${dir}/${s.id}-${theme}.jpg`, type: 'jpeg', quality: 80 })
    }
  })
}

export const SCREEN_TITLES = Object.fromEntries(SCREENS.map((s) => [s.id, s.title]))
