import { readFile } from 'node:fs/promises'
import { evaluateBenchmarkReport, type BenchmarkGateOptions, type BenchmarkReport } from '../src/lib/benchmark-gate'

const REPORT_PATH = process.env.BENCH_REPORT_PATH ?? 'benchmarks/hdr-benchmark-report.json'
const BASELINE_PATH = process.env.BENCH_BASELINE_PATH ?? 'benchmarks/hdr-benchmark-baseline.json'

const options: BenchmarkGateOptions = {
  minSpeedupPct: Number(process.env.BENCH_MIN_SPEEDUP_PCT ?? '0'),
  maxRegressionPct: Number(process.env.BENCH_MAX_REGRESSION_PCT ?? '20'),
  maxSizeRegressionPct: Number(process.env.BENCH_MAX_SIZE_REGRESSION_PCT ?? '0'),
  requireBaselineSnapshot: process.env.BENCH_REQUIRE_BASELINE === 'true',
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8')
  return JSON.parse(raw) as T
}

async function main(): Promise<void> {
  const report = await readJson<BenchmarkReport>(REPORT_PATH)

  let snapshot: BenchmarkReport | undefined
  try {
    snapshot = await readJson<BenchmarkReport>(BASELINE_PATH)
  } catch {
    snapshot = undefined
  }

  const result = evaluateBenchmarkReport(report, options, snapshot)

  if (result.snapshotChecked) {
    console.log(
      `[verify-benchmark-report] Passed with snapshot gate. selected=${result.selectedConfig.name} speedup=${result.speedupPct.toFixed(
        2,
      )}% perfDelta=${result.perfRegressionPct?.toFixed(2)}% sizeDelta=${result.sizeRegressionPct?.toFixed(2)}%`,
    )
    return
  }

  console.log(
    `[verify-benchmark-report] Passed current-run gates. selected=${result.selectedConfig.name} speedup=${result.speedupPct.toFixed(2)}%`,
  )
}

await main().catch((error: unknown) => {
  console.error(`[verify-benchmark-report] ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
