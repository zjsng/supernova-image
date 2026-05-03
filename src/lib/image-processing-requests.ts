import { BOOST_UI_MIN } from './hdr-boost'
import { PREVIEW_MAX_LONG_EDGE_DEFAULT, type LookControls } from './look-controls'
import type { WorkerConvertRequest, WorkerPreviewRequest, WorkerPreviewSuccessResponse, WorkerSuccessResponse } from './worker-protocol'

export interface RequestImage {
  file: File
  width: number
  height: number
}

export interface PixelDecodeResult {
  pixels: Uint8ClampedArray
  width: number
  height: number
}

export interface ImageProcessingWorkerAdapter {
  runWorkerConvert: (payload: Omit<WorkerConvertRequest, 'type' | 'id'>, transfer?: Transferable[]) => Promise<WorkerSuccessResponse>
  runWorkerPreview: (payload: Omit<WorkerPreviewRequest, 'type' | 'id'>, transfer?: Transferable[]) => Promise<WorkerPreviewSuccessResponse>
  shouldTryWorkerDecode: (hasFile: boolean) => boolean
  markWorkerDecodeSupport: (isSupported: boolean) => void
}

export interface RequestPreviewOptions {
  image: RequestImage
  boost: number
  lookControls: LookControls
  hdrPreviewEnabled: boolean
  worker: ImageProcessingWorkerAdapter
  decodePixelsOnMainThread: () => PixelDecodeResult
  previewMaxLongEdge?: number
}

export interface RequestPreviewResult {
  result: WorkerPreviewSuccessResponse
  hdrPreviewEnabled: boolean
}

export interface RequestExportOptions {
  image: RequestImage
  boost: number
  lookControls: LookControls
  collectStats: boolean
  worker: ImageProcessingWorkerAdapter
  decodePixelsOnMainThread: () => PixelDecodeResult
}

async function runWithDecodeFallback<TResponse>(
  image: RequestImage,
  worker: ImageProcessingWorkerAdapter,
  decodePixelsOnMainThread: () => PixelDecodeResult,
  runFilePayload: () => Promise<TResponse>,
  runPixelPayload: (pixels: PixelDecodeResult, transfer: Transferable[]) => Promise<TResponse>,
): Promise<TResponse> {
  if (worker.shouldTryWorkerDecode(Boolean(image.file))) {
    try {
      const response = await runFilePayload()
      worker.markWorkerDecodeSupport(true)
      return response
    } catch {
      // Worker-side decode can fail even when browser decode works (headless/driver quirks).
      // Always fall back to main-thread canvas decode before surfacing the error.
      worker.markWorkerDecodeSupport(false)
      const pixels = decodePixelsOnMainThread()
      return runPixelPayload(pixels, [pixels.pixels.buffer])
    }
  }

  const pixels = decodePixelsOnMainThread()
  return runPixelPayload(pixels, [pixels.pixels.buffer])
}

export async function requestPreviewConversion({
  image,
  boost,
  lookControls,
  hdrPreviewEnabled,
  worker,
  decodePixelsOnMainThread,
  previewMaxLongEdge = PREVIEW_MAX_LONG_EDGE_DEFAULT,
}: RequestPreviewOptions): Promise<RequestPreviewResult> {
  const requestWithOutput = (output: 'sdr-rgba' | 'hdr-png', previewBoost: number): Promise<WorkerPreviewSuccessResponse> =>
    runWithDecodeFallback(
      image,
      worker,
      decodePixelsOnMainThread,
      () =>
        worker.runWorkerPreview({
          file: image.file,
          boost: previewBoost,
          lookControls,
          output,
          previewMaxLongEdge,
        }),
      ({ pixels, width, height }, transfer) =>
        worker.runWorkerPreview(
          {
            pixels,
            width,
            height,
            boost: previewBoost,
            lookControls,
            output,
            previewMaxLongEdge,
          },
          transfer,
        ),
    )

  const preferredOutput = hdrPreviewEnabled ? 'hdr-png' : 'sdr-rgba'
  const preferredBoost = hdrPreviewEnabled ? boost : BOOST_UI_MIN

  try {
    const result = await requestWithOutput(preferredOutput, preferredBoost)
    return { result, hdrPreviewEnabled }
  } catch (error) {
    if (preferredOutput !== 'hdr-png') throw error
    const result = await requestWithOutput('sdr-rgba', BOOST_UI_MIN)
    return { result, hdrPreviewEnabled: false }
  }
}

export function requestExportConversion({
  image,
  boost,
  lookControls,
  collectStats,
  worker,
  decodePixelsOnMainThread,
}: RequestExportOptions): Promise<WorkerSuccessResponse> {
  return runWithDecodeFallback(
    image,
    worker,
    decodePixelsOnMainThread,
    () => worker.runWorkerConvert({ file: image.file, boost, lookControls, collectStats }),
    ({ pixels, width, height }, transfer) =>
      worker.runWorkerConvert({ pixels, width, height, boost, lookControls, collectStats }, transfer),
  )
}
