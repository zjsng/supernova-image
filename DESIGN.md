---
name: Supernova
description: Client-side HDR PNG converter — drop, push, download, send.
colors:
  hearth-black: 'oklch(0.12 0.008 60)'
  hearth-black-1: 'oklch(0.16 0.01 55)'
  hearth-black-2: 'oklch(0.2 0.012 55)'
  bone-light: 'oklch(0.96 0.008 75)'
  bone-light-2: 'oklch(0.78 0.01 70)'
  bone-light-3: 'oklch(0.55 0.012 65)'
  bone-light-4: 'oklch(0.38 0.012 60)'
  line: 'oklch(0.28 0.012 55)'
  line-soft: 'oklch(0.22 0.01 55 / 0.55)'
  spectral-red: 'oklch(0.78 0.2 25)'
  headroom-amber: 'oklch(0.82 0.19 70)'
  compat-lime: 'oklch(0.88 0.2 130)'
  aberration-cyan: 'oklch(0.84 0.16 210)'
  reserve-violet: 'oklch(0.72 0.2 300)'
  aberration-pink: 'oklch(0.78 0.22 350)'
  accent: '{colors.headroom-amber}'
  accent-light: '{colors.aberration-pink}'
  accent-dim: 'oklch(0.82 0.19 70 / 0.15)'
  glow-strong: 'oklch(0.82 0.19 70 / 0.4)'
  ink-on-accent: '#0a0a0a'
typography:
  display:
    fontFamily: 'Space Grotesk, system-ui, sans-serif'
    fontSize: 'clamp(48px, 7vw, 96px)'
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: '-0.04em'
  headline:
    fontFamily: 'Space Grotesk, system-ui, sans-serif'
    fontSize: 'clamp(36px, 5vw, 64px)'
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: '-0.035em'
  title:
    fontFamily: 'Space Grotesk, system-ui, sans-serif'
    fontSize: '22px'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '-0.02em'
  body:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.55
  body-long:
    fontFamily: 'Inter, system-ui, sans-serif'
    fontSize: '17px'
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: '11px'
    fontWeight: 400
    letterSpacing: '0.06em'
    fontFeature: 'tabular-nums'
  eyebrow:
    fontFamily: 'JetBrains Mono, ui-monospace, monospace'
    fontSize: '10px'
    fontWeight: 400
    letterSpacing: '0.32em'
rounded:
  sm: '4px'
  md: '6px'
  lg: '10px'
  drop-button: '8px'
  drop-zone: '16px'
spacing:
  hairline: '2px'
  xxs: '4px'
  xs: '8px'
  sm: '10px'
  md: '14px'
  base: '18px'
  lg: '22px'
  xl: '28px'
  xxl: '48px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.ink-on-accent}'
    typography: '{typography.title}'
    rounded: '{rounded.sm}'
    padding: '10px 18px'
  button-primary-hover:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.ink-on-accent}'
  button-primary-success:
    backgroundColor: '{colors.compat-lime}'
    textColor: '{colors.ink-on-accent}'
  button-primary-disabled:
    backgroundColor: 'oklch(0.4 0.05 60)'
    textColor: '{colors.bone-light-3}'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.bone-light-2}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '10px 18px'
  button-secondary-hover:
    backgroundColor: 'transparent'
    textColor: '{colors.bone-light}'
  drop-button:
    backgroundColor: 'oklch(0.14 0.01 55 / 0.6)'
    textColor: '{colors.bone-light}'
    typography: '{typography.title}'
    rounded: '{rounded.drop-button}'
    padding: '14px 18px 22px'
  drop-button-hover:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.ink-on-accent}'
  card:
    backgroundColor: '{colors.hearth-black-1}'
    textColor: '{colors.bone-light}'
    rounded: '{rounded.md}'
    padding: '20px 22px'
  pipeline-stage:
    backgroundColor: 'oklch(0.16 0.01 55 / 0.6)'
    textColor: '{colors.bone-light}'
    rounded: '{rounded.md}'
    padding: '14px 16px'
  pipeline-stage-output:
    backgroundColor: '{colors.accent-dim}'
    textColor: '{colors.bone-light}'
    rounded: '{rounded.md}'
    padding: '14px 16px'
---

# Design System: Supernova

## 1. Overview

