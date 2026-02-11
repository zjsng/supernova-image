import { Fragment } from 'preact'
import { GUIDE_SEO_ROUTES, SEO_BASE_URL } from '../lib/seo-routes'
import { ArrowLeftIcon, guideLabelForRoute, HOME_ROUTE, HOW_IT_WORKS_ROUTE, RevealSection, BrowserCompat, useSeoRouteHead } from './shared'

function pipelineStageClass(index: number, total: number): string {
  const classes = ['pipeline-stage']
  if (index === 0) classes.push('pipeline-stage--input')
  if (index === total - 1) classes.push('pipeline-stage--output')
  return classes.join(' ')
}

function PipelineFlow() {
  const stages = [
    { label: 'sRGB', sub: '8-bit' },
    { label: 'Linearize', sub: 'γ 2.4 decode' },
    { label: 'Boost', sub: 'HDR luminance' },
    { label: 'PQ Encode', sub: 'ST 2084' },
    { label: 'HDR PNG', sub: '16-bit' },
  ]

  return (
    <div class="pipeline-flow" role="img" aria-label="Conversion pipeline: sRGB 8-bit to Linearize to Boost to PQ Encode to HDR PNG 16-bit">
      {stages.map((stage, index) => (
        <Fragment key={index}>
          <div class={pipelineStageClass(index, stages.length)}>
            <span class="pipeline-stage__label">{stage.label}</span>
            <span class="pipeline-stage__sub">{stage.sub}</span>
          </div>
          {index < stages.length - 1 && (
            <div class="pipeline-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14m0 0l-4-4m4 4l-4 4" />
              </svg>
            </div>
          )}
        </Fragment>
      ))}
    </div>
  )
}

function PQCurveSVG() {
  return (
    <svg class="pq-curve-svg" viewBox="0 0 300 240" role="img" aria-label="Chart comparing PQ and Gamma 2.2 transfer curves">
      <defs>
        <linearGradient id="pq-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="var(--accent)" />
          <stop offset="100%" stop-color="var(--accent-light)" />
        </linearGradient>
      </defs>
      <line x1="50" y1="205" x2="280" y2="205" stroke="var(--border)" stroke-width="0.5" />
      <line x1="50" y1="157.5" x2="280" y2="157.5" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="110" x2="280" y2="110" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="62.5" x2="280" y2="62.5" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="2,4" />
      <line x1="50" y1="15" x2="280" y2="15" stroke="var(--border)" stroke-width="0.5" />
      <line x1="50" y1="15" x2="50" y2="205" stroke="var(--border)" stroke-width="0.5" />
      <line x1="280" y1="15" x2="280" y2="205" stroke="var(--border)" stroke-width="0.5" />
      <path
        d="M50.0,205.0L59.6,160.2L69.2,143.6L78.8,131.2L88.3,120.9L97.9,111.9L107.5,103.8L117.1,96.5L126.7,89.7L136.3,83.3L145.8,77.4L155.4,71.7L165.0,66.3L174.6,61.2L184.2,56.3L193.8,51.5L203.3,47.0L212.9,42.6L222.5,38.3L232.1,34.1L241.7,30.1L251.3,26.2L260.8,22.4L270.4,18.6L280.0,15.0"
        fill="none"
        stroke="var(--text-muted)"
        stroke-width="1.5"
        stroke-dasharray="6,4"
        opacity="0.6"
      />
      <path
        d="M50.0,205.0L57.7,84.7L65.3,70.5L73.0,62.2L80.7,56.2L88.3,51.6L96.0,47.8L103.7,44.6L111.3,41.8L119.0,39.4L126.7,37.3L134.3,35.3L142.0,33.5L149.7,31.9L157.3,30.4L165.0,29.0L172.7,27.6L180.3,26.4L188.0,25.3L195.7,24.2L203.3,23.1L211.0,22.1L218.7,21.2L226.3,20.3L234.0,19.5L241.7,18.6L249.3,17.9L257.0,17.1L264.7,16.4L272.3,15.7L280.0,15.0"
        fill="none"
        stroke="url(#pq-grad)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <text x="230" y="46" fill="var(--text-muted)" font-size="10" font-family="var(--font-body)" opacity="0.7">
        γ 2.2
      </text>
      <text x="170" y="22" fill="var(--accent)" font-size="10" font-family="var(--font-body)" font-weight="600">
        PQ
      </text>
      <text x="165" y="225" fill="var(--text-muted)" font-size="9" font-family="var(--font-body)" text-anchor="middle" opacity="0.6">
        Linear light
      </text>
      <text
        x="22"
        y="115"
        fill="var(--text-muted)"
        font-size="9"
        font-family="var(--font-body)"
        text-anchor="middle"
        transform="rotate(-90,22,115)"
        opacity="0.6"
      >
        Encoded signal
      </text>
      <text x="50" y="217" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.5">
        0
      </text>
      <text x="280" y="217" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.5">
        1
      </text>
      <text x="44" y="208" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="end" opacity="0.5">
        0
      </text>
      <text x="44" y="18" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="end" opacity="0.5">
        1
      </text>
    </svg>
  )
}

