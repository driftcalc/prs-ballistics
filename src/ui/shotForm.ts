// The shot input boxes, shared by the Rifles, Shoot (weather) and Check accuracy pages.
// One list of fields drives drawing the form, reading it back and checking it.
import { DEFAULT_INPUTS, type UsShotInputs } from '../shotInputs.ts'
import { escapeHtml } from './format.ts'

type Key = keyof UsShotInputs

interface NumberField {
  kind: 'number'
  key: Key
  label: string
  unit: string
  optional?: boolean
  hint?: string
  min?: number
  max?: number
  showIf?: (v: FormValues) => boolean
}

interface SelectField {
  kind: 'select'
  key: Key
  label: string
  options: [value: string, text: string][]
  showIf?: (v: FormValues) => boolean
}

type Field = NumberField | SelectField

/** Raw text of each box, keyed by field. */
export type FormValues = Partial<Record<Key, string>>

const clockOptions: [string, string][] = Array.from({ length: 12 }, (_, i) => {
  const h = String(i + 1)
  const note = h === '12' ? ' (head wind)' : h === '6' ? ' (tail wind)' : h === '3' ? ' (from right)' : h === '9' ? ' (from left)' : ''
  return [h, `${h} o'clock${note}`]
})

export type SectionId = 'rifle' | 'weather' | 'wind'

/** Plain English: what's normal and where to find the number. Shown when a box looks wrong. */
const HELP: Partial<Record<Key, string>> = {
  muzzleVelocityFps: 'rifle loads are usually 1,000–4,000 fps. Check the ammo box or your chronograph',
  bc: "BCs are usually 0.1–0.4 for G7 or 0.2–0.8 for G1. Check the bullet maker's website",
  bulletWeightGr: "bullets are usually 20–300 gr. It's printed on the ammo box",
  sightHeightIn: "it's usually 1.5–3 in, from the centre of the barrel to the centre of the scope",
  zeroRangeYd: 'most rifles are zeroed at 100 yd (rimfire often 50 yd)',
  twistIn: "type 8 for a 1:8 barrel. It's often stamped on the barrel",
  bulletDiameterIn: "e.g. 0.224, 0.264 or 0.308. It's in the cartridge name or on the bullet box",
  bulletLengthIn: "bullets are usually 0.5–1.7 in long. Measure one or check the maker's website",
  temperatureF: 'type the air temperature in °F',
  stationPressureInHg: 'station pressure is usually 20–31 inHg. Use the Kestrel reading, not the sea-level number from a forecast',
  altitudeFt: 'type your height above sea level in feet',
  humidityPct: 'humidity is 0–100 %',
  windSpeedMph: 'wind speed is 0–60 mph',
}