**Creative North Star: "The Prism in the Dark"**

Supernova is a single-purpose HDR converter dressed as a piece of optical equipment in a dim warm room. The page is a near-black surface tinted toward amber, lit from within by a slow plasma drift; on top of it sits a chromatic-aberration title, six matched spectral hues, and a pair of warmly glowing controls. The visual language behaves like the thing it encodes — color is the subject, not decoration. When you push the Boost slider, the preview reaches into headroom your monitor may not be able to fully render, and the interface holds the same posture: more saturated than it strictly needs to be, with a confidence that doesn't apologize.

This system explicitly rejects three reflexes. It is not a SaaS product page (no feature grids, no testimonials, no flat hero on cream). It is not a generic dev-tool utility (no Bootstrap-grey chrome, no boxed file input, no logo grid of supported formats). And it is not a "fun" site that screams fun (no chaotic Memphis stickers, no tilted neon, no five-layer glass stack). The mischief PRODUCT.md describes is delivered through restraint plus one committed gesture, never through novelty pile-on. If you can guess the aesthetic from the category alone — "image tool → either grey-utility or AI-gradient-mesh" — the design has failed; Supernova is neither.

**Key Characteristics:**

- Warm near-black surface (~`oklch(0.12 0.008 60)`), never `#000`. Every neutral is tinted toward the brand hue.
- Six spectral accents at matched chroma (~0.16–0.22) and lightness (~0.78–0.88). Hue varies; perceptual weight does not.
- Chromatic aberration as signature gesture — cyan/pink offsets on the hero title, amber dot on the brand mark, bloom drift on the "after" preview.
- Two-tier control hierarchy. Boost and Saturation are dominant (warm glowing card, 22px display values in accent); eight fine-tune sliders are a quiet uniform grid below.
- Ambient motion, never ornament. Plasma field drifts and lenses around the cursor; bloom drifts; processing scan-bar sweeps. All disabled under `prefers-reduced-motion` and when off-screen.
- Pure CSS, BEM-ish naming, no preprocessor, no utility framework, no icon library. One file per surface concern under `src/styles/`.

## 2. Colors: The Spectral Palette

A single dark warm base lit by six matched spectral hues. The system reskins by overriding two custom properties (`--accent`, `--accent-dim`); component CSS never hardcodes a spectral token. Every value is OKLCH; hex appears only as `#0a0a0a` for ink-on-accent.

### Primary

- **Headroom Amber** (`oklch(0.82 0.19 70)`, token `--spec-amber` / `--accent`): the default accent. Drop-button hover, download CTA, slider thumbs, fill gradients on hero sliders, focus rings, accent-colored slider values. Carries the brand promise of HDR brightness — it's the color you press to make something glow.

### Secondary

- **Aberration Pink** (`oklch(0.78 0.22 350)`, token `--spec-pink` / `--accent-light`): the right fringe of the chromatic title and the terminus of the amber→pink gradient on fine-tune slider fills. Always paired with amber; never used alone for state.

### Tertiary

- **Compat Lime** (`oklch(0.88 0.2 130)`, token `--spec-lime`): success state. Download-success button, the `--full` variant of compat cards, full-support status badges. Paired with a checkmark glyph so the signal is never color-only.

### Neutral

- **Hearth Black** (`oklch(0.12 0.008 60)`, token `--bg-0`): page background, hero surface. Warm-tinted near-black; never `#000`.
- **Hearth Black 1** (`oklch(0.16 0.01 55)`, token `--bg-1`): cards, panels, preview frame interior.
- **Hearth Black 2** (`oklch(0.2 0.012 55)`, token `--bg-2`): hover surfaces, raised elements.
- **Bone Light** (`oklch(0.96 0.008 75)`, token `--ink`): primary text, headlines, active UI labels.
- **Bone Light 2** (`oklch(0.78 0.01 70)`, token `--ink-2`): body prose, secondary copy.
- **Bone Light 3** (`oklch(0.55 0.012 65)`, token `--ink-3`): captions, spec tags, muted labels.
- **Bone Light 4** (`oklch(0.38 0.012 60)`, token `--ink-4`): hints, disabled, tick marks.
- **Line** (`oklch(0.28 0.012 55)`, token `--line`): default 1px borders on cards and buttons.
- **Line Soft** (`oklch(0.22 0.01 55 / 0.55)`, token `--line-soft`): dividers, footer tops, subtle cell separators.

