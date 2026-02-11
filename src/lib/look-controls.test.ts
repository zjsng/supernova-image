import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK_CONTROLS, LOOK_CONTROL_RANGES, normalizeLookControls } from './look-controls'

describe('normalizeLookControls', () => {
  it('returns neutral defaults when input is undefined', () => {
    expect(normalizeLookControls()).toEqual(DEFAULT_LOOK_CONTROLS)
  })

  it('clamps every control within declared ranges', () => {
    const normalized = normalizeLookControls({
      exposure: 99,
      saturation: 99,
      temperature: -99,
      tint: 99,
      gamma: -2,
      contrast: 99,
      blacks: -99,
      whites: 99,
      clarity: -99,
      highlightSaturation: 99,
      highlightRollOff: -4,
      shadowLift: 9,
      shadowGlow: 99,
      vibrance: -3,
    })

    expect(normalized.exposure).toBe(LOOK_CONTROL_RANGES.exposure.max)
    expect(normalized.saturation).toBe(LOOK_CONTROL_RANGES.saturation.max)
    expect(normalized.temperature).toBe(LOOK_CONTROL_RANGES.temperature.min)
    expect(normalized.tint).toBe(LOOK_CONTROL_RANGES.tint.max)
    expect(normalized.gamma).toBe(LOOK_CONTROL_RANGES.gamma.min)
    expect(normalized.contrast).toBe(LOOK_CONTROL_RANGES.contrast.max)
    expect(normalized.blacks).toBe(LOOK_CONTROL_RANGES.blacks.min)
    expect(normalized.whites).toBe(LOOK_CONTROL_RANGES.whites.max)
    expect(normalized.clarity).toBe(LOOK_CONTROL_RANGES.clarity.min)
    expect(normalized.highlightSaturation).toBe(LOOK_CONTROL_RANGES.highlightSaturation.max)
    expect(normalized.highlightRollOff).toBe(LOOK_CONTROL_RANGES.highlightRollOff.min)
    expect(normalized.shadowLift).toBe(LOOK_CONTROL_RANGES.shadowLift.max)
    expect(normalized.shadowGlow).toBe(LOOK_CONTROL_RANGES.shadowGlow.max)
    expect(normalized.vibrance).toBe(LOOK_CONTROL_RANGES.vibrance.min)
  })
})
