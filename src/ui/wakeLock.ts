// Keeps the screen on while a field screen (Shoot) is open, using the Wake Lock
// API. Fails quietly where it isn't supported (e.g. iPhone web apps before
// iOS 18.4). The browser drops the lock when the app goes to the background,
// so it's asked for again when you come back.

type Sentinel = { release: () => Promise<void> }
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }

/** Starts keeping the screen awake; call the returned function to stop. */
export function keepScreenAwake(): () => void {
  const nav = navigator as WakeLockNav
  if (!nav.wakeLock) return () => {}
  let sentinel: Sentinel | undefined
  let active = true

  const request = async () => {
    if (!active || document.visibilityState !== 'visible') return
    try {
      sentinel = await nav.wakeLock!.request('screen')
    } catch {
      // Not allowed right now (battery saver, unsupported); nothing to do.
    }
  }
  const onVisible = () => void request()

  document.addEventListener('visibilitychange', onVisible)
  void request()

  return () => {
    active = false
    document.removeEventListener('visibilitychange', onVisible)
    void sentinel?.release().catch(() => undefined)
    sentinel = undefined
  }
}
