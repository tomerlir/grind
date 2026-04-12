# Architecture

## Technology Stack

- Language: Vanilla JS (ES2022 modules)
- Tooling: Vite + `vite-plugin-pwa`
- UI: single-page HTML with inline custom CSS in `index.html`
- Persistence: `localStorage`
- Sync: n8n webhook POST at session completion, with offline queue

## File Structure

```text
grind/
  index.html              ← all screen markup + inline CSS
  src/
    main.js               ← app bootstrap + test harness
    app/
      runtime.js          ← main application flow and DOM-heavy logic
    data/
      workouts.js         ← exercise pools + workout templates
    lib/
      storage.js          ← guarded localStorage helpers
    config.js             ← version/webhook/dry-run config
  assets/
  docs/
  vite.config.mjs
```

## Architectural Direction

- The codebase now uses Vite as the module boundary instead of relying on one root `app.js`.
- This refactor is intentionally JS-first: HTML structure and inline CSS remain in place.
- `src/app/runtime.js` still contains the DOM-heavy orchestration layer, but immutable data, configuration, and storage are separated into dedicated modules.
- Existing `localStorage` keys and runtime behavior are preserved to avoid migration churn.

## Current Module Boundaries

- `src/main.js`
  - DOMContentLoaded boot
  - service worker update prompt registration
  - browser-only `?test` execution
- `src/config.js`
  - static runtime configuration such as version label and webhook defaults
- `src/data/workouts.js`
  - `EXERCISES`
  - `DAYS`
- `src/lib/storage.js`
  - `storageGet`
  - `storageSet`
  - `storageDel`
- `src/app/runtime.js`
  - onboarding
  - week/session flow
  - spin mechanics
  - rest timer
  - PR/history/sync logic
  - screen rendering and event wiring

## Screen Flow

```
  ┌──────────────────────────────────────────────┐
  │                   HOME                       │
  │  Week card · Weekly workout choices          │
  │· Resume banner                               │
  └────────┬──────────────────────┬──────────────┘
           │ tap workout card     │ tap HISTORY
  ┌────────▼──────────┐  ┌───────▼──────────────┐
  │      SESSION      │  │      HISTORY         │
  │  Slot machine     │  │  Past sessions list  │
  └────────┬──────────┘  └──────────────────────┘
           │ START EXERCISE
  ┌────────▼──────────┐
  │      EXERCISE     │
  │  Set rows · Timer │
  │  PR badge if hit  │
  └────────┬──────────┘
           │ DONE — NEXT
           │ (continue after last exercise)
  ┌────────▼──────────┐
  │       DONE        │
  │  Stats · PR recap │
  │  Sync status      │
  │  Overload nudges  │
  └───────────────────┘
```

## localStorage Schema (simplified — no user-editable data)

All keys prefixed `grind:`.

### `grind:week-{YYYY-MM-DD}` — Monday ISO date
```js
{
  templateChoices: ["A", "B", "C"],
  completed: ["A"],
  completedByTemplate: { "A": "tuesday" },
  usedExercises: {
    "lower-quad": ["Bulgarian Split Squat", "Goblet Squat"]
  }
}
```

### `grind:session-active`
```js
{
  templateId: "A",
  slots: [ /* snapshot */ ],
  slotIndex: 2,
  reservations: {
    "pull-vertical:0": "Pull-Up",
    "pull-vertical:1": "Chin-Up"   // handles Day B duplicate-category slots
  },
  entries: [
    {
      exerciseName: "Bulgarian Split Squat",
      categoryLabel: "LOWER · QUAD",
      sets: [{ weight: "40", reps: "8" }, { weight: "42.5", reps: "7" }],
      timestamp: "2026-03-13T09:30:00Z"
    }
  ],
  restEndsAt: null,       // timestamp (ms) when current rest timer expires
  startTime: "2026-03-13T09:00:00Z",
  status: "in_progress"
}
```

### `grind:history`
```js
[
  {
    date: "13/03/2026",
    templateId: "A",
    durationMinutes: 62,
    totalSets: 26,
    entries: [ /* same as session-active.entries */ ],
    timestamp: "2026-03-13T10:02:00Z"
  }
]
```

### `grind:pr`
```js
{
  "Bulgarian Split Squat": {
    maxWeight: 45,                  // heaviest single set (kg, float)
    maxVolume: 1260,                // heaviest session volume: sum(weight × reps) across all sets
    lastWeight: 42.5,              // last session weight (for pre-fill)
    sessions: [
      { date: "09/03/2026", maxSetWeight: 42.5, sessionVolume: 1190 }
    ]
  }
}
```

### `grind:sync-queue`
```js
[
  { payload: { ... }, failedAt: "2026-03-13T10:02:00Z" }
]
// Flushed on next app open when online
```

### `grind:config`
```js
{ webhookUrl: "...", dryRun: false }
```

---
