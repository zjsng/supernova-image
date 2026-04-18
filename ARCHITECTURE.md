# Architecture

## Overview

Supernova is a client-side HDR PNG converter built with Preact + Vite. All processing runs locally in the browser.

Runtime flow:

1. UI loads an image and schedules debounced preview updates.
2. A persistent Worker performs pixel processing and PNG encoding.
3. Preview uses an SDR approximation path.
4. Download export uses the full PQ/BT.2020 HDR path.

## Module Boundaries

### App composition

- `src/app.tsx`: route composition + header only. The `<Router>` sits inside a `<main>` landmark wrapped by preact-iso's `ErrorBoundary`, itself nested under the top-level `AppErrorBoundary`.
- `src/components/app-error-boundary.tsx`: top-level error boundary wrapping the router.
- `src/routes/home.tsx`: converter page orchestration (eagerly imported).
- `src/routes/how-it-works.tsx`: technical explanation page (lazy-loaded via `preact-iso` `lazy()`).
- `src/routes/guides.tsx`: SEO guide pages (lazy-loaded).
- `src/routes/not-found.tsx`: 404 route (lazy-loaded).
- `src/routes/shared.tsx`: shared route helpers and reusable route UI blocks.

### UI components

- `src/components/preview-pane.tsx`: upload/dropzone + before/after preview shell, hosts the Compare surface and peak-nits readout.
- `src/components/compare.tsx`: three-mode before/after comparator (split / drag / swap).
- `src/components/converter-controls.tsx`: hero Boost/Saturation slider plus the fine-tune look-control grid.
- `src/components/chromatic-title.tsx`: chromatic-aberration hero title.
- `src/components/plasma-field.tsx`: ambient cursor-reactive canvas background; rAF paused via `IntersectionObserver`, `visibilitychange`, and `prefers-reduced-motion`.

### Styles

- `src/app.css`: aggregator that `@import`s the per-surface stylesheets.
- `src/styles/`: `tokens.css`, `shell.css`, `header.css`, `hero.css`, `preview.css`, `controls.css`, `feedback.css`, `how-it-works.css`, `not-found.css`, `motion.css`.

### Worker orchestration

- `src/hooks/use-converter-worker.ts`: persistent worker lifecycle, request IDs, cancellation, timeout handling, decode-path feature flagging.
- `src/lib/worker.ts`: thin worker entrypoint and transferable response posting.
- `src/lib/worker-runtime.ts`: request validation + preview/export execution logic.

### Color and encoding core

- `src/lib/pq.ts`: color transforms + PQ encode (with a 32K-entry LUT for the fast path) + SDR preview mapping (with a 4096-entry sRGB OETF LUT, preview-only).
- `src/lib/hdr-boost.ts`: single-source boost/nits calibration constants.
- `src/lib/look-controls.ts`: default look-control values, normalization, and shared preview constants (`PREVIEW_DEBOUNCE_MS`, `PREVIEW_MAX_LONG_EDGE_DEFAULT`).
- `src/lib/encode-png.ts`: PNG assembly/chunking/compression.
- `src/lib/icc-profile.ts`: Rec.2020 PQ ICC profile bytes used in the `iCCP` PNG chunk.

### SEO/config SSOT

- `src/lib/site-config.json`: site-wide metadata constants.
- `src/lib/seo-routes.json`: route metadata source of truth.
- `src/lib/seo-routes.ts`: typed accessors and runtime route maps.

## Worker Protocol

Request types:

- `convert`
- `preview`
- `cancel`

Response types:

- `result`
- `preview-result`

Contract is defined in `src/lib/worker-protocol.ts` and validated at runtime in `src/lib/worker-runtime.ts`.

## Build and Artifact Flow

1. `vite build` prerenders routes.
2. `scripts/prepare-pages-artifact.mjs` flattens Pages output, injects into each prerendered HTML:
   - `<link rel="modulepreload">` for the hashed worker chunk
   - `<link rel="preload" as="font" type="font/woff2" crossorigin>` for hero fonts (Space Grotesk 500/600, Inter 400)
   - `<link rel="prefetch">` for lazy route chunks (`how-it-works`, `guides`, `not-found`)

   and generates:
   - `dist/404.html`
   - `dist/sitemap.xml`
   - `dist/robots.txt`
   - `dist/.nojekyll` (explicit Pages/Jekyll opt-out)

3. `scripts/seo-check.mjs` verifies metadata invariants and writes `dist/seo-audit.json`.

## Quality Gates

`bun run check` enforces:

1. config/metadata validation
2. lint
3. format check
4. strict typecheck
5. coverage-gated tests
6. build + SEO checks
7. pages artifact verification

Performance tooling:

- `bun run bench:hdr`: benchmark corpus run + report.
- `bun run bench:compare`: enforce speed/size gates from benchmark report.
- `bun run perf:pr`: PR-profile benchmark + strict comparison gate.
- `.github/workflows/perf.yml`: scheduled/manual benchmark guard.

## E2E and CI Contracts

- `playwright.config.ts` runs critical Chromium E2E flows against the local app.
- CI (`.github/workflows/ci.yml`) requires:
  1. `bun run check`
  2. `bun run e2e:ci`
  3. `bun run perf:pr`

## Privacy and Observability Policy

- No third-party telemetry, analytics, or external error tracking SDKs.
- Operational debugging uses local reproduction, deterministic tests, and CI quality gates.
