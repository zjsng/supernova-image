import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getICCProfileBytesMock } = vi.hoisted(() => ({
  getICCProfileBytesMock: vi.fn(async () => new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])),
}))

vi.mock('./icc-profile', () => ({
  getICCProfileBytes: getICCProfileBytesMock,
}))

import { encodePNG, resetEncodeCachesForTesting } from './encode-png'

function parseChunkTypes(png: Uint8Array): string[] {
  const types: string[] = []
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  let offset = 8 // Skip PNG signature.
  while (offset + 12 <= png.length) {
    const length = view.getUint32(offset)
    const typeBytes = png.subarray(offset + 4, offset + 8)
    types.push(String.fromCharCode(...typeBytes))
    offset += 12 + length
  }
  return types
}

describe('encodePNG', () => {
  beforeEach(() => {
    getICCProfileBytesMock.mockClear()
    resetEncodeCachesForTesting()
  })

  it('preserves HDR chunk order and presence', async () => {
    const pqPixels = new Uint16Array([123, 456, 789])
    const png = await encodePNG(1, 1, pqPixels)
    expect(parseChunkTypes(png)).toEqual(['IHDR', 'cICP', 'cHRM', 'iCCP', 'IDAT', 'IEND'])
  })

  it('reuses cached iCCP chunk between conversions with same backend', async () => {
    const pqPixels = new Uint16Array([10, 20, 30])

    await encodePNG(1, 1, pqPixels, { compressionBackend: 'fflate' })
    await encodePNG(1, 1, pqPixels, { compressionBackend: 'fflate' })

    expect(getICCProfileBytesMock).toHaveBeenCalledTimes(1)
  })

  it('keeps independent cache entries per compression backend', async () => {
    if (typeof CompressionStream === 'undefined') return
    const pqPixels = new Uint16Array([10, 20, 30])

    await encodePNG(1, 1, pqPixels, { compressionBackend: 'fflate' })
    await encodePNG(1, 1, pqPixels, { compressionBackend: 'compression-stream' })

    expect(getICCProfileBytesMock).toHaveBeenCalledTimes(2)
  })
})
