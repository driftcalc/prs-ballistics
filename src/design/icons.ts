// The app's one icon set: simple line icons drawn on a 24-unit grid with 2-unit
// rounded lines, in the text colour (so every theme, and Night's pure red,
// applies automatically). Typed symbols (⚙ ✎ ⚠ …) look different on every
// phone and some become colour emoji on iPhone, so the app uses these instead.
//
// Use: icon('settings'). Decorative by default (hidden from screen readers);
// give the button or link its own words or aria-label.

const PATHS = {
  /** Shoot tab: a reticle. */
  shoot: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  /** Match tab: a flag. */
  match: '<path d="M5 21V3"/><path d="M5 4h12l-3 4 3 4H5"/>',
  /** Log tab and "Log shot": a pencil. */
  log: '<path d="M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
  /** Rifles tab: a scoped rifle, side on. */
  rifles: '<path d="M2 13h20"/><path d="M2 13v5h4l3.5-5"/><rect x="8" y="6" width="9" height="3.5" rx="1.75"/><path d="M10.5 9.5V13M14.5 9.5V13"/>',
  /** Settings: a gear (wide teeth, so it can't be mistaken for a sun). */
  settings:
    '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path stroke-width="3.5" stroke-linecap="butt" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  /** Range card: a table. */
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 4v16"/>',
  /** Fill from factory ammo: down into a tray. */
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
  /** iPhone's Share: up out of a box. */
  share: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 11v10h14V11"/>',
  warning: '<path d="M12 3L2 20h20z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  prev: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  /** Opens a sheet or a list. */
  down: '<path d="M6 9l6 6 6-6"/>',
  /** The active rifle. */
  dot: '<circle cx="12" cy="12" r="5" fill="currentColor"/>',
  /** Empty states. */
  empty: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
} as const

export type IconName = keyof typeof PATHS
export const ICON_NAMES = Object.keys(PATHS) as IconName[]

export function icon(name: IconName, o: { className?: string } = {}): string {
  return `<svg class="icon${o.className ? ' ' + o.className : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`
}
