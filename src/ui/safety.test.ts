import { describe, expect, it } from 'vitest'
import { DEFAULT_RIFLE } from '../data/profiles.ts'
import { emptyData } from '../data/store.ts'
import { backupOverdue, daysSinceBackup } from './safety.ts'

const now = new Date('2026-12-01T12:00:00Z')
const withRifle = () => {
  const d = emptyData()
  d.profiles.push({ id: 'a', name: 'A', rifle: DEFAULT_RIFLE, updatedAt: '' })
  return d
}

describe('backup reminder', () => {
  it('stays quiet when there is nothing to back up', () => {
    expect(backupOverdue(emptyData(), now)).toBe(false)
  })

  it('reminds when there is data and no backup yet', () => {
    expect(backupOverdue(withRifle(), now)).toBe(true)
  })

  it('stays quiet within 30 days of a backup, reminds after', () => {
    const d = withRifle()
    d.settings.lastBackupAt = '2026-11-15T12:00:00Z'
    expect(backupOverdue(d, now)).toBe(false)
    expect(daysSinceBackup(d, now)).toBe(16)
    d.settings.lastBackupAt = '2026-10-31T12:00:00Z'
    expect(backupOverdue(d, now)).toBe(true)
  })

  it('treats an unreadable backup date as overdue', () => {
    const d = withRifle()
    d.settings.lastBackupAt = 'not a date'
    expect(backupOverdue(d, now)).toBe(true)
  })
})
