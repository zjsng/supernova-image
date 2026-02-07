/**
 * PQ (Perceptual Quantizer) encoding — SMPTE ST 2084
 *
 * This module converts 8-bit sRGB pixels into 16-bit PQ-encoded BT.2020 values
 * for HDR PNG output, and also provides a fast SDR approximation path for live
 * UI preview.
 */

import { boostToPQGain, SDR_TO_PQ_SCALE } from './hdr-boost'
import { DEFAULT_LOOK_CONTROLS, normalizeLookControls, type LookControls } from './look-controls'

// ST 2084 constants — derived from the specification's rational polynomial.
const m1 = 2610 / 16384
const m2 = 2523 / 4096 * 128
const c1 = 3424 / 4096
const c2 = 2413 / 4096 * 32
const c3 = 2392 / 4096 * 32

// BT.2020 luma coefficients (Rec.2100) for luminance-domain adjustments.
const BT2020_LUMA = [0.2627, 0.6780, 0.0593] as const
const MID_GRAY_PIVOT = 0.18

// Adaptive shoulder parameters.
const SHOULDER_KNEE_RATIO = 0.78
const SHOULDER_KNEE_MIN = 0.05
const SHOULDER_KNEE_MAX = 0.85

// LUT settings for the fast PQ path.
const PQ_LUT_SIZE = 32768
const PQ_LUT_SCALE = PQ_LUT_SIZE
const gammaLUTCache = new Map<number, Float32Array>()
const pqLUT = new Float32Array(PQ_LUT_SIZE + 1)

type PQEncodeMode = 'lut' | 'exact'
let pqEncodeMode: PQEncodeMode = 'lut'

export const SRGB_TO_BT2020 = [
  0.6274039, 0.3292830, 0.0433131,
  0.0690973, 0.9195404, 0.0113623,
  0.0163914, 0.0880133, 0.8955953,
] as const

// Inverse transform for SDR preview conversion.
const BT2020_TO_SRGB = [
  1.6604910, -0.5876411, -0.0728499,
  -0.1245505, 1.1328999, -0.0083494,
  -0.0181508, -0.1005789, 1.1187297,
] as const

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

function softShoulderLuma(y: number, knee = 0.75): number {
  if (y <= knee) return y
  const d = y - knee
  return knee + (d * (1 - knee)) / (d + (1 - knee))
}

function srgbOETF(linear: number): number {
  if (linear <= 0.0031308) return linear * 12.92
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
}

function previewToneMap(y: number): number {
  // Convert PQ-normalized luminance back to SDR-relative scale so 100-nit
  // diffuse white (0.01 in PQ domain) previews close to white.
  const ySdr = y / SDR_TO_PQ_SCALE
  // Mild shoulder that preserves midtones while compressing bright values.
  const mapped = ySdr / (1 + 0.08 * ySdr)
  return clamp(mapped, 0.0, 1.0)
}

function resolveLookControls(lookControlsOrGamma?: number | Partial<LookControls>): LookControls {
  if (typeof lookControlsOrGamma === 'number') {
    return normalizeLookControls({ gamma: lookControlsOrGamma })
  }
  if (lookControlsOrGamma) {
    return normalizeLookControls(lookControlsOrGamma)
  }
  return DEFAULT_LOOK_CONTROLS
}

export function setPQEncodeModeForTesting(mode: PQEncodeMode): void {
  pqEncodeMode = mode
}

export function pqEncodeDebug(L: number): { exact: number, lut: number } {
  const clamped = clamp(L, 0.0, 1.0)
  return { exact: pqOETF(clamped), lut: pqOETFFast(clamped) }
}

