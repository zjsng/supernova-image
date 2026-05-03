import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { BOOST_UI_MAX, BOOST_UI_MIN, boostToTargetNits } from '../lib/hdr-boost'
import {
  LOOK_CONTROL_GROUPS,
  LOOK_CONTROL_RANGES,
  LOOK_CONTROL_RENDER_META,
  saturationSubLabel,
  type LookControlKey,
  type LookControls,
} from '../lib/look-controls'

interface ConverterControlsProps {
  imageName: string
  imageWidth: number
  imageHeight: number
  boost: number
  lookControls: LookControls
  processing: boolean
  downloaded: boolean
  hdrPreviewEnabled: boolean
  onSetBoost: (value: number) => void
  onSetLookControl: (key: keyof LookControls, value: number) => void
  onReset: () => void
  onConvert: () => void
}

interface ScrollState {
  canScroll: boolean
  atTop: boolean
  atBottom: boolean
}

function downloadButtonLabel(processing: boolean, downloaded: boolean): string {
  if (processing) return 'Converting...'
  if (downloaded) return 'Downloaded'
  return 'Download HDR PNG'
}

function downloadButtonGlyph(processing: boolean, downloaded: boolean): string {
  if (processing) return '↓'
  if (downloaded) return '✓'
  return '↓'
}

function downloadReceiptMeta(boost: number): string {
  return `PQ · Rec.2020 · ${Math.round(boostToTargetNits(boost)).toLocaleString()} nits peak`
}

