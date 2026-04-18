# Supernova Design System

The source of truth for visual decisions in this repo. When you add a component, page, or token, start here. If the doc and `src/styles/` disagree, **the CSS is canonical** — fix the doc.

This system is derived from the **Prism** variant of the Supernova redesign (Claude Design handoff `1ZFQ2n7MovMNKenvt2G4bw`). The bundle's other variants (Observatory, Afterburn) are reference-only; they are not implemented and should not inform new work.

---

## 1. Design philosophy

Five commitments shape every decision. Keep them in mind before reaching for new primitives.

- **Spectral HDR on a warm near-black base.** Backgrounds are dark warm (~`oklch(0.12 0.008 60)`), punctuated by highly saturated spectral accents. The app is a tool for making HDR images; the UI should feel like it has headroom the screen can't fully render.
- **One palette, six hues.** All spectral accents sit at roughly matched chroma (~0.2) and lightness (~0.78–0.88); only the hue changes. This lets us swap `--accent` (amber → cyan → violet → lime → pink) without rebalancing contrast.
- **Chromatic aberration as signature.** Cyan/pink layer offsets on the hero title, the glowing amber dot on the brand mark, the bloom drift on the "after" preview — all reinforce "light dispersed through a prism." Decorative color has a job.
- **Two-tier controls.** Boost and Saturation are dominant (warm glowing card, 22px display-font values in accent); the eight fine-tune sliders are a quiet, uniform grid below. If you add a control, decide which tier it belongs to; don't invent a third.
- **Ambient motion, not ornament.** The plasma field drifts on its own and lenses around the cursor; the "after" preview has a slow bloom drift; processing shows a scan line. Motion is always soft, paused under `prefers-reduced-motion`, and disabled when off-screen.

---

## 2. Color system

All colors live in `src/styles/tokens.css` as CSS custom properties. Always reference them by name — never inline the raw `oklch()` call.

### 2.1 Why oklch

Oklch is perceptually uniform: two colors with the same L/C but different hues look roughly equally bright and saturated. That's what lets the spectral palette reskin cleanly.

- **`L` (lightness)** 0–1, where 0 is black, 1 is white.
- **`C` (chroma)** saturation; 0 is gray, ~0.22 is the top of our palette.
- **`h` (hue)** 0–360°.

Use `oklch()` for every new color. The only places `rgba()` is acceptable: pure-black/white overlays (e.g. `rgba(0, 0, 0, 0.5)` for a scrim) and text shadows on pure white.

### 2.2 Background scale

| Token    | Value                  | Use for                               |
| -------- | ---------------------- | ------------------------------------- |
| `--bg-0` | `oklch(0.12 0.008 60)` | Page background, hero surface         |
| `--bg-1` | `oklch(0.16 0.01 55)`  | Cards, panels, preview frame interior |
| `--bg-2` | `oklch(0.2 0.012 55)`  | Hover surface, raised element         |

### 2.3 Ink (text) scale

| Token     | Value                  | Use for                                  |
| --------- | ---------------------- | ---------------------------------------- |
| `--ink`   | `oklch(0.96 0.008 75)` | Primary text, headlines, active UI       |
| `--ink-2` | `oklch(0.78 0.01 70)`  | Body prose, secondary copy               |
| `--ink-3` | `oklch(0.55 0.012 65)` | Captions, spec tags, muted labels        |
| `--ink-4` | `oklch(0.38 0.012 60)` | Hints, disabled, hint arrows, tick marks |

### 2.4 Lines / borders

| Token         | Value                        | Use for                                  |
| ------------- | ---------------------------- | ---------------------------------------- |
| `--line`      | `oklch(0.28 0.012 55)`       | Default 1px borders on cards/buttons     |
| `--line-soft` | `oklch(0.22 0.01 55 / 0.55)` | Divider lines, footer tops, subtle cells |

### 2.5 Spectral palette

Six hues, all at ~0.78–0.88 L and ~0.16–0.22 C. Use these for accents, state colors, and decorative gradients — never for body text or surfaces.