### Reserve

- **Aberration Cyan** (`oklch(0.84 0.16 210)`, token `--spec-cyan`): chromatic title left fringe; cool bloom layer.
- **Reserve Violet** (`oklch(0.72 0.2 300)`, token `--spec-violet`): held in palette for accent-alt or deep shadows; not currently shipped on a route.
- **Spectral Red** (`oklch(0.78 0.2 25)`, token `--spec-red`): error indicator hue; in practice consumed via `feedback.css` color blends, not used directly on text.

### Named Rules

**The Single-Accent Reskin Rule.** Components read `--accent` and `--accent-dim`; they never hardcode `--spec-amber` or any other spectral token. A subtree can be themed in one place by overriding those two variables. Forking component CSS to recolor is forbidden.

**The Matched-Chroma Rule.** Every spectral accent sits at `L ≈ 0.78–0.88` and `C ≈ 0.16–0.22`. New decorative hues must enter at the same perceptual weight or they will clash with the existing six. If a new color breaks the band, it doesn't ship.

**The Tinted-Neutral Rule.** No `#000`, no `#fff`. Neutrals are warm-biased toward hue 55–75 with chroma 0.008–0.012. The exception is `#0a0a0a` for ink-on-accent (high-contrast text on amber/lime), which is intentional and singular.

**The Color-Plus-Glyph Rule.** Color is never the only signal for state. Success carries a checkmark, error carries an icon and copy, pipeline output carries a label. A color-blind visitor must be able to operate every control without distinguishing hues.

## 3. Typography

**Display Font:** Space Grotesk (with `system-ui, sans-serif` fallback).
**Body Font:** Inter (with `system-ui, sans-serif` fallback).
**Label/Mono Font:** JetBrains Mono (with `ui-monospace, monospace` fallback).

**Character:** Three families, three roles, no overlap. Space Grotesk's geometric humanist proportions carry headlines and any number the user is meant to _read_ as a value. Inter does prose at 1.5–1.65 line-height. JetBrains Mono does every label, eyebrow, and metadata tag, always uppercase with wide letter-spacing — it's the typographic equivalent of the spec sheet on a piece of optical equipment.

### Hierarchy

- **Display** (Space Grotesk, weight 500, `clamp(48px, 7vw, 96px)`, line-height 0.95, tracking -0.04em): the chromatic hero title only. Negative tracking pulls the cyan/pink offset layers into perceptual unity with the main span.
- **Headline** (Space Grotesk, 500, `clamp(36px, 5vw, 64px)`, lh 1.05, -0.035em): How It Works h1. Same family, less tight, less large.
- **Title** (Space Grotesk, 500, 22px, lh 1.2, -0.02em): preview filename, hero slider value, peak metric value. The 22px "value" sizing is itself a signature — it's bigger than typical UI numerics because the value is what the user is actually looking at.
- **Body** (Inter, 400, 15px, lh 1.55): UI body, subhead, dialog copy. Cap line length at 65–75ch when prose runs more than two sentences.
- **Body-Long** (Inter, 400, 17px, lh 1.65): How It Works prose only. Longer line-height, slightly larger, for read-not-scan reading mode.
- **Label** (JetBrains Mono, 400, 11px, tracking 0.06em, UPPERCASE, tabular-nums): every fine-tune slider label and value. The tracking is load-bearing — without it, uppercase mono looks cramped.
- **Eyebrow** (JetBrains Mono, 400, 10px, tracking 0.32em, UPPERCASE): hero eyebrow, header brand, privacy ribbon. The widest tracking on the page; signals "this is metadata, not content."

### Named Rules

**The Mono-For-Metadata Rule.** Anything uppercase with letter-spacing ≥0.06em is JetBrains Mono. Anything full-sentence prose is Inter. Anything a user reads as a numeric value (nits, multiplier, filename) is Space Grotesk. Mixing roles — UI labels in body type, prose in mono — is forbidden.

**The Tabular-Numerics Rule.** Any numeric that updates live (slider values, peak nits, histogram readouts) carries `font-variant-numeric: tabular-nums` so digits don't jitter as values change.

