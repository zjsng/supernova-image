import { describe, expect, it } from 'vitest'
import {
  pqEncodeDebug,
  processPixels,
  setPQEncodeModeForTesting,
  srgbEOTF,
  SRGB_TO_BT2020,
} from './pq'
import { boostToPQGain } from './hdr-boost'

// Expected PQ code values for calibrated diffuse white levels.
const WHITE_AT_100_NITS_PQ_U16 = 33297 // PQ(0.01) * 65535
const WHITE_AT_1600_NITS_PQ_U16 = 52631 // PQ(0.16) * 65535
const WHITE_AT_10000_NITS_PQ_U16 = 65535 // PQ(1.0) * 65535

/** Create a 1×1 ImageData-like object from an RGB triplet. */
function pixel(r: number, g: number, b: number) {
  return {
    data: new Uint8ClampedArray([r, g, b, 255]),
    width: 1,
    height: 1,
    colorSpace: 'srgb' as const,
  } as ImageData
}

describe('srgbEOTF', () => {
  it('returns 0 for black', () => {
    expect(srgbEOTF(0)).toBe(0)
  })

  it('returns 1 for white', () => {
    expect(srgbEOTF(1)).toBeCloseTo(1, 10)
  })

  it('uses linear segment below threshold', () => {
    const v = 0.04045
    expect(srgbEOTF(v)).toBeCloseTo(v / 12.92, 10)
  })

  it('uses power curve above threshold', () => {
    const v = 0.5
    const expected = Math.pow((v + 0.055) / 1.055, 2.4)
    expect(srgbEOTF(v)).toBeCloseTo(expected, 10)
  })

  it('is continuous at the 0.04045 boundary', () => {
    const below = srgbEOTF(0.04045)
    const above = srgbEOTF(0.04046)
    expect(Math.abs(above - below)).toBeLessThan(1e-5)
  })
})

describe('SRGB_TO_BT2020 matrix', () => {
  it('has rows that sum to 1.0 (preserves white)', () => {
    for (let row = 0; row < 3; row++) {
      const sum = SRGB_TO_BT2020[row * 3] + SRGB_TO_BT2020[row * 3 + 1] + SRGB_TO_BT2020[row * 3 + 2]
      expect(sum).toBeCloseTo(1.0, 6)
    }
  })

  it('has all positive coefficients (sRGB inside BT.2020)', () => {
    for (const v of SRGB_TO_BT2020) {
      expect(v).toBeGreaterThan(0)
    }
  })
})

