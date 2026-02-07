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

## Build

```bash
bun run build
```

Output goes to `dist/`.

For GitHub Pages project-site routing, the build step normalizes prerendered pages into root-relative paths in `dist/` (for example, `dist/how-it-works/index.html`) and generates `dist/404.html` from `dist/index.html` for SPA fallback behavior.