export function srgbEOTF(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/**
 * HDR export path: outputs PQ-encoded BT.2020 RGB16.
 *
 * Compatibility: the third argument accepts either a gamma number (legacy) or
 * a look-controls object.
 */
export function processPixels(
  imageData: ImageData,
  boost: number,
  lookControlsOrGamma: number | Partial<LookControls> = DEFAULT_LOOK_CONTROLS,
  outBuffer?: Uint16Array,
): Uint16Array {
  const look = resolveLookControls(lookControlsOrGamma)
  const { data, width, height } = imageData
  const pixelCount = width * height
  const outLen = pixelCount * 3
  const out = outBuffer && outBuffer.length === outLen ? outBuffer : new Uint16Array(outLen)

  const m = SRGB_TO_BT2020
  const lut = getLinearizedGammaLUT(look.gamma)
  const gain = boostToPQGain(boost)
  const scenePeak = Math.min(gain, 1.0)
  const baseShoulderKnee = clamp(scenePeak * SHOULDER_KNEE_RATIO, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)
  const shoulderKnee = clamp(baseShoulderKnee / look.highlightRollOff, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)

  const sat = look.saturation
  const vibranceDelta = look.vibrance - 1.0
  const contrast = look.contrast
  const shadowLift = look.shadowLift

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4
    const di = i * 3

    const r = lut[data[si]]
    const g = lut[data[si + 1]]
    const b = lut[data[si + 2]]

    let r2020 = (m[0] * r + m[1] * g + m[2] * b) * gain
    let g2020 = (m[3] * r + m[4] * g + m[5] * b) * gain
    let b2020 = (m[6] * r + m[7] * g + m[8] * b) * gain

    let y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020

    if (sat !== 1.0) {
      r2020 = y + (r2020 - y) * sat
      g2020 = y + (g2020 - y) * sat
      b2020 = y + (b2020 - y) * sat
    }

    if (vibranceDelta !== 0.0) {
      const max = Math.max(r2020, g2020, b2020)
      const min = Math.min(r2020, g2020, b2020)
      const chroma = max - min
      const saturationNorm = max > 1e-6 ? chroma / (max + 1e-6) : 0
      const vibranceFactor = 1.0 + vibranceDelta * (1.0 - saturationNorm)
      r2020 = y + (r2020 - y) * vibranceFactor
      g2020 = y + (g2020 - y) * vibranceFactor
      b2020 = y + (b2020 - y) * vibranceFactor
    }

    if (contrast !== 1.0 || shadowLift > 0.0) {
      y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
      let yMapped = MID_GRAY_PIVOT + (y - MID_GRAY_PIVOT) * contrast
      if (shadowLift > 0.0) {
        const liftWeight = clamp(1.0 - yMapped, 0.0, 1.0)
        yMapped += shadowLift * liftWeight * liftWeight
      }

      if (y > 1e-6) {
        const scale = yMapped / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      } else if (yMapped > 0.0) {
        r2020 = yMapped
        g2020 = yMapped
        b2020 = yMapped
      }
    }

    y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    if (y > 1.0) {
      const yMapped = softShoulderLuma(y, shoulderKnee)
      if (yMapped < y) {
        const scale = yMapped / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      }
    }

    r2020 = clamp(r2020, 0.0, 1.0)
    g2020 = clamp(g2020, 0.0, 1.0)
    b2020 = clamp(b2020, 0.0, 1.0)

    out[di] = Math.round(pqEncode(r2020) * 65535)
    out[di + 1] = Math.round(pqEncode(g2020) * 65535)
    out[di + 2] = Math.round(pqEncode(b2020) * 65535)
  }

  return out
}

/**
 * Fast preview path: outputs SDR RGBA8 approximation for responsive UI.
 */
