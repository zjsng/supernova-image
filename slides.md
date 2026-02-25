---
theme: seriph
colorSchema: dark
highlighter: shiki
transition: slide-left
title: Supernova — Client-Side HDR PNG Converter
---

# Supernova

Client-side HDR PNG converter

A side-project debugging story in three pivots

<div class="pt-12">
  <span class="px-2 py-1 rounded cursor-pointer" hover="bg-white bg-opacity-10">
    ZJ &middot; Traveloka Accommodations FE
  </span>
</div>

<!--
Opening: "This is the story of a side project that started with a very simple request and turned into a crash course in color science, binary formats, and browser quirks."

Keep it light — this is a story, not a lecture.
-->

---

# "Can you make this photo super bright?"

<div class="grid grid-cols-2 gap-8 items-center pt-4">
<div>

### The origin

- Reservist nights, looking for a side project
- PM Meldi sends a skiing photo of PM Geody
- "Can you make this *super bright*? Like, **glow** on my MacBook?"
- Curiosity + Claude kicked off the experiment
- Turns out: making a PNG "glow" on an HDR display is non-trivial

</div>
<div>

<img src="/slides-assets/origin-photo.jpeg" class="rounded shadow-lg" />

<p class="text-sm opacity-50 text-center mt-2">The original photo</p>

</div>
</div>

<!--
"Meldi sent me this photo and asked if I could make it glow on her MacBook Pro. I thought — how hard can it be? Turns out, very."

Mention reservist context: limited hours, focused sprints. This constraint actually helped — forced me to make progress in short bursts.
-->

---

# HDR 101 — What Makes a PNG Glow

<div class="grid grid-cols-2 gap-8 pt-4">
<div>

### Standard PNG (SDR)
- 8-bit per channel (0–255)
- sRGB color space (~36% of visible colors)
- Max brightness: 100 nits (SDR white)
- What you see is what you get

</div>
<div>

### HDR PNG
- **16-bit** per channel (0–65535)
- **BT.2020** gamut (~76% of visible colors)
- **PQ transfer function** (up to 10,000 nits)
- Metadata chunks: `cICP`, `cHRM`, `iCCP`

</div>
</div>

<div class="mt-8 text-center">

```
SDR_DIFFUSE_WHITE_NITS = 100
PQ_MAX_NITS            = 10,000
SDR_TO_PQ_SCALE        = 100 / 10,000 = 0.01
```

</div>

<!--
"Keep this in mind: SDR white is at 100 nits. PQ can represent up to 10,000 nits. So the entire SDR range is just the bottom 1% of PQ's dynamic range."

Don't go deep into PQ math here — just enough so the audience understands why we need 16-bit depth and special metadata.

The constants come directly from hdr-boost.ts.
-->

---

# v0: React + Canvas — "Just Ship It"

<div class="pt-4">

### Fastest path to test the idea

1. React for the UI — file upload, sliders, preview
2. Canvas API to decode pixels from the image
3. Manual PNG encoding for the HDR output
4. Ship it, test on a MacBook, see if it glows

### What worked
- UX iteration was fast — upload, tweak, export
- Canvas gives you `ImageData` with raw RGBA pixels

### What didn't
- **Browser color management is inconsistent** — same code, different colors across Chrome/Safari/Firefox
- Canvas can't produce HDR metadata chunks
- Couldn't tell if the output was *correct* or just *bright*

</div>

<!--
"React was the obvious choice to prototype fast. But I quickly hit a wall: browsers silently modify pixel values through color management. The same image looked different across browsers, and I had no way to know which output was 'correct'."

This is where I realized I needed actual forensic tools to validate the output.
-->

---

# Forensics: CLI Tools

How to actually verify your HDR PNG is correct

```bash
# Check bit depth and container format
file output.png

# macOS: inspect the embedded ICC profile
sips -g profile output.png

# ImageMagick: dump all PNG chunks and metadata
magick identify -verbose output.png

# FFmpeg: cross-check color info (primaries, transfer, matrix)
ffprobe -show_frames -select_streams v:0 output.png
```

