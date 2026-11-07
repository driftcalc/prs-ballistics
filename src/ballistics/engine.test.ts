import { describe, expect, it } from 'vitest'
import { Calculator } from 'js-ballistics'
import { createJsBallisticsEngine } from './index.ts'

describe('ballistics setup', () => {
  it('creates the js-ballistics engine', () => {
    expect(createJsBallisticsEngine().name).toBe('js-ballistics')
  })

  it('can load the js-ballistics library', () => {
    expect(new Calculator()).toBeDefined()
  })
})
