export interface BenchmarkCaseResult {
  caseName: string
  decodeMs: number
  processMs: number
  encodeMs: number
  totalMs: number
  outputBytes: number
}

export interface BenchmarkConfig {
  name: string
  backend: 'fflate' | 'compression-stream'
  level: number
}

export interface BenchmarkConfigSummary {
  config: BenchmarkConfig
  caseResults: BenchmarkCaseResult[]
  medianTotalMs: number
  medianOutputBytes: number
}

export interface BenchmarkReport {
  generatedAt: string
  baseline: BenchmarkConfigSummary
  candidates: BenchmarkConfigSummary[]
  selected: BenchmarkConfig | null
}

export interface BenchmarkGateOptions {
  minSpeedupPct: number
  maxRegressionPct: number
  maxSizeRegressionPct: number
  requireBaselineSnapshot: boolean
}

export interface BenchmarkGateResult {
  selectedConfig: BenchmarkConfig
  speedupPct: number
  perfRegressionPct: number | null
  sizeRegressionPct: number | null
  snapshotChecked: boolean
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite, got ${value}`)
  }
}

function pctDelta(current: number, previous: number): number {
  return ((current - previous) / previous) * 100
}

function findSummaryByConfig(report: BenchmarkReport, configName: string): BenchmarkConfigSummary | undefined {
  if (report.baseline.config.name === configName) return report.baseline
  return report.candidates.find((candidate) => candidate.config.name === configName)
}

export function evaluateBenchmarkReport(
  report: BenchmarkReport,
  options: BenchmarkGateOptions,
  baselineSnapshot?: BenchmarkReport,
): BenchmarkGateResult {
  if (!report.selected) {
    throw new Error('No selected benchmark config. Performance run failed to find a size-safe candidate.')
  }

  const selectedSummary = findSummaryByConfig(report, report.selected.name)
  if (!selectedSummary) {
    throw new Error(`Selected config ${report.selected.name} was not found in report payload.`)
  }

  const baseline = report.baseline
  assertFinite(selectedSummary.medianTotalMs, 'selected medianTotalMs')
  assertFinite(selectedSummary.medianOutputBytes, 'selected medianOutputBytes')
  assertFinite(baseline.medianTotalMs, 'baseline medianTotalMs')
  assertFinite(baseline.medianOutputBytes, 'baseline medianOutputBytes')

  if (selectedSummary.medianOutputBytes > baseline.medianOutputBytes) {
    throw new Error(
      `Size gate failed: selected median bytes ${Math.round(selectedSummary.medianOutputBytes)} > baseline ${Math.round(
        baseline.medianOutputBytes,
      )}`,
    )
  }

  const speedupPct = ((baseline.medianTotalMs - selectedSummary.medianTotalMs) / baseline.medianTotalMs) * 100
  if (speedupPct < options.minSpeedupPct) {
    throw new Error(`Speed gate failed: ${speedupPct.toFixed(2)}% < minimum ${options.minSpeedupPct.toFixed(2)}%`)
  }

  if (!baselineSnapshot) {
    if (options.requireBaselineSnapshot) {
      throw new Error('Baseline snapshot is required but was not provided.')
    }

    return {
      selectedConfig: report.selected,
      speedupPct,
      perfRegressionPct: null,
      sizeRegressionPct: null,
      snapshotChecked: false,
    }
  }

  const baselineSelected = baselineSnapshot.selected ? findSummaryByConfig(baselineSnapshot, baselineSnapshot.selected.name) : undefined
  if (!baselineSelected) {
    if (options.requireBaselineSnapshot) {
      throw new Error('Baseline snapshot does not contain selected summary')
    }

    return {
      selectedConfig: report.selected,
      speedupPct,
      perfRegressionPct: null,
      sizeRegressionPct: null,
      snapshotChecked: false,
    }
  }

  const perfRegressionPct = pctDelta(selectedSummary.medianTotalMs, baselineSelected.medianTotalMs)
  const sizeRegressionPct = pctDelta(selectedSummary.medianOutputBytes, baselineSelected.medianOutputBytes)

  if (perfRegressionPct > options.maxRegressionPct) {
    throw new Error(`Performance regression too high: ${perfRegressionPct.toFixed(2)}% > allowed ${options.maxRegressionPct.toFixed(2)}%`)
  }

  if (sizeRegressionPct > options.maxSizeRegressionPct) {
    throw new Error(`Size regression too high: ${sizeRegressionPct.toFixed(2)}% > allowed ${options.maxSizeRegressionPct.toFixed(2)}%`)
  }

  return {
    selectedConfig: report.selected,
    speedupPct,
    perfRegressionPct,
    sizeRegressionPct,
    snapshotChecked: true,
  }
}
