import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { DEFAULT_LOOK_CONTROLS, PREVIEW_DEBOUNCE_MS, PREVIEW_MAX_LONG_EDGE_DEFAULT, type LookControls } from '../lib/look-controls'
import type { WorkerPreviewSuccessResponse, WorkerSuccessResponse } from '../lib/worker-protocol'
import { BOOST_UI_MIN } from '../lib/hdr-boost'
import { getWorkerErrorCode, getWorkerErrorMessage, useConverterWorker } from '../hooks/use-converter-worker'
import { ConverterControls } from '../components/converter-controls'
import { PreviewPane } from '../components/preview-pane'
import { SEO_BASE_URL } from '../lib/seo-routes'
import { GuideLinksInline, HOME_ROUTE, RouteJsonLd, useSeoRouteHead } from './shared'

interface ImageState {
  src: string
  name: string
  width: number
  height: number
  file: File
  el: HTMLImageElement
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const decodeCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewDebounceTimerRef = useRef<number | null>(null)
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

  const clearPreviewCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current
    if (!canvas) {
      setPreviewReady(false)
      return
    }

    const context = canvas.getContext('2d')
    if (context) context.clearRect(0, 0, canvas.width, canvas.height)
    setPreviewReady(false)
  }, [])

  useEffect(() => {
    return () => {
      clearPreviewDebounce()
      teardownWorker()
    }
  }, [clearPreviewDebounce, teardownWorker])

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

  const drawPreview = useCallback((result: WorkerPreviewSuccessResponse) => {
    const canvas = previewCanvasRef.current
    if (!canvas) return

    canvas.width = result.width
    canvas.height = result.height

    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    context.putImageData(new ImageData(new Uint8ClampedArray(result.pixels), result.width, result.height), 0, 0)
    setPreviewReady(true)
  }, [])

  const requestPreview = useCallback(
    async (currentImage: ImageState) => {
      setPreviewPending(true)
      setErrorMessage(null)

      try {
        let result: WorkerPreviewSuccessResponse

        if (shouldTryWorkerDecode(Boolean(currentImage.file))) {
          try {
            result = await runWorkerPreview({
              file: currentImage.file,
              boost: BOOST_UI_MIN,
              lookControls,
              previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
            })
            markWorkerDecodeSupport(true)
          } catch {
            // Worker-side decode can fail even when browser decode works (headless/driver quirks).
            // Always fall back to main-thread canvas decode before surfacing the error.
            markWorkerDecodeSupport(false)
            const { pixels, width, height } = decodePixelsOnMainThread(currentImage)
            result = await runWorkerPreview(
              {
                pixels,
                width,
                height,
                boost: BOOST_UI_MIN,
                lookControls,
                previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
              },
              [pixels.buffer],
            )
          }
        } else {
          const { pixels, width, height } = decodePixelsOnMainThread(currentImage)
          result = await runWorkerPreview(
            {
              pixels,
              width,
              height,
              boost: BOOST_UI_MIN,
              lookControls,
              previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
            },
            [pixels.buffer],
          )
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
    [decodePixelsOnMainThread, drawPreview, lookControls, markWorkerDecodeSupport, runWorkerPreview, shouldTryWorkerDecode],
  )

  const loadImage = useCallback(
    (file: File) => {
      if (!file || !file.type.startsWith('image/')) return

      setErrorMessage(null)
      cancelActivePreview()
      clearPreviewDebounce()
      setPreviewPending(false)
      clearPreviewCanvas()

      if (image?.src) URL.revokeObjectURL(image.src)

      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        setImage({ src: url, name: file.name, width: img.width, height: img.height, file, el: img })
      }
      img.src = url
    },
    [cancelActivePreview, clearPreviewCanvas, clearPreviewDebounce, image],
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
    clearPreviewCanvas()
    setErrorMessage(null)
    setImage(null)
  }, [cancelActivePreview, clearPreviewCanvas, clearPreviewDebounce, image])

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

      const blob = new Blob([new Uint8Array(result.pngData)], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const stem = image.name.replace(/\.[^.]+$/, '')
      anchor.href = url
      anchor.download = `${stem}-hdr.png`
      anchor.click()
      URL.revokeObjectURL(url)

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

  return (
    <>
      <PreviewPane
        image={image}
        dragover={dragover}
        previewReady={previewReady}
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
      />

      {image && (
        <ConverterControls
          imageName={image.name}
          imageWidth={image.width}
          imageHeight={image.height}
          boost={boost}
          lookControls={lookControls}
          processing={processing}
          downloaded={downloaded}
          onSetBoost={setBoost}
          onSetLookControl={setLookControl}
          onReset={reset}
          onConvert={convert}
        />
      )}

      {errorMessage && (
        <div class="error-banner" role="status">
          {errorMessage}
        </div>
      )}

      <section class="seo-copy" aria-labelledby="converter-overview-title">
        <h2 id="converter-overview-title">Convert Images To HDR PNG With PQ (ST 2084)</h2>
        <p>
          Supernova is a browser-based HDR PNG converter built for fast local conversion. Drop a PNG, JPEG, WebP, or AVIF image and export
          an HDR PNG without uploading anything.
        </p>
        <p>
          The output includes PQ transfer and Rec.2020 metadata (cICP, cHRM, iCCP) so highlights can render with extended brightness on
          supported HDR displays and browsers.
        </p>
        <p>
          Popular guides: <GuideLinksInline />
        </p>
      </section>

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

      <footer class="trust-badge">
        <span class="trust-badge__item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
          </svg>
          100% client-side
        </span>
        <span class="trust-badge__divider" aria-hidden="true" />
        <span class="trust-badge__item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <path d="M7 10l5-5 5 5" />
            <path d="M12 5v10" />
            <line x1="4" y1="4" x2="20" y2="20" stroke-width="2" />
          </svg>
          No uploads
        </span>
        <span class="trust-badge__divider" aria-hidden="true" />
        <span class="trust-badge__item">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Images never leave your device
        </span>
      </footer>
    </>
  )
}