**The Up-The-Scale-For-Emphasis Rule.** Don't lower `--ink-3` or `--ink-4` to mute. Don't raise saturation to emphasize. Move up the ink scale (`--ink-3 → --ink-2 → --ink`) and bump weight or size. The ink scale is for de-emphasis only.

## 4. Elevation

Supernova uses **glow-forward layering**, not shadow-forward. Depth is conveyed by accent halos, blurred glassmorphic surfaces, and inset highlights — not by box-shadows offset under elements. The result reads as "this surface is emitting light," consistent with the prism-in-the-dark metaphor. There is exactly one universal-shadow exception: the drop-button outer halo on hover, which uses a 40px `--accent-dim` outer glow as part of the accent-press response.

### Shadow Vocabulary

- **Accent halo** (`box-shadow: 0 0 30px var(--accent-dim), 0 0 60px var(--accent-dim)`): the download button's resting glow. Doubled for soft falloff.
- **Slider thumb halo** (`box-shadow: 0 0 16px var(--accent-dim), 0 8px 24px rgba(0,0,0,0.5)`): primary glow plus a single warm grounding shadow.
- **Hero card outer glow** (`box-shadow: inset 0 1px 0 oklch(0.5 0.05 60 / 0.3), 0 0 32px oklch(0.4 0.1 60 / 0.2)`): inset top highlight (the warm rim light) plus diffuse external warmth.
- **Drag-knob halo** (`box-shadow: 0 0 30px var(--accent), 0 4px 16px rgba(0,0,0,0.6)`): the compare-mode drag handle. Bright accent ring on a darker grounding shadow.

### Named Rules

**The Glow-Not-Drop-Shadow Rule.** When a surface needs to feel raised, use an outer accent halo or an inset highlight. Reaching for a downward-offset drop-shadow re-introduces the SaaS-card aesthetic Supernova explicitly rejects. Two named exceptions exist and may not be extended: the slider thumb's single warm grounding shadow (paired with a halo) and the `.preview-frame` grounding shadow (`0 30px 80px oklch(0 0 0 / 0.5)`), which lifts the floating preview off the plasma field on the largest visual frame on the page. Anywhere else, shadows are forbidden.

**The Glassmorphism-As-Tool Rule.** Glass surfaces (`backdrop-filter: blur(...)`) appear only where content sits behind the surface and must read through. Six current sites: drop-button background (`hero.css`), controls panel (`controls.css`), compare label (`preview.css`), compare-mode-switch (`preview.css`), drag-knob (`preview.css`), processing-overlay (`preview.css`). Decorative glass — glass for the look of glass, or stacked layers for visual interest — is forbidden.

## 5. Components

For each component, lead with the character line, then the spec.

### Buttons

Buttons are precise instruments, warmly lit. Two variants exist; do not invent a third.

- **Shape:** square-cornered (`4px` / `--radius-sm`). Pills are forbidden; the small radius keeps them feeling like physical buttons, not chat bubbles.
- **Primary (download):** Headroom Amber background, `#0a0a0a` text, Space Grotesk weight 600 at 14px with 0.02em tracking. Resting state carries a doubled `accent-dim` halo (30px + 60px). Disabled fades to `oklch(0.4 0.05 60)` text on muted bg with no glow. Success variant swaps bg to Compat Lime with a lime halo.
- **Secondary (reset):** transparent bg, 1px `--line` border, Bone Light 2 text in JetBrains Mono uppercase 11/0.1em. Hover lifts to Bone Light text and Bone Light 3 border. No fill on hover.
- **Hover / Focus:** `--transition-base` (200ms ease) on background, border, color, box-shadow, opacity. Focus-visible always carries a 2px Headroom Amber outline at 2px offset.

### Drop Zone + Drop Button

The drop zone is the page's first ask. It is not a boxed input.

- **Drop zone:** transparent at rest, `2px dashed Headroom Amber` overlay on `.dragover` plus a `radial-gradient(circle 700px at 50% 50%, accent-light @ 18%)` warm wash. Focus-visible: 2px solid accent outline at 8px offset.
- **Drop button:** glassmorphic `oklch(0.14 0.01 55 / 0.6)` + `backdrop-filter: blur(8px)`, 1px `--line` border, 8px radius, `14px 18px 22px` padding (asymmetric — extra bottom for the hint text). 22×22 plus glyph drawn with two pseudo-element bars (10×2 + 2×10), centered.
- **Hover/focus:** background → `--accent`, border → `--accent`, text and glyph → `#0a0a0a`, hint copy → `oklch(0.2 0.02 55)`, plus a 40px outer `--accent-dim` halo.
- **Rule:** there is no other file picker on the page. If the user needs to pick an image, the entry point is this component.

