import { processPixels, processPreviewPixels, type PixelBufferLike } from './pq'
import { encodePNG } from './encode-png'
import { normalizeLookControls, PREVIEW_MAX_LONG_EDGE_DEFAULT, type LookControls } from './look-controls'
import type { EncodeStats, ConversionStats } from './perf-types'
import type {
  WorkerConvertRequest,
  WorkerPreviewRequest,
  WorkerRequestMessage,
  WorkerResponseMessage,
  WorkerPreviewSuccessResponse,
} from './worker-protocol'

const VALID_COMPRESSION_BACKENDS = new Set(['fflate', 'compression-stream'])

type RuntimeErrorCode = 'DECODE_UNSUPPORTED' | 'BAD_INPUT' | 'INTERNAL'

function runtimeError(message: string, code: RuntimeErrorCode): Error {
  const error = new Error(message) as Error & { code?: RuntimeErrorCode }
  error.code = code
  return error
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0
}

function supportsWorkerDecode(): boolean {
  return typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined'
}

function validatePixelPayload(request: WorkerConvertRequest | WorkerPreviewRequest): void {
  if (request.file) return

  if (!request.pixels || !isPositiveInt(request.width) || !isPositiveInt(request.height)) {
    throw runtimeError('Missing pixel buffer fallback payload', 'BAD_INPUT')
  }

  const expectedLength = request.width * request.height * 4
  if (request.pixels.length !== expectedLength) {
    throw runtimeError('Pixel buffer length does not match width/height', 'BAD_INPUT')
  }
}

function validateSharedRequestFields(request: WorkerConvertRequest | WorkerPreviewRequest): void {
  if (!isPositiveInt(request.id)) {
    throw runtimeError('Request id must be a positive integer', 'BAD_INPUT')
  }

  if (!isFiniteNumber(request.boost) || request.boost < 0) {
    throw runtimeError('Boost must be a finite non-negative number', 'BAD_INPUT')
  }

  if (request.file && !(request.file instanceof Blob)) {
    throw runtimeError('file payload must be a Blob', 'BAD_INPUT')
  }

  validatePixelPayload(request)
}

function validateConvertRequest(request: WorkerConvertRequest): void {
  validateSharedRequestFields(request)

  if (request.gamma !== undefined && (!isFiniteNumber(request.gamma) || request.gamma <= 0)) {
    throw runtimeError('Gamma must be a finite positive number when provided', 'BAD_INPUT')
  }

  if (request.idatCompressionLevel !== undefined) {
    if (!isFiniteNumber(request.idatCompressionLevel) || request.idatCompressionLevel < 0 || request.idatCompressionLevel > 9) {
      throw runtimeError('idatCompressionLevel must be between 0 and 9', 'BAD_INPUT')
    }
  }

  if (request.compressionBackend !== undefined && !VALID_COMPRESSION_BACKENDS.has(request.compressionBackend)) {
    throw runtimeError('Unknown compression backend', 'BAD_INPUT')
  }
}

function validatePreviewRequest(request: WorkerPreviewRequest): void {
  validateSharedRequestFields(request)

  if (request.output !== undefined && request.output !== 'sdr-rgba' && request.output !== 'hdr-png') {
    throw runtimeError('preview output must be either sdr-rgba or hdr-png', 'BAD_INPUT')
  }

  if (request.previewMaxLongEdge !== undefined) {
    if (!isFiniteNumber(request.previewMaxLongEdge) || request.previewMaxLongEdge <= 0) {
      throw runtimeError('previewMaxLongEdge must be a finite positive number', 'BAD_INPUT')
    }
  }
}

export function validateWorkerRequest(request: WorkerRequestMessage): void {
  if (request.type === 'cancel') {
    if (!isPositiveInt(request.id)) {
      throw runtimeError('Cancel request id must be a positive integer', 'BAD_INPUT')
    }
    return
  }

  if (request.type === 'convert') {
    validateConvertRequest(request)
    return
  }

  if (request.type === 'preview') {
    validatePreviewRequest(request)
    return
  }

  throw runtimeError('Unknown request type', 'BAD_INPUT')
}

