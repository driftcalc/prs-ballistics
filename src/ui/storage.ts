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

/** The saved text exactly as stored (null if none or storage unavailable). */
export function loadRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function saveRaw(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

/** All saved keys starting with `prefix`. */
export function keysStartingWith(prefix: string): string[] {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) keys.push(k)
    }
    return keys
  } catch {
    return []
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing else to do.
  }
}
