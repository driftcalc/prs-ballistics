// Automatic checks for the design rules (CLAUDE.md -> "Design system"):
// contrast in every theme, no green/blue in Night, and bans on small text,
// shadows, gradients and slow animation in every stylesheet.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Read the files from disk (in tests Vite hands stylesheets over as empty text).
const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..')
function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith('.css') ? [p] : []
  })
}
const sheetsByPath = Object.fromEntries(cssFiles(SRC).map((p) => [relative(SRC, p), readFileSync(p, 'utf8')]))
const tokens = readFileSync(join(HERE, 'tokens.css'), 'utf8')

/** The colour variables defined for one theme selector, e.g. [data-theme='sun']. */
function themeColors(theme: string): Record<string, string> {
  const block = tokens.match(new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`))?.[1]
  if (!block) throw new Error(`theme ${theme} not found`)
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]))
}

// WCAG 2 relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Every text colour must be readable on every background it can sit on. */
const TEXT_PAIRS: [text: string, background: string][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-2', 'bg'],
  ['text-2', 'surface'],
  ['accent', 'bg'], // accent used as text (links, selected labels)
  ['accent', 'surface'],
  ['on-accent', 'accent'], // text on a selected/primary button
  ['danger', 'bg'],
  ['danger', 'surface'],
  ['good', 'bg'],
  ['good', 'surface'],
  ['bg', 'text'], // pressed state inverts: background colour on text colour
]

describe('contrast (WCAG)', () => {
  for (const theme of ['sun', 'dark']) {
    const c = themeColors(theme)
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`${theme}: ${fg} on ${bg} is at least 7:1`, () => {
        expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(7)
      })
    }
  }

  // Night: the approved exception. Pure #FF0000 on black is 5.25:1, the maximum
  // possible for red; every text pair must be exactly that, never dimmer.
  const night = themeColors('night')
  for (const [fg, bg] of TEXT_PAIRS) {
    it(`night: ${fg} on ${bg} uses the brightest red (5.25:1)`, () => {
      expect(contrast(night[fg], night[bg])).toBeCloseTo(5.25, 2)
    })
  }

  it('night: no green or blue in any colour', () => {
    for (const [name, hex] of Object.entries(night)) {
      expect({ name, green: hex.slice(3, 5), blue: hex.slice(5, 7) }).toEqual({ name, green: '00', blue: '00' })
    }
  })

  it('sanity: the contrast maths matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#ff0000', '#000000')).toBeCloseTo(5.25, 2)
  })
})

describe('stylesheet rules', () => {
  const sheets = Object.entries(sheetsByPath).map(([p, css]) => ({ p, css: css.replace(/\/\*[\s\S]*?\*\//g, '') }))

  it('finds the stylesheets, with their contents', () => {
    expect(sheets.length).toBeGreaterThan(1)
    for (const s of sheets) expect(s.css.length).toBeGreaterThan(100)
  })

  for (const { p, css } of sheets) {
    it(`${p}: no text smaller than 16px`, () => {
      const tooSmall = [...css.matchAll(/font-size:\s*([^;]+);/g)]
        .flatMap((m) => [...m[1].matchAll(/(\d*\.?\d+)(px|rem|em)\b/g)].map((n) => ({ decl: m[0], v: Number(n[1]), u: n[2] })))
        .filter(({ v, u }) => (u === 'px' ? v < 16 : v < 1))
        .map(({ decl }) => decl)
      expect(tooSmall).toEqual([])
    })

    it(`${p}: no shadows or gradients`, () => {
      expect(css.match(/(box|text)-shadow:\s*(?!none)[^;]+;/g) ?? []).toEqual([])
      expect(css.match(/gradient\(/g) ?? []).toEqual([])
    })

    it(`${p}: no transition or animation longer than 150ms`, () => {
      const slow = [...css.matchAll(/(transition|animation)[\w-]*:\s*([^;]+);/g)]
        .flatMap((m) => [...m[2].matchAll(/(\d*\.?\d+)(ms|s)\b/g)].map((n) => ({ decl: m[0], ms: Number(n[1]) * (n[2] === 's' ? 1000 : 1) })))
        .filter(({ ms }) => ms > 150)
        .map(({ decl }) => decl)
      expect(slow).toEqual([])
    })
  }
})
