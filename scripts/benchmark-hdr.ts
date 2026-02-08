import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { processPixels, type PixelBufferLike } from '../src/lib/pq'
import { encodePNG, type CompressionBackend } from '../src/lib/encode-png'

const nativeFetch = globalThis.fetch.bind(globalThis)
const localICCPath = new URL('../src/lib/rec2020-pq.icc', import.meta.url)

// Bun script mode doesn't resolve Vite `?url` assets; provide a local fallback.
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    return await nativeFetch(input, init)
  } catch (error) {
    const text = String(input)
    if (!text.includes('rec2020-pq.icc')) throw error
    return new Response(await Bun.file(localICCPath).arrayBuffer())
  }
}

interface CorpusEntry {
  name: string
  width: number
  height: number
  detail: 'low' | 'high'
}

interface BenchConfig {
  name: string
  backend: CompressionBackend
  level: number
}

interface CaseResult {
  caseName: string
  decodeMs: number
  processMs: number
  encodeMs: number
  totalMs: number
  outputBytes: number
}

interface ConfigSummary {
  config: BenchConfig
  caseResults: CaseResult[]
  medianTotalMs: number
  medianOutputBytes: number
}

const fullCorpus: CorpusEntry[] = [
  { name: '2MP-low', width: 1920, height: 1080, detail: 'low' },
  { name: '2MP-high', width: 1920, height: 1080, detail: 'high' },
  { name: '8MP-low', width: 3840, height: 2160, detail: 'low' },
  { name: '8MP-high', width: 3840, height: 2160, detail: 'high' },
  { name: '12MP-low', width: 4000, height: 3000, detail: 'low' },
  { name: '12MP-high', width: 4000, height: 3000, detail: 'high' },
  { name: '24MP-low', width: 6000, height: 4000, detail: 'low' },
  { name: '24MP-high', width: 6000, height: 4000, detail: 'high' },
]

const prCorpus: CorpusEntry[] = fullCorpus.filter((entry) => ['2MP-low', '2MP-high'].includes(entry.name))

const BENCH_PROFILE = process.env.BENCH_PROFILE ?? 'full'
const corpus = BENCH_PROFILE === 'pr' ? prCorpus : fullCorpus
const REPORT_PATH = process.env.BENCH_REPORT_PATH ?? 'benchmarks/hdr-benchmark-report.json'

const BASELINE_BACKEND = (process.env.BENCH_BASELINE_BACKEND ??
  (BENCH_PROFILE === 'pr' ? 'fflate' : 'compression-stream')) as CompressionBackend
const BASELINE_LEVEL = Number(process.env.BENCH_BASELINE_LEVEL ?? '6')

const baselineConfig: BenchConfig = {
  name: `baseline-${BASELINE_BACKEND}-l${BASELINE_LEVEL}`,
  backend: BASELINE_BACKEND,
  level: BASELINE_LEVEL,
}

const CASE_TIMEOUT_MS = Number(process.env.BENCH_CASE_TIMEOUT_MS ?? (BENCH_PROFILE === 'pr' ? '45000' : '120000'))

const levelCandidates = (process.env.BENCH_LEVELS ?? (BENCH_PROFILE === 'pr' ? '5,6' : '4,5,6,7,8,9'))
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0 && value <= 9)

const candidateConfigs: BenchConfig[] = levelCandidates.map((level) => ({
  name: `fflate-l${level}`,
  backend: 'fflate',
  level,
}))

if (candidateConfigs.length === 0) {
  throw new Error('No valid BENCH_LEVELS provided for benchmark candidate configs.')
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function generateSyntheticPixels(entry: CorpusEntry): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(entry.width * entry.height * 4)
  if (entry.detail === 'low') {
    let i = 0
    for (let y = 0; y < entry.height; y++) {
      const yf = y / Math.max(1, entry.height - 1)
      for (let x = 0; x < entry.width; x++) {
        const xf = x / Math.max(1, entry.width - 1)
        const r = Math.round(255 * xf)
        const g = Math.round(255 * yf)
        const b = Math.round(255 * (0.5 + 0.5 * Math.sin((xf + yf) * Math.PI)))
        pixels[i++] = r
        pixels[i++] = g
        pixels[i++] = b
        pixels[i++] = 255
      }
    }
    return pixels
  }

  // Deterministic high-detail scene.
  let seed = 0x9e3779b9
  const next = (): number => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return seed >>> 0
  }
  for (let i = 0; i < pixels.length; i += 4) {
    const n0 = next()
    const n1 = next()
    const n2 = next()
    pixels[i] = n0 & 0xff
    pixels[i + 1] = n1 & 0xff
    pixels[i + 2] = n2 & 0xff
    pixels[i + 3] = 255
  }
  return pixels
}

