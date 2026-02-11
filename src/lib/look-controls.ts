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
type LookControlKey = keyof typeof LOOK_CONTROL_RANGES
export const LOOK_CONTROL_KEYS = Object.keys(LOOK_CONTROL_RANGES) as LookControlKey[]

export const DEFAULT_LOOK_CONTROLS: LookControls = LOOK_CONTROL_KEYS.reduce((defaults, key) => {
  defaults[key] = LOOK_CONTROL_RANGES[key].defaultValue
  return defaults
}, {} as LookControls)

export const PREVIEW_MAX_LONG_EDGE_DEFAULT = 1280
export const PREVIEW_DEBOUNCE_MS = 120

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
