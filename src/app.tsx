import { Fragment } from 'preact'
import { useState, useRef, useCallback, useEffect } from 'preact/hooks'
import { LocationProvider, Router, Route, useLocation } from 'preact-iso'
import { useHead } from './lib/use-head'
import { BOOST_UI_MAX, BOOST_UI_MIN, boostToTargetNits } from './lib/hdr-boost'
import {
  DEFAULT_LOOK_CONTROLS,
  LOOK_CONTROL_RANGES,
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_MAX_LONG_EDGE_DEFAULT,
  type LookControls,
} from './lib/look-controls'
import type {
  WorkerConvertRequest,
  WorkerPreviewRequest,
  WorkerPreviewSuccessResponse,
  WorkerResponseMessage,
  WorkerSuccessResponse,
} from './lib/worker-protocol'

interface ImageState {
  src: string
  name: string
  width: number
  height: number
  file: File
  el: HTMLImageElement
}

function rangeBackground(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100
  return `linear-gradient(90deg, var(--accent) 0%, var(--accent-light) ${pct}%, var(--border) ${pct}%)`
}

function downloadButtonLabel(processing: boolean, downloaded: boolean): string {
  if (processing) return 'Converting...'
  if (downloaded) return 'Downloaded!'
  return 'Download HDR PNG'
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
    </svg>
  )
}

function pipelineStageClass(index: number, total: number): string {
  const classes = ['pipeline-stage']
  if (index === 0) classes.push('pipeline-stage--input')
  if (index === total - 1) classes.push('pipeline-stage--output')
  return classes.join(' ')
}

