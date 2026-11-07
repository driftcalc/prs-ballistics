// Two copies of the app (e.g. two browser tabs) share one saved bundle.
// Saving in one must never wipe out what the other saved.
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** A stand-in for the browser's localStorage, shared like two tabs would share it. */
function fakeStorage(failWrites = () => false) {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites()) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k: string) => void map.delete(k),
  }
}

/** Loads a fresh copy of the store module, like opening the app in a new tab. */
async function openTab() {
  vi.resetModules()
  return import('./store.ts')
}

const rifle = (id: string, name: string) => ({
  id,
  name,
  rifle: { muzzleVelocityFps: 2700, bc: 0.3, dragModel: 'G7' as const, bulletWeightGr: 140, sightHeightIn: 2, zeroRangeYd: 100, twistDirection: 'right' as const },
  updatedAt: '',
})

describe('two copies of the app open at once', () => {
  let storage: ReturnType<typeof fakeStorage>
  beforeEach(() => {
    storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
  })

  it("saving in one copy keeps the other copy's newer changes", async () => {
    const tabA = await openTab()
    tabA.getData() // tab A has the data in memory
    const tabB = await openTab()
    tabB.updateData((d) => void d.profiles.push(rifle('b', 'Added in tab B')))

    // Tab A now changes something else; tab B's rifle must survive.
    tabA.updateData((d) => void (d.settings.night = true))
    const saved = JSON.parse(storage.map.get('prs.data')!)
    expect(saved.profiles.map((p: { name: string }) => p.name)).toEqual(['Added in tab B'])
    expect(saved.settings.night).toBe(true)
  })

  it('when saving is failing, keeps the in-memory changes instead of re-reading older storage', async () => {
    let failing = false
    storage = fakeStorage(() => failing)
    vi.stubGlobal('localStorage', storage)
    const tab = await openTab()
    tab.updateData((d) => void d.profiles.push(rifle('a', 'Saved')))
    failing = true
    tab.updateData((d) => void d.profiles.push(rifle('b', 'Only in memory')))
    tab.updateData((d) => void (d.settings.night = true))
    expect(tab.getData().profiles.map((p) => p.name)).toEqual(['Saved', 'Only in memory'])
  })
})
