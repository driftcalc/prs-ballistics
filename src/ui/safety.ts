// Keeping saved data safe: ask the browser not to clear it, nudge people to
// install the app (Safari can erase website data after ~7 days unused), and
// remind them to export a backup.
import type { AppData } from '../data/store.ts'

export const BACKUP_REMINDER_DAYS = 30

/** Asks the browser to keep this app's storage even when the phone is low on space. */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => undefined)
  } catch {
    // Not supported; nothing to do.
  }
}

/** True when running from the home screen (installed), not in a browser tab. */
export function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true
}

/** True when there's something worth backing up and no backup in the last 30 days. */
export function backupOverdue(d: AppData, now = new Date()): boolean {
  const hasData = d.profiles.length > 0 || d.log.length > 0 || Object.keys(d.comparisons).length > 0
  if (!hasData) return false
  if (!d.settings.lastBackupAt) return true
  const days = (now.getTime() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000
  return !(days < BACKUP_REMINDER_DAYS)
}

export function daysSinceBackup(d: AppData, now = new Date()): number | undefined {
  if (!d.settings.lastBackupAt) return undefined
  return Math.floor((now.getTime() - new Date(d.settings.lastBackupAt).getTime()) / 86_400_000)
}
