# Spin Drift — rules for Claude

(Display name "Spin Drift"; the repo, web address and backup format id stay `prs-ballistics`
so installed copies and saved data keep working.)

Ballistic calculator web app for PRS/NRL and rimfire competitors.
Live site: https://driftcalc.github.io/prs-ballistics/ (GitHub Pages), deployed by
`.github/workflows/deploy.yml` on every push to `main`.

## The user

The owner is not a programmer and relies on Claude for all code.
- Explain things in plain English. Avoid jargon, or explain it when unavoidable.
- Work in small steps. Show a plan before larger changes.

## Product rules

- Mobile-first web app. Must work well on a phone, be installable to the home
  screen (PWA), and work fully offline.
- Vite + TypeScript, no UI framework unless agreed. Keep it simple.
- No backend, no accounts. All user data is saved on the device only.
- Hosted free on GitHub Pages. Vite `base` is `/prs-ballistics/`.
- Pages (hash routes): bottom tabs Shoot (home), Match (placeholder), Log, Rifles;
  Check accuracy and Data & backup open from the ⚙ Settings sheet; hidden
  `#/styleguide` shows every component in all three themes.
- No ballistics logic changes during UI work.

## Design system (every screen, every session)

Look: a calm precision instrument (aviation display / Kestrel screen). Clean,
flat, high contrast. **No camo, no skulls, no gradients, no shadows, no decoration.**

- **Tokens only.** Every colour, size, space and timing comes from
  `src/design/tokens.css` (`--bg`, `--surface`, `--text`, `--text-2`, `--line`,
  `--accent`, `--on-accent`, `--danger`, `--good`, `--s1..--s6`, `--touch`, `--gap`,
  `--control-primary`, `--fs-*`, `--motion`). Never hard-code a colour or px size
  in a screen.
- **Themes:** Sun (black on white), Dark (default; white on black, amber accent),
  Night (pure red on pure black). Set by `data-theme` on `<html>`; setting
  `auto` follows the phone. **Night has no green or blue in any colour.**
- **Contrast ≥ 7:1** for all text in Sun and Dark. Night is the one approved
  exception: pure #FF0000 on black is 5.25:1 (the maximum possible), so all Night
  text uses full #FF0000 — hierarchy by size/weight, never dimmer text.
- **Type:** Inter (bundled, OFL), tabular digits + slashed zero everywhere.
  Minimum **16px** anywhere, **18px on field screens** (Shoot, Match, Log →
  `field: true` in `src/main.ts`), hold numbers **≥ 72px** bold.
- **Touch:** every target ≥ 48×48px with ≥ 8px gaps. Primary controls
  (steppers, tab bar, segmented toggles, pickers) use `--control-primary`:
  64px, **96px in Glove mode** (`data-glove`). **Left-handed** (`data-lefthand`)
  mirrors bottom control rows (stepper +/−, chip row, tab bar).
- **Motion:** every button has an instant pressed state (colours invert, no
  transition). No animation over 150ms; `prefers-reduced-motion` → none.
- **Components** (`src/design/components.ts` + `components.css`): readout,
  stepper, chipRow, segmented, card, tabBar (max 4 tabs), openSheet (bottom
  sheet). Use these instead of one-off markup; new buttons use `.btn`,
  `.btn-primary`, `.btn-danger`. Add any new component to the style guide.
- **Checks:** `src/design/design.test.ts` fails the build on contrast below the
  rules, green/blue in Night, any font size under 16px, shadows, gradients, or
  transitions over 150ms. Never weaken these checks to make them pass.
  After UI changes, audit every screen in all three themes (text size, contrast,
  48px targets) at phone width before publishing.

## Saved data

- All saved data is one bundle (`src/data/store.ts`, localStorage key `prs.data`,
  `DATA_VERSION`). Read with `getData()`, change with `updateData()`.
- If the bundle's shape changes: bump `DATA_VERSION` and add a conversion from
  the old version so nobody loses data. Old 0.1 keys are converted by `migrateLegacy`.
- Nothing may be trapped: anything new that is saved must also be included in the
  JSON backup (`src/data/backup.ts`) and covered by the round-trip test.
- Rifles CSV columns are listed in `CSV_COLUMNS`; keep import tolerant of
  missing optional columns.

## Logbook and truing

- Each log entry (`src/data/log.ts`) stores a snapshot of the rifle, the
  conditions, wind, the actual hold and the prediction at the time. Never
  rewrite old entries when a rifle changes.
