// Public entry point for the ballistics module. The UI imports from here only.
//
// The engine itself (and its ~250 KB WebAssembly) is loaded the first time it
// is needed, as a separate file, so the app opens fast.
import type { BallisticsEngine } from './engine.ts'

export type { BallisticsEngine, DragModelName, RangeSolution, ShotInput } from './engine.ts'
export { BallisticsError } from './engine.ts'

let engine: Promise<BallisticsEngine> | undefined

export function getEngine(): Promise<BallisticsEngine> {
  engine ??= import('./jsBallisticsEngine.ts').then((m) => m.createJsBallisticsEngine())
  return engine
}