function NitsScale() {
  const levels = [
    { nits: 100, pct: '1%', label: 'SDR white', accent: false },
    { nits: 203, pct: '2%', label: 'HDR ref white', accent: true },
    { nits: 1000, pct: '10%', label: 'HDR highlight', accent: true },
    { nits: 10000, pct: '100%', label: 'PQ maximum', accent: true },
  ]

  return (
    <div class="nits-scale" role="img" aria-label="Luminance scale showing SDR range (0-100 nits) versus HDR range (up to 10,000 nits)">
      {levels.map((level) => (
        <div class={`nits-row${level.accent ? ' nits-row--accent' : ''}`}>
          <span class="nits-row-val">{level.nits.toLocaleString()}</span>
          <div class="nits-row-track">
            <div class="nits-row-fill" style={{ width: level.pct }} />
          </div>
          <span class="nits-row-label">{level.label}</span>
        </div>
      ))}
    </div>
  )
}

function GamutSVG() {
  return (
    <svg
      class="gamut-svg"
      viewBox="0 0 260 240"
      role="img"
      aria-label="CIE 1931 chromaticity diagram showing sRGB and BT.2020 color gamuts"
    >
      <defs>
        <linearGradient id="gamut-fill" x1="0" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.03" />
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.08" />
        </linearGradient>
      </defs>
      <path
        d="M68.1,218.8L67.8,218.8L67.8,217.7L67.0,216.0L64.0,213.7L59.6,209.3L54.1,200.9L50.0,189.2L45.0,180.6L38.7,165.6L32.4,151.2L26.3,136.2L22.2,122.0L21.1,108.0L23.3,94.0L27.4,83.0L38.2,69.0L50.3,56.7L65.7,45.9L82.7,38.0L103.3,31.5L122.3,29.8L142.1,33.1L162.7,39.2L181.1,47.6L196.0,56.7L209.2,67.4L218.0,77.2L222.1,87.0L222.1,96.3L221.8,103.3L221.8,112.7L222.1,123.2L68.1,218.8"
        fill="none"
        stroke="var(--border)"
        stroke-width="1"
        opacity="0.5"
      />
      <path d="M214.7,151.9L66.8,34.0L56.0,209.3Z" fill="url(#gamut-fill)" stroke="var(--accent)" stroke-width="1.5" opacity="0.9" />
      <path
        d="M196.0,143.0L102.5,80.0L61.2,206.0Z"
        fill="none"
        stroke="var(--text-muted)"
        stroke-width="1.2"
        stroke-dasharray="5,4"
        opacity="0.5"
      />
      <text x="220" y="148" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">
        R
      </text>
      <text x="56" y="29" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">
        G
      </text>
      <text x="42" y="218" fill="var(--accent)" font-size="9" font-family="var(--font-body)" font-weight="600">
        B
      </text>
      <text x="155" y="170" fill="var(--accent)" font-size="10" font-family="var(--font-body)" font-weight="500" opacity="0.85">
        BT.2020
      </text>
      <text x="115" y="152" fill="var(--text-muted)" font-size="10" font-family="var(--font-body)" opacity="0.6">
        sRGB
      </text>
      <text x="130" y="237" fill="var(--text-muted)" font-size="8" font-family="var(--font-body)" text-anchor="middle" opacity="0.4">
        x
      </text>
      <text
        x="10"
        y="120"
        fill="var(--text-muted)"
        font-size="8"
        font-family="var(--font-body)"
        text-anchor="middle"
        transform="rotate(-90,10,120)"
        opacity="0.4"
      >
        y
      </text>
    </svg>
  )
}

