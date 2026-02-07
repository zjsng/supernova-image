import { processPixels, processPreviewPixels } from './pq'
import { encodePNG } from './encode-png'
import { DEFAULT_LOOK_CONTROLS, normalizeLookControls, PREVIEW_MAX_LONG_EDGE_DEFAULT, type LookControls } from './look-controls'
import type { EncodeStats, ConversionStats } from './perf-types'
import type {
  WorkerConvertRequest,
  WorkerPreviewRequest,
  WorkerRequestMessage,
  WorkerResponseMessage,
  WorkerPreviewSuccessResponse,
} from './worker-protocol'

interface PixelData {
  data: Uint8ClampedArray
  width: number
  height: number
}

const cancelledRequestIds = new Set<number>()
let reusablePqBuffer: Uint16Array | undefined
let reusablePreviewBuffer: Uint8ClampedArray | undefined

function makeEncodeStats(): EncodeStats {
  return {
    iccpMs: 0,
    idatPackMs: 0,
    idatCompressMs: 0,
    assembleMs: 0,
  }
}

function supportsWorkerDecode(): boolean {
  return typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined'
}

async function decodeInWorker(file: Blob): Promise<ImageData> {
  if (!supportsWorkerDecode()) {
    const err = new Error('Worker decode path unavailable')
    ;(err as Error & { code?: string }).code = 'DECODE_UNSUPPORTED'
    throw err
  }

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Failed to acquire 2D context in worker decode path')
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

function imageDataFromPixels(request: WorkerConvertRequest | WorkerPreviewRequest): ImageData {
  const { pixels, width, height } = request
  if (!pixels || !width || !height) {
    const err = new Error('Missing pixel buffer fallback payload')
    ;(err as Error & { code?: string }).code = 'BAD_INPUT'
    throw err
  }
  const pixelData: PixelData = { data: pixels, width, height }
  return pixelData as ImageData
}

async function decodeRequestImageData(request: WorkerConvertRequest | WorkerPreviewRequest): Promise<ImageData> {
  return request.file ? decodeInWorker(request.file) : imageDataFromPixels(request)
}

function getOrCreatePqBuffer(width: number, height: number): Uint16Array {
  const needed = width * height * 3
  if (!reusablePqBuffer || reusablePqBuffer.length !== needed) {
    reusablePqBuffer = new Uint16Array(needed)
  }
  return reusablePqBuffer
}

function getOrCreatePreviewBuffer(width: number, height: number): Uint8ClampedArray {
  const needed = width * height * 4
  if (!reusablePreviewBuffer || reusablePreviewBuffer.length !== needed) {
    reusablePreviewBuffer = new Uint8ClampedArray(needed)
  }
  return reusablePreviewBuffer
}

function resolveLookControls(request: { lookControls?: Partial<LookControls>, gamma?: number }): LookControls {
  return normalizeLookControls({
    ...DEFAULT_LOOK_CONTROLS,
    ...(typeof request.gamma === 'number' ? { gamma: request.gamma } : {}),
    ...(request.lookControls ?? {}),
  })
}

function normalizePreviewMaxLongEdge(previewMaxLongEdge?: number): number {
  if (typeof previewMaxLongEdge !== 'number' || !Number.isFinite(previewMaxLongEdge) || previewMaxLongEdge <= 0) {
    return PREVIEW_MAX_LONG_EDGE_DEFAULT
  }
  return Math.max(64, Math.min(4096, Math.round(previewMaxLongEdge)))
}

function downscaleImageData(imageData: ImageData, maxLongEdge: number): ImageData {
  const longEdge = Math.max(imageData.width, imageData.height)
  if (longEdge <= maxLongEdge || typeof OffscreenCanvas === 'undefined') {
    return imageData
  }

  const scale = maxLongEdge / longEdge
  const targetWidth = Math.max(1, Math.round(imageData.width * scale))
  const targetHeight = Math.max(1, Math.round(imageData.height * scale))

  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })
  const dstCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })

  if (!srcCtx || !dstCtx) return imageData

  srcCtx.putImageData(imageData, 0, 0)
  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = 'high'
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight)
  return dstCtx.getImageData(0, 0, targetWidth, targetHeight)
}

