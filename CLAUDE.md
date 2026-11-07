# PRS Ballistics — rules for Claude

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
- Pages (hash routes): Shoot (home), Rifles, Check (accuracy), Data.
- Shoot screen is used with gloves: tap targets at least 64 px, holds in huge text.
  Every colour must come from CSS variables so red night mode (`:root[data-night]`)
  covers it — no hard-coded colours.

## Saved data

- All saved data is one bundle (`src/data/store.ts`, localStorage key `prs.data`,
  `DATA_VERSION`). Read with `getData()`, change with `updateData()`.
- If the bundle's shape changes: bump `DATA_VERSION` and add a conversion from
  the old version so nobody loses data. Old 0.1 keys are converted by `migrateLegacy`.
- Nothing may be trapped: anything new that is saved must also be included in the
  JSON backup (`src/data/backup.ts`) and covered by the round-trip test.
- Rifles CSV columns are listed in `CSV_COLUMNS`; keep import tolerant of
  missing optional columns.

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