export function HowItWorks() {
  useSeoRouteHead(HOW_IT_WORKS_ROUTE.canonicalPath)

  return (
    <div class="how-it-works">
      <a class="how-back-link" href={HOME_ROUTE.routerPath}>
        <ArrowLeftIcon />
        Back to HDR PNG Converter
      </a>

      <section class="how-hero">
        <h1>How HDR PNG Conversion Works</h1>
        <p>
          Supernova converts standard images into HDR PNGs that glow on HDR displays. You get a fast live SDR before/after preview while
          editing, then the final download is encoded with full HDR PQ brightness and metadata.
        </p>
      </section>

      <RevealSection className="how-section how-section--flush">
        <h2>The Pipeline</h2>
        <PipelineFlow />
        <div class="pipeline-steps">
          <div class="pipeline-step-text">
            <strong>1.</strong> Decode your image into raw 8-bit RGBA pixels via Canvas
          </div>
          <div class="pipeline-step-text">
            <strong>2.</strong> Live preview path: run a fast SDR approximation on a downscaled copy for responsive before/after updates
          </div>
          <div class="pipeline-step-text">
            <strong>3.</strong> Export path: apply look controls in linear light, remap boost to HDR luminance, then PQ-encode to 16-bit
            BT.2020
          </div>
          <div class="pipeline-step-text">
            <strong>4.</strong> Wrap in a PNG with HDR metadata chunks (cICP, cHRM, iCCP)
          </div>
        </div>
      </RevealSection>

      <RevealSection className="how-section">
        <h2>The Controls</h2>
        <ul class="how-meta-list">
          <li>
            <strong>Boost</strong> — HDR export brightness control. 1.0≈100 nits, 4.0≈1600 nits, 10≈10000 nits in the final PNG.
          </li>
          <li>
            <strong>Saturation</strong> — primary color intensity control shown in the main panel for quick edits.
          </li>
          <li>
            <strong>Advanced</strong> — Gamma, Contrast, Highlight Roll-off, Shadow Lift, Shadow Glow, and Vibrance for finer grading.
          </li>
          <li>
            <strong>Preview behavior</strong> — preview is SDR approximation for speed; it does not display final HDR luminance boost
            exactly.
          </li>
        </ul>
      </RevealSection>

      <RevealSection className="how-section how-section--visual">
        <div class="how-split">
          <div class="how-split__text">
            <h2>What is PQ?</h2>
            <p>
              PQ (Perceptual Quantizer) is the transfer function behind HDR10 and Dolby Vision. Unlike gamma (~2.2) which tops out at 100
              nits, PQ maps luminance up to 10,000 nits.
            </p>
            <p>
              Its curve allocates more precision to dim regions where our eyes are most sensitive — far more efficient than gamma for HDR's
              wide brightness range.
            </p>
          </div>
          <div class="how-split__visual">
            <PQCurveSVG />
          </div>
        </div>
        <NitsScale />
      </RevealSection>

      <RevealSection className="how-section how-section--visual">
        <div class="how-split how-split--reverse">
          <div class="how-split__text">
            <h2>The Metadata</h2>
            <p>A valid HDR PNG needs metadata so the display knows how to interpret the pixels:</p>
            <ul class="how-meta-list">
              <li>
                <strong>cICP</strong> — declares BT.2020 primaries + PQ transfer. The primary HDR signal.
              </li>
              <li>
                <strong>cHRM</strong> — BT.2020 chromaticity coordinates as fallback.
              </li>
              <li>
                <strong>iCCP</strong> — embedded ICC profile for broadest compatibility. Triggers EDR on macOS.
              </li>
            </ul>
          </div>
          <div class="how-split__visual">
            <GamutSVG />
          </div>
        </div>
      </RevealSection>

      <RevealSection className="how-section">
        <h2>Compatibility</h2>
        <p>Requires an HDR display and a supported browser. On SDR displays, the image renders as a normal PNG.</p>
        <BrowserCompat />
      </RevealSection>

      <RevealSection className="how-section">
        <h2>Privacy</h2>
        <p>100% client-side. No uploads, no server, no analytics. Your images never leave your device.</p>
      </RevealSection>

      <RevealSection className="how-section">
        <h2>Related Guides</h2>
        <ul class="how-meta-list">
          {GUIDE_SEO_ROUTES.map((route) => (
            <li key={route.id}>
              <a href={route.routerPath}>{guideLabelForRoute(route)}</a>
            </li>
          ))}
        </ul>
      </RevealSection>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntityOfPage: `${SEO_BASE_URL}${HOW_IT_WORKS_ROUTE.canonicalPath}`,
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is PQ (Perceptual Quantizer)?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'PQ is the transfer function behind HDR10 and Dolby Vision. Unlike gamma (~2.2) which tops out at 100 nits, PQ maps luminance up to 10,000 nits. Its curve allocates more precision to dim regions where our eyes are most sensitive.',
                },
              },
              {
                '@type': 'Question',
                name: 'What browsers support HDR PNG?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "Chrome and Edge render HDR PNGs via cICP. Safari on macOS uses the ICC profile for EDR. Firefox doesn't yet support extended brightness. On SDR displays, the image renders as a normal PNG.",
                },
              },
              {
                '@type': 'Question',
                name: 'Why does preview brightness differ from the final HDR download?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The editor preview is a fast SDR approximation for responsive slider updates. The downloaded PNG uses the full HDR pipeline with PQ brightness and Rec.2020 metadata, so highlights can be much brighter on HDR displays.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is my image uploaded to a server?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. Supernova is 100% client-side. No uploads, no server, no analytics. Your images never leave your device.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  )
}
