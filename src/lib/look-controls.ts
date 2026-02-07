export interface LookControls {
  saturation: number
  gamma: number
  contrast: number
  highlightRollOff: number
  shadowLift: number
  vibrance: number
}

interface ControlRange {
  min: number
  max: number
  step: number
}

export const LOOK_CONTROL_RANGES: Record<keyof LookControls, ControlRange> = {
  saturation: { min: 1.0, max: 1.6, step: 0.05 },
  gamma: { min: 0.1, max: 3.0, step: 0.1 },
  contrast: { min: 0.75, max: 1.35, step: 0.05 },
  highlightRollOff: { min: 0.7, max: 1.4, step: 0.05 },
  shadowLift: { min: 0.0, max: 0.25, step: 0.01 },
  vibrance: { min: 1.0, max: 1.5, step: 0.05 },
}

export const DEFAULT_LOOK_CONTROLS: LookControls = {
  saturation: 1.0,
  gamma: 1.0,
  contrast: 1.0,
  highlightRollOff: 1.0,
  shadowLift: 0.0,
  vibrance: 1.0,
}

export const PREVIEW_MAX_LONG_EDGE_DEFAULT = 1280
export const PREVIEW_DEBOUNCE_MS = 120

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function normalizeLookControls(input?: Partial<LookControls>): LookControls {
  const merged = { ...DEFAULT_LOOK_CONTROLS, ...input }
  return {
    saturation: clamp(merged.saturation, LOOK_CONTROL_RANGES.saturation.min, LOOK_CONTROL_RANGES.saturation.max),
    gamma: clamp(merged.gamma, LOOK_CONTROL_RANGES.gamma.min, LOOK_CONTROL_RANGES.gamma.max),
    contrast: clamp(merged.contrast, LOOK_CONTROL_RANGES.contrast.min, LOOK_CONTROL_RANGES.contrast.max),
    highlightRollOff: clamp(merged.highlightRollOff, LOOK_CONTROL_RANGES.highlightRollOff.min, LOOK_CONTROL_RANGES.highlightRollOff.max),
    shadowLift: clamp(merged.shadowLift, LOOK_CONTROL_RANGES.shadowLift.min, LOOK_CONTROL_RANGES.shadowLift.max),
    vibrance: clamp(merged.vibrance, LOOK_CONTROL_RANGES.vibrance.min, LOOK_CONTROL_RANGES.vibrance.max),
  }
}