function makeEncodeStats(): EncodeStats {
  return {
    iccpMs: 0,
    idatPackMs: 0,
    idatCompressMs: 0,
    assembleMs: 0,
  }
}

function normalizePreviewMaxLongEdge(previewMaxLongEdge?: number): number {
  if (!isFiniteNumber(previewMaxLongEdge) || previewMaxLongEdge <= 0) {
    return PREVIEW_MAX_LONG_EDGE_DEFAULT
  }
  return Math.max(64, Math.min(4096, Math.round(previewMaxLongEdge)))
}

function resolveLookControls(request: { lookControls?: Partial<LookControls>; gamma?: number }): LookControls {
  return normalizeLookControls({
    ...(typeof request.gamma === 'number' ? { gamma: request.gamma } : {}),
    ...(request.lookControls ?? {}),
  })
}

async function decodeInWorker(file: Blob): Promise<PixelBufferLike> {
  if (!supportsWorkerDecode()) {
    throw runtimeError('Worker decode path unavailable', 'DECODE_UNSUPPORTED')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw runtimeError('Failed to acquire 2D context in worker decode path', 'INTERNAL')
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

function imageDataFromPixels(request: WorkerConvertRequest | WorkerPreviewRequest): PixelBufferLike {
  return {
    data: request.pixels!,
    width: request.width!,
    height: request.height!,
  }
}

async function decodeRequestImageData(request: WorkerConvertRequest | WorkerPreviewRequest): Promise<PixelBufferLike> {
  return request.file ? decodeInWorker(request.file) : imageDataFromPixels(request)
}

function downscaleImageData(imageData: PixelBufferLike, maxLongEdge: number): PixelBufferLike {
  const longEdge = Math.max(imageData.width, imageData.height)
  if (longEdge <= maxLongEdge || typeof OffscreenCanvas === 'undefined') {
    return imageData
  }

  const scale = maxLongEdge / longEdge
  const targetWidth = Math.max(1, Math.round(imageData.width * scale))
  const targetHeight = Math.max(1, Math.round(imageData.height * scale))

  const sourceCanvas = new OffscreenCanvas(imageData.width, imageData.height)
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  const destinationCanvas = new OffscreenCanvas(targetWidth, targetHeight)
  const destinationContext = destinationCanvas.getContext('2d', { willReadFrequently: true })

  if (!sourceContext || !destinationContext) return imageData

  const sourceImageData =
    imageData instanceof ImageData ? imageData : new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height)

  sourceContext.putImageData(sourceImageData, 0, 0)
  destinationContext.imageSmoothingEnabled = true
  destinationContext.imageSmoothingQuality = 'high'
  destinationContext.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
  return destinationContext.getImageData(0, 0, targetWidth, targetHeight)
}

function toWorkerErrorResponse(
  request: WorkerConvertRequest | WorkerPreviewRequest,
  type: 'result' | 'preview-result',
  error: unknown,
): WorkerResponseMessage {
  const typedError = error as Error & { code?: RuntimeErrorCode }
  return {
    type,
    id: request.id,
    ok: false,
    error: typedError.message || 'Worker request failed',
    code: typedError.code ?? 'INTERNAL',
  }
}

export class WorkerRuntime {
  private cancelledRequestIds = new Set<number>()

  private reusablePqBuffer: Uint16Array | undefined

  private reusablePreviewBuffer: Uint8ClampedArray | undefined

  cancel(id: number): void {
    this.cancelledRequestIds.add(id)
  }

  private isCancelled(id: number): boolean {
    if (!this.cancelledRequestIds.has(id)) return false
    this.cancelledRequestIds.delete(id)
    return true
  }

  private getOrCreatePqBuffer(width: number, height: number): Uint16Array {
    const needed = width * height * 3
    if (!this.reusablePqBuffer || this.reusablePqBuffer.length !== needed) {
      this.reusablePqBuffer = new Uint16Array(needed)
    }
    return this.reusablePqBuffer
  }

  private getOrCreatePreviewBuffer(width: number, height: number): Uint8ClampedArray {
    const needed = width * height * 4
    if (!this.reusablePreviewBuffer || this.reusablePreviewBuffer.length !== needed) {
      this.reusablePreviewBuffer = new Uint8ClampedArray(needed)
    }
    return this.reusablePreviewBuffer
  }

  async handle(request: WorkerRequestMessage): Promise<WorkerResponseMessage | null> {
    try {
      validateWorkerRequest(request)
    } catch (error) {
      if (request.type === 'cancel') return null
      const responseType = request.type === 'preview' ? 'preview-result' : 'result'
      return toWorkerErrorResponse(request, responseType, error)
    }

    if (request.type === 'cancel') {
      this.cancel(request.id)
      return null
    }

    if (request.type === 'preview') {
      return this.handlePreview(request)
    }

    return this.handleConvert(request)
  }

  private async handleConvert(request: WorkerConvertRequest): Promise<WorkerResponseMessage | null> {
    const totalStart = performance.now()
    const encodeStats = makeEncodeStats()
    const shouldCollectStats = request.collectStats === true

    try {
      const decodeStart = performance.now()
      const imageData = await decodeRequestImageData(request)
      const decodeMs = performance.now() - decodeStart

      if (this.isCancelled(request.id)) return null

      const lookControls = resolveLookControls(request)

      const processStart = performance.now()
      const pqPixels = processPixels(imageData, request.boost, lookControls, this.getOrCreatePqBuffer(imageData.width, imageData.height))
      const processMs = performance.now() - processStart

      if (this.isCancelled(request.id)) return null

      const encodeStart = performance.now()
      const encodeOptions = {
        ...(request.idatCompressionLevel !== undefined ? { idatCompressionLevel: request.idatCompressionLevel } : {}),
        ...(request.compressionBackend !== undefined ? { compressionBackend: request.compressionBackend } : {}),
        ...(shouldCollectStats ? { encodeStats } : {}),
      }
      const pngData = await encodePNG(imageData.width, imageData.height, pqPixels, encodeOptions)
      const encodeMs = performance.now() - encodeStart
      const totalMs = performance.now() - totalStart

      if (this.isCancelled(request.id)) return null

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

      return {
        type: 'result',
        id: request.id,
        ok: true,
        pngData,
        ...(stats ? { stats } : {}),
      }
    } catch (error) {
      return toWorkerErrorResponse(request, 'result', error)
    }
  }

  private async handlePreview(request: WorkerPreviewRequest): Promise<WorkerResponseMessage | null> {
    try {
      const imageData = await decodeRequestImageData(request)
      if (this.isCancelled(request.id)) return null

      const maxLongEdge = normalizePreviewMaxLongEdge(request.previewMaxLongEdge)
      const previewImageData = downscaleImageData(imageData, maxLongEdge)
      if (this.isCancelled(request.id)) return null

      const lookControls = resolveLookControls(request)
      const output = request.output ?? 'sdr-rgba'

      if (output === 'hdr-png') {
        const pqPixels = processPixels(
          previewImageData,
          request.boost,
          lookControls,
          this.getOrCreatePqBuffer(previewImageData.width, previewImageData.height),
        )
        if (this.isCancelled(request.id)) return null

        const pngData = await encodePNG(previewImageData.width, previewImageData.height, pqPixels)
        if (this.isCancelled(request.id)) return null

        const response: WorkerPreviewSuccessResponse = {
          type: 'preview-result',
          id: request.id,
          ok: true,
          width: previewImageData.width,
          height: previewImageData.height,
          pngData,
        }
        return response
      }

      const pixels = processPreviewPixels(
        previewImageData,
        request.boost,
        lookControls,
        this.getOrCreatePreviewBuffer(previewImageData.width, previewImageData.height),
      )

      if (this.isCancelled(request.id)) return null

      const response: WorkerPreviewSuccessResponse = {
        type: 'preview-result',
        id: request.id,
        ok: true,
        width: previewImageData.width,
        height: previewImageData.height,
        pixels,
      }

      return response
    } catch (error) {
      return toWorkerErrorResponse(request, 'preview-result', error)
    }
  }
}
