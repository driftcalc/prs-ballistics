// Field-readiness audit: every screen and state, in Sun, Dark and Night,
// normal / Glove / Left-handed, at 375px (small iPhone) and 430px (large phone).
// Findings are written to field-report/ and the test fails if there are any
// (links inside sentences are reported but don't fail).
import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { auditInPage, greenOrBluePixels, type Finding } from './audit.ts'
import { seedData, type Theme } from './seed.ts'

const THEMES: Theme[] = ['sun', 'dark', 'night']
const MODES = [
  { id: 'normal', glove: false, leftHanded: false },
  { id: 'glove', glove: true, leftHanded: false },
  { id: 'left', glove: false, leftHanded: true },
]
const WIDTHS = [
  { w: 375, h: 812 },
  { w: 430, h: 932 },
]

const wait = (page: Page, ms = 350) => page.waitForTimeout(ms)
async function go(page: Page, hash: string) {
  await page.keyboard.press('Escape').catch(() => undefined) // close any open sheet
  await page.evaluate(() => document.querySelector('.undo-toast')?.remove()) // and any Undo message left from the last screen
  // Same address twice doesn't fire a change, so re-open the page explicitly.
  await page.evaluate((h) => {
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'))
    else location.hash = h
  }, hash)
  await wait(page)
}
const click = (page: Page, sel: string) => page.locator(sel).first().click()
const waitText = (page: Page, sel: string, re: RegExp) =>
  page.waitForFunction(([s, r]) => new RegExp(r).test(document.querySelector(s)?.textContent ?? ''), [sel, re.source] as const, { timeout: 15_000 })

/** Each state: how to get there, and whether its colours belong to one theme. */
const STATES: { name: string; mixed?: boolean; open: (p: Page) => Promise<void> }[] = [
  { name: 'Shoot', open: async (p) => { await go(p, '#/shoot'); await waitText(p, '[data-readout="elev"] [data-part="num"]', /\d/) } },
  { name: 'Shoot · conditions sheet', open: async (p) => { await go(p, '#/shoot'); await click(p, '[data-action="conditions"]'); await wait(p) } },
  { name: 'Shoot · rifle sheet', open: async (p) => { await go(p, '#/shoot'); await click(p, '[data-action="pick-rifle"]'); await wait(p) } },
  {
    name: 'Shoot · log shot sheet',
    open: async (p) => {
      await go(p, '#/shoot')
      await click(p, '[data-action="log-shot"]')
      await waitText(p, '[data-predicted]', /Predicted/)
      await click(p, '.sheet [data-value="hit"]')
    },
  },
  {
    name: 'Shoot · undo toast',
    open: async (p) => {
      await go(p, '#/shoot')
      await click(p, '[data-action="log-shot"]')
      await waitText(p, '[data-predicted]', /Predicted/)
      await click(p, '.sheet [data-value="hit"]')
      await click(p, '.sheet [data-action="save"]')
      await wait(p, 150)
    },
  },
  {
    // Past the speed of sound: the warning line under the holds.
    name: 'Shoot · 1500 yd (speed of sound)',
    open: async (p) => {
      await go(p, '#/shoot')
      await p.locator('[name="range"]').fill('1500')
      await p.locator('[name="range"]').blur()
      await waitText(p, '[data-sound-note]', /speed of sound/)
    },
  },
  { name: 'Settings sheet', open: async (p) => { await go(p, '#/shoot'); await click(p, '[data-action="settings"]'); await wait(p) } },
  { name: 'Match list', open: (p) => go(p, '#/match') },
  { name: 'Match', open: async (p) => { await go(p, '#/match/m1'); await wait(p, 1500) } },
  { name: 'Stage entry (new)', open: (p) => go(p, '#/match/m1/stage/new') },
  { name: 'Stage entry (edit)', open: (p) => go(p, '#/match/m1/stage/1') },
  { name: 'Stage card 1', open: async (p) => { await go(p, '#/match/m1/card/1'); await p.waitForSelector('.stage-card', { timeout: 15_000 }) } },
  { name: 'Stage card 2', open: async (p) => { await go(p, '#/match/m1/card/2'); await p.waitForSelector('.stage-card', { timeout: 15_000 }) } },
  { name: 'Range card', open: async (p) => { await go(p, '#/card/r1'); await p.waitForSelector('.range-table', { timeout: 15_000 }) } },
  { name: 'Log', open: async (p) => { await go(p, '#/log'); await waitText(p, '[data-truing-status]', /^(?!Checking)/) } },
  { name: 'Log entry', open: async (p) => { await go(p, '#/log/l1'); await waitText(p, '[data-predicted]', /predicts/) } },
  { name: 'Truing 1 · pick', open: (p) => go(p, '#/log/true') },
  {
    name: 'Truing 2 · chart',
    open: async (p) => {
      await go(p, '#/log/true')
      await click(p, '[data-action="next"]')
      await p.waitForSelector('.chart', { timeout: 30_000 })
    },
  },
  {
    name: 'Truing 3 · verdict',
    open: async (p) => {
      await go(p, '#/log/true')
      await click(p, '[data-action="next"]')
      await p.waitForSelector('.chart', { timeout: 30_000 })
      await click(p, '[data-action="next"]')
      await wait(p, 200)
    },
  },
  { name: 'Rifles', open: (p) => go(p, '#/rifles') },
  {
    name: 'Rifle editor (More open)',
    open: async (p) => {
      await go(p, '#/rifles/r1')
      await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)))
    },
  },
  {
    name: 'Rifle editor · factory ammo',
    open: async (p) => {
      await go(p, '#/rifles/r1')
      await click(p, '[data-action="factory"]')
      await click(p, '[data-load]')
      await wait(p)
    },
  },
  { name: 'Check accuracy', open: (p) => go(p, '#/check') },
  { name: 'Data & backup', open: (p) => go(p, '#/data') },
  { name: 'Style guide', mixed: true, open: (p) => go(p, '#/styleguide') },
]

