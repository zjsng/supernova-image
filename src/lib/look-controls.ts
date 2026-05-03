interface ControlRange {
  min: number
  max: number
  step: number
  defaultValue: number
}

export const LOOK_CONTROL_RANGES = {
  exposure: { min: -2.0, max: 2.0, step: 0.1, defaultValue: 0.0 },
  saturation: { min: 1.0, max: 1.6, step: 0.05, defaultValue: 1.0 },
  temperature: { min: -1.0, max: 1.0, step: 0.05, defaultValue: 0.0 },
  tint: { min: -1.0, max: 1.0, step: 0.05, defaultValue: 0.0 },
  gamma: { min: 0.1, max: 3.0, step: 0.1, defaultValue: 1.0 },
  contrast: { min: 0.75, max: 1.35, step: 0.05, defaultValue: 1.0 },
  blacks: { min: -0.4, max: 0.4, step: 0.02, defaultValue: 0.0 },
  whites: { min: -0.4, max: 0.4, step: 0.02, defaultValue: 0.0 },
  clarity: { min: -0.5, max: 0.5, step: 0.02, defaultValue: 0.0 },
  highlightSaturation: { min: 0.7, max: 1.3, step: 0.02, defaultValue: 1.0 },
  highlightRollOff: { min: 0.7, max: 1.4, step: 0.05, defaultValue: 1.0 },
  shadowLift: { min: 0.0, max: 1.0, step: 0.02, defaultValue: 0.0 },
  shadowGlow: { min: 0.0, max: 0.5, step: 0.02, defaultValue: 0.0 },
  vibrance: { min: 1.0, max: 1.5, step: 0.05, defaultValue: 1.0 },
} as const satisfies Record<string, ControlRange>

export type LookControls = Record<keyof typeof LOOK_CONTROL_RANGES, number>
export type LookControlKey = keyof typeof LOOK_CONTROL_RANGES
export const LOOK_CONTROL_KEYS = Object.keys(LOOK_CONTROL_RANGES) as LookControlKey[]

export const DEFAULT_LOOK_CONTROLS: LookControls = LOOK_CONTROL_KEYS.reduce((defaults, key) => {
  defaults[key] = LOOK_CONTROL_RANGES[key].defaultValue
  return defaults
}, {} as LookControls)

export const PREVIEW_MAX_LONG_EDGE_DEFAULT = 1280
export const PREVIEW_DEBOUNCE_MS = 120

export interface LookControlRenderMeta {
  key: LookControlKey
  id: string
  label: string
  decimals: number
  centered: boolean
}

function camelToWords(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

function kebabCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

const PRIMARY_CONTROL_KEYS: LookControlKey[] = ['saturation']
const SPEC_FINE_TUNE_KEYS: LookControlKey[] = [
  'exposure',
  'temperature',
  'tint',
  'gamma',
  'contrast',
  'highlightRollOff',
  'shadowLift',
  'vibrance',
]
const ADVANCED_FINE_TUNE_KEYS: LookControlKey[] = ['blacks', 'whites', 'clarity', 'highlightSaturation', 'shadowGlow']

const KNOWN_CONTROL_KEY_SET = new Set<LookControlKey>([...PRIMARY_CONTROL_KEYS, ...SPEC_FINE_TUNE_KEYS, ...ADVANCED_FINE_TUNE_KEYS])

export const LOOK_CONTROL_GROUPS = {
  primary: PRIMARY_CONTROL_KEYS,
  specFineTune: SPEC_FINE_TUNE_KEYS,
  advanced: [...ADVANCED_FINE_TUNE_KEYS, ...LOOK_CONTROL_KEYS.filter((key) => !KNOWN_CONTROL_KEY_SET.has(key))],
} as const satisfies Record<string, readonly LookControlKey[]>

const SIGNED_CONTROL_KEYS = new Set<LookControlKey>(['exposure', 'temperature', 'tint', 'blacks', 'whites', 'clarity'])

const CONTROL_DECIMAL_OVERRIDES: Partial<Record<LookControlKey, number>> = {
  exposure: 1,
  gamma: 1,
}

const CONTROL_LABEL_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'Highlight Roll-off',
  highlightSaturation: 'Highlight Sat',
  shadowLift: 'Shadow Lift',
  shadowGlow: 'Shadow Glow',
}

const CONTROL_ID_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'rolloff-range',
  shadowLift: 'shadow-range',
}

export function controlId(key: LookControlKey): string {
  return CONTROL_ID_OVERRIDES[key] ?? `${kebabCase(key)}-range`
}

export function controlLabel(key: LookControlKey): string {
  if (CONTROL_LABEL_OVERRIDES[key]) return CONTROL_LABEL_OVERRIDES[key] as string
  const normalized = camelToWords(key)
  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`
}

export function controlDecimals(key: LookControlKey): number {
  return CONTROL_DECIMAL_OVERRIDES[key] ?? 2
}

export function saturationSubLabel(value: number): string {
  if (value > 1.3) return 'Wide gamut'
  if (value > 1.1) return 'Enhanced'
  return 'Natural'
}

export const LOOK_CONTROL_RENDER_META = LOOK_CONTROL_KEYS.reduce(
  (meta, key) => {
    meta[key] = {
      key,
      id: controlId(key),
      label: controlLabel(key),
      decimals: controlDecimals(key),
      centered: SIGNED_CONTROL_KEYS.has(key),
    }
    return meta
  },
  {} as Record<LookControlKey, LookControlRenderMeta>,
)

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function normalizeLookControls(input?: Partial<LookControls>): LookControls {
  const merged = { ...DEFAULT_LOOK_CONTROLS, ...input }
  return LOOK_CONTROL_KEYS.reduce((normalized, key) => {
    const range = LOOK_CONTROL_RANGES[key]
    normalized[key] = clamp(merged[key], range.min, range.max)
    return normalized
  }, {} as LookControls)
}