<div class="mt-6">

### The lesson

**Measurable checks over guesswork.**

If you can't verify it with a tool, you don't know if it works.

</div>

<!--
"These four commands became my acceptance test suite. Every time I changed the pipeline, I'd run these and check the output."

Show each briefly:
- file: tells you 16-bit RGB vs 8-bit RGBA
- sips: macOS-native, shows ICC profile name
- magick identify: the nuclear option — shows every chunk
- ffprobe: cross-references color info

Emphasize: this is what separates 'it looks bright' from 'it's actually correct HDR'.
-->

---

# The HDR PNG Checklist

Five acceptance criteria derived from forensics

<div class="pt-4">

| # | Check | Tool | What to look for |
|---|-------|------|-----------------|
| 1 | 16-bit RGB depth | `file` | "16-bit/color RGB" not "8-bit/color RGBA" |
| 2 | Valid ICC profile | `sips -g profile` | "Rec2020-PQ" or similar |
| 3 | cICP chunk values | `magick identify` | Primaries=9, Transfer=16, Matrix=0, Range=1 |
| 4 | cHRM chromaticity | `magick identify` | BT.2020 coordinates (not sRGB) |
| 5 | Real highlight headroom | Visual check | Bright areas **glow** on HDR display, not just clipped white |

</div>

<div class="mt-4 text-sm opacity-75">

Validation + visual check loop. Every pipeline change was tested against all five.

</div>

<!--
"This checklist became the north star. If any of these five were wrong, the image wouldn't display as HDR — even if it looked fine on a standard monitor."

Walk through each briefly. Emphasize #5: you need an actual HDR display to see the glow. A non-HDR monitor will just show clipped white.
-->

---

# Pivot 1: React → Rust CLI

<div class="grid grid-cols-2 gap-8 pt-4">
<div>

### Why isolate the pipeline

- Eliminate browser ambiguity entirely
- Byte-level control over PNG output
- Validate the math in isolation
- No Canvas API, no color management surprises
- Can run forensic tools on output immediately

</div>
<div>

### What it proved

- The pixel pipeline was **correct**
- PQ encoding + BT.2020 matrix math checked out
- ICC profile embedding worked
- All five checklist criteria passed

### ...but

- Sharing a CLI binary with PMs defeats the purpose
- "Can you compile this for my Mac?" is not a product

</div>
</div>

<!--
"The Rust CLI was never meant to be the final product. It was a controlled environment to prove the math. And it worked — the output passed every check."

"But then Meldi asked me to convert another photo, and I realized: I can't ask PMs to install Rust and run CLI commands."
-->

---

# Three Pivots, One Pipeline

<div class="pt-8">

```
Phase 1: React + Canvas
├─ Fast UX iteration
├─ Browser color management inconsistency
└─ Result: "works sometimes"

Phase 2: Rust CLI
├─ Byte-level PNG control
├─ Validated pipeline correctness
└─ Result: "works always, nobody uses it"

Phase 3: Preact + Web Worker
├─ Same proven pipeline, now in-browser
├─ GitHub Pages for easy sharing
└─ Result: "works always, anyone can use it"
```

</div>

<div class="mt-4 text-sm opacity-75">

Each pivot wasn't wasted — it proved something the next phase needed.

</div>

<!--
"This timeline is the core arc of the talk. Each phase looks like a failure, but each one proved something essential."

Phase 1 proved the UX. Phase 2 proved the math. Phase 3 combined both.

Mention: the total calendar time was spread over reservist nights + weekends, but actual coding time was maybe 2-3 focused weeks.
-->

---

# The ICC Profile Saga — The Bug

<div class="pt-4">

### The symptoms

- PNG output had correct cICP and cHRM chunks
- But colors looked *subtly wrong* on some displays
- No crash, no error — just wrong

### The root cause

```
Expected: binary ICC profile (~700 bytes)
Received: HTML redirect page (~2KB of "404 Not Found")
```

