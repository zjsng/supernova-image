import { BOOST_UI_MAX, BOOST_UI_MIN, boostToTargetNits } from '../lib/hdr-boost'
import { LOOK_CONTROL_RANGES, type LookControls } from '../lib/look-controls'

interface ConverterControlsProps {
  imageName: string
  imageWidth: number
  imageHeight: number
  boost: number
  lookControls: LookControls
  processing: boolean
  downloaded: boolean
  onSetBoost: (value: number) => void
  onSetLookControl: (key: keyof LookControls, value: number) => void
  onReset: () => void
  onConvert: () => void
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
  onSetBoost,
  onSetLookControl,
  onReset,
  onConvert,
}: ConverterControlsProps) {
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

        <ControlGroup
          id="saturation-range"
          label="Saturation"
          min={LOOK_CONTROL_RANGES.saturation.min}
          max={LOOK_CONTROL_RANGES.saturation.max}
          step={LOOK_CONTROL_RANGES.saturation.step}
          value={lookControls.saturation}
          onInput={(value) => onSetLookControl('saturation', value)}
          displayValue={lookControls.saturation.toFixed(2)}
        />
      </div>

      <div class="preview-note">Preview is SDR approximation. Boost affects final HDR export.</div>

      <details class="advanced-controls">
        <summary>Advanced</summary>
        <div class="advanced-controls__grid">
          <ControlGroup
            id="gamma-range"
            label="Gamma"
            min={LOOK_CONTROL_RANGES.gamma.min}
            max={LOOK_CONTROL_RANGES.gamma.max}
            step={LOOK_CONTROL_RANGES.gamma.step}
            value={lookControls.gamma}
            onInput={(value) => onSetLookControl('gamma', value)}
            displayValue={lookControls.gamma.toFixed(1)}
          />

          <ControlGroup
            id="contrast-range"
            label="Contrast"
            min={LOOK_CONTROL_RANGES.contrast.min}
            max={LOOK_CONTROL_RANGES.contrast.max}
            step={LOOK_CONTROL_RANGES.contrast.step}
            value={lookControls.contrast}
            onInput={(value) => onSetLookControl('contrast', value)}
            displayValue={lookControls.contrast.toFixed(2)}
          />

          <ControlGroup
            id="rolloff-range"
            label="Highlight Roll-off"
            min={LOOK_CONTROL_RANGES.highlightRollOff.min}
            max={LOOK_CONTROL_RANGES.highlightRollOff.max}
            step={LOOK_CONTROL_RANGES.highlightRollOff.step}
            value={lookControls.highlightRollOff}
            onInput={(value) => onSetLookControl('highlightRollOff', value)}
            displayValue={lookControls.highlightRollOff.toFixed(2)}
          />

          <ControlGroup
            id="shadow-range"
            label="Shadow Lift"
            min={LOOK_CONTROL_RANGES.shadowLift.min}
            max={LOOK_CONTROL_RANGES.shadowLift.max}
            step={LOOK_CONTROL_RANGES.shadowLift.step}
            value={lookControls.shadowLift}
            onInput={(value) => onSetLookControl('shadowLift', value)}
            displayValue={lookControls.shadowLift.toFixed(2)}
          />

          <ControlGroup
            id="shadow-glow-range"
            label="Shadow Glow"
            min={LOOK_CONTROL_RANGES.shadowGlow.min}
            max={LOOK_CONTROL_RANGES.shadowGlow.max}
            step={LOOK_CONTROL_RANGES.shadowGlow.step}
            value={lookControls.shadowGlow}
            onInput={(value) => onSetLookControl('shadowGlow', value)}
            displayValue={lookControls.shadowGlow.toFixed(2)}
          />

          <ControlGroup
            id="vibrance-range"
            label="Vibrance"
            min={LOOK_CONTROL_RANGES.vibrance.min}
            max={LOOK_CONTROL_RANGES.vibrance.max}
            step={LOOK_CONTROL_RANGES.vibrance.step}
            value={lookControls.vibrance}
            onInput={(value) => onSetLookControl('vibrance', value)}
            displayValue={lookControls.vibrance.toFixed(2)}
          />
        </div>
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
