import { SDR_TO_PQ_SCALE } from './hdr-boost'
import type { LookControls } from './look-controls'
import { srgbEOTF } from './pq-transfer'

export type RGBTuple = [number, number, number]

interface LookRuntime {
  exposureGain: number
  sat: number
  vibranceDelta: number
  contrast: number
  blacks: number
  whites: number
  clarity: number
  highlightSaturation: number
  shadowLift: number
  shadowGlow: number
  shadowLiftStrength: number
  whiteBalanceEnabled: boolean
  wbR: number
  wbG: number
  wbB: number
  toneControlEnabled: boolean
  scenePeak: number
  shoulderKnee: number
}

export interface ProcessingContext {
  lut: Float32Array
  gain: number
  runtime: LookRuntime
}

export const BT2020_LUMA = [0.2627, 0.678, 0.0593] as const
const MID_GRAY_PIVOT = 0.18
const HIGHLIGHT_DESAT_START = 0.55
const HIGHLIGHT_DESAT_MAX = 0.2
const WB_TEMP_STRENGTH = 0.12
const WB_TINT_STRENGTH = 0.1
const BLACKS_STRENGTH = 0.35
const WHITES_STRENGTH = 0.35
const CLARITY_STRENGTH = 0.45

const SHOULDER_KNEE_RATIO = 0.78
const SHOULDER_KNEE_MIN = 0.05
const SHOULDER_KNEE_MAX = 0.85

const gammaLUTCache = new Map<number, Float32Array>()

export const SRGB_TO_BT2020 = [0.6274039, 0.329283, 0.0433131, 0.0690973, 0.9195404, 0.0113623, 0.0163914, 0.0880133, 0.8955953] as const

export const BT2020_TO_SRGB = [
  1.660491, -0.5876411, -0.0728499, -0.1245505, 1.1328999, -0.0083494, -0.0181508, -0.1005789, 1.1187297,
] as const

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function shadowLiftHDRStrength(scenePeak: number): number {
  if (scenePeak <= SDR_TO_PQ_SCALE) return 0.0
  const normalizedHeadroom = (scenePeak - SDR_TO_PQ_SCALE) / (1.0 - SDR_TO_PQ_SCALE)
  return Math.sqrt(clamp(normalizedHeadroom, 0.0, 1.0))
}

function applyShadowLiftToLuma(yMapped: number, shadowLift: number, hdrStrength: number): number {
  if (shadowLift <= 0.0) return yMapped
  if (hdrStrength <= 0.0) return yMapped
  if (yMapped <= 0.0) return yMapped
  const gain = 1.0 + shadowLift * hdrStrength
  return yMapped * gain
}

function toneReferencePeak(scenePeak: number): number {
  return Math.max(scenePeak, SDR_TO_PQ_SCALE)
}

function highlightSaturationFactor(y: number, scenePeak: number, highlightSaturation: number): number {
  if (highlightSaturation === 1.0) return 1.0
  const normalizedY = clamp(y / toneReferencePeak(scenePeak), 0.0, 1.0)
  const weight = normalizedY * normalizedY
  return 1.0 + (highlightSaturation - 1.0) * weight
}

function highlightDesaturationAmount(y: number, scenePeak: number): number {
  const hdrStrength = shadowLiftHDRStrength(scenePeak)
  if (hdrStrength <= 0.0 || scenePeak <= 1e-6) return 0.0

  const normalizedY = clamp(y / toneReferencePeak(scenePeak), 0.0, 1.0)
  const t = clamp((normalizedY - HIGHLIGHT_DESAT_START) / (1.0 - HIGHLIGHT_DESAT_START), 0.0, 1.0)
  return HIGHLIGHT_DESAT_MAX * hdrStrength * t * t
}

