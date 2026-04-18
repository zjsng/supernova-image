import type { RefObject } from 'preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export type CompareMode = 'split' | 'drag' | 'swap'

interface CompareProps {
  mode: CompareMode
  beforeSrc: string
  beforeAlt: string
  previewImageSrc: string | null
  previewCanvasRef: RefObject<HTMLCanvasElement>
  previewReady: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function AfterImage({
  previewImageSrc,
  previewCanvasRef,
  previewReady,
}: {
  previewImageSrc: string | null
  previewCanvasRef: RefObject<HTMLCanvasElement>
  previewReady: boolean
}) {
  return (
    <div class="preview-output">
      {previewImageSrc ? (
        <img src={previewImageSrc} alt="Converted preview" class="preview-output-image" />
      ) : (
        <canvas ref={previewCanvasRef} class="preview-output-canvas" />
      )}
      {!previewReady && <div class="preview-placeholder">Adjust controls to render preview</div>}
    </div>
  )
}

function BeforeImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div class="compare__cell-image">
      <img src={src} alt={alt} />
    </div>
  )
}

export function Compare({ mode, beforeSrc, beforeAlt, previewImageSrc, previewCanvasRef, previewReady }: CompareProps) {
  const [dragPct, setDragPct] = useState(50)
  const [showAfter, setShowAfter] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const handleDrag = useCallback((event: MouseEvent | TouchEvent) => {
    if (!draggingRef.current || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX
    const x = clientX - rect.left
    setDragPct(clamp((x / rect.width) * 100, 0, 100))
  }, [])

  useEffect(() => {
    if (mode !== 'drag') return

    const stop = () => {
      draggingRef.current = false
    }
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('touchmove', handleDrag)
    return () => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
      window.removeEventListener('mousemove', handleDrag)
      window.removeEventListener('touchmove', handleDrag)
    }
  }, [handleDrag, mode])

  if (mode === 'split') {
    return (
      <div class="compare compare--split preview-compare">
        <figure class="preview-panel compare__cell compare__cell--before">
          <figcaption class="compare__label">Before · SDR</figcaption>
          <BeforeImage src={beforeSrc} alt={beforeAlt} />
        </figure>
        <figure class="preview-panel compare__cell compare__cell--after">
          <figcaption class="compare__label compare__label--after">After · HDR · PQ</figcaption>
          <AfterImage previewImageSrc={previewImageSrc} previewCanvasRef={previewCanvasRef} previewReady={previewReady} />
          <div class="hdr-bloom" aria-hidden="true" />
        </figure>
      </div>
    )
  }

  if (mode === 'swap') {
    // Keep both mounted so Playwright fingerprint always finds the after cell.
    return (
      <div class="compare compare--swap">
        <div class="compare__cell compare__cell--before" hidden={showAfter}>
          <BeforeImage src={beforeSrc} alt={beforeAlt} />
          <div class="compare__label">Before · SDR</div>
        </div>
        <div class="compare__cell compare__cell--after" hidden={!showAfter}>
          <AfterImage previewImageSrc={previewImageSrc} previewCanvasRef={previewCanvasRef} previewReady={previewReady} />
          <div class="hdr-bloom" aria-hidden="true" />
          <div class="compare__label compare__label--after">After · HDR · PQ</div>
        </div>
        <div class="compare-mode-switch" role="tablist" aria-label="Swap before and after">
          <button
            type="button"
            class={`compare-mode-switch__btn${!showAfter ? ' compare-mode-switch__btn--active' : ''}`}
            onClick={() => setShowAfter(false)}
            aria-pressed={!showAfter}
          >
            Before
          </button>
          <button
            type="button"
            class={`compare-mode-switch__btn${showAfter ? ' compare-mode-switch__btn--active' : ''}`}
            onClick={() => setShowAfter(true)}
            aria-pressed={showAfter}
          >
            After
          </button>
        </div>
      </div>
    )
  }

  // drag — both cells are absolutely positioned over the same frame and
  // clipped to mutually exclusive horizontal halves separated by the handle,
  // so neither can bleed into the other's side at any handle position.
  return (
    <div
      ref={wrapRef}
      class="compare compare--drag"
      onMouseDown={(event) => {
        draggingRef.current = true
        handleDrag(event)
      }}
      onTouchStart={(event) => {
        draggingRef.current = true
        handleDrag(event)
      }}
    >
      <div class="compare__cell compare__cell--before compare__cell--drag-cell" style={{ clipPath: `inset(0 ${100 - dragPct}% 0 0)` }}>
        <BeforeImage src={beforeSrc} alt={beforeAlt} />
        <div class="compare__label">Before · SDR</div>
      </div>
      <div class="compare__cell compare__cell--after compare__cell--drag-cell" style={{ clipPath: `inset(0 0 0 ${dragPct}%)` }}>
        <AfterImage previewImageSrc={previewImageSrc} previewCanvasRef={previewCanvasRef} previewReady={previewReady} />
        <div class="hdr-bloom" aria-hidden="true" />
        <div class="compare__label compare__label--after">After · HDR · PQ</div>
      </div>
      <div class="compare-handle" style={{ left: `${dragPct}%` }} aria-hidden="true">
        <div class="compare-handle__knob">⇄</div>
      </div>
    </div>
  )
}
