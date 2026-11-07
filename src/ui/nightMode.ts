// Red night mode: black screen, dim red everything, so your eyes stay dark-adapted.
import { getData } from '../data/store.ts'

export function applyNightMode(): void {
  const night = getData().settings.night
  document.documentElement.toggleAttribute('data-night', night)
  document.querySelector('.night-toggle')?.toggleAttribute('aria-pressed', night)
  // Colours the phone's status bar to match.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', night ? '#000000' : '#1b2a1f'))
}