- Wrong URLs returning HTML/404 silently
- Case sensitivity: `.ICC` vs `.icc`
- HTTP redirects served HTML instead of binary
- `fetch()` returned 200 OK for the redirect page itself

</div>

<div class="mt-4 text-yellow-400 text-sm">

The scariest bugs are the ones that don't crash.

</div>

<!--
"This one cost me an entire weekend. The PNG was technically valid — every chunk was there. But the ICC profile bytes were actually an HTML page. And because fetch() doesn't throw on 404 redirects, it silently embedded a web page as a 'color profile'."

"The output looked *almost* right, which made it incredibly hard to debug."
-->

---

# The ICC Profile Saga — The Fix

<div class="pt-4">

### The breakthrough

Found the correct profile URL from the `w3c/png-hdr-pq` repository — a confirmed-working Rec2020-PQ ICC profile extracted from Chrome's HDR output.

### The code

```ts
// src/lib/icc-profile.ts — Vite ?url import for hashed static assets
import iccUrl from './rec2020-pq.icc?url'

export async function getICCProfileBytes(): Promise<Uint8Array> {
  const response = await fetch(iccUrl)
  return new Uint8Array(await response.arrayBuffer())
}
```

### The validation

- Added byte-length check: real ICC profile is ~700 bytes, not 2KB
- Vite's `?url` import ensures the `.icc` file is served as a hashed static asset
- No more relying on external URLs that might redirect

</div>

<!--
"The fix was simple once I found the right profile. But the hard-earned lesson was: always validate binary assets by their content, not just HTTP status."

"Vite's ?url import was the key — it copies the file into the build output with a content hash, so the URL always resolves to the actual binary."
-->

---

# Pivot 2: Rust CLI → Preact

<div class="pt-4">

### Why come back to the frontend

- Small one-off tool — sharing a URL beats sharing a binary
- GitHub Pages = free hosting, zero infra
- Validated pipeline from Rust translates 1:1 to TypeScript

### Why Preact over React

- **3KB** vs ~40KB — this is a single-page tool, not an app
- Same JSX/hooks API — zero learning curve
- Sufficient for: file upload, sliders, canvas preview, download button
- Lower overhead = faster load on mobile

### What stayed the same

- The pixel pipeline: sRGB → linear → BT.2020 → PQ
- Manual PNG encoding with fflate for compression
- All five validation criteria from the checklist

</div>

<!--
"The Rust CLI proved the math. But the goal was always 'PM Meldi can use this from a URL.' Preact gave us the same pipeline in a shareable format."

"Why Preact? For a tool this small, React's runtime is overkill. Preact's 3KB gives us everything we need."
-->

---

# GitHub Pages: The Base Path Trap

The single most common GitHub Pages deployment bug

<div class="pt-4">

```ts
// vite.config.ts

// Before: assets load from root → broken on github.io/supernova-image/
export default defineConfig({
  base: '/',
})

// After: assets load from the correct subpath
export default defineConfig({
  base: '/supernova-image/',
})
```

### What breaks without it

- All JS/CSS/asset URLs resolve to `username.github.io/assets/...`
- But the app lives at `username.github.io/supernova-image/`
- **Blank white page**, no errors in console (scripts just 404)

</div>

<!--
"This is one of those bugs that makes you feel stupid once you find it. Everything works in dev, everything works in preview, and then you deploy to Pages and get a blank screen."

"The fix is one line, but finding it costs you an hour of staring at network tab 404s."
-->

---

# GitHub Pages: Other Gotchas

<div class="pt-4">

### SPA routing fallback

GitHub Pages serves `404.html` for unknown routes — need a copy of `index.html` as `404.html` for client-side routing to work.

### Static asset paths

Binary assets like `.icc` files need Vite's `?url` import to get hashed paths. Without it, the file might not be included in the build output.

```ts
// This works — file is copied to dist/ with a content hash
import iccUrl from './rec2020-pq.icc?url'

// This breaks — relative path doesn't survive the base path
fetch('./rec2020-pq.icc')
```

### Prerender routes

```ts
// Must declare routes for static site generation
additionalPrerenderRoutes: ADDITIONAL_PRERENDER_ROUTES
```