describe('processPixels', () => {
  it('maps black (0,0,0) to PQ (0,0,0)', () => {
    const result = processPixels(pixel(0, 0, 0), 1.0)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
    expect(result[2]).toBe(0)
  })

  it('maps white (255,255,255) at boost=1 to calibrated diffuse white (~100 nits)', () => {
    const result = processPixels(pixel(255, 255, 255), 1.0)
    // All three channels should be equal because the matrix preserves white
    expect(result[0]).toBe(result[1])
    expect(result[1]).toBe(result[2])
    expect(Math.abs(result[0] - WHITE_AT_100_NITS_PQ_U16)).toBeLessThanOrEqual(2)
  })

  it('maps white (255,255,255) at boost=4 to ~1600 nits', () => {
    const result = processPixels(pixel(255, 255, 255), 4.0)
    expect(result[0]).toBe(result[1])
    expect(result[1]).toBe(result[2])
    expect(Math.abs(result[0] - WHITE_AT_1600_NITS_PQ_U16)).toBeLessThanOrEqual(2)
  })

  it('maps white (255,255,255) at boost=10 to ~10000 nits', () => {
    const result = processPixels(pixel(255, 255, 255), 10.0)
    expect(result[0]).toBe(result[1])
    expect(result[1]).toBe(result[2])
    expect(Math.abs(result[0] - WHITE_AT_10000_NITS_PQ_U16)).toBeLessThanOrEqual(2)
  })

  it('maps sRGB red to BT.2020 with energy across all channels', () => {
    const result = processPixels(pixel(255, 0, 0), 1.0)
    // sRGB red in BT.2020: R gets most energy, but G and B get some too
    // R channel should be the largest
    expect(result[0]).toBeGreaterThan(result[1])
    expect(result[0]).toBeGreaterThan(result[2])
    // G and B should be non-zero (color space conversion redistributes energy)
    expect(result[1]).toBeGreaterThan(0)
    expect(result[2]).toBeGreaterThan(0)
  })

  it('produces correct relative BT.2020 values for sRGB red', () => {
    // For sRGB red (1,0,0) linear, the matrix gives:
    //   R_2020 = 0.6274, G_2020 = 0.0691, B_2020 = 0.0164
    // We can verify this indirectly via processPixels with boost=1
    const result = processPixels(pixel(255, 0, 0), 1.0)
    // G_2020/R_2020 ≈ 0.0691/0.6274 ≈ 0.110
    // B_2020/R_2020 ≈ 0.0164/0.6274 ≈ 0.026
    // PQ is nonlinear so ratios won't match exactly, but R >> G >> B
    expect(result[0]).toBeGreaterThan(result[1])
    expect(result[1]).toBeGreaterThan(result[2])
  })

  it('gamma=1.0 produces same result as default', () => {
    const withDefault = processPixels(pixel(128, 64, 200), 2.0)
    const withGamma1 = processPixels(pixel(128, 64, 200), 2.0, 1.0)
    expect(withGamma1[0]).toBe(withDefault[0])
    expect(withGamma1[1]).toBe(withDefault[1])
    expect(withGamma1[2]).toBe(withDefault[2])
  })

  it('gamma != 1.0 produces different result from gamma=1.0', () => {
    const gamma1 = processPixels(pixel(128, 128, 128), 1.0, 1.0)
    const gamma2 = processPixels(pixel(128, 128, 128), 1.0, 1.5)
    // Different gamma should produce different output
    expect(gamma2[0]).not.toBe(gamma1[0])
  })

  it('same pixel gets brighter as boost increases (1 < 4 < 10)', () => {
    const b1 = processPixels(pixel(180, 120, 80), 1.0)
    const b4 = processPixels(pixel(180, 120, 80), 4.0)
    const b10 = processPixels(pixel(180, 120, 80), 10.0)
    expect(b4[0]).toBeGreaterThan(b1[0])
    expect(b4[1]).toBeGreaterThan(b1[1])
    expect(b4[2]).toBeGreaterThan(b1[2])
    expect(b10[0]).toBeGreaterThan(b4[0])
    expect(b10[1]).toBeGreaterThan(b4[1])
    expect(b10[2]).toBeGreaterThan(b4[2])
  })

  it('does not force bright primaries to full-scale via local normalization', () => {
    const highBoost = processPixels(pixel(255, 0, 0), 10.0)
    // Ordering from matrix conversion is preserved.
    expect(highBoost[0]).toBeGreaterThan(highBoost[1])
    expect(highBoost[1]).toBeGreaterThan(highBoost[2])
    // With remapped boost + adaptive shoulder, this should stay below PQ max.
    expect(highBoost[0]).toBeLessThan(65535)
  })

  it('soft shoulder keeps extreme boost outputs bounded', () => {
    const result = processPixels(pixel(255, 255, 255), 200.0)
    for (const channel of result) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(65535)
    }
  })

  it('handles multi-pixel images', () => {
    const imageData = {
      data: new Uint8ClampedArray([
        255, 0, 0, 255,   // red pixel
        0, 255, 0, 255,   // green pixel
        0, 0, 255, 255,   // blue pixel
      ]),
      width: 3,
      height: 1,
      colorSpace: 'srgb' as const,
    } as ImageData

    const result = processPixels(imageData, 1.0)
    expect(result.length).toBe(9) // 3 pixels × 3 channels

    // Each pixel should produce non-zero values
    for (let i = 0; i < 9; i++) {
      expect(result[i]).toBeGreaterThan(0)
    }
  })
})

describe('PQ LUT fast path', () => {
  it('keeps LUT interpolation within 2 uint16 code values', () => {
    for (let i = 0; i <= 1000; i++) {
      const L = i / 1000
      const { exact, lut } = pqEncodeDebug(L)
      const exactCode = Math.round(exact * 65535)
      const lutCode = Math.round(lut * 65535)
      expect(Math.abs(lutCode - exactCode)).toBeLessThanOrEqual(2)
    }
  })

  it('matches exact-mode process output within 2 uint16 code values', () => {
    const sample = pixel(213, 156, 44)
    setPQEncodeModeForTesting('exact')
    const exact = processPixels(sample, 6.5, 1.2)
    setPQEncodeModeForTesting('lut')
    const fast = processPixels(sample, 6.5, 1.2)

    for (let i = 0; i < 3; i++) {
      expect(Math.abs(fast[i] - exact[i])).toBeLessThanOrEqual(2)
    }
  })

  it('uses shared boost mapping source of truth for white calibration', () => {
    const boosts = [1, 4, 10]
    for (const boost of boosts) {
      const expected = Math.round(pqEncodeDebug(boostToPQGain(boost)).exact * 65535)
      const result = processPixels(pixel(255, 255, 255), boost)
      expect(Math.abs(result[0] - expected)).toBeLessThanOrEqual(2)
    }
  })
})
