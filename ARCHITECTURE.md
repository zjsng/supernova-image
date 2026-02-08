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

- `src/app.tsx`: route composition + header only.
- `src/routes/home.tsx`: converter page orchestration.
- `src/routes/how-it-works.tsx`: technical explanation page.
- `src/routes/guides.tsx`: SEO guide pages.
- `src/routes/not-found.tsx`: 404 route.
- `src/routes/shared.tsx`: shared route helpers and reusable route UI blocks.

### UI components

- `src/components/preview-pane.tsx`: upload/dropzone + before/after preview pane.
- `src/components/converter-controls.tsx`: all sliders + conversion actions.

### Worker orchestration

- `src/hooks/use-converter-worker.ts`: persistent worker lifecycle, request IDs, cancellation, timeout handling, decode-path feature flagging.
- `src/lib/worker.ts`: thin worker entrypoint and transferable response posting.
- `src/lib/worker-runtime.ts`: request validation + preview/export execution logic.

### Color and encoding core

- `src/lib/pq.ts`: color transforms + PQ encode + SDR preview mapping.
- `src/lib/hdr-boost.ts`: single-source boost/nits calibration constants.
- `src/lib/encode-png.ts`: PNG assembly/chunking/compression.

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
2. `scripts/prepare-pages-artifact.mjs` flattens Pages output and generates:
   - `dist/404.html`
   - `dist/sitemap.xml`
   - `dist/robots.txt`
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
