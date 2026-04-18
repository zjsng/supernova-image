import { BOOST_UI_MAX, BOOST_UI_MIN, boostToTargetNits } from '../lib/hdr-boost'
import { LOOK_CONTROL_KEYS, LOOK_CONTROL_RANGES, type LookControls } from '../lib/look-controls'

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

type LookControlKey = keyof LookControls

const PRIMARY_CONTROL_KEYS: LookControlKey[] = ['saturation']
const PRIMARY_CONTROL_KEY_SET = new Set<LookControlKey>(PRIMARY_CONTROL_KEYS)
const FINE_TUNE_CONTROL_KEYS = LOOK_CONTROL_KEYS.filter((key) => !PRIMARY_CONTROL_KEY_SET.has(key))

const SIGNED_CONTROL_KEYS = new Set<LookControlKey>(['exposure', 'temperature', 'tint', 'blacks', 'whites', 'clarity'])

const CONTROL_DECIMAL_OVERRIDES: Partial<Record<LookControlKey, number>> = {
  exposure: 1,
  gamma: 1,
}

const CONTROL_LABEL_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'Highlight Roll-off',
  highlightSaturation: 'Highlight Sat',
  shadowLift: 'Shadow Lift',
  shadowGlow: 'Shadow Glow',
}

const CONTROL_ID_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'rolloff-range',
  shadowLift: 'shadow-range',
}

function downloadButtonLabel(processing: boolean, downloaded: boolean): string {
  if (processing) return 'Converting...'
  if (downloaded) return 'Downloaded!'
  return 'Download HDR PNG'
}

function camelToWords(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
}

function kebabCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

function controlId(key: LookControlKey): string {
  return CONTROL_ID_OVERRIDES[key] ?? `${kebabCase(key)}-range`
}

function controlLabel(key: LookControlKey): string {
  if (CONTROL_LABEL_OVERRIDES[key]) return CONTROL_LABEL_OVERRIDES[key] as string
  const normalized = camelToWords(key)
  return `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`
}

function controlDecimals(key: LookControlKey): number {
  return CONTROL_DECIMAL_OVERRIDES[key] ?? 2
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

function saturationSubLabel(value: number): string {
  if (value > 1.3) return 'Wide gamut'
  if (value > 1.1) return 'Enhanced'
  return 'Natural'
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
  const renderLookControl = (key: LookControlKey) => {
    const range = LOOK_CONTROL_RANGES[key]
    const value = lookControls[key]
    return (
      <Slider
        key={key}
        id={controlId(key)}
        label={controlLabel(key)}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        displayValue={value.toFixed(controlDecimals(key))}
        centered={SIGNED_CONTROL_KEYS.has(key)}
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
        {PRIMARY_CONTROL_KEYS.map((key) => {
          const range = LOOK_CONTROL_RANGES[key]
          const value = lookControls[key]
          return (
            <HeroSlider
              key={key}
              id={controlId(key)}
              label={controlLabel(key)}
              min={range.min}
              max={range.max}
              step={range.step}
              value={value}
              onInput={(nextValue) => onSetLookControl(key, nextValue)}
              display={value.toFixed(2)}
              sub={saturationSubLabel(value)}
            />
          )
        })}
      </div>

      <div class="fine-tune">{FINE_TUNE_CONTROL_KEYS.map(renderLookControl)}</div>

      <div class="preview-note">
        <span class="preview-note__heading">✦ Preview · {hdrPreviewEnabled ? 'HDR direct' : 'SDR approximation'}</span>
        {hdrPreviewEnabled
          ? 'Preview is using converted HDR PNG output on this browser/display.'
          : 'HDR encoded at export. Boost affects final output even if your display can’t render it.'}
      </div>

      <div class="btn-row">
        <button type="button" class="btn btn-secondary" onClick={onReset}>
          ← New image
        </button>
        <button
          type="button"
          class={`btn btn-download${downloaded ? ' btn-download--success' : ''}`}
          onClick={onConvert}
          disabled={processing}
        >
          {downloadButtonLabel(processing, downloaded)} ↓
        </button>
      </div>

      <div class="filename">
        {imageName} · {imageWidth}×{imageHeight}
      </div>
    </div>
  )
}
