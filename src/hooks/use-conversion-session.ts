import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { DEFAULT_LOOK_CONTROLS, PREVIEW_DEBOUNCE_MS, type LookControls } from '../lib/look-controls'
import { getWorkerErrorCode, getWorkerErrorMessage, useConverterWorker } from './use-converter-worker'
import { requestExportConversion, requestPreviewConversion, type PixelDecodeResult } from '../lib/image-processing-requests'
import type { WorkerPreviewSuccessResponse } from '../lib/worker-protocol'

export interface ImageState {
  src: string
  name: string
  width: number
  height: number
  file: File
  el: HTMLImageElement
}

function supportsHdrPreview(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const queries = ['(dynamic-range: high)', '(video-dynamic-range: high)', '(color-gamut: rec2020)']
  return queries.some((query) => {
    const media = window.matchMedia(query)
    return media.media !== 'not all' && media.matches
  })
}

function buildUserFacingError(error: unknown): string {
  const code = getWorkerErrorCode(error)
  if (code === 'DECODE_UNSUPPORTED') {
    return 'Worker decode path is unavailable in this browser. Falling back to canvas decode.'
  }
  if (code === 'BAD_INPUT') {
    return 'The image payload was invalid. Please reload and try again.'
  }
  if (code === 'INTERNAL') {
    return 'An internal conversion error occurred. Please try again.'
  }
  return getWorkerErrorMessage(error)
}

