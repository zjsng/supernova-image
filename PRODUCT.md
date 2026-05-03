# Product

## Register

product

## Users

Everyday web visitors — not photographers, not engineers, not designers. People who want to make an image absurdly bright and send it to a friend or coworker so it nukes their OLED phone or HDR monitor on receipt. The job-to-be-done is small, fast, and one-shot: land on the page, drop an image, push the brightness, download, send. They will likely never come back for the same image twice. They are not here to learn; they are here to leave with a payload.

Secondary: the same audience, surprised by how good the page looks, lingering on it a beat longer than the trolling required.

## Product Purpose

Supernova converts any image to a true HDR PNG (PQ / ST 2084 transfer, Rec.2020 gamut, HDR10-compatible) entirely in the browser. No upload, no account, no analytics.

It exists because the technical capability is real but underused — most people have never seen what their HDR display can actually do, because almost no consumer pipeline encodes for it. Supernova makes that one-click and giftable.

Success is measured in two layered outcomes:

1. **Utility** — the visitor downloads an HDR PNG that visibly outperforms an SDR copy when sent through iMessage / Discord / wherever. The tool does what it says.
2. **Memory** — they remember the page itself. "That neon HDR thing" becomes a site they bookmark, share, or cite as an example of a beautiful single-purpose web tool. Awwwards-grade craft is the second deliverable.

Both outcomes matter. Treating either as optional collapses the project into either a generic utility or a portfolio piece.

## Brand Personality

**Playful precision.** Three words that hold the tension:

- **Spectral** — light dispersed through a prism. Color is the subject, not decoration. The visuals behave like the thing they're encoding.
- **Exact** — every choice is committed. Tokens are precise, motion is intentional, copy is tight. The seriousness of the execution is the punchline.
- **Mischievous** — the implied use is "blast a friend's phone." The voice is dry, never apologetic, never winking too hard. Confidence carries the joke; sincerity would kill it.

Voice rules:

- Speak plainly. No marketing throat-clearing ("Powerful HDR conversion."), no exclamation points, no "✨ magic ✨".
- Don't explain the joke. The output speaks; the copy stays out of its way.
- Technical terms (PQ, Rec.2020, cICP, nits) appear unhedged. Curious visitors can click through to How It Works; everyone else trusts the tool.

## Anti-references

This should explicitly **not** look like:

- **A SaaS product page.** No three-column feature grids, no testimonial quotes, no "Trusted by teams at…", no gradient-on-white "Get started" buttons, no hero with a stock-photo mockup.
- **A generic dev tool / utility site.** No Bootstrap-grey chrome, no boxed `<input type="file">`, no "Drag & drop or click to upload" in body-weight grey on white, no logo grid of supported formats.
- **A "fun" site that screams fun.** No Comic Sans, no Memphis-pattern stickers, no chaotic rotated polaroids, no overdone glassmorphism stacked five layers deep, no tilted neon `text-shadow` heroes. Mischief comes from restraint plus a single committed gesture, not from piling on novelty.

Aesthetic-family reflexes to also avoid: terminal-on-black "hacker tool" framing, brutalist-grid editorial when it has nothing to say, AI-generated-startup gradient meshes.

## Design Principles

1. **Craft is the joke.** The gap between award-grade execution and "use this to ruin your friend's commute" is the entire concept. Don't soften either side. Premium components serving an irreverent purpose; never the other way around.

2. **One page, one job.** No navigation bloat, no settings panel, no accounts, no onboarding. Drop, adjust, download. Every additional step taxes the impulse that brought the visitor here. If a feature can't justify its place against that friction budget, it doesn't ship.

3. **Show, don't sell.** The page never promises HDR — it shows it. The preview is the demo, the chromatic title is the demo, the spectral palette is the demo. Marketing copy that describes the effect would compete with the effect. Let the artifact carry the argument.

4. **Privacy is structural, not a badge.** No uploads happen because the architecture forbids them, not because we wrote "Privacy-first" on the page. Mention it once, quietly (the privacy ribbon), and move on. Bragging about the absence of analytics is a tell that you considered adding them.

5. **No surface escapes the bar.** Every route — the converter, How It Works, the 404 — gets the same craft attention. A throwaway 404 or a plain how-to page would betray the personality. If a surface is worth shipping, it's worth being one of the best-looking instances of its kind.

## Accessibility & Inclusion

- **Target: WCAG 2.2 AA.** Color contrast, focus visibility, keyboard operability, semantic landmarks.
- **Reduced motion is a first-class state.** The plasma field, HDR bloom, and processing scan bar all collapse under `prefers-reduced-motion: reduce`. Any new decorative animation must do the same — disabled outright, not just shortened.
- **Spectral palette ≠ semantic color.** The six-hue palette is decorative; it's never the only signal for state. Success uses lime _and_ a checkmark; error uses red _and_ an icon and copy. A color-blind visitor must be able to operate the tool without distinguishing hues.
- **Keyboard reachability.** Every control reachable by mouse must be reachable by tab. Drop-zone, sliders, mode switch, download — all keyboard-operable with visible focus rings.
- **No motion-locked feedback.** Status changes (processing, success, error) must be conveyed in a static frame, not only by animation.