function toPixelBufferLike(data: Uint8ClampedArray, width: number, height: number): PixelBufferLike {
  return { data, width, height }
}

async function runCase(entry: CorpusEntry, config: BenchConfig): Promise<CaseResult> {
  const decodeStart = performance.now()
  const pixels = generateSyntheticPixels(entry)
  const decodeMs = performance.now() - decodeStart

  const processStart = performance.now()
  const pq = processPixels(toPixelBufferLike(pixels, entry.width, entry.height), 5.0, 1.0)
  const processMs = performance.now() - processStart

  const encodeStart = performance.now()
  const png = await encodePNG(entry.width, entry.height, pq, {
    compressionBackend: config.backend,
    idatCompressionLevel: config.level,
  })
  const encodeMs = performance.now() - encodeStart
  return {
    caseName: entry.name,
    decodeMs,
    processMs,
    encodeMs,
    totalMs: decodeMs + processMs + encodeMs,
    outputBytes: png.byteLength,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Benchmark timeout after ${timeoutMs}ms for ${label}`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

async function runConfig(config: BenchConfig): Promise<ConfigSummary> {
  const caseResults: CaseResult[] = []
  for (const entry of corpus) {
    const result = await withTimeout(runCase(entry, config), CASE_TIMEOUT_MS, `${config.name}:${entry.name}`)
    caseResults.push(result)
  }
  return {
    config,
    caseResults,
    medianTotalMs: median(caseResults.map((c) => c.totalMs)),
    medianOutputBytes: median(caseResults.map((c) => c.outputBytes)),
  }
}

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`
}

async function main(): Promise<void> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream is required for baseline size gate')
  }

  console.log('Running HDR benchmark corpus...')
  const baseline = await runConfig(baselineConfig)
  const candidates: ConfigSummary[] = []
  for (const candidate of candidateConfigs) {
    candidates.push(await runConfig(candidate))
  }

  const rows = candidates.map((candidate) => {
    const sizeDelta = ((candidate.medianOutputBytes - baseline.medianOutputBytes) / baseline.medianOutputBytes) * 100
    const speedup = ((baseline.medianTotalMs - candidate.medianTotalMs) / baseline.medianTotalMs) * 100
    return {
      config: candidate.config.name,
      medianTotal: formatMs(candidate.medianTotalMs),
      speedupPct: `${speedup.toFixed(2)}%`,
      medianBytes: Math.round(candidate.medianOutputBytes),
      medianDeltaPct: `${sizeDelta.toFixed(2)}%`,
      passesSizeGate: candidate.medianOutputBytes <= baseline.medianOutputBytes ? 'yes' : 'no',
    }
  })

  const passing = [baseline, ...candidates].filter((c) => c.medianOutputBytes <= baseline.medianOutputBytes)
  const selected = passing.sort((a, b) => a.medianTotalMs - b.medianTotalMs)[0] ?? null

  console.log('\nBaseline:')
  console.table([
    {
      config: baseline.config.name,
      medianTotal: formatMs(baseline.medianTotalMs),
      medianBytes: Math.round(baseline.medianOutputBytes),
    },
  ])

  console.log('\nCandidates:')
  console.table(rows)

  if (selected) {
    console.log(`Selected config (fastest passing size gate): ${selected.config.name}`)
  } else {
    console.log('No candidate passed the median size non-increase gate.')
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseline,
    candidates,
    selected: selected?.config ?? null,
  }
  await mkdir('benchmarks', { recursive: true })
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`Wrote ${REPORT_PATH}`)
}

await main()
