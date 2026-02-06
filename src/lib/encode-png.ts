/**
 * Manual HDR PNG encoder
 *
 * We construct PNG files byte-by-byte rather than using canvas.toBlob() because
 * browsers don't support writing HDR metadata chunks (cICP, cHRM, iCCP) into PNGs.
 * This module assembles a valid PNG with:
 *   - 16-bit RGB pixel data (for PQ's full dynamic range)
 *   - cICP chunk (signals BT.2020 primaries + PQ transfer to HDR-aware decoders)
 *   - cHRM chunk (BT.2020 chromaticity coordinates for legacy decoders)
 *   - iCCP chunk (embedded ICC profile as fallback for apps that don't read cICP)
 *
 * PNG spec: https://www.w3.org/TR/png/
 */

import { getICCProfileBytes } from './icc-profile'

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate')
  const writer = cs.writable.getWriter()
  writer.write(data)
  writer.close()
  const chunks: Uint8Array[] = []
  const reader = cs.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  let len = 0
  for (const c of chunks) len += c.length
  const result = new Uint8Array(len)
  let off = 0
  for (const c of chunks) { result.set(c, off); off += c.length }
  return result
}

// 8-byte PNG file signature — identifies the file as PNG and detects transmission errors
const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

// CRC32 lookup table — precomputed per PNG spec (polynomial 0xEDB88320)
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c
}

// Standard CRC32 used by PNG for chunk integrity verification
function crc32(buf: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

/**
 * Build a single PNG chunk.
 * Every PNG chunk follows the same format:
 *   [4 bytes: data length][4 bytes: type name][N bytes: data][4 bytes: CRC32]
 * The CRC covers the type + data (not the length field).
 */
function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const len = data.length
  const chunk = new Uint8Array(4 + 4 + len + 4)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, len) // big-endian length
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)

  // CRC over type + data
  const crcData = new Uint8Array(4 + len)
  crcData.set(typeBytes, 0)
  crcData.set(data, 4)
  view.setUint32(8 + len, crc32(crcData))

  return chunk
}

/**
 * IHDR — Image Header (must be the first chunk)
 * Declares 16-bit depth, RGB color (type 2, no alpha), no interlacing.
 * 16-bit depth is needed to preserve PQ's precision across the luminance range.
 */