function postResult(message: WorkerResponseMessage): void {
  if (message.type === 'result' && message.ok) {
    self.postMessage(message, { transfer: [message.pngData.buffer] })
    return
  }
  if (message.type === 'preview-result' && message.ok) {
    self.postMessage(message, { transfer: [message.pixels.buffer] })
    return
  }
  self.postMessage(message)
}

function isCancelled(id: number): boolean {
  if (!cancelledRequestIds.has(id)) return false
  cancelledRequestIds.delete(id)
  return true
}

async function handleConvert(request: WorkerConvertRequest): Promise<void> {
  const totalStart = performance.now()
  const encodeStats = makeEncodeStats()
  const shouldCollectStats = request.collectStats === true

  try {
    const decodeStart = performance.now()
    const imageData = await decodeRequestImageData(request)
    const decodeMs = performance.now() - decodeStart

    if (isCancelled(request.id)) return

    const lookControls = resolveLookControls(request)

    const processStart = performance.now()
    const pqPixels = processPixels(
      imageData,
      request.boost,
      lookControls,
      getOrCreatePqBuffer(imageData.width, imageData.height),
    )
    const processMs = performance.now() - processStart

    if (isCancelled(request.id)) return

    const encodeStart = performance.now()
    const pngData = await encodePNG(imageData.width, imageData.height, pqPixels, {
      idatCompressionLevel: request.idatCompressionLevel,
      compressionBackend: request.compressionBackend,
      encodeStats: shouldCollectStats ? encodeStats : undefined,
    })
    const encodeMs = performance.now() - encodeStart
    const totalMs = performance.now() - totalStart

    if (isCancelled(request.id)) return

    const stats: ConversionStats | undefined = shouldCollectStats
      ? {
          decodeMs,
          processMs,
          encodeMs,
          totalMs,
          outputBytes: pngData.byteLength,
          encode: encodeStats,
        }
      : undefined

    postResult({
      type: 'result',
      id: request.id,
      ok: true,
      pngData,
      stats,
    })
  } catch (error) {
    const typedError = error as Error & { code?: string }
    postResult({
      type: 'result',
      id: request.id,
      ok: false,
      error: typedError.message || 'Worker conversion failed',
      code: (typedError.code as 'DECODE_UNSUPPORTED' | 'BAD_INPUT' | 'INTERNAL' | undefined) ?? 'INTERNAL',
    })
  }
}

async function handlePreview(request: WorkerPreviewRequest): Promise<void> {
  try {
    const imageData = await decodeRequestImageData(request)
    if (isCancelled(request.id)) return

    const maxLongEdge = normalizePreviewMaxLongEdge(request.previewMaxLongEdge)
    const previewImageData = downscaleImageData(imageData, maxLongEdge)
    if (isCancelled(request.id)) return

    const lookControls = resolveLookControls(request)
    const pixels = processPreviewPixels(
      previewImageData,
      request.boost,
      lookControls,
      getOrCreatePreviewBuffer(previewImageData.width, previewImageData.height),
    )

    if (isCancelled(request.id)) return

    const response: WorkerPreviewSuccessResponse = {
      type: 'preview-result',
      id: request.id,
      ok: true,
      width: previewImageData.width,
      height: previewImageData.height,
      pixels,
    }
    postResult(response)
  } catch (error) {
    const typedError = error as Error & { code?: string }
    postResult({
      type: 'preview-result',
      id: request.id,
      ok: false,
      error: typedError.message || 'Worker preview failed',
      code: (typedError.code as 'DECODE_UNSUPPORTED' | 'BAD_INPUT' | 'INTERNAL' | undefined) ?? 'INTERNAL',
    })
  }
}

self.onmessage = (e: MessageEvent<WorkerRequestMessage>) => {
  const request = e.data
  if (request.type === 'cancel') {
    cancelledRequestIds.add(request.id)
    return
  }
  if (request.type === 'preview') {
    void handlePreview(request)
    return
  }
  void handleConvert(request)
}
