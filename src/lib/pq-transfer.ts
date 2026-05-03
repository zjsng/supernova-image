// ST 2084 constants - derived from the specification's rational polynomial.
const m1 = 2610 / 16384
const m2 = (2523 / 4096) * 128
const c1 = 3424 / 4096
const c2 = (2413 / 4096) * 32
const c3 = (2392 / 4096) * 32

const PQ_LUT_SIZE = 32768
const PQ_LUT_SCALE = PQ_LUT_SIZE
const pqLUT = new Float32Array(PQ_LUT_SIZE + 1)

const SRGB_OETF_LUT_SIZE = 4096
const SRGB_OETF_LUT_SCALE = SRGB_OETF_LUT_SIZE
const srgbOETFLUT = new Float32Array(SRGB_OETF_LUT_SIZE + 1)

type PQEncodeMode = 'lut' | 'exact'
let pqEncodeMode: PQEncodeMode = 'lut'
type SRGBEncodeMode = 'lut' | 'exact'
let srgbEncodeMode: SRGBEncodeMode = 'lut'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function pqOETF(L: number): number {
  const Lm1 = Math.pow(L, m1)
  return Math.pow((c1 + c2 * Lm1) / (1 + c3 * Lm1), m2)
}

for (let i = 0; i <= PQ_LUT_SIZE; i++) {
  pqLUT[i] = pqOETF(i / PQ_LUT_SCALE)
}

function pqOETFFast(L: number): number {
  if (L <= 0) return 0
  if (L >= 1) return 1
  const x = L * PQ_LUT_SCALE
  const i = x | 0
  const t = x - i
  const a = pqLUT[i] ?? 0
  const b = pqLUT[i + 1] ?? 1
  return a + (b - a) * t
}

function srgbOETF(linear: number): number {
  if (linear <= 0.0031308) return linear * 12.92
  return 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
}

for (let i = 0; i <= SRGB_OETF_LUT_SIZE; i++) {
  srgbOETFLUT[i] = srgbOETF(i / SRGB_OETF_LUT_SCALE)
}

function srgbOETFFast(linear: number): number {
  if (linear <= 0) return 0
  if (linear >= 1) return 1
  const x = linear * SRGB_OETF_LUT_SCALE
  const i = x | 0
  const t = x - i
  const a = srgbOETFLUT[i] ?? 0
  const b = srgbOETFLUT[i + 1] ?? 1
  return a + (b - a) * t
}

export function pqEncode(L: number): number {
  return pqEncodeMode === 'exact' ? pqOETF(L) : pqOETFFast(L)
}

export function srgbEncode(linear: number): number {
  return srgbEncodeMode === 'exact' ? srgbOETF(linear) : srgbOETFFast(linear)
}

export function setPQEncodeModeForTesting(mode: PQEncodeMode): void {
  pqEncodeMode = mode
}

export function setSRGBEncodeModeForTesting(mode: SRGBEncodeMode): void {
  srgbEncodeMode = mode
}

export function pqEncodeDebug(L: number): { exact: number; lut: number } {
  const clamped = clamp(L, 0.0, 1.0)
  return { exact: pqOETF(clamped), lut: pqOETFFast(clamped) }
}

export function srgbEncodeDebug(L: number): { exact: number; lut: number } {
  const clamped = clamp(L, 0.0, 1.0)
  return { exact: srgbOETF(clamped), lut: srgbOETFFast(clamped) }
}

export function srgbEOTF(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