export const SECTIONS: { id: SectionId; title: string; fields: Field[] }[] = [
  {
    id: 'rifle',
    title: 'Rifle & bullet',
    fields: [
      { kind: 'number', key: 'muzzleVelocityFps', label: 'Muzzle velocity', unit: 'fps', min: 300, max: 5000 },
      { kind: 'number', key: 'bc', label: 'Ballistic coefficient (BC)', unit: '', min: 0.01, max: 2 },
      { kind: 'select', key: 'dragModel', label: 'BC type', options: [['G7', 'G7'], ['G1', 'G1']] },
      { kind: 'number', key: 'bulletWeightGr', label: 'Bullet weight', unit: 'gr', min: 10, max: 1000 },
      { kind: 'number', key: 'sightHeightIn', label: 'Sight height', unit: 'in', min: 0, max: 10 },
      { kind: 'number', key: 'zeroRangeYd', label: 'Zero range', unit: 'yd', min: 10, max: 1000 },
      { kind: 'number', key: 'twistIn', label: 'Twist rate (1 turn in)', unit: 'in', optional: true, min: 3, max: 30 },
      { kind: 'select', key: 'twistDirection', label: 'Twist direction', options: [['right', 'Right hand'], ['left', 'Left hand']] },
      { kind: 'number', key: 'bulletDiameterIn', label: 'Bullet diameter', unit: 'in', optional: true, min: 0.1, max: 1 },
      {
        kind: 'number',
        key: 'bulletLengthIn',
        label: 'Bullet length',
        unit: 'in',
        optional: true,
        min: 0.2,
        max: 3,
        hint: 'Needed with twist and diameter for spin drift. Leave blank to skip spin drift.',
      },
    ],
  },
  {
    id: 'weather',
    title: 'Weather',
    fields: [
      { kind: 'number', key: 'temperatureF', label: 'Temperature', unit: '°F', min: -60, max: 140 },
      {
        kind: 'select',
        key: 'atmosphereMode',
        label: 'Air pressure from',
        options: [['pressure', 'Station pressure (Kestrel)'], ['altitude', 'Altitude (estimate)']],
      },
      {
        kind: 'number',
        key: 'stationPressureInHg',
        label: 'Station pressure',
        unit: 'inHg',
        min: 15,
        max: 32,
        hint: 'The actual pressure where you are, not the sea-level number from a weather report.',
        showIf: (v) => v.atmosphereMode !== 'altitude',
      },
      {
        kind: 'number',
        key: 'altitudeFt',
        label: 'Altitude',
        unit: 'ft',
        min: -1000,
        max: 15000,
        showIf: (v) => v.atmosphereMode === 'altitude',
      },
      { kind: 'number', key: 'humidityPct', label: 'Humidity', unit: '%', min: 0, max: 100 },
    ],
  },
  {
    id: 'wind',
    title: 'Wind',
    fields: [
      { kind: 'number', key: 'windSpeedMph', label: 'Wind speed', unit: 'mph', min: 0, max: 60 },
      { kind: 'select', key: 'windClock', label: 'Wind from', options: clockOptions },
    ],
  },
]

const ALL: SectionId[] = ['rifle', 'weather', 'wind']
const fieldsIn = (ids: SectionId[]) => SECTIONS.filter((s) => ids.includes(s.id)).flatMap((s) => s.fields)

export function toFormValues(inputs: UsShotInputs): FormValues {
  const values: FormValues = {}
  for (const f of fieldsIn(ALL)) {
    const v = inputs[f.key]
    values[f.key] = v === undefined ? '' : String(v)
  }
  return values
}

/** Draws the input sections. `disabled` is for read-only examples. */
export function renderShotFields(values: FormValues, disabled = false, ids: SectionId[] = ALL): string {
  return SECTIONS.filter((s) => ids.includes(s.id)).map(
    (section) => `
    <fieldset class="group">
      <legend>${section.title}</legend>
      ${section.fields.map((f) => renderField(f, values, disabled)).join('')}
    </fieldset>`,
  ).join('')
}

function renderField(f: Field, values: FormValues, disabled: boolean): string {
  const id = `f-${f.key}`
  const value = values[f.key] ?? ''
  const hidden = f.showIf && !f.showIf(values) ? ' hidden' : ''
  const dis = disabled ? ' disabled' : ''
  if (f.kind === 'select') {
    const opts = f.options
      .map(([v, t]) => `<option value="${v}"${v === value ? ' selected' : ''}>${escapeHtml(t)}</option>`)
      .join('')
    return `<label class="field" data-field="${f.key}"${hidden}><span>${f.label}</span>
      <select id="${id}" name="${f.key}"${dis}>${opts}</select></label>`
  }
  const placeholder = f.optional ? 'optional' : ''
  return `<label class="field" data-field="${f.key}"${hidden}><span>${f.label}${f.unit ? ` <small>(${f.unit})</small>` : ''}</span>
    <input id="${id}" name="${f.key}" type="text" inputmode="decimal" autocomplete="off"
      value="${escapeHtml(value)}" placeholder="${placeholder}"${dis} aria-describedby="${id}-error" />
    ${f.hint ? `<small class="hint">${f.hint}</small>` : ''}
    <small class="field-error" id="${id}-error" data-error-for="${f.key}" hidden></small></label>`
}