function HeroSlider(props: {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  display: string
  sub: string
  onInput: (value: number) => void
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100
  return (
    <div class="hero-slider">
      <div class="hero-slider__head">
        <label class="hero-slider__label" htmlFor={props.id}>
          {props.label}
        </label>
        <div class="hero-slider__meta">
          <span class="hero-slider__sub">{props.sub}</span>
          <span class="hero-slider__value">{props.display}</span>
        </div>
      </div>
      <div class="hero-slider__track-wrap">
        <div class="hero-slider__rail">
          <div class="hero-slider__fill" style={{ width: `${pct}%` }} />
        </div>
        <div class="hero-slider__thumb" style={{ left: `${pct}%` }} aria-hidden="true" />
        <input
          id={props.id}
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          aria-valuetext={`${props.display}, ${props.sub}`}
          onInput={(event) => props.onInput(Number((event.target as HTMLInputElement).value))}
        />
      </div>
    </div>
  )
}

function Slider(props: {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  displayValue: string
  centered: boolean
  onInput: (value: number) => void
}) {
  const pct = ((props.value - props.min) / (props.max - props.min)) * 100
  const fillLeft = props.centered ? `${Math.min(50, pct)}%` : '0%'
  const fillWidth = props.centered ? `${Math.abs(pct - 50)}%` : `${pct}%`

  return (
    <div class="slider-row">
      <label class="slider-row__label" htmlFor={props.id} title={props.label}>
        {props.label}
      </label>
      <div class="slider-row__track-wrap">
        <div class="slider-row__rail">
          <div class="slider-row__fill" style={{ left: fillLeft, width: fillWidth }} />
          {props.centered && <div class="slider-row__tick" style={{ left: '50%' }} />}
        </div>
        <div class="slider-row__thumb" style={{ left: `${pct}%` }} aria-hidden="true" />
        <input
          id={props.id}
          type="range"
          min={props.min}
          max={props.max}
          step={props.step}
          value={props.value}
          onInput={(event) => props.onInput(Number((event.target as HTMLInputElement).value))}
        />
      </div>
      <span class="slider-row__value">{props.displayValue}</span>
    </div>
  )
}

export function ConverterControls({
  imageName,
  imageWidth,
  imageHeight,
  boost,
  lookControls,
  processing,
  downloaded,
  hdrPreviewEnabled,
  onSetBoost,
  onSetLookControl,
  onReset,
  onConvert,
}: ConverterControlsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScroll: false,
    atTop: true,
    atBottom: true,
  })

  const updateScrollState = useCallback(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const scrollMax = scrollElement.scrollHeight - scrollElement.clientHeight
    const canScroll = scrollMax > 2
    const nextState = {
      canScroll,
      atTop: scrollElement.scrollTop <= 2,
      atBottom: !canScroll || scrollElement.scrollTop >= scrollMax - 2,
    }

    setScrollState((current) =>
      current.canScroll === nextState.canScroll && current.atTop === nextState.atTop && current.atBottom === nextState.atBottom
        ? current
        : nextState,
    )
  }, [])

  const queueScrollStateUpdate = useCallback(() => {
    requestAnimationFrame(updateScrollState)
  }, [updateScrollState])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    updateScrollState()

    const resizeObserver = new ResizeObserver(updateScrollState)
    resizeObserver.observe(scrollElement)

    scrollElement.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      resizeObserver.disconnect()
      scrollElement.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState])

  const renderLookControl = (key: LookControlKey) => {
    const range = LOOK_CONTROL_RANGES[key]
    const meta = LOOK_CONTROL_RENDER_META[key]
    const value = lookControls[key]
    return (
      <Slider
        key={key}
        id={meta.id}
        label={meta.label}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        displayValue={value.toFixed(meta.decimals)}
        centered={meta.centered}
        onInput={(nextValue) => onSetLookControl(key, nextValue)}
      />
    )
  }

  return (
    <div class="controls-panel">
      <div class="hero-sliders">
        <HeroSlider
          id="boost-range"
          label="Boost"
          min={BOOST_UI_MIN}
          max={BOOST_UI_MAX}
          step={0.5}
          value={boost}
          onInput={onSetBoost}
          display={`${boost.toFixed(1)}×`}
          sub={`${Math.round(boostToTargetNits(boost)).toLocaleString()} nits peak`}
        />
        {LOOK_CONTROL_GROUPS.primary.map((key) => {
          const range = LOOK_CONTROL_RANGES[key]
          const meta = LOOK_CONTROL_RENDER_META[key]
          const value = lookControls[key]
          return (
            <HeroSlider
              key={key}
              id={meta.id}
              label={meta.label}
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onInput={(nextValue) => onSetLookControl(key, nextValue)}
              display={value.toFixed(meta.decimals)}
              sub={saturationSubLabel(value)}
            />
          )
        })}
      </div>

      <div
        class={`controls-panel__scroll-shell${scrollState.canScroll ? ' is-scrollable' : ''}${
          !scrollState.atTop ? ' is-scrolled' : ''
        }${!scrollState.atBottom ? ' has-more-below' : ''}`}
      >
        <div ref={scrollRef} class="controls-panel__scroll">
          <details class="fine-tune-group" onToggle={queueScrollStateUpdate}>
            <summary class="fine-tune-group__summary">
              <span class="fine-tune-group__label">Tune image</span>
              <span class="fine-tune-group__hint">{LOOK_CONTROL_GROUPS.specFineTune.length} controls</span>
              <span class="fine-tune-group__chevron" aria-hidden="true">
                +
              </span>
            </summary>
            <div class="fine-tune fine-tune-group__grid">{LOOK_CONTROL_GROUPS.specFineTune.map(renderLookControl)}</div>
          </details>

          <details class="advanced-fine-tune" onToggle={queueScrollStateUpdate}>
            <summary class="advanced-fine-tune__summary">
              <span class="advanced-fine-tune__label">Advanced</span>
              <span class="advanced-fine-tune__chevron" aria-hidden="true">
                +
              </span>
            </summary>
            <div class="fine-tune advanced-fine-tune__grid">{LOOK_CONTROL_GROUPS.advanced.map(renderLookControl)}</div>
          </details>
        </div>
        <span class="controls-panel__scroll-cue controls-panel__scroll-cue--top" aria-hidden="true" />
        <span class="controls-panel__scroll-cue controls-panel__scroll-cue--bottom" aria-hidden="true" />
      </div>

      <div class="controls-panel__footer">
        <div class="preview-note">
          <span class="preview-note__heading">
            <span aria-hidden="true">✦</span> Export · {hdrPreviewEnabled ? 'HDR preview' : 'HDR output'}
          </span>
          {hdrPreviewEnabled
            ? 'This display can show the HDR preview. The download keeps the same headroom.'
            : 'The download is HDR even if this preview looks normal on your display.'}
        </div>

        <div class="btn-row">
          <button type="button" class="btn btn-secondary" onClick={onReset}>
            <span aria-hidden="true">←</span> New image
          </button>
          <button
            type="button"
            class={`btn btn-download${downloaded ? ' btn-download--success' : ''}`}
            onClick={onConvert}
            disabled={processing}
          >
            <span class="btn-download__label">{downloadButtonLabel(processing, downloaded)}</span>
            <span class="btn-download__glyph" aria-hidden="true">
              {downloadButtonGlyph(processing, downloaded)}
            </span>
          </button>
        </div>

        {downloaded && (
          <div class="download-receipt" role="status" aria-live="polite">
            <span class="download-receipt__flare" aria-hidden="true">
              <span class="download-receipt__core">✓</span>
            </span>
            <span class="download-receipt__copy">
              <span class="download-receipt__label">HDR payload saved</span>
              <span class="download-receipt__meta">{downloadReceiptMeta(boost)}</span>
            </span>
          </div>
        )}

        <div class="filename" aria-label={`${imageName}, ${imageWidth} by ${imageHeight} pixels`}>
          <span aria-hidden="true">
            {imageName} · {imageWidth}×{imageHeight}
          </span>
        </div>
      </div>
    </div>
  )
}
