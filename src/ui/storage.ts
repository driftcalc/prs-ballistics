// Saves small amounts of data on this device only (browser localStorage).
// Storage can be unavailable (private mode, full disk), so failures are ignored
// and the app falls back to defaults.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not saved; the app still works for this visit.
  }
}