/** Draws just the named boxes, in this order (for screens that group them their own way). */
export function renderFieldsByKey(keys: Key[], values: FormValues): string {
  const all = fieldsIn(ALL)
  return keys.map((k) => renderField(all.find((f) => f.key === k)!, values, false)).join('')
}

/**
 * Shows each problem under its own box (and clears fixed ones). A box inside
 * a closed "More" section opens it, so a problem is never hidden.
 */
export function showFieldErrors(root: HTMLElement, fieldErrors: Partial<Record<Key, string>>): void {
  root.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
    const key = el.dataset.errorFor as Key
    const text = fieldErrors[key]
    el.textContent = text ?? ''
    el.hidden = !text
    root.querySelector(`[name="${key}"]`)?.toggleAttribute('aria-invalid', !!text)
    if (text) el.closest('details')?.setAttribute('open', '')
  })
}

/** Reads the current text of every shot box inside `root`. */
export function readFormValues(root: HTMLElement, ids: SectionId[] = ALL): FormValues {
  const values: FormValues = {}
  for (const f of fieldsIn(ids)) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${f.key}"]`)
    if (el) values[f.key] = el.value.trim()
  }
  return values
}

/** Shows/hides boxes that depend on other choices (pressure vs altitude). */
export function updateVisibility(root: HTMLElement, values: FormValues, ids: SectionId[] = ALL): void {
  for (const f of fieldsIn(ids)) {
    if (!f.showIf) continue
    root.querySelector<HTMLElement>(`[data-field="${f.key}"]`)?.toggleAttribute('hidden', !f.showIf(values))
  }
}

export interface ParseResult {
  inputs?: UsShotInputs
  errors: string[]
  /** The same problems, by box, to show next to the box they belong to. */
  fieldErrors: Partial<Record<Key, string>>
}

/** Checks every box and turns the text into numbers. */
export function parseFormValues(values: FormValues, ids: SectionId[] = ALL): ParseResult {
  const errors: string[] = []
  const fieldErrors: Partial<Record<Key, string>> = {}
  const problem = (key: Key, text: string) => {
    errors.push(text)
    fieldErrors[key] = text
  }
  const out: Record<string, unknown> = { ...DEFAULT_INPUTS }
  for (const f of fieldsIn(ids)) {
    if (f.showIf && !f.showIf(values)) {
      // Hidden box (e.g. pressure while "Altitude" is chosen): keep whatever valid
      // number is in it so switching back shows your value, not a default.
      // It isn't checked or used while hidden.
      const n = Number((values[f.key] ?? '').replace(',', '.'))
      if (f.kind === 'number' && values[f.key] && Number.isFinite(n)) out[f.key] = n
      continue
    }
    const raw = (values[f.key] ?? '').replace(',', '.')
    if (f.kind === 'select') {
      out[f.key] = f.key === 'windClock' ? Number(raw) : raw
      continue
    }
    if (raw === '') {
      if (f.optional) out[f.key] = undefined
      else problem(f.key, `${f.label} is missing.${HELP[f.key] ? ` Hint: ${HELP[f.key]}.` : ''}`)
      continue
    }
    const n = Number(raw)
    const unit = f.unit ? ` ${f.unit}` : ''
    if (!Number.isFinite(n)) {
      problem(f.key, `${f.label} must be a number, e.g. ${DEFAULT_INPUTS[f.key] ?? 1}.`)
    } else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
      const help = HELP[f.key]
      problem(f.key, help ? `${f.label} ${n}${unit} looks wrong — ${help}.` : `${f.label} should be between ${f.min} and ${f.max}${unit}.`)
    } else {
      out[f.key] = n
    }
  }
  return errors.length ? { errors, fieldErrors } : { inputs: out as unknown as UsShotInputs, errors, fieldErrors }
}