### Hero Slider (Boost / Saturation)

The dominant control. Two and only two sliders go here; adding a third requires an explicit hierarchy decision.

- **Card:** `linear-gradient(180deg, oklch(0.18 0.04 60 / 0.5), oklch(0.14 0.02 55 / 0.2))`, 1px warm border, inset top highlight + 32px outer warm glow.
- **Track:** 6px rail on `oklch(0.22 0.01 55)`. Fill gradient `oklch(0.55 0.15 40) → oklch(0.75 0.18 60) → oklch(0.8 0.2 85)` with a 12px warm glow.
- **Thumb:** 18px Bone Light circle, 2px accent ring, 16px warm halo, 8px grounding drop shadow.
- **Header layout:** display-500 label (15px) + mono sub tag (9.5px uppercase) on the left; display-500 22px **accent-colored value** on the right. The value reads as the headline of the row.

### Fine-Tune Slider (Exposure, Temperature, Tint, Gamma, Contrast, Rolloff, Shadow Lift, Vibrance)

The quiet uniform grid below the hero pair. Every non-hero control must use this primitive — duplicating the CSS for a one-off is forbidden.

- **Grid:** `120px / 1fr / 56px` (`--slider-label-w` / track / `--slider-value-w`), gap 14px. The fixed left and right columns are load-bearing — they keep tracks aligned across labels of different lengths.
- **Track:** 2px rail on `--line`, fill gradient `--spec-amber → --spec-pink`, optional `centered` variant grows fill outward from 50% with a Bone Light 4 tick at center.
- **Thumb:** 14px Bone Light, 1px white inner stroke, 16px accent halo. On row hover the halo expands to 24+48px.
- **Label:** uppercase mono 11px, tracking 0.06em.
- **Value:** mono 11px, right-aligned, tabular-nums.

### Compare Surface

Three modes (split / drag / swap) on a single primitive. The compare frame is the second-most-important surface on the page after the hero sliders.

- **Split:** CSS Grid `1fr 1fr` with a 2px `--line` divider.
- **Drag:** full-width before, clip-path reveal of after, 2px vertical Headroom Amber line with a 20px glow, 44px knob (`rgba(0,0,0,0.7)` + `blur(8px)`, 1.5px accent border, 30px accent halo).
- **Swap:** absolute layer with an in-frame mode switch (top-right pill).
- **Labels:** mono 9.5px uppercase, glassmorphic `oklch(0.14 0.01 55 / 0.92)` + `blur(6px)`, 1px border. The `--after` variant colors both label and border in `--accent`.
- **Mode switch:** top-right pill, `rgba(0,0,0,0.6)` + `blur(8px)`, 2px inner padding. Active button → `--accent` bg with `#0a0a0a` text.

### Cards / Panels

Cards are used sparingly, as actual containers for content groups, never as decoration.

- **Corner Style:** `6px` (`--radius-md`).
- **Background:** Hearth Black 1 (`oklch(0.16 0.01 55)`).
- **Border:** 1px `--line`. Border-only is the default; tinted backgrounds appear only when the card is functional (hero card, pipeline-output stage).
- **Internal Padding:** `20px 22px` for control panels; `18px 14px` for compat cards.
- **Shadow Strategy:** none by default. Reach for `--accent-dim` glow only when the card is actively glowing (hero, hover-active states). See Elevation.

### Pipeline Stage (How It Works)

A signature component. Describes the conversion flow as a sequence of optical equipment.

- **Frame:** flex row of `.pipeline-stage` separated by 18×18 SVG chevrons in Bone Light 4.
- **Default:** 1px `--line` border, `oklch(0.16 0.01 55 / 0.6)` bg, 6px radius, 14×16 padding.
- **Input variant** (`--input`): Bone Light 4 border (faded entry).
- **Output variant** (`--output`): Headroom Amber border, `--accent-dim` background. The output stage is the only colored cell — it carries semantic weight.

