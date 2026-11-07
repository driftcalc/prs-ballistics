// Saves small amounts of data on this device only (browser localStorage).
// Storage can be unavailable (private mode, full disk). Reads fall back to
// defaults; writes report whether they worked so the app can warn you.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Returns false if the data could NOT be saved. */
export function save(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
