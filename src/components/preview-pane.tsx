import type { RefObject } from 'preact'
import { useMemo, useState } from 'preact/hooks'
import { Compare, type CompareMode } from './compare'
import { ChromaticTitle } from './chromatic-title'

interface PreviewImage {
  src: string
  width: number
  height: number
}

interface PreviewPaneProps {
  image: PreviewImage | null
  dragover: boolean
  previewReady: boolean
  previewImageSrc: string | null
  processing: boolean
  previewPending: boolean
  fileInputRef: RefObject<HTMLInputElement>
  previewCanvasRef: RefObject<HTMLCanvasElement>
  decodeCanvasRef: RefObject<HTMLCanvasElement>
  onDrop: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onBrowse: () => void
  onFileSelect: (event: Event) => void
  imageName?: string | undefined
  imageWidth?: number | undefined
  imageHeight?: number | undefined
  boost?: number | undefined
  exposure?: number | undefined
}

const COMPARE_MODES: { id: CompareMode; label: string }[] = [
  { id: 'split', label: 'Split' },
  { id: 'drag', label: 'Drag' },
  { id: 'swap', label: 'Swap' },
]

function PeakReadout({ boost, exposure }: { boost: number; exposure: number }) {
  const peakNits = Math.round(boost * 400)

  const bars = useMemo(() => {
    const arr: number[] = []
    for (let i = 0; i < 24; i++) {
      const t = i / 23
      const peakBias = Math.min(1, boost / 12)
      const base = Math.exp(-Math.pow((t - 0.28 - exposure * 0.1) * 3, 2))
      const hiLift = peakBias * Math.exp(-Math.pow((t - 0.82) * 5, 2)) * 0.75
      arr.push(Math.min(1, base + hiLift))
    }
    return arr
  }, [boost, exposure])

  return (
    <div class="peak-readout" aria-label={`Estimated peak ${peakNits} nits`}>
      <div class="peak-readout__metric">
        <span class="peak-readout__label">Peak</span>
        <span class="peak-readout__value">{peakNits.toLocaleString()}</span>
        <span class="peak-readout__unit">nits</span>
      </div>
      <div class="peak-readout__bars" aria-hidden="true">
        {bars.map((value, index) => {
          const t = index / (bars.length - 1)
          const hue = 240 - t * 220
          const isHdr = t > 0.75 && boost > 2
          const scale = Math.max(0.04, value)
          return (
            <span
              key={index}
              class="peak-readout__bar"
              style={{
                transform: `scaleY(${scale})`,
                background: isHdr ? `oklch(0.75 0.2 ${hue})` : `oklch(0.5 0.08 ${hue})`,
                opacity: isHdr ? 1 : 0.7,
                boxShadow: isHdr ? `0 0 6px oklch(0.7 0.2 ${hue} / 0.5)` : 'none',
              }}
            />
          )
        })}
      </div>
      <div class="peak-readout__tags">
        <span>PQ</span>
        <span>Rec.2020</span>
        <span class="peak-readout__tag--muted">cICP 9·16·0</span>
      </div>
    </div>
  )
}

export function PreviewPane({
  image,
  dragover,
  previewReady,
  previewImageSrc,
  processing,
  previewPending,
  fileInputRef,
  previewCanvasRef,
  decodeCanvasRef,
  onDrop,
  onDragOver,
  onDragLeave,
  onBrowse,
  onFileSelect,
  imageName,
  imageWidth,
  imageHeight,
  boost = 5,
  exposure = 0,
}: PreviewPaneProps) {
  const [compareMode, setCompareMode] = useState<CompareMode>('drag')

  if (!image) {
    return (
      <div
        class={`drop-zone ${dragover ? 'dragover' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload an image"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onBrowse}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onBrowse()
          }
        }}
      >
        <div class="drop-zone__overlay" aria-hidden="true" />
        <div class="drop-zone__inner">
          <span class="hero__eyebrow">In-browser · Local · Open-source</span>
          <ChromaticTitle as="h1" lines={['Drop an image.', 'Get HDR back.']} accentLine={1} />
          <p class="hero__subhead">PNG, JPEG, WebP, or AVIF in. True HDR PNG with PQ transfer and Rec.2020 gamut out.</p>
          <span class="drop-button" aria-hidden="true">
            <span class="drop-button__plus" />
            <span class="drop-button__copy">
              <span class="drop-button__title">
                Drop a file or <span class="accent">browse</span>
              </span>
              <span class="drop-button__hint">PNG · JPEG · WEBP · AVIF · max 100MB</span>
            </span>
          </span>
        </div>
        <input type="file" ref={fileInputRef} accept="image/*" tabIndex={-1} onChange={onFileSelect} />
      </div>
    )
  }

  const widthValue = imageWidth ?? image.width
  const heightValue = imageHeight ?? image.height
  const isBusy = processing || previewPending
  const busyLabel = processing ? 'Converting' : 'Updating Preview'

  return (
    <div class="preview-column">
      <div class="preview-header">
        <div class="preview-header__name">{imageName ?? 'image'}</div>
        <div class="preview-header__meta">
          <span aria-label={`${widthValue} by ${heightValue} pixels`}>
            {widthValue} <span aria-hidden="true">×</span> {heightValue}
          </span>
        </div>
      </div>

      <PeakReadout boost={boost} exposure={exposure} />

      <div class="preview-frame" aria-busy={isBusy}>
        <div class="preview-mode-picker preview-mode-picker--frame" role="group" aria-label="Compare mode">
          {COMPARE_MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              class={`preview-mode-picker__btn${compareMode === option.id ? ' preview-mode-picker__btn--active' : ''}`}
              onClick={() => setCompareMode(option.id)}
              aria-pressed={compareMode === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Compare
          mode={compareMode}
          beforeSrc={image.src}
          beforeAlt="Original preview"
          previewImageSrc={previewImageSrc}
          previewCanvasRef={previewCanvasRef}
          previewReady={previewReady}
        />

        {isBusy && (
          <div class="processing-overlay">
            <div class="scan-bar" />
            <span class="processing-text" aria-live="polite">
              {busyLabel}
            </span>
          </div>
        )}
      </div>

      <canvas ref={decodeCanvasRef} class="preview-decode-canvas" />
    </div>
  )
}
