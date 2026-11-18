import { describe, expect, it } from 'vitest'
import { DEFAULT_RIFLE } from '../data/profiles.ts'
import { emptyData } from '../data/store.ts'
import { icon } from '../design/icons.ts'
import { lastBackupHtml } from './dataPage.ts'

const now = new Date('2026-12-01T12:00:00Z')
const withRifle = () => {
  const d = emptyData()
  d.profiles.push({ id: 'a', name: 'A', rifle: DEFAULT_RIFLE, updatedAt: '' })
  return d
}

describe('last backup line', () => {
  it('shows a real warning icon and the reminder when no backup has been exported', () => {
    const html = lastBackupHtml(withRifle(), now)
    expect(html).toContain(icon('warning'))
    expect(html).toContain('<svg')
    expect(html).not.toContain('&lt;svg')
    expect(html).toContain('No full backup exported yet.')
    expect(html).toContain('Export one now')
    // The sentence is escaped (the apostrophe), the icon is not.
    expect(html).toContain('doesn&#39;t')
    expect(html).not.toContain("doesn't")
  })

  it('names how many days ago an overdue backup was', () => {
    const d = withRifle()
    d.settings.lastBackupAt = '2026-10-01T12:00:00Z'
    const html = lastBackupHtml(d, now)
    expect(html).toContain(icon('warning'))
    expect(html).toContain('That was 61 days ago')
    expect(html).toContain('doesn&#39;t')
    expect(html).not.toContain('&lt;svg')
  })

  it('stays plain text, with no icon, when the backup is recent', () => {
    const d = withRifle()
    d.settings.lastBackupAt = '2026-11-15T12:00:00Z'
    const html = lastBackupHtml(d, now)
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('&lt;')
    expect(html.startsWith('Last full backup:')).toBe(true)
  })

  it('a later update after exporting drops the warning', () => {
    const d = withRifle()
    expect(lastBackupHtml(d, now)).toContain(icon('warning'))
    d.settings.lastBackupAt = now.toISOString()
    const fresh = lastBackupHtml(d, now)
    expect(fresh).not.toContain('<svg')
    expect(fresh.startsWith('Last full backup:')).toBe(true)
  })

  it('does not turn a broken backup date into HTML', () => {
    const d = withRifle()
    d.settings.lastBackupAt = '<img src=x onerror=alert(1)>'
    const html = lastBackupHtml(d, now)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('alert')
    expect(html).toContain(icon('warning'))
    // The stored text is not printed. Only the formatted date is, and that is escaped.
    expect(html.startsWith('Last full backup:')).toBe(true)
    expect(html).toContain('doesn&#39;t')
  })
})