- The truing assistant (`src/truing/truing.ts`) only re-runs the engine with
  trial MV/BC values (golden-section search) — no ballistics formulas. It uses
  confirmed elevation holds only, never windage.
- **It must never change a rifle by itself.** Changes happen only from the
  "Apply" button after the owner confirms, and the old value goes in the notes.
- Its "clear vs can't tell" decision accounts for the click size of the holds
  (`holdResolutionMil`). Prefer "can't tell yet" over a confident wrong answer.
  Known-answer tests in `truing.test.ts` generate holds from a hidden true MV/BC;
  don't loosen their limits to make them pass.

## Factory ammo library

- `src/library/ammo.ts`: manufacturers' published figures only, typed by hand from
  the maker's OWN product page, with `source` URL and `checked` date per entry.
  Never scrape, never copy another app's/site's database, no descriptions/photos/
  logos, no Applied Ballistics custom drag models. Leave a load out rather than
  guess a figure the maker doesn't publish; mark assumptions (e.g. `testBarrelAssumed`).
- Hornady publishes BC per speed band; use the Mach 1.75 value (their advice beyond 600 yd).
- Show the owner new library data as a table for review before adding it.
- **The one allowed exception to "no hand-written ballistics formulas"** is the
  barrel-length velocity estimate in `src/library/barrelEstimate.ts` (owner approved).
  It must always be shown as an estimate with ± and a source for each per-inch figure.
  No other hand-made formulas.
- Filling a rifle from the library sets `profile.factory.mvEstimated`; typing your
  own MV or applying a trued MV clears it.

## Ballistics rules (most important)

- **Never write ballistics formulas by hand.** All trajectory math comes from
  the open-source `js-ballistics` library.
- All ballistics code lives in `src/ballistics/`, separate from the UI, behind the
  `BallisticsEngine` interface in `src/ballistics/engine.ts` so the engine can be
  swapped later. Only `src/ballistics/jsBallisticsEngine.ts` may import `js-ballistics`.
- All math is done internally in metric/SI units. Convert to yards, fps, mil, MOA,
  etc. only for display, using helpers in `src/units/`.
- "Mil" in this app always means milliradian (what scopes, Hornady and AB use).
  The library's `Unit.MIL` is the NATO mil (1/6400 circle) — never use it; read
  angles as `Unit.Radian` and convert with `src/units/`.
- Conventions in `ShotInput`/`RangeSolution`: wind direction is where the wind
  comes FROM, clockwise from 12 o'clock (3 o'clock = from the right); elevation
  positive = dial up; windage positive = dial right. Spin drift needs twist,
  bullet diameter AND bullet length.
- US-unit inputs (`src/shotInputs.ts`) are converted to SI in `toShotInput` only.

## Accuracy reference tests

- `src/accuracy/cases/*.json` are comparisons exported from the Check accuracy
  page (Hornady / Applied Ballistics answers). `src/accuracy/reference.test.ts`
  runs them all; any elevation/windage row more than `TOLERANCE_MIL` (0.1 mil)
  away fails, which blocks publishing (the owner chose this).
- Never edit the numbers in a case file or `TOLERANCE_MIL` to make it pass.
  Stop, show the owner which rows differ, and investigate inputs first
  (G1/G7 vs custom drag curves, Coriolis, zero conditions, station vs sea-level
  pressure, spin drift settings).

## Licensing

- js-ballistics is ISC; it bundles bclibc (WebAssembly), which is LGPL-3.0.
  See `THIRD_PARTY_NOTICES.md`. Keep `public/licenses/` and the in-app
  "Licenses & disclaimer" link. Never modify js-ballistics/bclibc.
- When adding or upgrading any dependency, check its license and update the notices.

## How to work

- Work in small steps. After each step works (`npm run build` and `npm test` pass),
  commit to git with a clear message.
- **Never change test tolerances (or expected values) to make a test pass.**
  If a test fails, stop and tell the user what failed and why you think it did.
- After each feature, explain in plain English what was built and what could go wrong.

## Commands

- `npm run dev` — local dev server
- `npm test` — run tests (Vitest)
- `npm run build` — type-check and build to `dist/`
- Publishing: `gh` CLI is not signed in. Commit locally, then the owner clicks
  **Push origin** in GitHub Desktop (account `driftcalc`).
- Node, Git and GitHub CLI were installed with winget. If a command isn't found in a
  shell, refresh PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
