import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOOK_CONTROLS } from './look-controls'
import { requestExportConversion, requestPreviewConversion, type ImageProcessingWorkerAdapter } from './image-processing-requests'

function makeWorker(overrides: Partial<ImageProcessingWorkerAdapter> = {}): ImageProcessingWorkerAdapter {
  return {
    runWorkerConvert: vi.fn(async () => ({
      type: 'result',
      id: 1,
      ok: true,
      pngData: new Uint8Array([9]),
    })),
    runWorkerPreview: vi.fn(async () => ({
      type: 'preview-result',
      id: 1,
      ok: true,
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([1, 2, 3, 255]),
    })),
    shouldTryWorkerDecode: vi.fn(() => true),
    markWorkerDecodeSupport: vi.fn(),
    ...overrides,
  }
}

const image = {
  file: new File(['x'], 'test.png', { type: 'image/png' }),
  width: 1,
  height: 1,
}

describe('requestPreviewConversion', () => {
  it('uses worker file decode when preview succeeds', async () => {
    const worker = makeWorker()
    const decodePixelsOnMainThread = vi.fn()

    const response = await requestPreviewConversion({
      image,
      boost: 5,
      lookControls: DEFAULT_LOOK_CONTROLS,
      hdrPreviewEnabled: false,
      worker,
      decodePixelsOnMainThread,
    })

    expect(response.hdrPreviewEnabled).toBe(false)
    expect(worker.runWorkerPreview).toHaveBeenCalledWith(expect.objectContaining({ file: image.file, output: 'sdr-rgba' }))
    expect(worker.markWorkerDecodeSupport).toHaveBeenCalledWith(true)
    expect(decodePixelsOnMainThread).not.toHaveBeenCalled()
  })

  it('falls back to canvas pixels when worker decode fails', async () => {
    const worker = makeWorker({
      runWorkerPreview: vi
        .fn()
        .mockRejectedValueOnce(new Error('decode failed'))
        .mockResolvedValueOnce({
          type: 'preview-result',
          id: 2,
          ok: true,
          width: 1,
          height: 1,
          pixels: new Uint8ClampedArray([4, 5, 6, 255]),
        }),
    })
    const pixels = new Uint8ClampedArray([4, 5, 6, 255])

    await requestPreviewConversion({
      image,
      boost: 5,
      lookControls: DEFAULT_LOOK_CONTROLS,
      hdrPreviewEnabled: false,
      worker,
      decodePixelsOnMainThread: () => ({ pixels, width: 1, height: 1 }),
    })

    expect(worker.markWorkerDecodeSupport).toHaveBeenCalledWith(false)
    expect(worker.runWorkerPreview).toHaveBeenLastCalledWith(expect.objectContaining({ pixels, width: 1, height: 1, output: 'sdr-rgba' }), [
      pixels.buffer,
    ])
  })

  it('falls back from HDR preview PNG to SDR preview pixels', async () => {
    const worker = makeWorker({
      runWorkerPreview: vi
        .fn()
        .mockRejectedValueOnce(new Error('hdr preview failed'))
        .mockRejectedValueOnce(new Error('hdr fallback decode failed'))
        .mockResolvedValueOnce({
          type: 'preview-result',
          id: 3,
          ok: true,
          width: 1,
          height: 1,
          pixels: new Uint8ClampedArray([7, 8, 9, 255]),
        }),
    })
    const pixels = new Uint8ClampedArray([7, 8, 9, 255])

    const response = await requestPreviewConversion({
      image,
      boost: 5,
      lookControls: DEFAULT_LOOK_CONTROLS,
      hdrPreviewEnabled: true,
      worker,
      decodePixelsOnMainThread: () => ({ pixels, width: 1, height: 1 }),
    })

    expect(response.hdrPreviewEnabled).toBe(false)
    expect(worker.runWorkerPreview).toHaveBeenLastCalledWith(expect.objectContaining({ file: image.file, output: 'sdr-rgba' }))
  })
})

describe('requestExportConversion', () => {
  it('uses the shared decode fallback path for export', async () => {
    const worker = makeWorker({
      runWorkerConvert: vi
        .fn()
        .mockRejectedValueOnce(new Error('decode failed'))
        .mockResolvedValueOnce({
          type: 'result',
          id: 4,
          ok: true,
          pngData: new Uint8Array([1, 2, 3]),
        }),
    })
    const pixels = new Uint8ClampedArray([1, 2, 3, 255])

    const response = await requestExportConversion({
      image,
      boost: 5,
      lookControls: DEFAULT_LOOK_CONTROLS,
      collectStats: false,
      worker,
      decodePixelsOnMainThread: () => ({ pixels, width: 1, height: 1 }),
    })

    expect(response.pngData).toEqual(new Uint8Array([1, 2, 3]))
    expect(worker.markWorkerDecodeSupport).toHaveBeenCalledWith(false)
    expect(worker.runWorkerConvert).toHaveBeenLastCalledWith(expect.objectContaining({ pixels, width: 1, height: 1 }), [pixels.buffer])
  })
})
