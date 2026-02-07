/**
 * PQ (Perceptual Quantizer) encoding — SMPTE ST 2084
 *
 * PQ is the transfer function used by HDR displays (HDR10, Dolby Vision).
 * Unlike traditional gamma (~2.2), PQ maps absolute luminance up to 10,000 nits
 * using a curve optimized for human perception across the entire brightness range.
 *
 * This module converts standard 8-bit sRGB pixels into 16-bit PQ-encoded values
 * in the BT.2020 color space, suitable for embedding in an HDR PNG.
 *
 * Pipeline per pixel:
 *   sRGB 0-255 → normalize → sRGB EOTF (piecewise) → gamma adjust
 *     → 3×3 sRGB-to-BT.2020 matrix → absolute luminance scaling
 *     → luminance soft shoulder → clamp → PQ OETF → uint16
 *
 * Reference: SMPTE ST 2084:2014
 * https://ieeexplore.ieee.org/document/7291452
 */

import { boostToPQGain } from './hdr-boost'

// ST 2084 constants — derived from the specification's rational polynomial.
// m1, m2 control the shape of the curve; c1, c2, c3 are normalization coefficients.
const m1 = 2610 / 16384   // 0.1593017578125
const m2 = 2523 / 4096 * 128  // 78.84375
const c1 = 3424 / 4096    // 0.8359375  (= c3 - c2 + 1)
const c2 = 2413 / 4096 * 32   // 18.8515625
const c3 = 2392 / 4096 * 32   // 18.6875

// BT.2020 luma coefficients (Rec.2100) for luminance-domain highlight mapping.
const BT2020_LUMA = [0.2627, 0.6780, 0.0593] as const

// Adaptive shoulder parameters.
const SHOULDER_KNEE_RATIO = 0.78
const SHOULDER_KNEE_MIN = 0.05
const SHOULDER_KNEE_MAX = 0.85

// LUT settings for the fast path.
const PQ_LUT_SIZE = 32768
const PQ_LUT_SCALE = PQ_LUT_SIZE
const gammaLUTCache = new Map<number, Float32Array>()
const pqLUT = new Float32Array(PQ_LUT_SIZE + 1)

type PQEncodeMode = 'lut' | 'exact'
let pqEncodeMode: PQEncodeMode = 'lut'

/**
 * Apply the PQ Opto-Electronic Transfer Function (OETF).
 *
 * Takes a linear-light luminance value normalized to [0, 1] where 1.0 = 10,000 nits,
 * and returns a perceptually-encoded signal value in [0, 1].
 *
 * The formula is a rational polynomial: ((c1 + c2·L^m1) / (1 + c3·L^m1))^m2
 */
function pqOETF(L: number): number {
  const Lm1 = Math.pow(L, m1)
  return Math.pow((c1 + c2 * Lm1) / (1 + c3 * Lm1), m2)
}