| Token           | Value                  | Role                                                          |
| --------------- | ---------------------- | ------------------------------------------------------------- |
| `--spec-red`    | `oklch(0.78 0.2 25)`   | Error indicators (rarely used directly — see `feedback.css`)  |
| `--spec-amber`  | `oklch(0.82 0.19 70)`  | **Default accent.** Download, active state, handles           |
| `--spec-lime`   | `oklch(0.88 0.2 130)`  | Success (download-success), full-support compat cards         |
| `--spec-cyan`   | `oklch(0.84 0.16 210)` | Chromatic-title left fringe; cool bloom layer                 |
| `--spec-violet` | `oklch(0.72 0.2 300)`  | Reserved (accent alt, deep shadows)                           |
| `--spec-pink`   | `oklch(0.78 0.22 350)` | Chromatic-title right fringe; accent-light; gradient terminus |

### 2.6 Accent system

`--accent` is a scoped alias. Components should **always** read `--accent` / `--accent-dim` rather than hardcoding `--spec-amber`, so a subtree can be reskinned by overriding two vars.

| Token            | Value                        | Use for                                                      |
| ---------------- | ---------------------------- | ------------------------------------------------------------ |
| `--accent`       | `var(--spec-amber)`          | Primary call-to-action; active state background; focus rings |
| `--accent-light` | `var(--spec-pink)`           | Secondary accent in gradients (amber→pink)                   |
| `--accent-dim`   | `oklch(0.82 0.19 70 / 0.15)` | Soft accent fills, selection bg, dim glows                   |
| `--glow`         | `var(--accent-dim)`          | Alias, retained for clarity at call sites                    |
| `--glow-strong`  | `oklch(0.82 0.19 70 / 0.4)`  | Stronger halo for hover/active glows                         |