function makeIHDR(width: number, height: number): Uint8Array {
  const data = new Uint8Array(13)
  const view = new DataView(data.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  data[8] = 16  // bit depth
  data[9] = 2   // color type: RGB
  data[10] = 0  // compression
  data[11] = 0  // filter
  data[12] = 0  // interlace
  return makeChunk('IHDR', data)
}

/**
 * cICP — Coding-Independent Code Points (the primary HDR signal)
 * Four bytes that tell the decoder exactly how to interpret the pixel data:
 *   Byte 0: Color primaries = 9 (BT.2020 wide gamut)
 *   Byte 1: Transfer function = 16 (PQ / ST 2084)
 *   Byte 2: Matrix coefficients = 0 (Identity — we're using RGB, not YCbCr)
 *   Byte 3: Full range = 1 (values use full 0–65535 range, not studio/limited)
 */
function makeCICP(): Uint8Array {
  return makeChunk('cICP', new Uint8Array([9, 16, 0, 1]))
}

/**
 * cHRM — Primary Chromaticities and White Point
 * Specifies the BT.2020 color gamut coordinates (x, y pairs scaled by 100,000).
 * This helps legacy decoders that don't understand cICP to still get the color
 * gamut right. BT.2020 covers ~76% of visible colors (vs sRGB's ~36%).
 */
function makeCHRM(): Uint8Array {
  const data = new Uint8Array(32)
  const view = new DataView(data.buffer)
  const vals = [
    31270, 32900, // white point (D65 illuminant)
    70800, 29200, // red primary   (deeper red than sRGB)
    17000, 79700, // green primary (much wider than sRGB)
    13100, 4600,  // blue primary  (slightly shifted from sRGB)
  ]
  vals.forEach((v, i) => view.setUint32(i * 4, v))
  return makeChunk('cHRM', data)
}

/**
 * iCCP — Embedded ICC Color Profile
 * Contains Google's "Rec2020 Gamut with PQ Transfer" profile as a compatibility
 * fallback. Apps that understand cICP (Chrome, macOS) use that; apps that don't
 * (some image editors, older software) fall back to this ICC profile to still
 * render colors correctly. The profile is deflate-compressed per PNG spec.
 */
async function makeICCP(): Promise<Uint8Array> {
  const profileBytes = getICCProfileBytes()
  const compressed = await deflate(profileBytes)
  const name = new TextEncoder().encode('Rec2020-PQ')
  // iCCP data format: profile name + null terminator + compression method (0=deflate) + compressed profile
  const data = new Uint8Array(name.length + 2 + compressed.length)
  data.set(name, 0)
  data[name.length] = 0     // null separator
  data[name.length + 1] = 0 // compression method: deflate
  data.set(compressed, name.length + 2)
  return makeChunk('iCCP', data)
}

/**
 * IDAT — Image Data
 * Contains the actual pixel data, deflate-compressed.
 * Each scanline row is: [1 filter byte (0=None)] + [pixels as big-endian uint16 RGB]
 * So each pixel is 6 bytes (2 bytes × 3 channels), and each row has a leading
 * filter byte. The entire block is then deflate-compressed.
 */
async function makeIDAT(width: number, height: number, pqPixels: Uint16Array): Promise<Uint8Array> {
  const rowBytes = 1 + width * 6 // 1 filter byte + 3 channels × 2 bytes per pixel
  const raw = new Uint8Array(height * rowBytes)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes
    raw[rowOffset] = 0 // filter: None

    for (let x = 0; x < width; x++) {
      const pi = (y * width + x) * 3
      const ri = rowOffset + 1 + x * 6
      // Big-endian 16-bit per channel
      raw[ri]     = (pqPixels[pi] >> 8) & 0xFF
      raw[ri + 1] = pqPixels[pi] & 0xFF
      raw[ri + 2] = (pqPixels[pi + 1] >> 8) & 0xFF
      raw[ri + 3] = pqPixels[pi + 1] & 0xFF
      raw[ri + 4] = (pqPixels[pi + 2] >> 8) & 0xFF
      raw[ri + 5] = pqPixels[pi + 2] & 0xFF
    }
  }

  const compressed = await deflate(raw)
  return makeChunk('IDAT', compressed)
}

/**
 * IEND — Image End (marks the end of the PNG file, always empty)
 */
function makeIEND(): Uint8Array {
  return makeChunk('IEND', new Uint8Array(0))
}

/**
 * Encode a complete 16-bit HDR PNG with Rec.2100 PQ metadata.
 *
 * The chunk order matters:
 *   1. IHDR — must be first (image dimensions, bit depth, color type)
 *   2. cICP — HDR signal: BT.2020 primaries + PQ transfer function
 *   3. cHRM — BT.2020 chromaticity (fallback for decoders without cICP support)
 *   4. iCCP — embedded ICC profile (fallback for apps without cICP or cHRM)
 *   5. IDAT — compressed pixel data
 *   6. IEND — file terminator (must be last)
 *
 * @param {number} width
 * @param {number} height
 * @param {Uint16Array} pqPixels - RGB16 pixel data (3 values per pixel)
 * @returns {Uint8Array} Complete PNG file as a byte array
 */
export async function encodePNG(width: number, height: number, pqPixels: Uint16Array): Promise<Uint8Array> {
  const chunks = [
    makeIHDR(width, height),  // image header
    makeCICP(),               // HDR color info (primary signal)
    makeCHRM(),               // chromaticity (legacy fallback)
    await makeICCP(),         // ICC profile (compatibility fallback)
    await makeIDAT(width, height, pqPixels), // pixel data
    makeIEND(),               // end marker
  ]

  // Calculate total file size: signature + all chunks
  let totalSize = PNG_SIGNATURE.length
  for (const chunk of chunks) totalSize += chunk.length

  // Assemble the final PNG byte array
  const png = new Uint8Array(totalSize)
  let offset = 0
  png.set(PNG_SIGNATURE, offset)
  offset += PNG_SIGNATURE.length
  for (const chunk of chunks) {
    png.set(chunk, offset)
    offset += chunk.length
  }

  return png
}
