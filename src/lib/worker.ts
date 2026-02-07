import { processPixels } from './pq'
import { encodePNG } from './encode-png'
import type { EncodeStats, ConversionStats } from './perf-types'
import type {
  WorkerConvertRequest,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from './worker-protocol'

interface PixelData {
  data: Uint8ClampedArray
  width: number
  height: number
}

const cancelledRequestIds = new Set<number>()
let reusablePqBuffer: Uint16Array | undefined

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

function imageDataFromPixels(request: WorkerConvertRequest): ImageData {
  const { pixels, width, height } = request
  if (!pixels || !width || !height) {
    const err = new Error('Missing pixel buffer fallback payload')
    ;(err as Error & { code?: string }).code = 'BAD_INPUT'
    throw err
  }
  const pixelData: PixelData = { data: pixels, width, height }
  return pixelData as ImageData
}

function getOrCreatePqBuffer(width: number, height: number): Uint16Array {
  const needed = width * height * 3
  if (!reusablePqBuffer || reusablePqBuffer.length !== needed) {
    reusablePqBuffer = new Uint16Array(needed)
  }
  return reusablePqBuffer
}

function postResult(message: WorkerResponseMessage): void {
  if (message.ok) {
    self.postMessage(message, { transfer: [message.pngData.buffer] })
    return
  }
  self.postMessage(message)
}

async function handleConvert(request: WorkerConvertRequest): Promise<void> {
  const totalStart = performance.now()
  const encodeStats = makeEncodeStats()
  const shouldCollectStats = request.collectStats === true

  try {
    const decodeStart = performance.now()
    const imageData = request.file ? await decodeInWorker(request.file) : imageDataFromPixels(request)
    const decodeMs = performance.now() - decodeStart

    if (cancelledRequestIds.has(request.id)) {
      cancelledRequestIds.delete(request.id)
      return
    }

    const processStart = performance.now()
    const pqPixels = processPixels(
      imageData,
      request.boost,
      request.gamma,
      getOrCreatePqBuffer(imageData.width, imageData.height),
    )
    const processMs = performance.now() - processStart

    if (cancelledRequestIds.has(request.id)) {
      cancelledRequestIds.delete(request.id)
      return
    }

    const encodeStart = performance.now()
    const pngData = await encodePNG(imageData.width, imageData.height, pqPixels, {
      idatCompressionLevel: request.idatCompressionLevel,
      compressionBackend: request.compressionBackend,
      encodeStats: shouldCollectStats ? encodeStats : undefined,
    })
    const encodeMs = performance.now() - encodeStart
    const totalMs = performance.now() - totalStart

    if (cancelledRequestIds.has(request.id)) {
      cancelledRequestIds.delete(request.id)
      return
    }

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

self.onmessage = (e: MessageEvent<WorkerRequestMessage>) => {
  const request = e.data
  if (request.type === 'cancel') {
    cancelledRequestIds.add(request.id)
    return
  }
  void handleConvert(request)
}
