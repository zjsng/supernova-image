import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { DEFAULT_LOOK_CONTROLS, PREVIEW_DEBOUNCE_MS, PREVIEW_MAX_LONG_EDGE_DEFAULT, type LookControls } from '../lib/look-controls'
import type { WorkerPreviewSuccessResponse, WorkerSuccessResponse } from '../lib/worker-protocol'
import { BOOST_UI_MIN } from '../lib/hdr-boost'
import { getWorkerErrorCode, getWorkerErrorMessage, useConverterWorker } from '../hooks/use-converter-worker'
import { ConverterControls } from '../components/converter-controls'
import { PreviewPane } from '../components/preview-pane'
import { PlasmaField } from '../components/plasma-field'
import { SEO_BASE_URL } from '../lib/seo-routes'
import { HOME_ROUTE, RouteJsonLd, useSeoRouteHead } from './shared'

interface ImageState {
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

export function Home() {
  useSeoRouteHead(HOME_ROUTE.canonicalPath)

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

  const decodePixelsOnMainThread = useCallback(
    (
      currentImage: ImageState,
    ): {
      pixels: Uint8ClampedArray
      width: number
      height: number
    } => {
      const canvas = decodeCanvasRef.current
      if (!canvas) throw new Error('Canvas is unavailable for decode fallback')

      canvas.width = currentImage.width
      canvas.height = currentImage.height

      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Failed to acquire 2D context')

      context.drawImage(currentImage.el, 0, 0)
      const imageData = context.getImageData(0, 0, currentImage.width, currentImage.height)
      return { pixels: imageData.data, width: currentImage.width, height: currentImage.height }
    },
    [],
  )

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
      const requestWithOutput = async (output: 'sdr-rgba' | 'hdr-png', previewBoost: number): Promise<WorkerPreviewSuccessResponse> => {
        if (shouldTryWorkerDecode(Boolean(currentImage.file))) {
          try {
            const response = await runWorkerPreview({
              file: currentImage.file,
              boost: previewBoost,
              lookControls,
              output,
              previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
            })
            markWorkerDecodeSupport(true)
            return response
          } catch {
            // Worker-side decode can fail even when browser decode works (headless/driver quirks).
            // Always fall back to main-thread canvas decode before surfacing the error.
            markWorkerDecodeSupport(false)
            const { pixels, width, height } = decodePixelsOnMainThread(currentImage)
            return runWorkerPreview(
              {
                pixels,
                width,
                height,
                boost: previewBoost,
                lookControls,
                output,
                previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
              },
              [pixels.buffer],
            )
          }
        }

        const { pixels, width, height } = decodePixelsOnMainThread(currentImage)
        return runWorkerPreview(
          {
            pixels,
            width,
            height,
            boost: previewBoost,
            lookControls,
            output,
            previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
          },
          [pixels.buffer],
        )
      }

      setPreviewPending(true)
      setErrorMessage(null)

      try {
        const preferredOutput = hdrPreviewEnabled ? 'hdr-png' : 'sdr-rgba'
        const preferredBoost = hdrPreviewEnabled ? boost : BOOST_UI_MIN

        let result: WorkerPreviewSuccessResponse
        try {
          result = await requestWithOutput(preferredOutput, preferredBoost)
        } catch (error) {
          if (preferredOutput === 'hdr-png') {
            result = await requestWithOutput('sdr-rgba', BOOST_UI_MIN)
            setHdrPreviewEnabled(false)
          } else {
            throw error
          }
        }

        drawPreview(result)
      } catch (error) {
        const message = getWorkerErrorMessage(error).toLowerCase()
        if (!message.includes('cancelled')) {
          setErrorMessage(buildUserFacingError(error))
        }
      } finally {
        setPreviewPending(false)
      }
    },
    [
      boost,
      decodePixelsOnMainThread,
      drawPreview,
      hdrPreviewEnabled,
      lookControls,
      markWorkerDecodeSupport,
      runWorkerPreview,
      shouldTryWorkerDecode,
    ],
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
      const collectStats = import.meta.env.DEV
      let result: WorkerSuccessResponse

      if (shouldTryWorkerDecode(Boolean(image.file))) {
        try {
          result = await runWorkerConvert({ file: image.file, boost, lookControls, collectStats })
          markWorkerDecodeSupport(true)
        } catch {
          // Mirror preview behavior: prefer robust canvas fallback on worker decode failure.
          markWorkerDecodeSupport(false)
          const { pixels, width, height } = decodePixelsOnMainThread(image)
          result = await runWorkerConvert({ pixels, width, height, boost, lookControls, collectStats }, [pixels.buffer])
        }
      } else {
        const { pixels, width, height } = decodePixelsOnMainThread(image)
        result = await runWorkerConvert({ pixels, width, height, boost, lookControls, collectStats }, [pixels.buffer])
      }

      if (collectStats && result.stats) {
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
  }, [
    boost,
    cancelActivePreview,
    clearPreviewDebounce,
    decodePixelsOnMainThread,
    image,
    lookControls,
    markWorkerDecodeSupport,
    runWorkerConvert,
    shouldTryWorkerDecode,
  ])

  const previewPane = (
    <PreviewPane
      image={image}
      dragover={dragover}
      previewReady={previewReady}
      previewImageSrc={previewImageSrc}
      processing={processing}
      previewPending={previewPending}
      fileInputRef={fileInputRef}
      previewCanvasRef={previewCanvasRef}
      decodeCanvasRef={decodeCanvasRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onBrowse={handleBrowse}
      onFileSelect={handleFileSelect}
      imageName={image?.name}
      imageWidth={image?.width}
      imageHeight={image?.height}
      boost={boost}
      exposure={lookControls.exposure}
    />
  )

  return (
    <div
      class="prism-home"
      onDragOver={!image ? handleDragOver : undefined}
      onDragLeave={!image ? handleDragLeave : undefined}
      onDrop={!image ? handleDrop : undefined}
    >
      <PlasmaField />
      <div class="grain-overlay" aria-hidden="true" />

      <div class="prism-home__content">
        {image ? (
          <div class="preview-layout">
            {previewPane}
            <ConverterControls
              imageName={image.name}
              imageWidth={image.width}
              imageHeight={image.height}
              boost={boost}
              lookControls={lookControls}
              processing={processing}
              downloaded={downloaded}
              hdrPreviewEnabled={hdrPreviewEnabled}
              onSetBoost={setBoost}
              onSetLookControl={setLookControl}
              onReset={reset}
              onConvert={convert}
            />
          </div>
        ) : (
          <section class="hero">{previewPane}</section>
        )}

        {errorMessage && (
          <div class="error-banner" role="alert">
            <span class="error-banner__icon" aria-hidden="true">⚠</span>
            <span class="error-banner__message">{errorMessage}</span>
          </div>
        )}

        <RouteJsonLd
          data={{
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebApplication',
                name: 'Supernova',
                description: 'Convert any image to HDR PNG in your browser',
                url: `${SEO_BASE_URL}/`,
                mainEntityOfPage: `${SEO_BASE_URL}/`,
                applicationCategory: 'MultimediaApplication',
                operatingSystem: 'Any',
                browserRequirements: 'Modern browser with HDR display recommended',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              },
              {
                '@type': 'WebSite',
                name: 'Supernova',
                url: `${SEO_BASE_URL}/`,
              },
              {
                '@type': 'Organization',
                name: 'Supernova',
                url: `${SEO_BASE_URL}/`,
                logo: `${SEO_BASE_URL}/og-image.png`,
              },
            ],
          }}
        />
      </div>
    </div>
  )
}
