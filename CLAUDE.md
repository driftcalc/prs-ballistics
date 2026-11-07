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

## Ballistics rules (most important)

- **Never write ballistics formulas by hand.** All trajectory math comes from
  the open-source `js-ballistics` library.
- All ballistics code lives in `src/ballistics/`, separate from the UI, behind the
  `BallisticsEngine` interface in `src/ballistics/engine.ts` so the engine can be
  swapped later. Only `src/ballistics/jsBallisticsEngine.ts` may import `js-ballistics`.
- All math is done internally in metric/SI units. Convert to yards, fps, mil, MOA,
  etc. only for display, using helpers in `src/units/`.

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
- Node, Git and GitHub CLI were installed with winget. If a command isn't found in a
  shell, refresh PATH: `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
