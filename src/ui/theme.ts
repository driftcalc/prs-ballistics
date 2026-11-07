// Applies the display settings to the whole app: theme (Sun / Dark / Night,
// or Auto = follow the phone), Glove mode and Left-handed.
import { getData, type ThemeSetting } from '../data/store.ts'

export type Theme = 'sun' | 'dark' | 'night'

const STATUS_BAR: Record<Theme, string> = { sun: '#ffffff', dark: '#000000', night: '#000000' }

const prefersLight = () => window.matchMedia?.('(prefers-color-scheme: light)').matches === true

/** Turns the setting into the theme actually shown (Auto follows the phone). */
export function resolveTheme(setting: ThemeSetting, phoneIsLight: boolean): Theme {
  if (setting === 'auto') return phoneIsLight ? 'sun' : 'dark'
  return setting
}

export function applyTheme(): void {
  const { settings } = getData()
  const theme = resolveTheme(settings.theme, prefersLight())
  const root = document.documentElement
  root.dataset.theme = theme
  root.toggleAttribute('data-glove', settings.glove)
  root.toggleAttribute('data-lefthand', settings.leftHanded)
  document.querySelector('.night-toggle')?.toggleAttribute('aria-pressed', theme === 'night')
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', STATUS_BAR[theme]))
}

/** In Auto, switch when the phone switches between light and dark. */
export function followPhoneTheme(): void {
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme)
}