function PipelineFlow() {
  const stages = [
    { label: 'sRGB', sub: '8-bit' },
    { label: 'Linearize', sub: 'γ 2.4 decode' },
    { label: 'Boost', sub: 'HDR luminance' },
    { label: 'PQ Encode', sub: 'ST 2084' },
    { label: 'HDR PNG', sub: '16-bit' },
  ]
  return (
    <div class="pipeline-flow" role="img" aria-label="Conversion pipeline: sRGB 8-bit to Linearize to Boost to PQ Encode to HDR PNG 16-bit">
      {stages.map((s, i) => (
        <Fragment key={i}>
          <div class={pipelineStageClass(i, stages.length)}>
            <span class="pipeline-stage__label">{s.label}</span>
            <span class="pipeline-stage__sub">{s.sub}</span>
          </div>
          {i < stages.length - 1 && (
            <div class="pipeline-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14m0 0l-4-4m4 4l-4 4" />
              </svg>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}

function PQCurveSVG() {
  return (
    <svg class="pq-curve-svg" viewBox="0 0 300 240" role="img" aria-label="Chart comparing PQ and Gamma 2.2 transfer curves">
      <defs>
        <linearGradient id="pq-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--accent)" />
          <stop offset="100%" stop-color="var(--accent-light)" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      <line x1="50" y1="205" x2="280" y2="205" stroke="var(--border)" stroke-width="0.5" />
      <line x1="50" y1="157.5" x2="280" y2="157.5" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="110" x2="280" y2="110" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="62.5" x2="280" y2="62.5" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="15" x2="280" y2="15" stroke="var(--border)" stroke-width="0.5" />
      <line x1="50" y1="15" x2="50" y2="205" stroke="var(--border)" stroke-width="0.5" />
      <line x1="280" y1="15" x2="280" y2="205" stroke="var(--border)" stroke-width="0.5" />
      {/* Gamma 2.2 curve — dashed, muted */}
      <path
        d="M50.0,205.0L59.6,160.2L69.2,143.6L78.8,131.2L88.3,120.9L97.9,111.9L107.5,103.8L117.1,96.5L126.7,89.7L136.3,83.3L145.8,77.4L155.4,71.7L165.0,66.3L174.6,61.2L184.2,56.3L193.8,51.5L203.3,47.0L212.9,42.6L222.5,38.3L232.1,34.1L241.7,30.1L251.3,26.2L260.8,22.4L270.4,18.6L280.0,15.0"
        fill="none" stroke="var(--text-muted)" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.6"
      />
      {/* PQ curve — solid, accent gradient */}
      <path
        d="M50.0,205.0L57.7,84.7L65.3,70.5L73.0,62.2L80.7,56.2L88.3,51.6L96.0,47.8L103.7,44.6L111.3,41.8L119.0,39.4L126.7,37.3L134.3,35.3L142.0,33.5L149.7,31.9L157.3,30.4L165.0,29.0L172.7,27.6L180.3,26.4L188.0,25.3L195.7,24.2L203.3,23.1L211.0,22.1L218.7,21.2L226.3,20.3L234.0,19.5L241.7,18.6L249.3,17.9L257.0,17.1L264.7,16.4L272.3,15.7L280.0,15.0"
        fill="none" stroke="url(#pq-grad)" stroke-width="2.5" stroke-linecap="round"
      />
      {/* Curve labels */}
      <text x="230" y="46" fill="var(--text-muted)" font-size="10" font-family="var(--font-body)" opacity="0.7">γ 2.2</text>
      <text x="170" y="22" fill="var(--accent)" font-size="10" font-family="var(--font-body)" font-weight="600">PQ</text>
      {/* Axis labels */}
      <text x="165" y="225" fill="var(--text-muted)" font-size="9" font-family="var(--font-body)" text-anchor="middle" opacity="0.6">Linear light</text>
      <text x="22" y="115" fill="var(--text-muted)" font-size="9" font-family="var(--font-body)" text-anchor="middle" transform="rotate(-90,22,115)" opacity="0.6">Encoded signal</text>
      {/* Axis tick labels */}
      <text x="50" y="217" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.5">0</text>
      <text x="280" y="217" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.5">1</text>
      <text x="44" y="208" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="end" opacity="0.5">0</text>
      <text x="44" y="18" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="end" opacity="0.5">1</text>
    </svg>
  )
}

function NitsScale() {
  const levels = [
    { nits: 100,   pct: '1%',   label: 'SDR white',    accent: false },
    { nits: 203,   pct: '2%',   label: 'HDR ref white', accent: true },
    { nits: 1000,  pct: '10%',  label: 'HDR highlight', accent: true },
    { nits: 10000, pct: '100%', label: 'PQ maximum',    accent: true },
  ]
  return (
    <div class="nits-scale" role="img" aria-label="Luminance scale showing SDR range (0-100 nits) versus HDR range (up to 10,000 nits)">
      {levels.map((l) => (
        <div class={`nits-row${l.accent ? ' nits-row--accent' : ''}`}>
          <span class="nits-row-val">{l.nits.toLocaleString()}</span>
          <div class="nits-row-track">
            <div class="nits-row-fill" style={{ width: l.pct }} />
          </div>
          <span class="nits-row-label">{l.label}</span>
        </div>
      ))}
    </div>
  )
}

function GamutSVG() {
  return (
    <svg class="gamut-svg" viewBox="0 0 260 240" role="img" aria-label="CIE 1931 chromaticity diagram showing sRGB and BT.2020 color gamuts">
      <defs>
        <linearGradient id="gamut-fill" x1="0" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.03" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.08" />
        </linearGradient>
      </defs>
      {/* Horseshoe outline */}
      <path
        d="M68.1,218.8L67.8,218.8L67.8,217.7L67.0,216.0L64.0,213.7L59.6,209.3L54.1,200.9L50.0,189.2L45.0,180.6L38.7,165.6L32.4,151.2L26.3,136.2L22.2,122.0L21.1,108.0L23.3,94.0L27.4,83.0L38.2,69.0L50.3,56.7L65.7,45.9L82.7,38.0L103.3,31.5L122.3,29.8L142.1,33.1L162.7,39.2L181.1,47.6L196.0,56.7L209.2,67.4L218.0,77.2L222.1,87.0L222.1,96.3L221.8,103.3L221.8,112.7L222.1,123.2L68.1,218.8"
        fill="none" stroke="var(--border)" stroke-width="1" opacity="0.5"
      />
      {/* BT.2020 triangle */}
      <path
        d="M214.7,151.9L66.8,34.0L56.0,209.3Z"
        fill="url(#gamut-fill)" stroke="var(--accent)" stroke-width="1.5" opacity="0.9"
      />
      {/* sRGB triangle */}
      <path
        d="M196.0,143.0L102.5,80.0L61.2,206.0Z"
        fill="none" stroke="var(--text-muted)" stroke-width="1.2" stroke-dasharray="5,4" opacity="0.5"
      />
      {/* Labels */}
      <text x="220" y="148" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">R</text>
      <text x="56" y="29" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">G</text>
      <text x="42" y="218" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">B</text>
      {/* Gamut labels */}
      <text x="155" y="170" fill="var(--accent)" font-size="10" font-family="var(--font-body)" font-weight="500" opacity="0.85">BT.2020</text>
      <text x="115" y="152" fill="var(--text-muted)" font-size="10" font-family="var(--font-body)" opacity="0.6">sRGB</text>
      {/* Axis labels */}
      <text x="130" y="237" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.4">x</text>
      <text x="10" y="120" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" transform="rotate(-90,10,120)" opacity="0.4">y</text>
    </svg>
  )
}

const STATUS_ICON_PATHS: Record<string, string> = {
  full: 'M20 6L9 17l-5-5',
  partial: 'M5 12h14',
  none: 'M18 6L6 18M6 6l12 12',
}

function StatusIcon({ status }: { status: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d={STATUS_ICON_PATHS[status]} />
    </svg>
  )
}

function BrowserCompat() {
  const browsers = [
    { name: 'Chrome', engine: 'cICP', status: 'full' as const, note: 'Full HDR rendering' },
    { name: 'Edge', engine: 'cICP', status: 'full' as const, note: 'Full HDR rendering' },
    { name: 'Safari', engine: 'ICC / EDR', status: 'partial' as const, note: 'macOS only' },
    { name: 'Firefox', engine: '—', status: 'none' as const, note: 'No extended brightness' },
  ]
  return (
    <div class="compat-grid" role="list" aria-label="Browser HDR support">
      {browsers.map((b) => (
        <div class={`compat-card compat-card--${b.status}`} role="listitem" key={b.name}>
          <div class="compat-card__status" aria-hidden="true">
            <StatusIcon status={b.status} />
          </div>
          <span class="compat-card__name">{b.name}</span>
          <span class="compat-card__engine">{b.engine}</span>
          <span class="compat-card__note">{b.note}</span>
        </div>
      ))}
    </div>
  )
}

function useReveal() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('will-reveal')
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.unobserve(el)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref }
}

interface RevealSectionProps {
  children: preact.ComponentChildren
  className?: string
}

function RevealSection({ children, className = '' }: RevealSectionProps) {
  const { ref } = useReveal()
  return (
    <section ref={ref} class={className}>
      {children}
    </section>
  )
}

function HowItWorks() {
  useHead(
    'How HDR PNG Conversion Works | Supernova',
    'Learn how this HDR PNG converter uses live SDR preview, look controls, PQ transfer, Rec.2020 color, and cICP/cHRM/iCCP metadata to produce HDR-ready PNG files.',
    '/how-it-works'
  )
  return (
    <div class="how-it-works">
      <a class="how-back-link" href="/supernova-image/">
        <ArrowLeftIcon />
        Back to HDR PNG Converter
      </a>

      {/* Overview — hero-style, no card */}
      <section class="how-hero">
        <h1>How HDR PNG Conversion Works</h1>
        <p>Supernova converts standard images into HDR PNGs that glow on HDR displays. You get a fast live SDR before/after preview while editing, then the final download is encoded with full HDR PQ brightness and metadata.</p>
      </section>

      {/* Pipeline — full-width flow diagram */}
      <RevealSection className="how-section how-section--flush">
        <h2>The Pipeline</h2>
        <PipelineFlow />
        <div class="pipeline-steps">
          <div class="pipeline-step-text"><strong>1.</strong> Decode your image into raw 8-bit RGBA pixels via Canvas</div>
          <div class="pipeline-step-text"><strong>2.</strong> Live preview path: run a fast SDR approximation on a downscaled copy for responsive before/after updates</div>
          <div class="pipeline-step-text"><strong>3.</strong> Export path: apply look controls in linear light, remap boost to HDR luminance, then PQ-encode to 16-bit BT.2020</div>
          <div class="pipeline-step-text"><strong>4.</strong> Wrap in a PNG with HDR metadata chunks (cICP, cHRM, iCCP)</div>
        </div>
      </RevealSection>

      {/* Controls — compact */}
      <RevealSection className="how-section">
        <h2>The Controls</h2>
        <ul class="how-meta-list">
          <li><strong>Boost</strong> — HDR export brightness control. 1.0≈100 nits, 4.0≈1600 nits, 10≈10000 nits in the final PNG.</li>
          <li><strong>Saturation</strong> — primary color intensity control shown in the main panel for quick edits.</li>
          <li><strong>Advanced</strong> — Gamma, Contrast, Highlight Roll-off, Shadow Lift, and Vibrance for finer grading.</li>
          <li><strong>Preview behavior</strong> — preview is SDR approximation for speed; it does not display final HDR luminance boost exactly.</li>
        </ul>
      </RevealSection>

      {/* PQ — side-by-side with curve + nits bar */}
      <RevealSection className="how-section how-section--visual">
        <div class="how-split">
          <div class="how-split__text">
            <h2>What is PQ?</h2>
            <p>PQ (Perceptual Quantizer) is the transfer function behind HDR10 and Dolby Vision. Unlike gamma (~2.2) which tops out at 100 nits, PQ maps luminance up to 10,000 nits.</p>
            <p>Its curve allocates more precision to dim regions where our eyes are most sensitive — far more efficient than gamma for HDR's wide brightness range.</p>
          </div>
          <div class="how-split__visual">
            <PQCurveSVG />
          </div>
        </div>
        <NitsScale />
      </RevealSection>

      {/* Metadata — side-by-side with gamut diagram */}
      <RevealSection className="how-section how-section--visual">
        <div class="how-split how-split--reverse">
          <div class="how-split__text">
            <h2>The Metadata</h2>
            <p>A valid HDR PNG needs metadata so the display knows how to interpret the pixels:</p>
            <ul class="how-meta-list">
              <li><strong>cICP</strong> — declares BT.2020 primaries + PQ transfer. The primary HDR signal.</li>
              <li><strong>cHRM</strong> — BT.2020 chromaticity coordinates as fallback.</li>
              <li><strong>iCCP</strong> — embedded ICC profile for broadest compatibility. Triggers EDR on macOS.</li>
            </ul>
          </div>
          <div class="how-split__visual">
            <GamutSVG />
          </div>
        </div>
      </RevealSection>

      {/* Compatibility — full-width with browser grid */}
      <RevealSection className="how-section">
        <h2>Compatibility</h2>
        <p>Requires an HDR display and a supported browser. On SDR displays, the image renders as a normal PNG.</p>
        <BrowserCompat />
      </RevealSection>

      {/* Privacy */}
      <RevealSection className="how-section">
        <h2>Privacy</h2>
        <p>100% client-side. No uploads, no server, no analytics. Your images never leave your device.</p>
      </RevealSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "What is PQ (Perceptual Quantizer)?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "PQ is the transfer function behind HDR10 and Dolby Vision. Unlike gamma (~2.2) which tops out at 100 nits, PQ maps luminance up to 10,000 nits. Its curve allocates more precision to dim regions where our eyes are most sensitive."
            }
          },
          {
            "@type": "Question",
            "name": "What browsers support HDR PNG?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Chrome and Edge render HDR PNGs via cICP. Safari on macOS uses the ICC profile for EDR. Firefox doesn't yet support extended brightness. On SDR displays, the image renders as a normal PNG."
            }
          },
          {
            "@type": "Question",
            "name": "Why does preview brightness differ from the final HDR download?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "The editor preview is a fast SDR approximation for responsive slider updates. The downloaded PNG uses the full HDR pipeline with PQ brightness and Rec.2020 metadata, so highlights can be much brighter on HDR displays."
            }
          },
          {
            "@type": "Question",
            "name": "Is my image uploaded to a server?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "No. Supernova is 100% client-side. No uploads, no server, no analytics. Your images never leave your device."
            }
          }
        ]
      }) }} />
    </div>
  )
}

