/**
 * Shared HDR boost calibration.
 *
 * Centralizing these values keeps slider UI, labels, and pixel processing
 * in sync as one source of truth.
 */
export const SDR_DIFFUSE_WHITE_NITS = 100
export const PQ_MAX_NITS = 10000
export const SDR_TO_PQ_SCALE = SDR_DIFFUSE_WHITE_NITS / PQ_MAX_NITS

export const BOOST_UI_MIN = 1
export const BOOST_UI_MAX = 10
export const BOOST_TARGET_NITS_AT_MAX = 10000
export const BOOST_EXPONENT = Math.log(BOOST_TARGET_NITS_AT_MAX / SDR_DIFFUSE_WHITE_NITS) / Math.log(BOOST_UI_MAX)

export function effectiveBoost(boost: number): number {
  return Math.pow(Math.max(boost, 0), BOOST_EXPONENT)
}

export function boostToPQGain(boost: number): number {
  return effectiveBoost(boost) * SDR_TO_PQ_SCALE
}

export function boostToTargetNits(boost: number): number {
  return SDR_DIFFUSE_WHITE_NITS * effectiveBoost(boost)
}
