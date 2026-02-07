import type { ConversionStats } from './perf-types'
import type { CompressionBackend } from './encode-png'
import type { LookControls } from './look-controls'

export interface WorkerConvertRequest {
  type: 'convert'
  id: number
  boost: number
  gamma?: number
  lookControls?: Partial<LookControls>
  collectStats?: boolean
  idatCompressionLevel?: number
  compressionBackend?: CompressionBackend
  file?: Blob
  pixels?: Uint8ClampedArray
  width?: number
  height?: number
}

export interface WorkerPreviewRequest {
  type: 'preview'
  id: number
  boost: number
  lookControls?: Partial<LookControls>
  previewMaxLongEdge?: number
  file?: Blob
  pixels?: Uint8ClampedArray
  width?: number
  height?: number
}

export interface WorkerCancelRequest {
  type: 'cancel'
  id: number
}

export type WorkerRequestMessage = WorkerConvertRequest | WorkerPreviewRequest | WorkerCancelRequest

export interface WorkerSuccessResponse {
  type: 'result'
  id: number
  ok: true
  pngData: Uint8Array
  stats?: ConversionStats
}

export interface WorkerErrorResponse {
  type: 'result'
  id: number
  ok: false
  error: string
  code?: 'DECODE_UNSUPPORTED' | 'BAD_INPUT' | 'INTERNAL'
}

export interface WorkerPreviewSuccessResponse {
  type: 'preview-result'
  id: number
  ok: true
  width: number
  height: number
  pixels: Uint8ClampedArray
}

export interface WorkerPreviewErrorResponse {
  type: 'preview-result'
  id: number
  ok: false
  error: string
  code?: 'DECODE_UNSUPPORTED' | 'BAD_INPUT' | 'INTERNAL'
}

export type WorkerResponseMessage =
  | WorkerSuccessResponse
  | WorkerErrorResponse
  | WorkerPreviewSuccessResponse
  | WorkerPreviewErrorResponse