function applyToneControlsToLuma(
  y: number,
  scenePeak: number,
  contrast: number,
  shadowLift: number,
  shadowLiftStrength: number,
  blacks: number,
  whites: number,
  clarity: number,
): number {
  const referencePeak = toneReferencePeak(scenePeak)
  let yMapped = MID_GRAY_PIVOT + (y - MID_GRAY_PIVOT) * contrast
  yMapped = applyShadowLiftToLuma(yMapped, shadowLift, shadowLiftStrength)

  const tonePos = clamp(yMapped / referencePeak, 0.0, 1.0)
  if (blacks !== 0.0) {
    const shadowWeight = (1.0 - tonePos) * (1.0 - tonePos)
    yMapped += blacks * BLACKS_STRENGTH * shadowWeight * referencePeak
  }
  if (whites !== 0.0) {
    const highlightWeight = tonePos * tonePos
    yMapped += whites * WHITES_STRENGTH * highlightWeight * referencePeak
  }
  if (clarity !== 0.0) {
    const midWeight = 1.0 - Math.abs(2.0 * tonePos - 1.0)
    yMapped += clarity * CLARITY_STRENGTH * (tonePos - 0.5) * midWeight * referencePeak
  }

  return yMapped
}

function createLookRuntime(look: LookControls, scenePeak: number, shoulderKnee: number): LookRuntime {
  const temperature = look.temperature
  const tint = look.tint
  const shadowLiftStrength = shadowLiftHDRStrength(scenePeak)
  const whiteBalanceEnabled = temperature !== 0.0 || tint !== 0.0
  const wbTemp = temperature * WB_TEMP_STRENGTH
  const wbTint = tint * WB_TINT_STRENGTH

  return {
    exposureGain: Math.pow(2, look.exposure),
    sat: look.saturation,
    vibranceDelta: look.vibrance - 1.0,
    contrast: look.contrast,
    blacks: look.blacks,
    whites: look.whites,
    clarity: look.clarity,
    highlightSaturation: look.highlightSaturation,
    shadowLift: look.shadowLift,
    shadowGlow: look.shadowGlow,
    shadowLiftStrength,
    whiteBalanceEnabled,
    wbR: 1.0 + wbTemp + 0.5 * wbTint,
    wbG: Math.max(0.5, 1.0 - 0.15 * Math.abs(wbTemp) - wbTint),
    wbB: 1.0 - wbTemp + 0.5 * wbTint,
    toneControlEnabled:
      look.contrast !== 1.0 || look.shadowLift > 0.0 || look.blacks !== 0.0 || look.whites !== 0.0 || look.clarity !== 0.0,
    scenePeak,
    shoulderKnee,
  }
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

function softShoulderLuma(y: number, knee = 0.75): number {
  if (y <= knee) return y
  const d = y - knee
  return knee + (d * (1 - knee)) / (d + (1 - knee))
}

export function createProcessingContext(look: LookControls, gain: number): ProcessingContext {
  const scenePeak = Math.min(gain, 1.0)
  const baseShoulderKnee = clamp(scenePeak * SHOULDER_KNEE_RATIO, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)
  const shoulderKnee = clamp(baseShoulderKnee / look.highlightRollOff, SHOULDER_KNEE_MIN, SHOULDER_KNEE_MAX)

  return {
    lut: getLinearizedGammaLUT(look.gamma),
    gain,
    runtime: createLookRuntime(look, scenePeak, shoulderKnee),
  }
}

export function gradeBt2020Pixel(r2020: number, g2020: number, b2020: number, runtime: LookRuntime, out: RGBTuple): void {
  let y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020

  if (runtime.whiteBalanceEnabled) {
    const yBefore = y
    r2020 *= runtime.wbR
    g2020 *= runtime.wbG
    b2020 *= runtime.wbB
    const yAfter = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    if (yAfter > 1e-6) {
      const scale = yBefore / yAfter
      r2020 *= scale
      g2020 *= scale
      b2020 *= scale
    }
    y = yBefore
  }

  if (runtime.sat !== 1.0) {
    r2020 = y + (r2020 - y) * runtime.sat
    g2020 = y + (g2020 - y) * runtime.sat
    b2020 = y + (b2020 - y) * runtime.sat
  }

  if (runtime.vibranceDelta !== 0.0) {
    const max = Math.max(r2020, g2020, b2020)
    const min = Math.min(r2020, g2020, b2020)
    const chroma = max - min
    const saturationNorm = max > 1e-6 ? chroma / (max + 1e-6) : 0
    const vibranceFactor = 1.0 + runtime.vibranceDelta * (1.0 - saturationNorm)
    r2020 = y + (r2020 - y) * vibranceFactor
    g2020 = y + (g2020 - y) * vibranceFactor
    b2020 = y + (b2020 - y) * vibranceFactor
  }

  if (runtime.toneControlEnabled) {
    y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    const yMapped = applyToneControlsToLuma(
      y,
      runtime.scenePeak,
      runtime.contrast,
      runtime.shadowLift,
      runtime.shadowLiftStrength,
      runtime.blacks,
      runtime.whites,
      runtime.clarity,
    )

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

  if (runtime.shadowGlow > 0.0) {
    y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
    const normalizedY = clamp(y / toneReferencePeak(runtime.scenePeak), 0.0, 1.0)
    const glowWeight = (1.0 - normalizedY) * (1.0 - normalizedY)
    const lift = runtime.shadowGlow * runtime.scenePeak * glowWeight
    if (lift > 0.0) {
      const yNew = y + lift
      if (y > 1e-6) {
        const scale = yNew / y
        r2020 *= scale
        g2020 *= scale
        b2020 *= scale
      } else {
        r2020 = lift
        g2020 = lift
        b2020 = lift
      }
    }
  }

  y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
  if (runtime.highlightSaturation !== 1.0) {
    const factor = highlightSaturationFactor(y, runtime.scenePeak, runtime.highlightSaturation)
    r2020 = y + (r2020 - y) * factor
    g2020 = y + (g2020 - y) * factor
    b2020 = y + (b2020 - y) * factor
  }

  y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
  const highlightDesat = highlightDesaturationAmount(y, runtime.scenePeak)
  if (highlightDesat > 0.0) {
    const chromaScale = 1.0 - highlightDesat
    r2020 = y + (r2020 - y) * chromaScale
    g2020 = y + (g2020 - y) * chromaScale
    b2020 = y + (b2020 - y) * chromaScale
  }

  y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
  if (y > 1.0) {
    const yMapped = softShoulderLuma(y, runtime.shoulderKnee)
    if (yMapped < y) {
      const scale = yMapped / y
      r2020 *= scale
      g2020 *= scale
      b2020 *= scale
    }
  }

  out[0] = r2020
  out[1] = g2020
  out[2] = b2020
}

export function decodeAndGradeBt2020Pixel(data: Uint8ClampedArray, sourceIndex: number, context: ProcessingContext, out: RGBTuple): void {
  const r = context.lut[data[sourceIndex] ?? 0] ?? 0
  const g = context.lut[data[sourceIndex + 1] ?? 0] ?? 0
  const b = context.lut[data[sourceIndex + 2] ?? 0] ?? 0
  const gain = context.gain * context.runtime.exposureGain

  const r2020 = (SRGB_TO_BT2020[0] * r + SRGB_TO_BT2020[1] * g + SRGB_TO_BT2020[2] * b) * gain
  const g2020 = (SRGB_TO_BT2020[3] * r + SRGB_TO_BT2020[4] * g + SRGB_TO_BT2020[5] * b) * gain
  const b2020 = (SRGB_TO_BT2020[6] * r + SRGB_TO_BT2020[7] * g + SRGB_TO_BT2020[8] * b) * gain

  gradeBt2020Pixel(r2020, g2020, b2020, context.runtime, out)
}

export function previewToneMap(y: number): number {
  const ySdr = y / SDR_TO_PQ_SCALE
  const mapped = ySdr / (1 + 0.08 * ySdr)
  return clamp(mapped, 0.0, 1.0)
}
