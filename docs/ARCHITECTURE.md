# Architecture

## Technology Stack
Language: Vanilla JS (ES2022) — no build step, no dependencies
UI: Custom CSS — extending the existing design system with slot layer and semantic typography tokens 
Persistence: localStorage — survives close/refresh/background |
PWA: `manifest.json` + service worker — installable, offline, beta-labelled
Sync: n8n webhook POST — once at session end only (TODO)
Typography: Google Fonts: Caesar Dressing + Cormorant Garamond + Alegreya Sans SC

## File Structure

```
grind/
  index.html          ← all screen markup + <style> block (all CSS)
  app.js              ← all logic in named sections (see below)
  manifest.json
  sw.js               ← service worker (cache-first)
  icons/
    web-app-manifest-192x192.png
    web-app-manifest-512x512.png
```

**Why 4 files instead of 17:** Vanilla JS without a bundler gets no benefit from file splitting — it creates `<script>` load-order fragility, a brittle SW asset list, and global namespace coordination issues. One `app.js` with clear section comments is both simpler and more explicit.

`app.js` internal structure:
```
// ── DATA ──────────────── exercise DB, day definitions
// ── STORAGE ───────────── localStorage helpers, try/catch guards
// ── WEEK STORE ────────── getWeekKey(), weekly template choices, dedup
// ── SESSION ───────────── state object, saveSession(), loadSession()
// ── SPIN ──────────────── pickExercise(), spinToReveal()
// ── TIMER ─────────────── startRest(), resumeRestIfNeeded()
// ── PR TRACKING ───────── checkAndUpdatePR(), getOverloadNudge()
// ── HISTORY ───────────── loadHistory(), renderHistory()
// ── SYNC ──────────────── syncToSheets(), flushSyncQueue()
// ── APP / ROUTER ──────── showScreen(), event wiring, init
// ── TESTS ─────────────── runTests() — active on ?test param
```

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
