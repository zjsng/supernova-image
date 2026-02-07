import type { ConversionStats } from './perf-types'
import type { CompressionBackend } from './encode-png'

export interface WorkerConvertRequest {
  type: 'convert'
  id: number
  boost: number
  gamma: number
  collectStats?: boolean
  idatCompressionLevel?: number
  compressionBackend?: CompressionBackend
  file?: Blob
  pixels?: Uint8ClampedArray
  width?: number
  height?: number
}

export interface WorkerCancelRequest {
  type: 'cancel'
  id: number
}

export type WorkerRequestMessage = WorkerConvertRequest | WorkerCancelRequest

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

export type WorkerResponseMessage = WorkerSuccessResponse | WorkerErrorResponse
