# Design System — Premium Performance UI

The current visual direction aims for a premium, high-focus fitness product rather than a themed mythic interface. The style combines:
- high-contrast graphite surfaces with restrained glow and depth
- warm neutral highlights for completion, trust, and hierarchy
- a clean mint performance accent for active states and motion feedback
- compact PWA ergonomics with strong hierarchy, large tap targets, and minimal visual clutter

## Color Palette

- Background: deep charcoal with soft performance-light gradients.
- Surfaces: layered graphite panels with translucent depth and subtle borders.
- Accent 1: warm sand for highlights, metrics, and completion states.
- Accent 2: mint for active states, progress, and feedback.
- Text: high-contrast white with cooler secondary neutrals.

## Typography

- Display: `Space Grotesk`
  Used for logos, screen titles, and high-emphasis metrics.
  Goal: compact, modern, performance-oriented confidence.
- Body / UI: `Plus Jakarta Sans`
  Used for descriptive copy, metadata, CTAs, and app chrome.
  Goal: crisp mobile readability without feeling generic.
- Labels / utility: `IBM Plex Mono`
  Used for status text, chips, timing metadata, and system-style labels.
  Goal: give structure and rhythm to compact data without looking playful.
- Semantic scale:
  `--type-display-hero`, `--type-display-xl`, `--type-display-lg`, `--type-display-md`
  for branded hero moments, workout titles, and primary ritual states.
- Semantic scale:
  `--type-title-lg`, `--type-title-md`, `--type-body-lg`, `--type-body-md`, `--type-body-sm`
  for readable content hierarchy across cards, exercise instructions, and completion summaries.
- Semantic scale:
  `--type-label-lg`, `--type-label-md`, `--type-label-sm`, `--type-label-xs`, plus shared
  tracking and line-height tokens, for status pills, metadata, and compact utility copy.
- Button sizing:
  `--type-button-lg` and `--type-button-md` are the only CTA text sizes; buttons should not
  introduce one-off font scales.
- Design-system rule:
  components should consume the semantic typography tokens rather than defining local
  one-off `clamp(...)` values for text unless the content is an icon or decorative symbol.

## Surface Language

- Borders should stay subtle and crisp, relying on contrast more than ornament.
- Backgrounds should feel layered and atmospheric, with noise and lighting used sparingly.
- Cards should feel premium and dense, like performance dashboards rather than themed plaques.
- Motion should feel deliberate and confident, especially around session generation, PB overlays, and completion.
- A small footer badge should always expose the current beta version label for testers.