</div>

<!--
"GitHub Pages has this fun quirk where it serves a 404 page for any route it doesn't recognize. For SPAs, you copy index.html to 404.html so the client-side router can take over."

"The ?url import pattern is critical for binary assets — it's the same fix that solved the ICC profile bug."
-->

---

# Pixel Pipeline: sRGB In, PQ Out

<div class="pt-2 text-sm">

```
┌──────────────┐
│  Canvas API   │  decode uploaded image → 8-bit RGBA ImageData
└──────┬───────┘
       ▼
┌──────────────┐
│  sRGB EOTF   │  v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)^2.4
└──────┬───────┘
       ▼
┌──────────────┐
│  BT.2020     │  3x3 matrix multiply (SRGB_TO_BT2020)
│  Color Space │  [0.627, 0.329, 0.043]
└──────┬───────┘  [0.069, 0.920, 0.011]
       │          [0.016, 0.088, 0.896]
       ▼
┌──────────────┐
│ Look Controls │  exposure, saturation, contrast, white balance,
│  (Grading)   │  shadow lift, highlight rolloff
└──────┬───────┘
       ▼
┌──────────────┐
│   PQ OETF    │  ((c1 + c2·L^m1) / (1 + c3·L^m1))^m2
│  (32K LUT)   │  m1=2610/16384, m2=2523/4096×128
└──────┬───────┘
       ▼
┌──────────────┐
│  16-bit      │  Math.round(pqEncode(channel) * 65535)
│  Quantize    │
└──────┬───────┘
       ▼
┌──────────────┐
│  Manual PNG  │  IHDR → cICP → cHRM → iCCP → IDAT → IEND
│  Encode      │  via fflate (zlib compression)
└──────┬───────┘
       ▼
┌──────────────┐
│  Download    │  Blob → URL.createObjectURL → <a>.click()
└──────────────┘

All runs in a Web Worker — UI stays responsive.
```

</div>

<!--
"This is the full pipeline. Each box is a real function in the codebase."

Walk through top to bottom:
- Canvas gives us 8-bit sRGB pixels
- sRGB EOTF linearizes (removes gamma)
- 3x3 matrix converts sRGB primaries to BT.2020
- Look controls apply grading in linear BT.2020
- PQ OETF encodes luminance (uses a 32K-entry LUT for speed)
- Quantize to 16-bit integers
- Manual PNG assembly with all the HDR metadata chunks
- Web Worker keeps the UI thread free

The matrix values and PQ constants are from the actual source code.
-->

---

# Building PNGs by Hand

<div class="pt-2">

### Why `canvas.toBlob()` can't do HDR

Canvas outputs 8-bit sRGB PNGs. No way to inject `cICP`, `cHRM`, or `iCCP` chunks. No 16-bit support.

### Chunk assembly order (matters!)

```
PNG Signature  [137, 80, 78, 71, 13, 10, 26, 10]
  │
  ├── IHDR     width, height, 16-bit depth, RGB color type
  ├── cICP     [9, 16, 0, 1]  — BT.2020 + PQ + RGB + full range
  ├── cHRM     BT.2020 chromaticity coordinates (×100,000)
  ├── iCCP     "Rec2020-PQ" + deflate-compressed ICC profile
  ├── IDAT     deflate-compressed 16-bit RGB scanlines
  └── IEND     empty (file terminator)
```

### Every chunk follows the same format

```
[4 bytes: data length][4 bytes: type][N bytes: data][4 bytes: CRC32]
```

CRC32 covers type + data. The iCCP profile must be deflate-compressed *inside* the chunk.

</div>

<!--
"This is where it gets fun — or terrifying, depending on your perspective. We're building a PNG file byte by byte."

"Each chunk is: length, type name, data, CRC32. The CRC covers the type and data but not the length. Get one byte wrong and the whole file is corrupt."

"The iCCP chunk is the trickiest — the ICC profile has to be deflate-compressed inside the chunk data, with a null-terminated name prefix."
-->