const FIRST_RUN: typeof STATES = [
  { name: 'First run · welcome', open: (p) => go(p, '#/shoot') },
  { name: 'First run · your load', open: async (p) => { await go(p, '#/shoot'); await click(p, '[data-action="setup"]'); await click(p, '[data-action="factory"]'); await click(p, '[data-load]'); await wait(p) } },
  { name: 'First run · scope & zero', open: async (p) => { await click(p, '[data-action="skip"]'); await wait(p) } },
]

const NO_RIFLE: typeof STATES = [
  { name: 'Empty · Rifles (no rifles)', open: (p) => go(p, '#/rifles') },
  { name: 'Empty · Log (no rifle)', open: (p) => go(p, '#/log') },
  { name: 'Empty · Range card (no rifle)', open: (p) => go(p, '#/card/r1') },
]

const EMPTY: Record<'all' | 'stages', typeof STATES> = {
  all: [
    { name: 'Empty · Match list', open: (p) => go(p, '#/match') },
    { name: 'Empty · Log (no shots)', open: (p) => go(p, '#/log') },
    { name: 'Empty · Truing (no hits)', open: (p) => go(p, '#/log/true') },
  ],
  stages: [{ name: 'Empty · Match with no stages', open: (p) => go(p, '#/match/m1') }],
}

async function runStates(page: Page, theme: Theme, states: typeof STATES, label: string): Promise<{ state: string; findings: Finding[] }[]> {
  const results: { state: string; findings: Finding[] }[] = []
  for (const s of states) {
    await s.open(page)
    const findings = await page.evaluate(auditInPage, { theme, minContrast: 4.5, nightContrast: 5.25, mixedThemes: !!s.mixed })
    if (theme === 'night' && !s.mixed) {
      const px = greenOrBluePixels(await page.screenshot({ fullPage: true }))
      if (px.count) findings.push({ kind: 'night-colour', detail: `${px.count} pixels on screen have green or blue (e.g. ${px.example})` })
    }
    results.push({ state: `${label} · ${s.name}`, findings })
  }
  return results
}

for (const theme of THEMES) {
  for (const mode of MODES) {
    for (const size of WIDTHS) {
      const label = `${theme} · ${mode.id} · ${size.w}px`
      test(label, async ({ page }) => {
        await page.setViewportSize({ width: size.w, height: size.h })
        const seed = (rifles: boolean) => JSON.stringify(seedData({ theme, glove: mode.glove, leftHanded: mode.leftHanded, rifles }))
        await page.addInitScript((data) => {
          if (sessionStorage.getItem('field-seeded')) return
          localStorage.setItem('prs.data', data)
          sessionStorage.setItem('field-seeded', '1')
        }, seed(true))
        await page.goto('#/shoot')
        const results = await runStates(page, theme, STATES, label)

        // First run and "no rifle" screens need a phone with no rifles yet.
        await page.evaluate((data) => localStorage.setItem('prs.data', data), seed(false))
        await page.reload()
        results.push(...(await runStates(page, theme, [...NO_RIFLE, ...FIRST_RUN], label)))

        // Empty states: rifles, but nothing logged and no matches; then a match with no stages.
        for (const empty of ['all', 'stages'] as const) {
          const data = JSON.stringify(seedData({ theme, glove: mode.glove, leftHanded: mode.leftHanded, empty }))
          await page.evaluate((d) => localStorage.setItem('prs.data', d), data)
          await page.reload()
          results.push(...(await runStates(page, theme, EMPTY[empty], label)))
        }

        mkdirSync('field-report', { recursive: true })
        writeFileSync(`field-report/${label.replace(/[^\w]+/g, '-')}.json`, JSON.stringify(results, null, 2))
        const failing = results.flatMap((r) => r.findings.filter((f) => f.kind !== 'inline-link').map((f) => `${r.state}: [${f.kind}] ${f.detail}`))
        expect(failing, failing.slice(0, 40).join('\n')).toEqual([])
      })
    }
  }
}