export function processPreviewPixels(
  imageData: ImageData,
  boost: number,
  lookControlsInput: Partial<LookControls> = DEFAULT_LOOK_CONTROLS,
  outBuffer?: Uint8ClampedArray,
): Uint8ClampedArray {
  // Preview is an SDR approximation only; HDR luminance boost is export-only.
  void boost
  const look = normalizeLookControls(lookControlsInput)
  const { data, width, height } = imageData
  const pixelCount = width * height
  const outLen = pixelCount * 4
  const out = outBuffer && outBuffer.length === outLen ? outBuffer : new Uint8ClampedArray(outLen)

  const m = SRGB_TO_BT2020
  const inv = BT2020_TO_SRGB
  const lut = getLinearizedGammaLUT(look.gamma)
  const gain = SDR_TO_PQ_SCALE
  const scenePeak = Math.min(gain, 1.0)
  const baseShoulderKnee = clamp(scenePeak * SHOULDER_KNEE_RATIO, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)
  const shoulderKnee = clamp(baseShoulderKnee / look.highlightRollOff, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)

  const sat = look.saturation
  const vibranceDelta = look.vibrance - 1.0
  const contrast = look.contrast
  const shadowLift = look.shadowLift

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4
    const di = i * 4

    const r = lut[data[si]]
    const g = lut[data[si + 1]]
    const b = lut[data[si + 2]]

    let r2020 = (m[0] * r + m[1] * g + m[2] * b) * gain
    let g2020 = (m[3] * r + m[4] * g + m[5] * b) * gain
    let b2020 = (m[6] * r + m[7] * g + m[8] * b) * gain

    let y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020

    if (sat !== 1.0) {
      r2020 = y + (r2020 - y) * sat
      g2020 = y + (g2020 - y) * sat
      b2020 = y + (b2020 - y) * sat
    }

    if (vibranceDelta !== 0.0) {
      const max = Math.max(r2020, g2020, b2020)
      const min = Math.min(r2020, g2020, b2020)
      const chroma = max - min
      const saturationNorm = max > 1e-6 ? chroma / (max + 1e-6) : 0
      const vibranceFactor = 1.0 + vibranceDelta * (1.0 - saturationNorm)
      r2020 = y + (r2020 - y) * vibranceFactor
      g2020 = y + (g2020 - y) * vibranceFactor
      b2020 = y + (b2020 - y) * vibranceFactor
    }

    if (contrast !== 1.0 || shadowLift > 0.0) {
      y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
      let yMapped = MID_GRAY_PIVOT + (y - MID_GRAY_PIVOT) * contrast
      if (shadowLift > 0.0) {
        const liftWeight = clamp(1.0 - yMapped, 0.0, 1.0)
        yMapped += shadowLift * liftWeight * liftWeight
      }

      if (y > 1e-6) {
        const scale = yMapped / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      } else if (yMapped > 0.0) {
        r2020 = yMapped
        g2020 = yMapped
        b2020 = yMapped
      }
    }

    y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    if (y > 1.0) {
      const yMapped = softShoulderLuma(y, shoulderKnee)
      if (yMapped < y) {
        const scale = yMapped / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      }
    }

    r2020 = Math.max(0.0, r2020)
    g2020 = Math.max(0.0, g2020)
    b2020 = Math.max(0.0, b2020)

    y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    if (y > 0.0) {
      const yMapped = previewToneMap(y)
      const scale = yMapped / y
      r2020 *= scale
      g2020 *= scale
      b2020 *= scale
    }

    let rs = inv[0] * r2020 + inv[1] * g2020 + inv[2] * b2020
    let gs = inv[3] * r2020 + inv[4] * g2020 + inv[5] * b2020
    let bs = inv[6] * r2020 + inv[7] * g2020 + inv[8] * b2020

    rs = clamp(rs, 0.0, 1.0)
    gs = clamp(gs, 0.0, 1.0)
    bs = clamp(bs, 0.0, 1.0)

    out[di] = Math.round(clamp(srgbOETF(rs), 0.0, 1.0) * 255)
    out[di + 1] = Math.round(clamp(srgbOETF(gs), 0.0, 1.0) * 255)
    out[di + 2] = Math.round(clamp(srgbOETF(bs), 0.0, 1.0) * 255)
    out[di + 3] = 255
  }

  return out
}
