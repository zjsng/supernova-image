/**
 * PQ (Perceptual Quantizer) encoding - SMPTE ST 2084
 *
 * This module keeps the public pixel-processing interface stable while the
 * transfer functions and BT.2020 grading implementation live behind internal
 * modules.
 */

import { boostToPQGain, SDR_TO_PQ_SCALE } from './hdr-boost'
import { DEFAULT_LOOK_CONTROLS, normalizeLookControls, type LookControls } from './look-controls'
import {
  BT2020_LUMA,
  BT2020_TO_SRGB,
  clamp,
  createProcessingContext,
  decodeAndGradeBt2020Pixel,
  previewToneMap,
  SRGB_TO_BT2020,
  type RGBTuple,
} from './bt2020-grading'
import {
  pqEncode,
  pqEncodeDebug,
  setPQEncodeModeForTesting,
  setSRGBEncodeModeForTesting,
  srgbEncode,
  srgbEncodeDebug,
  srgbEOTF,
} from './pq-transfer'

export interface PixelBufferLike {
  data: Uint8ClampedArray
  width: number
  height: number
}

function resolveLookControls(lookControlsOrGamma?: number | Partial<LookControls>): LookControls {
  return normalizeLookControls(typeof lookControlsOrGamma === 'number' ? { gamma: lookControlsOrGamma } : lookControlsOrGamma)
}

/**
 * HDR export path: outputs PQ-encoded BT.2020 RGB16.
 *
 * Compatibility: the third argument accepts either a gamma number (legacy) or
 * a look-controls object.
 */
export function processPixels(
  imageData: PixelBufferLike,
  boost: number,
  lookControlsOrGamma: number | Partial<LookControls> = DEFAULT_LOOK_CONTROLS,
  outBuffer?: Uint16Array,
): Uint16Array {
  const look = resolveLookControls(lookControlsOrGamma)
  const { data, width, height } = imageData
  const pixelCount = width * height
  const outLen = pixelCount * 3
  const out = outBuffer && outBuffer.length === outLen ? outBuffer : new Uint16Array(outLen)

  const context = createProcessingContext(look, boostToPQGain(boost))
  const graded: RGBTuple = [0, 0, 0]

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4
    const di = i * 3

    decodeAndGradeBt2020Pixel(data, si, context, graded)
    const r2020 = clamp(graded[0], 0.0, 1.0)
    const g2020 = clamp(graded[1], 0.0, 1.0)
    const b2020 = clamp(graded[2], 0.0, 1.0)

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
  imageData: PixelBufferLike,
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

  const inv = BT2020_TO_SRGB
  const context = createProcessingContext(look, SDR_TO_PQ_SCALE)
  const graded: RGBTuple = [0, 0, 0]

  for (let i = 0; i < pixelCount; i++) {
    const si = i * 4
    const di = i * 4

    decodeAndGradeBt2020Pixel(data, si, context, graded)
    let r2020 = Math.max(0.0, graded[0])
    let g2020 = Math.max(0.0, graded[1])
    let b2020 = Math.max(0.0, graded[2])

    const y = BT2020_LUMA[0] * r2020 + BT2020_LUMA[1] * g2020 + BT2020_LUMA[2] * b2020
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

    out[di] = Math.round(srgbEncode(rs) * 255)
    out[di + 1] = Math.round(srgbEncode(gs) * 255)
    out[di + 2] = Math.round(srgbEncode(bs) * 255)
    out[di + 3] = 255
  }

  return out
}

export { pqEncodeDebug, setPQEncodeModeForTesting, setSRGBEncodeModeForTesting, srgbEncodeDebug, srgbEOTF, SRGB_TO_BT2020 }
