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
const ADVANCED_CONTROL_KEYS = LOOK_CONTROL_KEYS.filter((key) => !PRIMARY_CONTROL_KEY_SET.has(key))

const CONTROL_DECIMAL_OVERRIDES: Partial<Record<LookControlKey, number>> = {
  exposure: 1,
  gamma: 1,
}

const CONTROL_LABEL_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'Highlight Roll-off',
}

const CONTROL_ID_OVERRIDES: Partial<Record<LookControlKey, string>> = {
  highlightRollOff: 'rolloff-range',
  shadowLift: 'shadow-range',
}

function rangeBackground(value: number, min: number, max: number): string {
  const percentage = ((value - min) / (max - min)) * 100
  return `linear-gradient(90deg, var(--accent) 0%, var(--accent-light) ${percentage}%, var(--border) ${percentage}%)`
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
  const normalized = camelToWords(key)
  return CONTROL_LABEL_OVERRIDES[key] ?? `${normalized.slice(0, 1).toUpperCase()}${normalized.slice(1)}`
}

function controlDecimals(key: LookControlKey): number {
  return CONTROL_DECIMAL_OVERRIDES[key] ?? 2
}

function ControlGroup(props: {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  displayValue: string
  onInput: (value: number) => void
}) {
  return (
    <div class="control-group">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(event) => props.onInput(Number((event.target as HTMLInputElement).value))}
        style={{ background: rangeBackground(props.value, props.min, props.max) }}
      />
      <span class="value">{props.displayValue}</span>
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
  const renderLookControl = (key: LookControlKey) => {
    const range = LOOK_CONTROL_RANGES[key]
    const value = lookControls[key]
    return (
      <ControlGroup
        key={key}
        id={controlId(key)}
        label={controlLabel(key)}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onInput={(nextValue) => onSetLookControl(key, nextValue)}
        displayValue={value.toFixed(controlDecimals(key))}
      />
    )
  }

  return (
    <>
      <div class="controls">
        <ControlGroup
          id="boost-range"
          label="Boost"
          min={BOOST_UI_MIN}
          max={BOOST_UI_MAX}
          step={0.5}
          value={boost}
          onInput={onSetBoost}
          displayValue={`${boost.toFixed(1)} · ~${Math.round(boostToTargetNits(boost)).toLocaleString()} nits`}
        />

        {PRIMARY_CONTROL_KEYS.map(renderLookControl)}
      </div>

      <div class="preview-note">
        {hdrPreviewEnabled
          ? 'Preview is using converted HDR PNG output on this browser/display.'
          : 'Preview is SDR approximation. Boost affects final HDR export.'}
      </div>

      <details class="advanced-controls">
        <summary>Advanced</summary>
        <div class="advanced-controls__grid">{ADVANCED_CONTROL_KEYS.map(renderLookControl)}</div>
      </details>

      <div class="btn-row">
        <button class="btn btn-secondary" onClick={onReset}>
          New image
        </button>
        <button class={`btn btn-download${downloaded ? ' btn-download--success' : ''}`} onClick={onConvert} disabled={processing}>
          {downloadButtonLabel(processing, downloaded)}
        </button>
      </div>

      <div class="filename">
        {imageName} &middot; {imageWidth}&times;{imageHeight}
      </div>
    </>
  )
}
