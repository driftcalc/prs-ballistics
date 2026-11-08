// Settings (the ⚙ button): theme, Glove mode, Left-handed, stage card wind speeds, and the pages that
// don't fit in the four tabs (Check accuracy, Data & backup).
import { openSheet, segmented, setSelected, stepper } from '../design/components.ts'
import { getData, updateData, type ThemeSetting } from '../data/store.ts'
import { backupOverdue } from './safety.ts'
import { applyTheme } from './theme.ts'

const onOff = (name: string, label: string, on: boolean) =>
  segmented({ name, label, selected: on ? 'on' : 'off', options: [{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }] })

export function openSettings(onChange: () => void): void {
  const d = getData()
  const due = backupOverdue(d)
  const sheet = openSheet({
    title: 'Settings',
    content: `
      <div class="setting">
        <h3 class="setting-title">Theme</h3>
        ${segmented({
          name: 'theme',
          label: 'Theme',
          selected: d.settings.theme,
          options: [
            { value: 'auto', label: 'Auto' },
            { value: 'sun', label: 'Sun' },
            { value: 'dark', label: 'Dark' },
            { value: 'night', label: 'Night' },
          ],
        })}
        <p class="setting-help">Auto follows your phone's light/dark setting. Sun: black on white for bright daylight. Night: red only, to keep your night vision.</p>
      </div>
      <div class="setting">
        <h3 class="setting-title">Glove mode</h3>
        ${onOff('glove', 'Glove mode', d.settings.glove)}
        <p class="setting-help">Makes the main controls at least 96 px tall.</p>
      </div>
      <div class="setting">
        <h3 class="setting-title">Left-handed</h3>
        ${onOff('lefthand', 'Left-handed', d.settings.leftHanded)}
        <p class="setting-help">Mirrors the controls: + on the left, tabs right to left.</p>
      </div>
      <div class="setting">
        <h3 class="setting-title">Stage card wind speeds</h3>
        ${stepper({ name: 'cardwind0', label: 'First card wind speed', value: String(d.settings.cardWindsMph[0]), unit: 'mph' })}
        ${stepper({ name: 'cardwind1', label: 'Second card wind speed', value: String(d.settings.cardWindsMph[1]), unit: 'mph' })}
        <p class="setting-help">Match stage cards show wind holds at these two speeds, from the left and from the right.</p>
      </div>
      <div class="setting">
        <h3 class="setting-title">More</h3>
        <button class="btn" type="button" data-go="#/check">Check accuracy vs Hornady / AB</button>
        <button class="btn${due ? ' btn-danger' : ''}" type="button" data-go="#/data">${due ? '⚠ ' : ''}Data &amp; backup${due ? ' — backup due' : ''}</button>
      </div>`,
  })

  sheet.body.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button')
    if (!btn) return
    if (btn.dataset.go) return sheet.closeAndGo(btn.dataset.go)
    const wind = /^cardwind([01])$/.exec(btn.dataset.stepper ?? '')
    if (wind) {
      const i = Number(wind[1])
      const data = updateData((x) => {
        const next: [number, number] = [...x.settings.cardWindsMph]
        next[i] = Math.min(60, Math.max(1, next[i] + Number(btn.dataset.dir)))
        x.settings.cardWindsMph = next
      })
      sheet.body.querySelector(`[data-stepper-value="cardwind${i}"]`)!.textContent = String(data.settings.cardWindsMph[i])
      return onChange()
    }
    const name = btn.dataset.segment
    const value = btn.dataset.value!
    if (!name) return
    setSelected(sheet.body, 'data-segment', name, value)
    updateData((data) => {
      if (name === 'theme') data.settings.theme = value as ThemeSetting
      if (name === 'glove') data.settings.glove = value === 'on'
      if (name === 'lefthand') data.settings.leftHanded = value === 'on'
    })
    applyTheme()
    onChange()
  })
}