### Chromatic Title (Signature)

The page's strongest gesture. Three layered spans simulate light dispersion through a prism.

- **Main span:** Bone Light, top layer.
- **Cyan layer:** absolute, `color: --spec-cyan`, opacity 0.3, `transform: translate(-3px, 1px)`, `mix-blend-mode: screen`.
- **Pink layer:** absolute mirror, `translate(3px, -1px)`, `--spec-pink`, same opacity and blend mode.
- **Accent line modifier** (`--accent`): a single line can be re-colored to `--accent` (used on the second line of the home hero).
- **Rule:** never adjust the 3px offset or the 0.3 opacity. Below 2px the effect vanishes; above 4px or 0.5 opacity it crosses into double-vision territory and the title becomes hard to read.

### Inputs

Native `range` inputs only. There are no text fields, no selects, no checkboxes anywhere on the page. If a future feature needs one, it must justify breaking that surface area.

### Navigation

Header navigation is mono 11px uppercase with tracking 0.14em, Bone Light 3 default, Bone Light on hover. No icon, no underline, no border. Vertical separation from content is implicit (the page background bleeds through).

## 6. Do's and Don'ts

### Do

- **Do** read `--accent` and `--accent-dim` instead of hardcoding `--spec-amber`. A subtree must be reskinnable in two var overrides.
- **Do** pass every fine-tune control through `.slider-row`'s `120px / 1fr / 56px` grid. Track alignment across labels is the entire point of the grid.
- **Do** pair color signals with a glyph or copy. Compat Lime success carries a checkmark; Spectral Red error carries an icon and copy.
- **Do** disable decorative animation under `prefers-reduced-motion: reduce`. The two existing exceptions (`.hdr-bloom`, `.scan-bar`) are disabled outright via `animation: none`.
- **Do** reach for the existing primitive before authoring a new one. Compare, drop, peak readout, pipeline stage, compat card — these are the named affordances. Importing them is not optional politeness; it's the rule.
- **Do** keep 1px borders for default state and reserve thicker rings for focus-visible (2px solid accent at 2px offset on buttons; 8px offset on the drop zone).

### Don't

- **Don't** use `#000` or `#fff`. Tint every neutral toward the brand hue (chroma 0.008–0.012). The single hex exception is `#0a0a0a` for ink-on-accent.
- **Don't** introduce a third control tier. Boost and Saturation are hero; the eight named look controls are fine-tune; everything else fits one of those two grids or it doesn't ship.
- **Don't** stack glassmorphism for decoration. Glass surfaces appear only where content sits behind them and needs to be partially seen. Five-layer glass stacks are explicitly named in PRODUCT.md as a "screams fun" anti-pattern.
- **Don't** write a SaaS product page. No three-column feature grid, no "Trusted by teams at…", no testimonial quotes, no gradient-on-cream "Get started" button, no stock-photo mockup hero.
- **Don't** dress this as a generic dev-tool / utility. No Bootstrap-grey chrome, no boxed `<input type="file">`, no logo grid of supported formats, no "Drag & drop or click to upload" body-grey-on-white.
- **Don't** lean on tilted-neon, Memphis stickers, Comic Sans, or rotated polaroid clusters to signal playfulness. Mischief comes from one committed gesture (the chromatic title, the trolling-grade brightness preview), not from pile-on novelty.
- **Don't** introduce a new z-index band without amending `DESIGN_SYSTEM.md §4.6`. The current bands are deliberate.
- **Don't** add an icon library, CSS-in-JS, Sass, PostCSS preprocessing, or a utility framework. Pure CSS with `@import`, BEM-ish naming, custom inline SVG only.
- **Don't** use side-stripe `border-left` greater than 1px as a colored accent on a card or alert. If a row needs to read as state, use a full border, a tinted background, or a leading icon.
- **Don't** write gradient text via `background-clip: text`. Hierarchy is built from scale, weight, and a single solid color.
- **Don't** brag about privacy. The privacy ribbon is small, mono, and quiet. "No uploads, no analytics" lives there once and never appears as a hero claim.
- **Don't** drop the bar on secondary surfaces. The 404 and How It Works get the same craft attention as the converter. A throwaway 404 betrays the personality.
- **Don't** use em dashes or `--` in copy. Use commas, colons, semicolons, periods, or parentheses.