function triggerPngDownload(pngData: Uint8Array, sourceName: string): void {
  const blob = new Blob([new Uint8Array(pngData)], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const stem = sourceName.replace(/\.[^.]+$/, '') || 'image'

  anchor.href = url
  anchor.download = `${stem}-hdr.png`
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()

  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export function useConversionSession() {
  const [image, setImage] = useState<ImageState | null>(null)
  const [boost, setBoost] = useState(5)
  const [lookControls, setLookControls] = useState<LookControls>(DEFAULT_LOOK_CONTROLS)
  const [processing, setProcessing] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [dragover, setDragover] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null)
  const [hdrPreviewEnabled, setHdrPreviewEnabled] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const decodeCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewDebounceTimerRef = useRef<number | null>(null)
  const previewImageUrlRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { runWorkerConvert, runWorkerPreview, cancelActivePreview, shouldTryWorkerDecode, markWorkerDecodeSupport, teardownWorker } =
    useConverterWorker({
      onWorkerFailure: () => {
        setErrorMessage('Worker crashed while processing image. Please retry.')
      },
    })

  const worker = useMemo(
    () => ({
      runWorkerConvert,
      runWorkerPreview,
      shouldTryWorkerDecode,
      markWorkerDecodeSupport,
    }),
    [markWorkerDecodeSupport, runWorkerConvert, runWorkerPreview, shouldTryWorkerDecode],
  )

  const clearPreviewDebounce = useCallback(() => {
    if (previewDebounceTimerRef.current !== null) {
      window.clearTimeout(previewDebounceTimerRef.current)
      previewDebounceTimerRef.current = null
    }
  }, [])

  const revokePreviewImageUrl = useCallback(() => {
    if (previewImageUrlRef.current) {
      URL.revokeObjectURL(previewImageUrlRef.current)
      previewImageUrlRef.current = null
    }
  }, [])

  const clearPreviewOutput = useCallback(() => {
    revokePreviewImageUrl()
    setPreviewImageSrc(null)

    const canvas = previewCanvasRef.current
    if (!canvas) {
      setPreviewReady(false)
      return
    }

    const context = canvas.getContext('2d')
    if (context) context.clearRect(0, 0, canvas.width, canvas.height)
    setPreviewReady(false)
  }, [revokePreviewImageUrl])

  useEffect(() => {
    setHdrPreviewEnabled(supportsHdrPreview())
  }, [])

  useEffect(() => {
    return () => {
      clearPreviewDebounce()
      revokePreviewImageUrl()
      teardownWorker()
    }
  }, [clearPreviewDebounce, revokePreviewImageUrl, teardownWorker])

  const decodePixelsOnMainThread = useCallback((currentImage: ImageState): PixelDecodeResult => {
    const canvas = decodeCanvasRef.current
    if (!canvas) throw new Error('Canvas is unavailable for decode fallback')

    canvas.width = currentImage.width
    canvas.height = currentImage.height

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Failed to acquire 2D context')

    context.drawImage(currentImage.el, 0, 0)
    const imageData = context.getImageData(0, 0, currentImage.width, currentImage.height)
    return { pixels: imageData.data, width: currentImage.width, height: currentImage.height }
  }, [])

  const drawPreview = useCallback(
    (result: WorkerPreviewSuccessResponse) => {
      if ('pngData' in result) {
        revokePreviewImageUrl()
        const blob = new Blob([new Uint8Array(result.pngData)], { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        previewImageUrlRef.current = url
        setPreviewImageSrc(url)
        setPreviewReady(true)
        return
      }

      setPreviewImageSrc(null)
      revokePreviewImageUrl()

      const canvas = previewCanvasRef.current
      if (!canvas) return

      canvas.width = result.width
      canvas.height = result.height

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) return

      context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0)
      setPreviewReady(true)
    },
    [revokePreviewImageUrl],
  )

  const requestPreview = useCallback(
    async (currentImage: ImageState) => {
      setPreviewPending(true)
      setErrorMessage(null)

      try {
        const response = await requestPreviewConversion({
          image: currentImage,
          boost,
          lookControls,
          hdrPreviewEnabled,
          worker,
          decodePixelsOnMainThread: () => decodePixelsOnMainThread(currentImage),
        })

        if (response.hdrPreviewEnabled !== hdrPreviewEnabled) {
          setHdrPreviewEnabled(response.hdrPreviewEnabled)
        }
        drawPreview(response.result)
      } catch (error) {
        const message = getWorkerErrorMessage(error).toLowerCase()
        if (!message.includes('cancelled')) {
          setErrorMessage(buildUserFacingError(error))
        }
      } finally {
        setPreviewPending(false)
      }
    },
    [boost, decodePixelsOnMainThread, drawPreview, hdrPreviewEnabled, lookControls, worker],
  )

  const loadImage = useCallback(
    (file: File) => {
      if (!file || !file.type.startsWith('image/')) return

      setErrorMessage(null)
      cancelActivePreview()
      clearPreviewDebounce()
      setPreviewPending(false)
      clearPreviewOutput()

      if (image?.src) URL.revokeObjectURL(image.src)

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setImage({ src: url, name: file.name, width: img.width, height: img.height, file, el: img })
      }
      img.src = url
    },
    [cancelActivePreview, clearPreviewDebounce, clearPreviewOutput, image],
  )

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      setDragover(false)
      const file = event.dataTransfer?.files?.[0]
      if (file) loadImage(file)
    },
    [loadImage],
  )

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    setDragover(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragover(false)
  }, [])

  const handleFileSelect = useCallback(
    (event: Event) => {
      const file = (event.target as HTMLInputElement)?.files?.[0]
      if (file) loadImage(file)
    },
    [loadImage],
  )

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const reset = useCallback(() => {
    if (image?.src) URL.revokeObjectURL(image.src)
    cancelActivePreview()
    clearPreviewDebounce()
    setPreviewPending(false)
    clearPreviewOutput()
    setErrorMessage(null)
    setImage(null)
  }, [cancelActivePreview, clearPreviewDebounce, clearPreviewOutput, image])

  const setLookControl = useCallback((key: keyof LookControls, value: number) => {
    setLookControls((previous) => ({ ...previous, [key]: value }))
  }, [])

  useEffect(() => {
    if (!image || processing) return

    clearPreviewDebounce()
    previewDebounceTimerRef.current = window.setTimeout(() => {
      void requestPreview(image)
    }, PREVIEW_DEBOUNCE_MS)

    return clearPreviewDebounce
  }, [clearPreviewDebounce, image, lookControls, processing, requestPreview])

  const convert = useCallback(async () => {
    if (!image) return

    setProcessing(true)
    setErrorMessage(null)
    cancelActivePreview()
    clearPreviewDebounce()

    try {
      const result = await requestExportConversion({
        image,
        boost,
        lookControls,
        collectStats: import.meta.env.DEV,
        worker,
        decodePixelsOnMainThread: () => decodePixelsOnMainThread(image),
      })

      if (import.meta.env.DEV && result.stats) {
        const stats = result.stats
        console.table({
          decodeMs: stats.decodeMs.toFixed(2),
          processMs: stats.processMs.toFixed(2),
          encodeMs: stats.encodeMs.toFixed(2),
          totalMs: stats.totalMs.toFixed(2),
          idatPackMs: stats.encode.idatPackMs.toFixed(2),
          idatCompressMs: stats.encode.idatCompressMs.toFixed(2),
          outputKB: (stats.outputBytes / 1024).toFixed(1),
        })
      }

      triggerPngDownload(result.pngData, image.name)

      setDownloaded(true)
      window.setTimeout(() => setDownloaded(false), 2500)
    } catch (error) {
      setErrorMessage(buildUserFacingError(error))
    } finally {
      setProcessing(false)
    }
  }, [boost, cancelActivePreview, clearPreviewDebounce, decodePixelsOnMainThread, image, lookControls, worker])

  return {
    image,
    boost,
    lookControls,
    processing,
    downloaded,
    dragover,
    previewPending,
    previewReady,
    previewImageSrc,
    hdrPreviewEnabled,
    errorMessage,
    decodeCanvasRef,
    previewCanvasRef,
    fileInputRef,
    setBoost,
    setLookControl,
    loadImage,
    reset,
    convert,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleBrowse,
    handleFileSelect,
  }
}
