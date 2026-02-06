/**
 * PQ (Perceptual Quantizer) encoding — SMPTE ST 2084
 *
 * PQ is the transfer function used by HDR displays (HDR10, Dolby Vision).
 * Unlike traditional gamma (~2.2), PQ maps absolute luminance up to 10,000 nits
 * using a curve optimized for human perception across the entire brightness range.
 *
 * This module converts standard 8-bit sRGB pixels into 16-bit PQ-encoded values
 * suitable for embedding in an HDR PNG.
 *
 * Reference: SMPTE ST 2084:2014
 * https://ieeexplore.ieee.org/document/7291452
 */

// ST 2084 constants — derived from the specification's rational polynomial.
// m1, m2 control the shape of the curve; c1, c2, c3 are normalization coefficients.
const m1 = 2610 / 16384   // 0.1593017578125
const m2 = 2523 / 4096 * 128  // 78.84375
const c1 = 3424 / 4096    // 0.8359375  (= c3 - c2 + 1)
const c2 = 2413 / 4096 * 32   // 18.8515625
const c3 = 2392 / 4096 * 32   // 18.6875

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

/**
 * Convert a single sRGB 0–255 pixel value to a PQ-encoded uint16.
 *
 * Pipeline for each value:
 *   1. Normalize to [0, 1]
 *   2. Linearize with gamma 2.4 (approximate sRGB→linear), adjusted by user gamma
 *   3. Multiply by boost to push into HDR luminance range
 *   4. Clamp to [0, 1] (the PQ domain, where 1.0 = 10,000 nits)
 *   5. Apply PQ OETF to get perceptually-encoded value
 *   6. Quantize to 16-bit unsigned integer (0–65535)
 *
 * @param {number} val - sRGB pixel value (0-255)
 * @param {number} boost - brightness multiplier (e.g. 4.0 → ~400 nits SDR white point)
 * @param {number} gamma - gamma adjustment (default 1.0)
 * @returns {number} uint16 PQ value (0-65535)
 */
export function srgbToPQu16(val: number, boost: number, gamma = 1.0): number {
  // Step 1–2: normalize and linearize (sRGB to linear light)
  const v = val / 255
  const linear = Math.pow(v, 2.4 * gamma)
  // Step 3–4: boost into HDR range, clamp to PQ domain (1.0 = 10,000 nits)
  const L = Math.min(linear * boost, 1.0)
  // Step 5–6: PQ encode and quantize to 16 bits
  const pq = pqOETF(L)
  return Math.round(pq * 65535)
}

/**
 * Process an entire ImageData into a Uint16Array of PQ-encoded RGB values.
 *
 * Input is 8-bit RGBA from canvas (4 bytes/pixel).
 * Output is 16-bit RGB (3 values/pixel) — the alpha channel is dropped
 * because HDR PNGs with PQ transfer use RGB color type (no alpha).
 *
 * @param {ImageData} imageData - source image data from canvas
 * @param {number} boost - brightness multiplier
 * @param {number} gamma - gamma adjustment
 * @returns {Uint16Array} PQ-encoded RGB pixels (3 values per pixel)
 */
export function processPixels(imageData: ImageData, boost: number, gamma = 1.0): Uint16Array {
  const { data, width, height } = imageData
  const pixelCount = width * height
  const out = new Uint16Array(pixelCount * 3) // RGB only, no alpha

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4 // source index into RGBA data
    const di = i * 3 // dest index into RGB output
    out[di]     = srgbToPQu16(data[si],     boost, gamma) // R
    out[di + 1] = srgbToPQu16(data[si + 1], boost, gamma) // G
    out[di + 2] = srgbToPQu16(data[si + 2], boost, gamma) // B
    // data[si + 3] (alpha) is intentionally skipped
  }

  return out
}
