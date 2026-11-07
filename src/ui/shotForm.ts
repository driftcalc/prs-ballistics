// The shot input boxes, shared by the Calculator and Check accuracy pages.
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
      value="${escapeHtml(value)}" placeholder="${placeholder}"${dis} />
    ${f.hint ? `<small class="hint">${f.hint}</small>` : ''}</label>`
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
}

/** Checks every box and turns the text into numbers. */
export function parseFormValues(values: FormValues, ids: SectionId[] = ALL): ParseResult {
  const errors: string[] = []
  const out: Record<string, unknown> = { ...DEFAULT_INPUTS }
  for (const f of fieldsIn(ids)) {
    if (f.showIf && !f.showIf(values)) {
      continue
    }
    const raw = (values[f.key] ?? '').replace(',', '.')
    if (f.kind === 'select') {
      out[f.key] = f.key === 'windClock' ? Number(raw) : raw
      continue
    }
    if (raw === '') {
      if (f.optional) out[f.key] = undefined
      else errors.push(`${f.label} is missing.`)
      continue
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      errors.push(`${f.label} must be a number.`)
    } else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
      errors.push(`${f.label} should be between ${f.min} and ${f.max}${f.unit ? ' ' + f.unit : ''}.`)
    } else {
      out[f.key] = n
    }
  }
  return errors.length ? { errors } : { inputs: out as unknown as UsShotInputs, errors }
}