> **Reskinning.** Apply a style object with `--accent` and `--accent-dim` to a subtree (see `accentStyle()` in the design bundle's `primitives.jsx`). If the repo gains a theme picker, extend that pattern — don't fork component styles.

### 2.7 Surface glass

| Token             | Value                       | Use for                                      |
| ----------------- | --------------------------- | -------------------------------------------- |
| `--surface-glass` | `rgba(255, 255, 255, 0.03)` | Subtle frosted highlight on layered elements |

### 2.8 Legacy aliases

These are kept so older consumers render correctly. **Don't introduce new uses.** Prefer the modern token in new code.

| Alias             | Points to     |
| ----------------- | ------------- |
| `--bg`            | `--bg-0`      |
| `--surface`       | `--bg-1`      |
| `--border`        | `--line`      |
| `--border-subtle` | `--line-soft` |
| `--text`          | `--ink`       |
| `--text-muted`    | `--ink-3`     |

---

## 3. Typography

Three families, all loaded via `@fontsource/*` (no external CDN). Each has a specific role; don't mix them.

```css
--font-display: 'Space Grotesk', system-ui, sans-serif; /* Headlines, metric values */
--font-body: 'Inter', system-ui, sans-serif; /* Prose, UI copy */
--font-mono: 'JetBrains Mono', ui-monospace, monospace; /* Labels, tags, numeric */
```

Base: `15px / 1.5`, antialiased, body font. See `tokens.css`.

### 3.1 Role → style table

| Role                   | Family  | Size                     | Weight | LH   | Tracking      | Example / selector          |
| ---------------------- | ------- | ------------------------ | ------ | ---- | ------------- | --------------------------- |
| Chromatic hero title   | Display | `clamp(48px, 7vw, 96px)` | 500    | 0.95 | −0.04em       | `.chromatic-title`          |
| How-it-works h1        | Display | `clamp(36px, 5vw, 64px)` | 500    | 1.05 | −0.035em      | `.how-hero h1`              |
| How-it-works h2        | Display | `clamp(24px, 3vw, 34px)` | 500    | 1.15 | −0.025em      | `.how-section h2`           |
| Long-form body         | Body    | 17px                     | 400    | 1.65 | —             | `.how-hero p`               |
| UI body / subhead      | Body    | 15px                     | 400    | 1.55 | —             | `.hero__subhead`            |
| Preview filename       | Display | 22px                     | 500    | —    | −0.02em       | `.preview-header__name`     |
| Hero slider label      | Display | 15px                     | 600    | —    | −0.01em       | `.hero-slider__label`       |
| Hero slider value      | Display | 22px                     | 500    | —    | −0.02em       | `.hero-slider__value`       |
| Peak metric value      | Display | 18px                     | 500    | —    | −0.01em       | `.peak-readout__value`      |
| Drop button title      | Display | 15px                     | 600    | —    | —             | `.drop-button__title`       |
| Download button        | Display | 14px                     | 600    | —    | 0.02em        | `.btn-download`             |
| Fine-tune label        | Mono    | 11px                     | 400    | —    | 0.06em, UPPER | `.slider-row__label`        |
| Fine-tune value        | Mono    | 11px                     | 400    | —    | tabular       | `.slider-row__value`        |
| Hero eyebrow           | Mono    | 10px                     | 400    | —    | 0.32em, UPPER | `.hero__eyebrow`            |
| Section eyebrow        | Mono    | 10.5px                   | 400    | —    | 0.22em, UPPER | `.section-eyebrow`          |
| Peak readout label/tag | Mono    | 9.5px                    | 400    | —    | 0.14em, UPPER | `.peak-readout__label`      |
| Preview mode picker    | Mono    | 9.5px                    | 500    | —    | 0.12em, UPPER | `.preview-mode-picker__btn` |
| Compare mode switch    | Mono    | 10px                     | 500    | —    | 0.1em, UPPER  | `.compare-mode-switch__btn` |
| Compare label          | Mono    | 9.5px                    | 400    | —    | 0.14em, UPPER | `.compare__label`           |
| Compare caveat         | Mono    | 9px                      | 400    | —    | 0.1em, UPPER  | `.compare__caveat`          |
| Drop button hint       | Mono    | 9px                      | 400    | —    | 0.16em, UPPER | `.drop-button__hint`        |
| Processing text        | Mono    | 12px                     | 400    | —    | 0.2em, UPPER  | `.processing-text`          |
| Privacy ribbon         | Mono    | 10px                     | 400    | —    | 0.14em, UPPER | `.privacy-ribbon`           |
| Header brand           | Mono    | 12px                     | 400    | —    | 0.18em, UPPER | `.header__brand`            |
| Header nav             | Mono    | 11px                     | 400    | —    | 0.14em, UPPER | `.header__nav-link`         |

### 3.2 Typography rules

- **Mono → labels, tags, hints, uppercase, metadata.** Anything with `text-transform: uppercase` and wide letter-spacing is mono.
- **Display → headlines and metric values.** Any number the user is meant to _read_ as a value (nits, multiplier, filename) is display.
- **Body → prose only.** Full-sentence copy ("PNG, JPEG, WebP, or AVIF in…"). Rarely appears in UI chrome.
- **Tabular nums for live updates.** Apply `font-variant-numeric: tabular-nums` to any numeric that changes (slider values, peak nits) so digits don't jitter.
- **Uppercase + letter-spacing go together.** An uppercase mono label without ≥0.06em tracking looks cramped.
- **Don't lower `--ink-3` or `--ink-4` for emphasis.** They're for de-emphasis; go up the scale instead.

---

## 4. Spacing, layout, radii

### 4.1 Spacing

No fixed scale token yet; use the values already in play. Common increments: **2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40, 48, 56, 64, 72, 80**. Pick neighbors, don't invent new gaps (e.g., avoid 15px if 14px or 16px fits).

Common patterns:

- **Panel padding** 20px 22px (controls), 18px 18px 4px (hero sliders card), 10px 14px (peak readout)
- **Card gaps** 14px (column stack), 28px (preview layout), 10px (button row)
- **Hero vertical** 24px 0 40px; min-height 460px

### 4.2 Radii

| Token         | Value | Use for                                                                 |
| ------------- | ----- | ----------------------------------------------------------------------- |
| `--radius-lg` | 10px  | Large surfaces (e.g. tweaks panel)                                      |
| `--radius-md` | 6px   | **Default** — cards, panels, preview frame, pipeline stage, mode picker |
| `--radius-sm` | 4px   | Buttons, inline pills, slider ticks                                     |

Drop zone uses 16px (bespoke outer shell); drop button 8px. Slider thumbs are 50% (circular). Compare-cell label pill is 3px. Avoid introducing new discrete radii — reach for 4/6/10 first.

### 4.3 Container widths

- **How It Works / long-form** `max-width: 920px`, centered (`src/styles/how-it-works.css`).
- **App shell** fills viewport; header and content use 48px horizontal padding at >880px, 24px below.

### 4.4 Preview layout

```
.preview-layout {
  display: grid;
  grid-template-columns: 1.7fr 1fr;  /* preview · controls */
  gap: 28px;
}
@media (max-width: 880px) { grid-template-columns: 1fr; }
```

### 4.5 Fine-tune slider grid (unified)

Every fine-tune slider uses the same three-column grid. **Do not bypass this** — consistency of track width across labels of different lengths is the reason for the grid.

```
.slider-row {
  grid-template-columns: var(--slider-label-w) 1fr var(--slider-value-w);
  gap: 14px;
}
--slider-label-w: 120px;
--slider-value-w: 56px;
```

### 4.6 Z-index stack

| Z     | Layer                                                   |
| ----- | ------------------------------------------------------- |
| 0     | Plasma field canvas, grain overlay                      |
| 1     | Route content (`.prism-home__content`, `.how-it-works`) |
| 2     | HDR bloom, compare drag cell                            |
| 3     | Drop-zone inner, chromatic-title accent                 |
| 4     | Compare labels & caveat, drop-zone overlay              |
| 5     | Compare drag handle, header                             |
| 6     | Compare mode switch                                     |
| 10    | Processing overlay                                      |
| 10000 | Design bundle tweaks panel (not shipped)                |

Don't reach for a new z-band without pinning down where it fits here.

### 4.7 Breakpoints

Two breakpoints, both in `src/styles/motion.css`:

- **880px** — preview/how-split collapses to 1 column; compat grid 4→2; shell padding tightens.
- **560px** — chromatic title downsizes (`clamp(36px, 11vw, 56px)`); hero eyebrow shrinks; compat grid 2→1; nav gap tightens.

---

## 5. Core components & patterns

For each pattern, use the listed class/selector as-is; if you need a variant, extend it with a modifier class (`--after`, `--active`, etc.) rather than a new component.

### 5.1 SpectralMark (brand lockup)

**Where:** inline SVG in `src/app.tsx`.
**What:** 18×18 circle — 1.5px ring with a 5-stop linear gradient (red → amber → lime → cyan → violet), 2.5px inner dot filled `--accent` with `drop-shadow(0 0 4px var(--accent))`.
**Rule:** don't redraw this. The mark is the identity. If the header context changes, reuse `<SpectralMark />`.

### 5.2 ChromaticTitle

**Where:** `src/components/chromatic-title.tsx`, styles in `src/styles/hero.css` (`.chromatic-title`).
**Layers:**

- `--cyan` absolute, `color: var(--spec-cyan)`, `opacity: 0.3`, `transform: translate(-3px, 1px)`, `mix-blend-mode: screen`.
- `--pink` mirror at `translate(3px, -1px)` on `--spec-pink`.
- Main span on top, `color: var(--ink)`.
  **Accent line:** a single line can use `.chromatic-title__line--accent` to color the main span `--accent` (used on "Get HDR back.").
  **Rule:** never adjust the 3px offset or 0.3 opacity — the effect breaks if it drifts into "double vision" territory.

### 5.3 Hero slider (Boost / Saturation)

**Where:** `src/components/converter-controls.tsx`, styles in `src/styles/controls.css` (`.hero-slider`, `.hero-sliders`).
**Visual:** warm glowing card — `linear-gradient(180deg, oklch(0.18 0.04 60 / 0.5), oklch(0.14 0.02 55 / 0.2))`, 1px warm border, inset top highlight + 32px outer glow. Track: 6px rail on `oklch(0.22 0.01 55)`, fill gradient `oklch(0.55 0.15 40) → oklch(0.75 0.18 60) → oklch(0.8 0.2 85)` with 12px warm glow. Thumb: 18px white circle, 2px accent ring, 16px warm halo, 8px drop shadow.
**Header:** display-500 label left (15px) + mono sub tag (9.5px uppercase) + display-500 22px **accent-colored value** right.
**Rule:** only Boost and Saturation go here. Adding a third hero slider requires an explicit hierarchy decision.

### 5.4 Fine-tune slider (Exposure, Temperature, Tint, Gamma, Contrast, Rolloff, Shadow Lift, Vibrance)

**Where:** `src/styles/controls.css` (`.slider-row`).
**Visual:** 2px rail on `--line`, fill gradient `--spec-amber → --spec-pink`, 14px `--ink` thumb, 1px white inner stroke + 16px accent glow (expands to 24+48px on row hover). Optional `centered` variant grows fill outward from 50% and renders an `--ink-4` tick at center.
**Layout:** the 120px/1fr/56px grid (see §4.5). Labels uppercase mono 11px 0.06em, values mono 11px right-aligned tabular.
**Rule:** every non-hero control goes through this primitive. Don't duplicate the CSS for one-offs.

### 5.5 Compare surface (split / drag / swap)

**Where:** `src/components/compare.tsx`, styles in `src/styles/preview.css` (`.compare`, `.compare-handle`, `.compare-mode-switch`).
**Modes:**

- **Split** — CSS Grid `1fr 1fr` with a 2px `--line` divider.
- **Drag** — full-width before, clip-path reveal of after; 2px vertical `--accent` line (20px glow) with a 44px knob: `rgba(0,0,0,0.7)` + `blur(8px)`, 1.5px accent border, 30px accent glow.
- **Swap** — absolute layer with an in-frame mode switch top-right.
  **Labels:** 9.5px mono uppercase, glassmorphic `oklch(0.14 0.01 55 / 0.92)` + `blur(6px)`, 1px border. `--after` variant colors the label **and** border in `--accent`.
  **Caveat:** "your display may cap these highlights" lives bottom of the `after` cell, `--ink-3` at 0.8 opacity.
  **Mode switch:** top-right pill, `rgba(0,0,0,0.6)` + `blur(8px)`, 2px inner padding, active button becomes `--accent` bg with `#0a0a0a` text.

### 5.6 Peak readout

**Where:** `src/styles/preview.css` (`.peak-readout`).
**Layout:** `auto 1fr auto` grid. Left: "PEAK · {nits} · NITS" (mono 9.5 uppercase / display 18 accent / mono 9.5 muted). Middle: 24 histogram bars, 28px tall, gap 2px. Right: spec tags (PQ · Rec.2020 · cICP muted).
**Bar coloring** (runtime, in `preview-pane.tsx`): hue ramps `240° → 20°` (blue shadows → red highlights). Non-HDR bars use `oklch(0.5 0.08 {hue})` at 70% opacity; HDR-bright bars (`t > 0.75`, `boost > 2`) jump to `oklch(0.75 0.2 {hue})` with a 6px glow.
**Rule:** when adding new metrics, match this frame — don't build a new panel style.

### 5.7 Drop zone + drop button

**Where:** `src/styles/hero.css` (`.drop-zone`, `.drop-button`, `.drop-button__plus`).
**Drop zone:** transparent by default; on `.dragover` the `::before`-less `&__overlay` animates in — `2px dashed --accent` + radial `circle 700px at 50% 50%, oklch(0.7 0.22 55 / 0.18)` overlay. Focus-visible: 2px solid accent outline, 8px offset.
**Drop button:** glassmorphic `oklch(0.14 0.01 55 / 0.6)` + `blur(8px)`, `--line` border, 8px radius, 14/18/22px padding. 22×22 plus icon drawn with two pseudo-elements (10×2 + 2×10 bars).
**Hover/focus:** background → `--accent`, border → `--accent`, text/icon → `#0a0a0a`, hint → `oklch(0.2 0.02 55)`, 40px outer `--accent-dim` glow.
**Rule:** don't recreate file-input buttons elsewhere — if the user needs to pick an image, route it through this component.

### 5.8 Action buttons

**Where:** `src/styles/controls.css` (`.btn`, `.btn-secondary`, `.btn-download`, `.btn-download--success`).
**Secondary** (e.g. "Reset"): 10/18, mono 11 uppercase 0.1em, transparent bg, `--line` border, 4px radius. Hover → `--ink` text, `--ink-3` border.
**Download:** display-600 14/0.02em, `#0a0a0a` text on `--accent`, 4px radius, dual glow (`0 0 30px --accent-dim, 0 0 60px --accent-dim`). `:disabled` fades to `oklch(0.4 0.05 60)` with muted text and no glow. Success variant (`--success`) swaps bg to `--spec-lime` with a lime glow.

### 5.9 Processing overlay

**Where:** `src/styles/preview.css` (`.processing-overlay`, `.scan-bar`, `.processing-text`).
**What:** absolute `inset:0`, `rgba(0, 0, 0, 0.5)` + `blur(4px)`. A 2px horizontal gradient bar (`transparent → --accent → transparent`, 20px glow) animates top→bottom via `scan 1.5s ease-in-out infinite`. Centered mono 12 0.2em accent label ("CONVERTING").
**Rule:** any long-running op in the preview frame uses this overlay — don't add a spinner elsewhere.

### 5.10 Pipeline stage (How It Works)

**Where:** `src/styles/how-it-works.css` (`.pipeline-flow`, `.pipeline-stage`).
**Frame:** 22px padding, 1px `--line`, 6px radius, `oklch(0.14 0.01 55 / 0.4)` bg. Flex row of stages with `.pipeline-arrow` separators (18×18 SVG chevron in `--ink-4`).
**Stage states:**

- default — `--line` border, `oklch(0.16 0.01 55 / 0.6)` bg
- `--input` — `--ink-4` border (faded entry point)
- `--output` — `--accent` border, `--accent-dim` bg (destination)

**Rule:** any future multi-step flow should reuse `.pipeline-flow / .pipeline-stage`. The input/output variants carry semantic meaning — don't repurpose them for decoration.

### 5.11 Nits row (How It Works)

**Where:** `.nits-scale`, `.nits-row`. Grid `60px / 1fr / 160px` (tightens to `50px / 1fr / 110px` at ≤560px). Default fill is `--ink-4` on a `--line` track; `.nits-row--accent` uses a `--accent → --spec-pink` gradient fill with an 8px `--accent-dim` glow and accent-colored value.

### 5.12 Compat card (How It Works)

**Where:** `.compat-grid`, `.compat-card`. 18/14 padding, center-aligned flex column on `oklch(0.14 0.01 55 / 0.4)`. 28×28 round `__status` badge holds a 16×16 SVG check/x. Three variants:

- `--full` — lime-tinted status (`oklch(0.88 0.2 130 / 0.18)` bg, `--spec-lime` icon, 14px lime glow)
- `--partial` — `--accent-dim` bg, accent icon, 14px accent glow
- `--none` — muted `oklch(0.2 0.01 55)` bg, `--ink-4` icon, no glow

### 5.13 Reveal animation

**Where:** `.will-reveal → .revealed` (how-it-works). `opacity 0 → 1` and `translateY 12px → 0` over 480ms ease. Used by `RevealSection` via IntersectionObserver. Reuse this pattern (not a new one) for content that should appear on scroll.

### 5.14 Plasma field

**Where:** `src/components/plasma-field.tsx`.
**Rules:**

- Five spectral blobs on independent Lissajous orbits, screen-blended, cursor-lensed.
- Must be paused under `prefers-reduced-motion`, when off-screen (`IntersectionObserver`), and on `visibilitychange`.
- `pointer-events: none`, `z-index: 0`, max DPR 2.
- **Do not** add new full-viewport canvas effects elsewhere. If a route needs ambient motion, it extends plasma-field or it doesn't get it.

### 5.15 Error banner & privacy ribbon

**Where:** `src/styles/feedback.css`.
**Error banner:** red-tinted `oklch(0.2 0.08 25 / 0.3)` bg, `oklch(0.6 0.18 25 / 0.5)` border, `oklch(0.85 0.1 25)` text, 11px mono. All feedback uses this pattern — don't invent new color states.
**Privacy ribbon:** top-bordered `--line-soft` footer, 10px mono uppercase 0.14em, `--ink-3` default → `--ink` on hover.

---

## 6. Motion

All keyframes live in `src/styles/motion.css` and `preview.css`.

### 6.1 Transitions

| Speed | Var                 | Use                                                          |
| ----- | ------------------- | ------------------------------------------------------------ |
| 120ms | — (inline)          | Slider thumb shadow, preview-mode picker hover               |
| 180ms | — (inline)          | Peak-readout bar height                                      |
| 200ms | `--transition-base` | **Default** — background, border, color, box-shadow, opacity |
| 220ms | — (inline)          | Drop-zone overlay fade                                       |
| 320ms | `--transition-slow` | Reserved for larger state shifts                             |

Rule: use `--transition-base` for interactive state changes unless you have a concrete reason to choose otherwise.

### 6.2 Keyframes

| Name          | Duration / easing                  | What it's for                        |
| ------------- | ---------------------------------- | ------------------------------------ |
| `scan`        | 1.5s ease-in-out infinite          | Processing overlay bar sweep         |
| `bloom-drift` | 12s ease-in-out infinite alternate | HDR bloom on `after` preview         |
| `pulse-dot`   | 2.8s ease-in-out infinite          | 404 star pulse                       |
| `fade-up`     | one-shot                           | Reserved (defined, currently unused) |

### 6.3 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .hdr-bloom,
  .scan-bar,
  .not-found__star::before {
    animation: none !important;
  }
}
```

**Rule.** Any new decorative animation must either collapse under this rule or get its own `animation: none` override. If it can't (e.g. a progress indicator genuinely requires motion), document the exception.

---

## 7. Iconography & imagery

- **No icon font, no icon library.** All glyphs are custom inline SVG.
- **SpectralMark** is the only brand asset — defined inline in `src/app.tsx`. Reuse it for every header; don't fork.
- **Inline chart SVGs** (PQ curve, gamut diagram, pipeline arrow, check/x marks) live next to the component that owns them, under `src/components/`.
- **Public assets** — `favicon.svg`, `og-image.png` — live in `src/public/`.
- Set `aria-hidden="true"` on decorative SVGs (plasma canvas, grain overlay, mark flourishes).

---

## 8. CSS architecture

- **Pure CSS, no preprocessor.** `src/app.css` aggregates everything via `@import` — no CSS-in-JS, no Tailwind, no Sass. Keep it that way.
- **One file per concern** under `src/styles/`:

| File               | Concern                                                         |
| ------------------ | --------------------------------------------------------------- |
| `tokens.css`       | Vars, reset, base elements, `::selection`, `.visually-hidden`   |
| `shell.css`        | Home layout, plasma positioning, grain overlay                  |
| `header.css`       | Brand lockup + nav                                              |
| `hero.css`         | Empty state — eyebrow, chromatic title, drop zone               |
| `preview.css`      | Loaded state — preview frame, compare, peak readout, processing |
| `controls.css`     | Controls panel, hero + fine-tune sliders, buttons, filename     |
| `feedback.css`     | Error banner, privacy ribbon                                    |
| `how-it-works.css` | Technical page — pipeline, nits, compat cards, reveal           |
| `not-found.css`    | 404 page star + link                                            |
| `motion.css`       | Keyframes, reduced-motion overrides, responsive breakpoints     |

New work slots into an existing file when it's a natural extension; a new file is fine when a new route/page needs its own concern.

- **BEM-ish naming** — `.block`, `.block__element`, `.block--modifier`. No utility classes.
- **Dark-only.** There's no light mode toggle. Do not author colors for a second theme.

---

## 9. Authoring rules (the don'ts)

- **Don't hardcode hex colors.** Use tokens. If a new hue is genuinely needed, add it to `tokens.css` at matching L/C and document the rationale.
- **Don't hardcode `--spec-amber` in component styles.** Use `--accent` / `--accent-dim` so a subtree can be reskinned.
- **Don't bypass `.slider-row`.** Every fine-tune-style control uses the unified grid.
- **Don't add a third control tier.** Boost/Saturation are hero; everything else is fine-tune.
- **Don't add decorative animation without a reduced-motion path.** The two existing exceptions (`.hdr-bloom`, `.scan-bar`) are disabled outright — follow suit.
- **Don't introduce new z-index bands.** Fit into §4.6 or amend it deliberately.
- **Don't add an icon library.** Inline SVG only.
- **Don't introduce CSS-in-JS, Sass, PostCSS preprocessing, or a utility framework.** Pure CSS with `@import`.
- **Don't duplicate compare / drop / peak primitives.** If a new page needs the same behavior, import the component.
- **Don't write prose in mono or labels in body.** The role conventions in §3.2 are load-bearing.

---

## 10. Provenance

This document is derived from the **Prism** variant in the Claude Design handoff bundle `1ZFQ2n7MovMNKenvt2G4bw` (April 2026). The bundle's Observatory and Afterburn variants, and the earlier prism-beam hero exploration, are reference material only and were intentionally not shipped. Ambient motion — the plasma field — replaced the interactive prism beam after user feedback, and remains the canonical idle-state ornament.

When the design evolves (a new variant, a second accent track, a light mode), update this file in the same PR. Future contributors should be able to read this doc and make a new component match the existing surface without opening any CSS file.
