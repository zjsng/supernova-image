import { useState, useRef, useCallback } from 'preact/hooks'
import { LocationProvider, Router, Route } from 'preact-iso'
import { processPixels } from './lib/pq'
import { encodePNG } from './lib/encode-png'

interface ImageState {
  src: string
  name: string
  width: number
  height: number
  el: HTMLImageElement
}

function rangeBackground(value: number, min: number, max: number): string {
  const pct = ((value - min) / (max - min)) * 100
  return `linear-gradient(90deg, var(--accent) 0%, var(--accent-light) ${pct}%, var(--border) ${pct}%)`
}

function HowItWorks() {
  return (
    <div class="how-it-works">
      <a class="how-back-link" href="/supernova-image/">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5m0 0l7 7m-7-7l7-7" />
        </svg>
        Back
      </a>

      <section class="how-section">
        <h2>Overview</h2>
        <p>Supernova converts standard images into HDR PNGs that glow on HDR displays.</p>
        <p>It runs entirely in your browser — your images are never uploaded anywhere.</p>
      </section>

      <section class="how-section">
        <h2>The Pipeline</h2>
        <div class="how-steps">
          <div class="how-step">
            <span class="how-step-num">1</span>
            <div>
              <h3>Decode</h3>
              <p>Your image is loaded into an HTML canvas element. The browser decodes it into raw pixel data — 8-bit RGBA values (red, green, blue, alpha) for every pixel.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-step-num">2</span>
            <div>
              <h3>Transform</h3>
              <p>Each pixel goes through a conversion pipeline: sRGB values are linearized (gamma 2.4 decode), then brightness-boosted into the HDR luminance range, and finally encoded using the PQ (Perceptual Quantizer) transfer function into 16-bit values.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-step-num">3</span>
            <div>
              <h3>Encode</h3>
              <p>The transformed pixels are wrapped in a hand-built PNG file with special HDR metadata chunks — cICP, cHRM, and iCCP — that tell the display to render the image using the Rec.2020 color gamut and PQ transfer function.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="how-section">
        <h2>What is PQ?</h2>
        <p>PQ (Perceptual Quantizer), standardized as SMPTE ST 2084, is the transfer function used by HDR10 and Dolby Vision. Unlike traditional gamma curves (~2.2) which top out around 100 nits, PQ maps absolute luminance up to 10,000 nits.</p>
        <p>PQ's curve is designed around human perception — it allocates more code values to dim regions where our eyes are most sensitive, and fewer to extremely bright highlights. This makes it far more efficient than gamma for encoding the wide brightness range of HDR content.</p>
      </section>

      <section class="how-section">
        <h2>The Metadata</h2>
        <p>A valid HDR PNG needs more than just bright pixels — the display needs to know <em>how</em> to interpret them. Supernova embeds three metadata chunks:</p>
        <ul class="how-meta-list">
          <li><strong>cICP</strong> — the primary HDR signal. Four bytes that declare BT.2020 color primaries, PQ transfer function, and full-range encoding. Modern browsers (Chrome, Safari) use this.</li>
          <li><strong>cHRM</strong> — chromaticity coordinates for the BT.2020 gamut. Acts as a fallback for decoders that don't understand cICP.</li>
          <li><strong>iCCP</strong> — an embedded ICC color profile ("Rec2020 Gamut with PQ Transfer"). The broadest fallback — even apps that understand neither cICP nor cHRM can use this profile to render colors correctly. On macOS, this triggers Extended Dynamic Range (EDR).</li>
        </ul>
      </section>

      <section class="how-section">
        <h2>Privacy</h2>
        <p>Everything runs client-side in your browser. Your images never leave your device — there are no uploads, no server processing, and no analytics on your content. The entire conversion happens in JavaScript using the Canvas API and manual PNG byte construction.</p>
      </section>
    </div>
  )
}

function Home() {
  const [image, setImage] = useState<ImageState | null>(null)
  const [boost, setBoost] = useState(4)
  const [gamma, setGamma] = useState(1.0)
  const [processing, setProcessing] = useState(false)
  const [dragover, setDragover] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadImage = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage({ src: url, name: file.name, width: img.width, height: img.height, el: img })
    }
    img.src = url
  }, [])

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
    setImage(null)
  }, [image])

  const convert = useCallback(async () => {
    if (!image) return
    setProcessing(true)

    // Defer to next frame so UI updates
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => setTimeout(r, 50))

    try {
      const { el, width, height, name } = image
      const canvas = canvasRef.current!
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(el, 0, 0)
      const imageData = ctx.getImageData(0, 0, width, height)

      const pqPixels = processPixels(imageData, boost, gamma)
      const pngData = encodePNG(width, height, pqPixels)

      const blob = new Blob([pngData as BlobPart], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stem = name.replace(/\.[^.]+$/, '')
      a.href = url
      a.download = `${stem}-hdr.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setProcessing(false)
    }
  }, [image, boost, gamma])

  return (
    <>
      <a class="how-link" href="/supernova-image/how-it-works">How it works</a>

      {!image ? (
        <div
          class={`drop-zone ${dragover ? 'dragover' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <div class="drop-zone__prompt">
            <svg viewBox="0 0 48 48" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
            <img src={image.src} alt="Preview" />
            <canvas ref={canvasRef} />
            {processing && (
              <div class="processing-overlay">
                <div class="scan-bar" />
                <span class="processing-text">Converting</span>
              </div>
            )}
          </div>
        </div>
      )}

      {image && (
        <>
          <div class="controls">
            <div class="control-group">
              <label>Boost</label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={boost}
                onInput={(e) => setBoost(Number((e.target as HTMLInputElement).value))}
                style={{ background: rangeBackground(boost, 1, 10) }}
              />
              <span class="value">{boost.toFixed(1)}</span>
            </div>
            <div class="control-group">
              <label>Gamma</label>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={gamma}
                onInput={(e) => setGamma(Number((e.target as HTMLInputElement).value))}
                style={{ background: rangeBackground(gamma, 0.1, 3.0) }}
              />
              <span class="value">{gamma.toFixed(1)}</span>
            </div>
          </div>

          <div class="btn-row">
            <button class="btn btn-secondary" onClick={reset}>
              New image
            </button>
            <button class="btn btn-download" onClick={convert} disabled={processing}>
              {processing ? 'Converting...' : 'Download HDR PNG'}
            </button>
          </div>

          <div class="filename">
            {image.name} &middot; {image.width}&times;{image.height}
          </div>
        </>
      )}

      <footer class="trust-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
        <span>100% client-side · no uploads · your images never leave this device</span>
      </footer>
    </>
  )
}

export function App() {
  return (
    <LocationProvider>
      <div class="header">
        <h1>Supernova</h1>
        <p>Convert any image to <span class="accent">HDR PNG</span> — runs entirely in your browser</p>
      </div>
      <Router>
        <Route path="/supernova-image/" component={Home} />
        <Route path="/supernova-image/how-it-works" component={HowItWorks} />
        <Route default component={Home} />
      </Router>
    </LocationProvider>
  )
}
