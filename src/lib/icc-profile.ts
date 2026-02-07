/**
 * Embedded ICC Color Profile — "Rec2020 Gamut with PQ Transfer"
 *
 * This is Google's ICC profile for Rec.2020 color primaries with the PQ
 * (ST 2084) transfer function. The raw binary is stored as `rec2020-pq.icc`
 * and loaded via Vite's `?url` import so it's served as a hashed static asset.
 *
 * Purpose: provides fallback HDR metadata for applications that don't read
 * the newer cICP PNG chunk. macOS uses this profile to activate Extended
 * Dynamic Range (EDR), making images glow on HDR-capable displays.
 *
 * Extracted from a confirmed-working HDR sample produced by Chrome.
 */

import iccUrl from './rec2020-pq.icc?url'

/**
 * Fetch the raw ICC profile bytes from the static asset.
 */
export async function getICCProfileBytes(): Promise<Uint8Array> {
  const response = await fetch(iccUrl)
  return new Uint8Array(await response.arrayBuffer())
}
