import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK_CONTROLS, LOOK_CONTROL_RANGES, normalizeLookControls } from './look-controls'

describe('normalizeLookControls', () => {
  it('returns neutral defaults when input is undefined', () => {
    expect(normalizeLookControls()).toEqual(DEFAULT_LOOK_CONTROLS)
  })

  it('clamps every control within declared ranges', () => {
    const normalized = normalizeLookControls({
      saturation: 99,
      gamma: -2,
      contrast: 99,
      highlightRollOff: -4,
      shadowLift: 9,
      vibrance: -3,
    })

    expect(normalized.saturation).toBe(LOOK_CONTROL_RANGES.saturation.max)
    expect(normalized.gamma).toBe(LOOK_CONTROL_RANGES.gamma.min)
    expect(normalized.contrast).toBe(LOOK_CONTROL_RANGES.contrast.max)
    expect(normalized.highlightRollOff).toBe(LOOK_CONTROL_RANGES.highlightRollOff.min)
    expect(normalized.shadowLift).toBe(LOOK_CONTROL_RANGES.shadowLift.max)
    expect(normalized.vibrance).toBe(LOOK_CONTROL_RANGES.vibrance.min)
  })
})