function Home() {
  useHead(
    'HDR PNG Converter: Convert Images to HDR PNG | Supernova',
    'Convert image files to HDR PNG in your browser with PQ (ST 2084) and Rec.2020 metadata. Upload PNG, JPEG, WebP, or AVIF and download instantly.',
    '/'
  )
  const [image, setImage] = useState<ImageState | null>(null)
  const [boost, setBoost] = useState(5)
  const [lookControls, setLookControls] = useState<LookControls>(DEFAULT_LOOK_CONTROLS)
  const [processing, setProcessing] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [dragover, setDragover] = useState(false)
  const [previewPending, setPreviewPending] = useState(false)
  const [previewReady, setPreviewReady] = useState(false)
  const decodeCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewDebounceTimerRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const nextRequestIdRef = useRef(1)
  const activeConvertRequestIdRef = useRef<number | null>(null)
  const activePreviewRequestIdRef = useRef<number | null>(null)
  const workerDecodeSupportRef = useRef<boolean | null>(null)
  const pendingRef = useRef(new Map<number, {
    kind: 'convert' | 'preview'
    resolve: (value: WorkerSuccessResponse | WorkerPreviewSuccessResponse) => void
    reject: (error: Error) => void
  }>())

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
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setPreviewReady(false)
  }, [])

  const cancelPendingById = useCallback((id: number, reason: string) => {
    const pending = pendingRef.current.get(id)
    if (!pending) return
    pendingRef.current.delete(id)
    pending.reject(new Error(reason))
  }, [])

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current
    const worker = new Worker(new URL('./lib/worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
      const message = e.data
      if (!message) return
      const pending = pendingRef.current.get(message.id)
      if (!pending) return
      pendingRef.current.delete(message.id)

      if (pending.kind === 'convert' && activeConvertRequestIdRef.current === message.id) {
        activeConvertRequestIdRef.current = null
      }
      if (pending.kind === 'preview' && activePreviewRequestIdRef.current === message.id) {
        activePreviewRequestIdRef.current = null
      }

      if (pending.kind === 'convert' && message.type !== 'result') {
        pending.reject(new Error('Worker responded with mismatched message type for convert request'))
        return
      }
      if (pending.kind === 'preview' && message.type !== 'preview-result') {
        pending.reject(new Error('Worker responded with mismatched message type for preview request'))
        return
      }

      if (message.ok) {
        pending.resolve(message as WorkerSuccessResponse | WorkerPreviewSuccessResponse)
        return
      }

      const err = new Error(message.error) as Error & { code?: string }
      err.code = message.code
      pending.reject(err)
    }
    worker.onerror = () => {
      for (const [id, pending] of pendingRef.current.entries()) {
        pending.reject(new Error(`Worker failed while processing request ${id}`))
      }
      pendingRef.current.clear()
      activeConvertRequestIdRef.current = null
      activePreviewRequestIdRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
    }
    workerRef.current = worker
    return worker
  }, [cancelPendingById])

  const cancelActivePreview = useCallback(() => {
    const activeId = activePreviewRequestIdRef.current
    const worker = workerRef.current
    if (activeId === null || !worker) return
    worker.postMessage({ type: 'cancel', id: activeId })
    cancelPendingById(activeId, 'Preview request cancelled')
    activePreviewRequestIdRef.current = null
  }, [cancelPendingById])

  useEffect(() => {
    return () => {
      clearPreviewDebounce()
      workerRef.current?.terminate()
      workerRef.current = null
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error('Worker closed before conversion completed'))
      }
      pendingRef.current.clear()
      activeConvertRequestIdRef.current = null
      activePreviewRequestIdRef.current = null
    }
  }, [clearPreviewDebounce])

  const loadImage = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return
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
  }, [cancelActivePreview, clearPreviewCanvas, clearPreviewDebounce, image])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragover(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) loadImage(file)
  }, [loadImage])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragover(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragover(false)
  }, [])

  const handleFileSelect = useCallback((e: Event) => {
    const file = (e.target as HTMLInputElement)?.files?.[0]
    if (file) loadImage(file)
  }, [loadImage])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const reset = useCallback(() => {
    if (image?.src) URL.revokeObjectURL(image.src)
    cancelActivePreview()
    clearPreviewDebounce()
    setPreviewPending(false)
    clearPreviewCanvas()
    setImage(null)
  }, [cancelActivePreview, clearPreviewCanvas, clearPreviewDebounce, image])

  const decodePixelsOnMainThread = useCallback((img: ImageState): {
    pixels: Uint8ClampedArray
    width: number
    height: number
  } => {
    const canvas = decodeCanvasRef.current
    if (!canvas) throw new Error('Canvas is unavailable for decode fallback')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Failed to acquire 2D context')
    ctx.drawImage(img.el, 0, 0)
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    return { pixels: imageData.data, width: img.width, height: img.height }
  }, [])

  const setLookControl = useCallback((key: keyof LookControls, value: number) => {
    setLookControls((prev) => ({ ...prev, [key]: value }))
  }, [])

  const runWorkerConvert = useCallback((
    payload: Omit<WorkerConvertRequest, 'type' | 'id'>,
    transfer: Transferable[] = [],
  ): Promise<WorkerSuccessResponse> => {
    const worker = getWorker()
    const id = nextRequestIdRef.current++
    const priorActiveId = activeConvertRequestIdRef.current
    if (priorActiveId !== null) {
      worker.postMessage({ type: 'cancel', id: priorActiveId })
      cancelPendingById(priorActiveId, 'Previous convert request cancelled')
    }
    activeConvertRequestIdRef.current = id

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, {
        kind: 'convert',
        resolve: resolve as (value: WorkerSuccessResponse | WorkerPreviewSuccessResponse) => void,
        reject,
      })
      worker.postMessage({ type: 'convert', id, ...payload }, transfer)
    })
  }, [cancelPendingById, getWorker])

  const runWorkerPreview = useCallback((
    payload: Omit<WorkerPreviewRequest, 'type' | 'id'>,
    transfer: Transferable[] = [],
  ): Promise<WorkerPreviewSuccessResponse> => {
    const worker = getWorker()
    const id = nextRequestIdRef.current++
    const priorActiveId = activePreviewRequestIdRef.current
    if (priorActiveId !== null) {
      worker.postMessage({ type: 'cancel', id: priorActiveId })
      cancelPendingById(priorActiveId, 'Previous preview request cancelled')
    }
    activePreviewRequestIdRef.current = id

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, {
        kind: 'preview',
        resolve: resolve as (value: WorkerSuccessResponse | WorkerPreviewSuccessResponse) => void,
        reject,
      })
      worker.postMessage({ type: 'preview', id, ...payload }, transfer)
    })
  }, [cancelPendingById, getWorker])

  const drawPreview = useCallback((result: WorkerPreviewSuccessResponse) => {
    const canvas = previewCanvasRef.current
    if (!canvas) return
    canvas.width = result.width
    canvas.height = result.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0)
    setPreviewReady(true)
  }, [])

  const requestPreview = useCallback(async (img: ImageState) => {
    setPreviewPending(true)

    try {
      let result: WorkerPreviewSuccessResponse
      const shouldTryWorkerDecode = img.file && workerDecodeSupportRef.current !== false

      if (shouldTryWorkerDecode) {
        try {
          result = await runWorkerPreview({
            file: img.file,
            boost: BOOST_UI_MIN,
            lookControls,
            previewMaxLongEdge: PREVIEW_MAX_LONG_EDGE_DEFAULT,
          })
          workerDecodeSupportRef.current = true
        } catch (err) {
          const code = (err as Error & { code?: string }).code
          if (code !== 'DECODE_UNSUPPORTED') throw err
          workerDecodeSupportRef.current = false
          const { pixels, width, height } = decodePixelsOnMainThread(img)
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
        const { pixels, width, height } = decodePixelsOnMainThread(img)
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
      const message = (error as Error).message.toLowerCase()
      if (!message.includes('cancelled')) {
        console.error(error)
      }
    } finally {
      setPreviewPending(false)
    }
  }, [decodePixelsOnMainThread, drawPreview, lookControls, runWorkerPreview])

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
    cancelActivePreview()
    clearPreviewDebounce()

    try {
      const collectStats = import.meta.env.DEV
      let result: WorkerSuccessResponse

      const shouldTryWorkerDecode = image.file && workerDecodeSupportRef.current !== false
      if (shouldTryWorkerDecode) {
        try {
          result = await runWorkerConvert({
            file: image.file,
            boost,
            lookControls,
            collectStats,
          })
          workerDecodeSupportRef.current = true
        } catch (err) {
          const code = (err as Error & { code?: string }).code
          if (code !== 'DECODE_UNSUPPORTED') throw err
          workerDecodeSupportRef.current = false
          const { pixels, width, height } = decodePixelsOnMainThread(image)
          result = await runWorkerConvert(
            { pixels, width, height, boost, lookControls, collectStats },
            [pixels.buffer],
          )
        }
      } else {
        const { pixels, width, height } = decodePixelsOnMainThread(image)
        result = await runWorkerConvert(
          { pixels, width, height, boost, lookControls, collectStats },
          [pixels.buffer],
        )
      }

      const pngData = result.pngData
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

      const blob = new Blob([pngData], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stem = image.name.replace(/\.[^.]+$/, '')
      a.href = url
      a.download = `${stem}-hdr.png`
      a.click()
      URL.revokeObjectURL(url)
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 2500)
    } catch (error) {
      console.error(error)
    } finally {
      setProcessing(false)
    }
  }, [boost, cancelActivePreview, clearPreviewDebounce, decodePixelsOnMainThread, image, lookControls, runWorkerConvert])

  return (
    <>
      {!image ? (
        <div
          class={`drop-zone ${dragover ? 'dragover' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload an image"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
          onKeyDown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick()
            }
          }}
        >
          <div class="drop-zone__prompt">
            <svg viewBox="0 0 48 48" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M24 32V16m0 0l-8 8m8-8l8 8" />
              <rect x="6" y="6" width="36" height="36" rx="4" />
            </svg>
            <span>Drop an image or <span class="accent">browse</span></span>
            <span class="drop-zone__hint">PNG, JPEG, WebP, AVIF</span>
          </div>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} />
        </div>
      ) : (
        <div class="preview-wrapper">
          <div class="preview-container">
            <div class="preview-compare" style={{ '--img-ratio': `${image.width} / ${image.height}` } as any}>
              <figure class="preview-panel">
                <figcaption class="preview-panel__label">Before</figcaption>
                <img src={image.src} alt="Original preview" />
              </figure>
              <figure class="preview-panel">
                <figcaption class="preview-panel__label">After</figcaption>
                <div class="preview-output">
                  <canvas ref={previewCanvasRef} class="preview-output-canvas" />
                  {!previewReady && (
                    <div class="preview-placeholder">
                      Adjust controls to render preview
                    </div>
                  )}
                </div>
              </figure>
            </div>
            <canvas ref={decodeCanvasRef} class="preview-decode-canvas" />
            {(processing || previewPending) && (
              <div class="processing-overlay">
                <div class="scan-bar" />
                <span class="processing-text">{processing ? 'Converting' : 'Updating Preview'}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {image && (
        <>
          <div class="controls">
            <div class="control-group">
              <label htmlFor="boost-range">Boost</label>
              <input
                id="boost-range"
                type="range"
                min={BOOST_UI_MIN}
                max={BOOST_UI_MAX}
                step="0.5"
                value={boost}
                onInput={(e) => setBoost(Number((e.target as HTMLInputElement).value))}
                style={{ background: rangeBackground(boost, BOOST_UI_MIN, BOOST_UI_MAX) }}
              />
              <span class="value">{boost.toFixed(1)} · ~{Math.round(boostToTargetNits(boost)).toLocaleString()} nits</span>
            </div>
            <div class="control-group">
              <label htmlFor="saturation-range">Saturation</label>
              <input
                id="saturation-range"
                type="range"
                min={LOOK_CONTROL_RANGES.saturation.min}
                max={LOOK_CONTROL_RANGES.saturation.max}
                step={LOOK_CONTROL_RANGES.saturation.step}
                value={lookControls.saturation}
                onInput={(e) => setLookControl('saturation', Number((e.target as HTMLInputElement).value))}
                style={{ background: rangeBackground(lookControls.saturation, LOOK_CONTROL_RANGES.saturation.min, LOOK_CONTROL_RANGES.saturation.max) }}
              />
              <span class="value">{lookControls.saturation.toFixed(2)}</span>
            </div>
          </div>
          <div class="preview-note">Preview is SDR approximation. Boost affects final HDR export.</div>

          <details class="advanced-controls">
            <summary>Advanced</summary>
            <div class="advanced-controls__grid">
              <div class="control-group">
                <label htmlFor="gamma-range">Gamma</label>
                <input
                  id="gamma-range"
                  type="range"
                  min={LOOK_CONTROL_RANGES.gamma.min}
                  max={LOOK_CONTROL_RANGES.gamma.max}
                  step={LOOK_CONTROL_RANGES.gamma.step}
                  value={lookControls.gamma}
                  onInput={(e) => setLookControl('gamma', Number((e.target as HTMLInputElement).value))}
                  style={{ background: rangeBackground(lookControls.gamma, LOOK_CONTROL_RANGES.gamma.min, LOOK_CONTROL_RANGES.gamma.max) }}
                />
                <span class="value">{lookControls.gamma.toFixed(1)}</span>
              </div>
              <div class="control-group">
                <label htmlFor="contrast-range">Contrast</label>
                <input
                  id="contrast-range"
                  type="range"
                  min={LOOK_CONTROL_RANGES.contrast.min}
                  max={LOOK_CONTROL_RANGES.contrast.max}
                  step={LOOK_CONTROL_RANGES.contrast.step}
                  value={lookControls.contrast}
                  onInput={(e) => setLookControl('contrast', Number((e.target as HTMLInputElement).value))}
                  style={{ background: rangeBackground(lookControls.contrast, LOOK_CONTROL_RANGES.contrast.min, LOOK_CONTROL_RANGES.contrast.max) }}
                />
                <span class="value">{lookControls.contrast.toFixed(2)}</span>
              </div>
              <div class="control-group">
                <label htmlFor="rolloff-range">Highlight Roll-off</label>
                <input
                  id="rolloff-range"
                  type="range"
                  min={LOOK_CONTROL_RANGES.highlightRollOff.min}
                  max={LOOK_CONTROL_RANGES.highlightRollOff.max}
                  step={LOOK_CONTROL_RANGES.highlightRollOff.step}
                  value={lookControls.highlightRollOff}
                  onInput={(e) => setLookControl('highlightRollOff', Number((e.target as HTMLInputElement).value))}
                  style={{ background: rangeBackground(lookControls.highlightRollOff, LOOK_CONTROL_RANGES.highlightRollOff.min, LOOK_CONTROL_RANGES.highlightRollOff.max) }}
                />
                <span class="value">{lookControls.highlightRollOff.toFixed(2)}</span>
              </div>
              <div class="control-group">
                <label htmlFor="shadow-range">Shadow Lift</label>
                <input
                  id="shadow-range"
                  type="range"
                  min={LOOK_CONTROL_RANGES.shadowLift.min}
                  max={LOOK_CONTROL_RANGES.shadowLift.max}
                  step={LOOK_CONTROL_RANGES.shadowLift.step}
                  value={lookControls.shadowLift}
                  onInput={(e) => setLookControl('shadowLift', Number((e.target as HTMLInputElement).value))}
                  style={{ background: rangeBackground(lookControls.shadowLift, LOOK_CONTROL_RANGES.shadowLift.min, LOOK_CONTROL_RANGES.shadowLift.max) }}
                />
                <span class="value">{lookControls.shadowLift.toFixed(2)}</span>
              </div>
              <div class="control-group">
                <label htmlFor="vibrance-range">Vibrance</label>
                <input
                  id="vibrance-range"
                  type="range"
                  min={LOOK_CONTROL_RANGES.vibrance.min}
                  max={LOOK_CONTROL_RANGES.vibrance.max}
                  step={LOOK_CONTROL_RANGES.vibrance.step}
                  value={lookControls.vibrance}
                  onInput={(e) => setLookControl('vibrance', Number((e.target as HTMLInputElement).value))}
                  style={{ background: rangeBackground(lookControls.vibrance, LOOK_CONTROL_RANGES.vibrance.min, LOOK_CONTROL_RANGES.vibrance.max) }}
                />
                <span class="value">{lookControls.vibrance.toFixed(2)}</span>
              </div>
            </div>
          </details>

          <div class="btn-row">
            <button class="btn btn-secondary" onClick={reset}>
              New image
            </button>
            <button
              class={`btn btn-download${downloaded ? ' btn-download--success' : ''}`}
              onClick={convert}
              disabled={processing}
            >
              {downloadButtonLabel(processing, downloaded)}
            </button>
          </div>

          <div class="filename">
            {image.name} &middot; {image.width}&times;{image.height}
          </div>
        </>
      )}

      <section class="seo-copy" aria-labelledby="converter-overview-title">
        <h2 id="converter-overview-title">Convert Images To HDR PNG With PQ (ST 2084)</h2>
        <p>Supernova is a browser-based HDR PNG converter built for fast local conversion. Drop a PNG, JPEG, WebP, or AVIF image and export an HDR PNG without uploading anything.</p>
        <p>The output includes PQ transfer and Rec.2020 metadata (cICP, cHRM, iCCP) so highlights can render with extended brightness on supported HDR displays and browsers.</p>
      </section>

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

function NotFound() {
  useHead(
    'Page Not Found | Supernova HDR PNG Converter',
    'This page could not be found. Return to the Supernova HDR PNG converter.',
    '/404',
    { robots: 'noindex,nofollow' }
  )

  return (
    <div class="not-found">
      <div class="not-found__star" aria-hidden="true" />
      <h1>Signal Lost</h1>
      <p>This page drifted beyond the visible spectrum.</p>
      <a class="not-found__link" href="/supernova-image/">
        <ArrowLeftIcon />
        Go to HDR PNG Converter
      </a>
    </div>
  )
}

function Header() {
  const { path } = useLocation()
  const isHome = path === '/' || path === '/supernova-image' || path === '/supernova-image/'
  return (
    <div class="header">
      {isHome ? <h1>HDR PNG Converter</h1> : <div class="header__brand">Supernova</div>}
      <p>Convert any image to <span class="accent">HDR PNG</span> — runs entirely in your browser</p>
      {isHome && <a class="how-link" href="/supernova-image/how-it-works">How it works</a>}
    </div>
  )
}

export function App({ url }: { url?: string }) {
  return (
    <LocationProvider url={url}>
      <Header />
      <Router>
        <Route path="/supernova-image/" component={Home} />
        <Route path="/supernova-image/how-it-works" component={HowItWorks} />
        <Route path="/supernova-image/404" component={NotFound} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  )
}
