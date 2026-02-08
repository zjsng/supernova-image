import { describe, expect, it } from 'vitest'
import { evaluateBenchmarkReport, type BenchmarkReport } from './benchmark-gate'

function makeReport(overrides?: Partial<BenchmarkReport>): BenchmarkReport {
  const baseline = {
    config: { name: 'baseline-compression-stream-l6', backend: 'compression-stream' as const, level: 6 },
    caseResults: [],
    medianTotalMs: 100,
    medianOutputBytes: 1000,
  }
  const selected = {
    config: { name: 'fflate-l6', backend: 'fflate' as const, level: 6 },
    caseResults: [],
    medianTotalMs: 90,
    medianOutputBytes: 980,
  }

  return {
    generatedAt: '2026-02-08T00:00:00.000Z',
    baseline,
    candidates: [selected],
    selected: selected.config,
    ...overrides,
  }
}

describe('evaluateBenchmarkReport', () => {
  it('passes with current-run gates when snapshot is absent and optional', () => {
    const report = makeReport()
    const result = evaluateBenchmarkReport(
      report,
      {
        minSpeedupPct: 0,
        maxRegressionPct: 20,
        maxSizeRegressionPct: 0,
        requireBaselineSnapshot: false,
      },
      undefined,
    )

    expect(result.snapshotChecked).toBe(false)
    expect(result.selectedConfig.name).toBe('fflate-l6')
    expect(result.speedupPct).toBeGreaterThan(0)
  })

  it('fails when snapshot is required but absent', () => {
    const report = makeReport()

    expect(() =>
      evaluateBenchmarkReport(
        report,
        {
          minSpeedupPct: 0,
          maxRegressionPct: 20,
          maxSizeRegressionPct: 0,
          requireBaselineSnapshot: true,
        },
        undefined,
      ),
    ).toThrow('Baseline snapshot is required')
  })

  it('fails when selected output size is larger than baseline', () => {
    const report = makeReport({
      candidates: [
        {
          config: { name: 'fflate-l6', backend: 'fflate', level: 6 },
          caseResults: [],
          medianTotalMs: 80,
          medianOutputBytes: 1200,
        },
      ],
      selected: { name: 'fflate-l6', backend: 'fflate', level: 6 },
    })

    expect(() =>
      evaluateBenchmarkReport(report, {
        minSpeedupPct: 0,
        maxRegressionPct: 20,
        maxSizeRegressionPct: 0,
        requireBaselineSnapshot: false,
      }),
    ).toThrow('Size gate failed')
  })

  it('fails when snapshot perf regression exceeds threshold', () => {
    const report = makeReport()
    const snapshot = makeReport({
      baseline: {
        config: { name: 'baseline-compression-stream-l6', backend: 'compression-stream', level: 6 },
        caseResults: [],
        medianTotalMs: 100,
        medianOutputBytes: 1000,
      },
      candidates: [
        {
          config: { name: 'fflate-l6', backend: 'fflate', level: 6 },
          caseResults: [],
          medianTotalMs: 70,
          medianOutputBytes: 980,
        },
      ],
      selected: { name: 'fflate-l6', backend: 'fflate', level: 6 },
    })

    expect(() =>
      evaluateBenchmarkReport(
        report,
        {
          minSpeedupPct: 0,
          maxRegressionPct: 20,
          maxSizeRegressionPct: 0,
          requireBaselineSnapshot: true,
        },
        snapshot,
      ),
    ).toThrow('Performance regression too high')
  })

  it('passes snapshot gate when deltas are within thresholds', () => {
    const report = makeReport()
    const snapshot = makeReport({
      baseline: {
        config: { name: 'baseline-compression-stream-l6', backend: 'compression-stream', level: 6 },
        caseResults: [],
        medianTotalMs: 200,
        medianOutputBytes: 1000,
      },
      candidates: [
        {
          config: { name: 'fflate-l6', backend: 'fflate', level: 6 },
          caseResults: [],
          medianTotalMs: 180,
          medianOutputBytes: 980,
        },
      ],
      selected: { name: 'fflate-l6', backend: 'fflate', level: 6 },
    })

    const result = evaluateBenchmarkReport(
      report,
      {
        minSpeedupPct: 0,
        maxRegressionPct: 20,
        maxSizeRegressionPct: 0,
        requireBaselineSnapshot: true,
      },
      snapshot,
    )

    expect(result.snapshotChecked).toBe(true)
    expect(result.perfRegressionPct).not.toBeNull()
    expect(result.sizeRegressionPct).not.toBeNull()
  })

  it('passes snapshot perf gate when absolute runtime increases but normalized ratio is stable', () => {
    const report = makeReport({
      baseline: {
        config: { name: 'baseline-compression-stream-l6', backend: 'compression-stream', level: 6 },
        caseResults: [],
        medianTotalMs: 600,
        medianOutputBytes: 1000,
      },
      candidates: [
        {
          config: { name: 'fflate-l6', backend: 'fflate', level: 6 },
          caseResults: [],
          medianTotalMs: 540,
          medianOutputBytes: 980,
        },
      ],
      selected: { name: 'fflate-l6', backend: 'fflate', level: 6 },
    })
    const snapshot = makeReport({
      baseline: {
        config: { name: 'baseline-compression-stream-l6', backend: 'compression-stream', level: 6 },
        caseResults: [],
        medianTotalMs: 200,
        medianOutputBytes: 1000,
      },
      candidates: [
        {
          config: { name: 'fflate-l6', backend: 'fflate', level: 6 },
          caseResults: [],
          medianTotalMs: 180,
          medianOutputBytes: 980,
        },
      ],
      selected: { name: 'fflate-l6', backend: 'fflate', level: 6 },
    })

    const result = evaluateBenchmarkReport(
      report,
      {
        minSpeedupPct: 0,
        maxRegressionPct: 5,
        maxSizeRegressionPct: 0,
        requireBaselineSnapshot: true,
      },
      snapshot,
    )

    expect(result.snapshotChecked).toBe(true)
    expect(result.perfRegressionPct).toBeLessThanOrEqual(0)
  })
})
