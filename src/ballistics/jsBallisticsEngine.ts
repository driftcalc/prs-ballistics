// Adapter: connects js-ballistics to the BallisticsEngine interface.
// This is the ONLY file in the app allowed to import 'js-ballistics'.
// No calculations yet; they are wired up when the first feature is built.

import type { BallisticsEngine } from './engine.ts'

export function createJsBallisticsEngine(): BallisticsEngine {
  return { name: 'js-ballistics' }
}
