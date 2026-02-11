import type { RefObject } from 'preact'
import type { JSX } from 'preact'

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
}

type RatioStyle = JSX.CSSProperties & { '--img-ratio': string }

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
}: PreviewPaneProps) {
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
        <div class="drop-zone__prompt">
          <svg viewBox="0 0 48 48" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M24 32V16m0 0l-8 8m8-8l8 8" />
            <rect x="6" y="6" width="36" height="36" rx="4" />
          </svg>
          <span>
            Drop an image or <span class="accent">browse</span>
          </span>
          <span class="drop-zone__hint">PNG, JPEG, WebP, AVIF</span>
        </div>
        <input type="file" ref={fileInputRef} accept="image/*" onChange={onFileSelect} />
      </div>
    )
  }

  const ratioStyle: RatioStyle = { '--img-ratio': `${image.width} / ${image.height}` }

  return (
    <div class="preview-wrapper">
      <div class="preview-container">
        <div class="preview-compare" style={ratioStyle}>
          <figure class="preview-panel">
            <figcaption class="preview-panel__label">Before</figcaption>
            <img src={image.src} alt="Original preview" />
          </figure>
          <figure class="preview-panel">
            <figcaption class="preview-panel__label">After</figcaption>
            <div class="preview-output">
              {previewImageSrc ? (
                <img src={previewImageSrc} alt="Converted preview" class="preview-output-image" />
              ) : (
                <canvas ref={previewCanvasRef} class="preview-output-canvas" />
              )}
              {!previewReady && <div class="preview-placeholder">Adjust controls to render preview</div>}
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
  )
}