---

# Where We Are Now

<div class="pt-4">

### A working frontend tool

- Upload any photo → get an HDR PNG that glows on HDR displays
- Look controls: exposure, saturation, contrast, white balance, shadow lift
- Live SDR preview + full HDR export
- Runs entirely in the browser — no server, no uploads

### Built-in validation mindset

- Every output can be verified with CLI forensic tools
- Five-point checklist passes consistently
- ICC profile loaded from local static asset (no external dependencies)

### Shareable

- One URL: `zjsng.github.io/supernova-image/`
- Works on any modern browser
- No install, no CLI, no Rust toolchain

</div>

<!--
"This is where we are today. It's not a production app — it's a focused tool that does one thing well."

"The validation mindset is the real takeaway: every change is tested against the five-point checklist. No more 'it looks bright enough'."
-->

---

# Pair Programming with AI

<div class="pt-4">

### Where AI accelerated the build

- **Reverse-engineering**: understanding PQ math, ICC profile structure, PNG chunk format
- **Pipeline logic**: sRGB→BT.2020 matrix, PQ encoding, LUT generation
- **Profile/metadata reasoning**: debugging the ICC saga, cICP chunk values
- **Clipping reduction**: highlight rolloff, adaptive shoulder, desaturation
- **Deployment debugging**: GitHub Pages base paths, Vite config, SPA routing

### What AI couldn't replace

- **Forensic validation**: running CLI tools and interpreting output
- **Visual judgment**: "does this actually glow?" on a real HDR display
- **Architectural decisions**: when to pivot, what to keep, what to throw away
- **Domain taste**: knowing when the output looks *right* vs just *different*

### The pattern

AI as a fast technical copilot during iteration — not one-shot magic.
Human validation + tool-based checks still required.

</div>

<!--
"I want to be honest about the AI role. Claude was incredibly useful for the technical deep dives — color science, binary formats, standards specs. It's like having a colleague who's read every spec but never seen a monitor."

"The key: I never trusted AI output without running it through the forensic tools. The validation loop was always: AI generates → I verify with tools → iterate."
-->

---

# Lessons Learned

<div class="pt-6">

### 1. Validate binary assets, not just HTTP status

`fetch()` returns 200 for redirect pages. Check byte length and content, not just the response code.

### 2. Pivots are not waste — each proved something

React proved the UX. Rust proved the math. Preact combined both.

### 3. Side constraints forced focused iterations

Reservist schedule meant short sprints. No time for over-engineering.

### 4. Browser color management is a minefield

Same pixels, different rendering across browsers. The only truth is the file bytes.

### 5. GitHub Pages base paths break everything silently

One missing config line → blank page, no errors. Always set `base` in Vite.

</div>

<!--
Walk through each one briefly:

1. "This one cost me a weekend. Always check the actual bytes."
2. "If I'd gone straight to Preact, I wouldn't have caught the color management issues. Each pivot taught me something."
3. "Having limited time forced me to make real progress each session instead of yak-shaving."
4. "This is the big one for frontend devs. You cannot trust the browser to preserve your pixel values."
5. "Test your deployment URL, not just localhost."
-->

---
layout: center
---

# Try It Yourself

<div class="pt-8 text-center">

### [zjsng.github.io/supernova-image](https://zjsng.github.io/supernova-image/)

<div class="mt-8 text-sm opacity-75">

Source: [github.com/zjsng/supernova-image](https://github.com/zjsng/supernova-image)

**Stack:** Preact + TypeScript + Vite + fflate + Web Workers

**Pipeline:** sRGB → Linear → BT.2020 → PQ → 16-bit PNG

</div>

<div class="mt-8 text-lg">

"AI got me from zero-to-working in color science territory<br/>I normally wouldn't touch."

</div>

</div>

<!--
"That's it. If you have an HDR display, try uploading a photo and see the glow."

"The source code is all on GitHub. The interesting files are encode-png.ts for the PNG assembly, pq.ts for the color pipeline, and icc-profile.ts for the ICC saga."

"Questions?"
-->
