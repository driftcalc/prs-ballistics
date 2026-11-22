# Comparisons set aside (not run by the tests)

These are comparisons with other calculators that are **not** used as tests yet,
because they disagree with Spin Drift by more than 0.1 mil somewhere and the
reason hasn't been settled. Per CLAUDE.md, the numbers are never edited to pass.

- `shooterscalc-65cm-140-g7.json` (2026-11-22): ShootersCalculator.com, which
  calls itself "an approximation". Within 0.05 mil to 800 yd; at 1000 yd ours
  9.27 vs theirs 9.16 mil (0.11). Weather inputs were confirmed identical and
  its atmosphere correction barely moves it (9.14 off / 9.16 on); the gap is in
  drag as the bullet slows (1388 vs 1411 fps at 1000 yd). Needs a trusted second
  source (AB, Hornady 4DOF app, JBM/Ballistic AE) before deciding.

Move a file into `../cases/` only when it agrees, or when the owner decides.
