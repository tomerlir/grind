# Design System — Zeus Ancient Greek Slot Machine Aesthetic

The visual direction is no longer generic casino UI. The current style is a hybrid of:
- Zeus slot-machine energy: electric blue glows, gold trim, celebratory lightning flashes.
- Ancient temple materials: marble-like grain, carved serif typography, inscription-like headings.
- Compact PWA ergonomics: one-column cards, large tap targets, bold status labels, minimal clutter.

## Color Palette

- Background: deep midnight navy with radial electric glow.
- Surfaces: layered blue-black stone panels with gold borders.
- Accent 1: treasury gold for headings, cards, and completion states.
- Accent 2: electric cyan for active states, progress, and motion feedback.
- Text: marble white and desaturated silver-blue.

## Typography

- Display: `Caesar Dressing`
  Used for logos, workout letters (`A/B/C`), screen titles, and big CTA moments.
  Goal: theatrical classical inscription with a more mythic, ornamental silhouette.
- Body: `Cormorant Garamond`
  Used for descriptive copy and supporting text.
  Goal: classical, refined, less app-like than modern sans-serif UI.
- Labels / utility: `Alegreya Sans SC`
  Used for status text, metadata, chip labels, and interface chrome.
  Goal: carved small-caps feel without losing legibility on mobile.
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

- Borders use Greek-inspired double-rule treatments and metallic gold framing.
- Backgrounds lean on marble grain plus atmospheric lightning glows instead of flat fills.
- Cards should feel like illuminated stone plaques, not default mobile list items.
- Motion should feel ceremonial and dramatic, especially around reel landing, PR overlays, and completion.
- A small footer badge should always expose the current beta version label for testers.
