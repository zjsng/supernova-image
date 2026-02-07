export interface EncodeStats {
  iccpMs: number
  idatPackMs: number
  idatCompressMs: number
  assembleMs: number
}

export interface ConversionStats {
  decodeMs: number
  processMs: number
  encodeMs: number
  totalMs: number
  outputBytes: number
  encode: EncodeStats
}
