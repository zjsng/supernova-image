# Supernova

A client-side HDR PNG converter. Drop any image and get a true HDR PNG with PQ (ST 2084) transfer and Rec.2020 gamut — entirely in your browser, no uploads.

**[Try it live](https://zjsng.github.io/supernova-image/)**

## How it works

1. **Decode** — image is drawn to a canvas and read as raw pixel data
2. **Transform** — sRGB values are linearized, brightness-boosted, and encoded using the PQ transfer function into 16-bit values
3. **Encode** — pixels are wrapped in a PNG with cICP, cHRM, and iCCP metadata chunks for HDR10-compatible output

Everything runs in JavaScript. Your images never leave your device.

## Development

```bash
bun install
bun run dev
```

Architecture reference: `ARCHITECTURE.md`

## Build

```bash
bun run build
```

Output goes to `dist/`.

For GitHub Pages project-site routing, the build step normalizes prerendered pages into root-relative paths in `dist/` (for example, `dist/how-it-works/index.html`) and generates:

- `dist/404.html` fallback page
- `dist/sitemap.xml` from route metadata
- `dist/robots.txt` from site metadata
- `dist/seo-audit.json` SEO validation report

## Quality Gates

```bash
bun run check
```

`check` runs config validation, metadata sync checks, lint, format check, TypeScript typecheck, coverage-gated tests, build, and Pages artifact verification.

## E2E Gates

```bash
bun run e2e
```

Critical browser paths covered:

- upload image
- before/after preview update
- download action
- core routes (`/`, `/how-it-works`, `404`)

## Performance Gates

```bash
bun run bench:hdr
bun run bench:compare
bun run perf:pr
```

- `bench:hdr` generates `benchmarks/hdr-benchmark-report.json` for the synthetic corpus.
- `bench:compare` enforces speed/size gates (including median non-increase size gate).
- `perf:pr` runs PR-profile benchmark + strict compare gate.
- CI performance workflow: `.github/workflows/perf.yml` (manual + scheduled).

## Privacy and Incident Triage

- No uploads, no analytics, no third-party telemetry.
- For production issues, triage is reproduction-first:
  1. capture user-reported symptoms and browser/OS details
  2. reproduce locally with the same image and controls
  3. run `bun run check`, `bun run e2e`, and `bun run perf:pr`
  4. fix and verify before release