for (let i = 0; i <= PQ_LUT_SIZE; i++) {
  pqLUT[i] = pqOETF(i / PQ_LUT_SCALE)
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function quantizeGamma(gamma: number): number {
  // Slider uses 0.1 increments; quantize to keep LUT cache bounded.
  return Math.round(gamma * 1000) / 1000
}

function getLinearizedGammaLUT(gamma: number): Float32Array {
  const g = quantizeGamma(gamma)
  let lut = gammaLUTCache.get(g)
  if (lut) return lut

  lut = new Float32Array(256)
  const applyGamma = g !== 1.0
  for (let i = 0; i < 256; i++) {
    const base = srgbEOTF(i / 255)
    lut[i] = applyGamma ? Math.pow(base, g) : base
  }
  gammaLUTCache.set(g, lut)
  return lut
}

function pqOETFFast(L: number): number {
  if (L <= 0) return 0
  if (L >= 1) return 1
  const x = L * PQ_LUT_SCALE
  const i = x | 0
  const t = x - i
  const a = pqLUT[i]
  const b = pqLUT[i + 1]
  return a + (b - a) * t
}

function pqEncode(L: number): number {
  return pqEncodeMode === 'exact' ? pqOETF(L) : pqOETFFast(L)
}

export function setPQEncodeModeForTesting(mode: PQEncodeMode): void {
  pqEncodeMode = mode
}

export function pqEncodeDebug(L: number): { exact: number, lut: number } {
  const clamped = clamp(L, 0.0, 1.0)
  return { exact: pqOETF(clamped), lut: pqOETFFast(clamped) }
}

/**
 * Softly compress luminance above a knee to preserve highlight detail.
 *
 * Values below the knee are unchanged. Values above it approach 1.0 asymptotically,
 * avoiding abrupt clipping while keeping a natural highlight roll-off.
 */
function softShoulderLuma(y: number, knee = 0.75): number {
  if (y <= knee) return y
  const d = y - knee
  return knee + (d * (1 - knee)) / (d + (1 - knee))
}

/**
 * sRGB Electro-Optical Transfer Function (EOTF) — IEC 61966-2-1.
 *
 * Converts a normalized sRGB signal value [0, 1] to linear light [0, 1].
 * Uses the proper piecewise formula: linear segment below 0.04045 threshold,
 * power curve above.
 */
export function srgbEOTF(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/**
 * sRGB → BT.2020 color space conversion matrix.
 *
 * Both color spaces use D65 white point, so no chromatic adaptation is needed.
 * All coefficients are positive (sRGB gamut is fully inside BT.2020).
 * Rows sum to 1.0 (neutral white is preserved).
 */
export const SRGB_TO_BT2020 = [
  0.6274039, 0.3292830, 0.0433131,
  0.0690973, 0.9195404, 0.0113623,
  0.0163914, 0.0880133, 0.8955953,
] as const

/**
 * Process an entire ImageData into a Uint16Array of PQ-encoded BT.2020 RGB values.
 *
 * Input is 8-bit sRGB RGBA from canvas (4 bytes/pixel).
 * Output is 16-bit BT.2020 RGB (3 values/pixel) — the alpha channel is dropped
 * because HDR PNGs with PQ transfer use RGB color type (no alpha).
 *
 * @param {ImageData} imageData - source image data from canvas
 * @param {number} boost - brightness multiplier
 * @param {number} gamma - gamma adjustment
 * @returns {Uint16Array} PQ-encoded BT.2020 RGB pixels (3 values per pixel)
 */
export function processPixels(
  imageData: ImageData,
  boost: number,
  gamma = 1.0,
  outBuffer?: Uint16Array,
): Uint16Array {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const outLen = pixelCount * 3
  const out = outBuffer && outBuffer.length === outLen ? outBuffer : new Uint16Array(outLen)

  const m = SRGB_TO_BT2020
  const lut = getLinearizedGammaLUT(gamma)
  const gain = boostToPQGain(boost)
  const scenePeak = Math.min(gain, 1.0)
  const shoulderKnee = clamp(scenePeak * SHOULDER_KNEE_RATIO, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4 // source index into RGBA data
    const di = i * 3 // dest index into RGB output

    // Step 1/2/3: LUT combines 8-bit normalization + sRGB EOTF + gamma.
    const r = lut[data[si]]
    const g = lut[data[si + 1]]
    const b = lut[data[si + 2]]
    // data[si + 3] (alpha) is intentionally skipped

    // Step 4: sRGB linear → BT.2020 linear (3×3 matrix multiply)
    let r2020 = m[0] * r + m[1] * g + m[2] * b
    let g2020 = m[3] * r + m[4] * g + m[5] * b
    let b2020 = m[6] * r + m[7] * g + m[8] * b

    // Step 5: Map diffuse white to 100 nits, then apply remapped user boost.
    // boost=1.0 => ~100 nits, boost=4.0 => ~1600 nits, boost=10 => ~10,000 nits.
    r2020 *= gain
    g2020 *= gain
    b2020 *= gain

    // Step 6: Luminance-domain soft shoulder to preserve highlight detail.
    // Apply one shared scale so chromaticity is preserved.
    const y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    // Only engage the shoulder once luminance exceeds the PQ domain. This keeps
    // calibrated boost targets intact while still taming extreme overflow cases.
    if (y > 1.0) {
      const yMapped = softShoulderLuma(y, shoulderKnee)
      if (yMapped < y) {
        const scale = yMapped / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      }
    }

    // Step 7: Clamp to PQ domain [0, 1] and guard floating-point edge cases.
    r2020 = clamp(r2020, 0.0, 1.0)
    g2020 = clamp(g2020, 0.0, 1.0)
    b2020 = clamp(b2020, 0.0, 1.0)

    // Step 8: PQ-encode and quantize to 16 bits.
    out[di]     = Math.round(pqEncode(r2020) * 65535)
    out[di + 1] = Math.round(pqEncode(g2020) * 65535)
    out[di + 2] = Math.round(pqEncode(b2020) * 65535)
  }

  return out
}
