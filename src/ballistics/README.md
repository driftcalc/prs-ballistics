# Ballistics module

All trajectory math lives here, separate from the screens.

- **No hand-written ballistics formulas.** The math comes from
  [js-ballistics](https://github.com/o-murphy/js-ballistics).
- `engine.ts` defines the `BallisticsEngine` interface — the only thing the UI uses.
- `jsBallisticsEngine.ts` is the only file allowed to import `js-ballistics`.
  To swap engines, write a new adapter that implements the same interface.
- Everything in and out of this module is SI units (m, m/s, kg, rad, K, Pa).
  Display conversions (yd, fps, mil, MOA) live in `src/units/`.
