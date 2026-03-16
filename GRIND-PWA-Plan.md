# GRIND — Workout Roulette
## PWA Implementation Plan v2.0

**Target:** Progressive Web App · iOS Safari + Chrome · Installable to home screen
**Author:** Claude Code · March 2026
**Aesthetic:** Zeus slot machine meets marble temple — gold, lightning blue, carved serif typography, dark celestial stone. Not a fitness app. A ritualized game you play every day.

---

## 1. What We're Building

A personal fitness PWA with a slot-machine mechanic. The training structure is fixed (3 workouts/week, hardcoded A/B/C templates and exercise pools). The user chooses which of the three templates to run on any day, and the surprise comes from which specific exercise fills each slot.

**The core loop:**
1. Open app → Pick any workout that has not been completed yet this week (A, B, or C)
2. Tap that card → slot machine levers reveal each exercise from the exercise pools
3. Log sets with weight/reps → one dynamic primary button advances sets, handles rest, and moves to the next exercise
4. Finish session → one webhook fires; data logged to Sheets
5. Session is auto-saved throughout — close the tab, reopen, resume where you left off

**Locked decisions:**
- Hardcoded 3 workouts/week (A, B, C) — no custom templates
- Hardcoded exercise pools per category — no exercise builder
- All state in localStorage; webhook fires once at session completion
- PR tracking: max weight AND total volume per exercise
- History view and progressive overload nudge included in scope

---

## 2. Architecture

### 2.1 Technology Stack

| Layer | Choice |
|---|---|
| Language | Vanilla JS (ES2022) — no build step, no dependencies |
| UI | Custom CSS — extending the existing design system with casino layer and semantic typography tokens |
| Persistence | localStorage — survives close/refresh/background |
| PWA | `manifest.json` + service worker — installable, offline |
| Sync | n8n webhook POST — once at session end only |
| Typography | Google Fonts: Caesar Dressing + Cormorant Garamond + Alegreya Sans SC |

### 2.2 File Structure

```
grind/
  index.html          ← all screen markup + <style> block (all CSS)
  app.js              ← all logic in named sections (see below)
  manifest.json
  sw.js               ← service worker (cache-first)
  icons/
    icon-192.png
    icon-512.png
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

### 2.3 Screen Flow

```
  ┌──────────────────────────────────────────────┐
  │                   HOME                        │
  │  Week card · Weekly workout choices · Resume banner  │
  └────────┬──────────────────────┬──────────────┘
           │ tap workout card     │ tap HISTORY
  ┌────────▼──────────┐  ┌───────▼──────────────┐
  │      SESSION      │  │      HISTORY          │
  │  Slot machine     │  │  Past sessions list   │
  └────────┬──────────┘  └───────────────────────┘
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

---

## 3. Design System — Zeus Ancient Greek Slot Machine Aesthetic

The visual direction is no longer generic casino UI. The current style is a hybrid of:
- Zeus slot-machine energy: electric blue glows, gold trim, celebratory lightning flashes.
- Ancient temple materials: marble-like grain, carved serif typography, inscription-like headings.
- Compact PWA ergonomics: one-column cards, large tap targets, bold status labels, minimal clutter.

### 3.1 Color Palette

- Background: deep midnight navy with radial electric glow.
- Surfaces: layered blue-black stone panels with gold borders.
- Accent 1: treasury gold for headings, cards, and completion states.
- Accent 2: electric cyan for active states, progress, and motion feedback.
- Text: marble white and desaturated silver-blue.

### 3.2 Typography

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

### 3.3 Surface Language

- Borders use Greek-inspired double-rule treatments and metallic gold framing.
- Backgrounds lean on marble grain plus atmospheric lightning glows instead of flat fills.
- Cards should feel like illuminated stone plaques, not default mobile list items.
- Motion should feel ceremonial and dramatic, especially around reel landing, PR overlays, and completion.


## 4. localStorage Schema (simplified — no user-editable data)

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

## 5. Core Logic

### 5.1 Week Key (bug-free)
```js
function getWeekKey() {
  const now = new Date();
  const dow = now.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now);
  mon.setDate(now.getDate() + offset);
  return mon.toISOString().slice(0, 10); // "YYYY-MM-DD", always correct
}
```

### 5.2 Weekly Template Choices (fixed, persist)
```js
function getOrCreateDayAssignment() {
  const week = loadWeek();
  if (week.templateChoices) return week.templateChoices;

  week.templateChoices = ["A", "B", "C"];
  saveWeek(week);
  return week.templateChoices;
}
// Result example: ["A", "B", "C"]
// Any incomplete template can be started on any day of the current week.
```

### 5.3 Exercise Pick (intra-session dedup fix)
```js
function pickExercise(categoryKey, slotPosition) {
  // Guard: unknown category returns null, caller handles gracefully
  const pool = EXERCISES[categoryKey] ?? [];
  if (pool.length === 0) return null;

  const weekUsed = getWeekUsed(categoryKey);              // from week store
  const sessionReserved = getSessionReserved(categoryKey); // from active session

  let available = pool.filter(e =>
    !weekUsed.includes(e.name) && !sessionReserved.includes(e.name)
  );

  if (available.length === 0) {
    // All week-used exhausted — reset week dedup but respect session reservations
    available = pool.filter(e => !sessionReserved.includes(e.name));
  }

  if (available.length === 0) {
    // Fallback: pool smaller than same-category slots in this session
    available = pool;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];

  // Reserve at SPIN time (not completion time) — prevents Day B pull-vertical × 2
  // from serving the same exercise in both slots within one session
  reserveInSession(categoryKey, slotPosition, chosen.name);

  return chosen;
}
```

### 5.4 Rest Timer (background-safe)
```js
function startRest(seconds) {
  const endTime = Date.now() + seconds * 1000;
  session.restEndsAt = endTime;
  saveSession(); // persisted — survives tab close

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining <= 0) { onRestComplete(); return; }
    updateTimerDisplay(remaining);
    restTimerId = setTimeout(tick, 200);
  };
  tick();
}

// On app resume: check session.restEndsAt
function resumeRestIfNeeded() {
  if (!session.restEndsAt) return;
  const remaining = Math.ceil((session.restEndsAt - Date.now()) / 1000);
  if (remaining > 0) startRest(remaining); // pick up where we left off
  else onRestComplete();                   // timer already expired
}
```

### 5.5 PR Detection

```js
// Returns null for BW/empty/non-numeric weights.
// Used in PR tracking and volume calculation.
function parseWeight(w) {
  if (!w || w === '—' || w.toLowerCase?.() === 'bw') return null;
  const n = parseFloat(w);
  return isNaN(n) ? null : n;
}

function checkAndUpdatePR(exerciseName, sets) {
  const numericWeights = sets.map(s => parseWeight(s.weight)).filter(w => w !== null);

  // BW exercise (all sets have no numeric weight) — skip PR tracking entirely
  if (numericWeights.length === 0) return {};

  const maxSetWeight = Math.max(...numericWeights);
  const sessionVolume = sets.reduce((sum, s) => {
    const w = parseWeight(s.weight) ?? 0;
    const r = parseInt(s.reps) || 0;
    return sum + w * r;
  }, 0);

  const history = loadPR(exerciseName);
  const prs = {};

  if (maxSetWeight > (history.maxWeight || 0)) {
    prs.weight = { prev: history.maxWeight, new: maxSetWeight };
    history.maxWeight = maxSetWeight;
  }

  if (sessionVolume > (history.maxVolume || 0)) {
    prs.volume = { prev: history.maxVolume, new: sessionVolume };
    history.maxVolume = sessionVolume;
  }

  // Only update lastWeight if we have a real numeric value
  history.lastWeight = maxSetWeight;
  history.sessions = [
    ...(history.sessions || []),
    { date: todayFormatted(), weekKey: getWeekKey(), maxSetWeight, sessionVolume }
  ].slice(-52);

  savePR(exerciseName, history);
  return prs; // { weight?: {...}, volume?: {...} } or {}
}
```

Trigger: `checkAndUpdatePR` is called in `completeExercise()`. If `prs` is non-empty, show PR badge on the transition back to SessionView.

### 5.6 Progressive Overload Nudge
```js
function getOverloadNudge(exerciseName) {
  const h = loadPR(exerciseName);
  const recent = (h.sessions || []).slice(-3);
  if (recent.length < 3) return null;

  // Don't nudge if already nudged within the last 3 weeks
  if (h.lastNudgeDate) {
    const daysSince = (Date.now() - new Date(h.lastNudgeDate)) / 86400000;
    if (daysSince < 21) return null;
  }

  const weights = recent.map(s => s.maxSetWeight).filter(Boolean);
  if (weights.length < 3) return null; // BW sessions in recent history
  const allSame = weights.every(w => w === weights[0]);
  if (!allSame) return null;

  return { currentWeight: weights[0], suggestedWeight: weights[0] + 2.5 };
}

// Call this when the nudge is DISPLAYED (Done screen recap),
// not when calculated — prevents re-nudging on same session open/close.
function markNudgeShown(exerciseName) {
  const h = loadPR(exerciseName);
  h.lastNudgeDate = new Date().toISOString();
  savePR(exerciseName, h);
}
```

Shown: on the Done screen (recap of all nudges for the session), AND as a subtle chip badge on ExerciseView when opening the set logger ("Last 3× at 40kg — try 42.5?").
`markNudgeShown()` is called once per exercise when the Done screen renders its nudge list.

### 5.7 Webhook Payload (once at session end)
```js
{
  "date": "13/03/2026",           // dd/MM/yyyy
  "day": "A",
  "duration_minutes": 62,
  "total_sets": 26,
  "exercises": [
    {
      "exercise": "Bulgarian Split Squat",
      "category": "LOWER · QUAD",
      "sets": "Set 1: 40kg × 8 | Set 2: 42.5kg × 7",
      "session_volume_kg": 595,
      "pr_weight": false,
      "pr_volume": true,
      "timestamp": "2026-03-13T09:30:00Z"
    }
  ]
}
```

---

## 6. Screens

### 6.1 Home

```
         G R I N D
      Workout Roulette
    ✦ ♠  ·  ♥  ·  ♦  ·  ♣  ✦

  ┌─────────────────────────────┐
  │  AVAILABLE               A │
  │  SQUAT · HORIZONTAL PUSH/PULL │
  │              [START SESSION ▸] │
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │  COMPLETED ON TUESDAY    B ✓ │   ← completed: gold checkmark, dimmed
  │  HINGE · VERTICAL PUSH/PULL │
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │  AVAILABLE               C │
  │  LUNGE · UNILATERAL · ARMS │
  └─────────────────────────────┘

  [HISTORY]                  [⚙]
```

- If session in progress → resume banner at top:
  `"♠ SESSION IN PROGRESS · Day C · Exercise 3 of 7 — RESUME"`
- If session in progress, workout cards should be visually locked and should not start a second session.
- Card hierarchy should be:
  `A/B/C` as the primary workout marker,
  workout focus as the subtitle,
  per-card availability/completion day as the status.
- CTA on each available card: `START SESSION ▸`

### 6.2 Session (Slot Machine)

```
  ← DAY A                    3/7 ████████░░░░░░░░░░░░

  ┌─────────────────────────────────────────────────────┐
  │  ✦                                              ✦  │
  │                                                     │
  │         BULGARIAN SPLIT SQUAT                       │  ← neon glow
  │                                                     │
  │  ✦                                              ✦  │
  └─────────────────────────────────────────────────────┘
         4 sets  ·  6–10 reps  ·  2 min rest

  ┌─────────────────────────────────────────────────────┐
  │                    SPIN                             │
  └─────────────────────────────────────────────────────┘

  (after spin lands → proceed CTA becomes a glowing lightning tile:)

                 ┌─────────────┐
                 │      ⚡      │
                 └─────────────┘
```

Slot machine animation: exercise names cycle at 60ms intervals for 1.2s, decelerate for last 0.3s (ease-out), snap to chosen. The landing moment: brief scale pulse + neon glow flash.

### 6.3 Exercise (Set Logger)

```
  LOWER · QUAD

  BULGARIAN
  SPLIT SQUAT

  [⚡ Last 3× at 40kg — try 42.5?]   ← overload nudge chip (if applicable)

  Front foot flat, torso upright. Drive through the heel.   ← yellow instructional hint

  ┌──────────────────────────────────────────────────────┐
  │ PREVIOUS SETS: SET 1 · 40kg × 8                     │
  └──────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────┐
  │ SET 2                             ACTIVE             │
  │ [   ] weight               [   ] reps               │
  │ 2 sets remaining after this one                     │
  └──────────────────────────────────────────────────────┘

  [PROCEED ▸]
  [SKIP REST · 1:32]          ← same primary button during rest
  [NEXT EXERCISE ▸]           ← after all sets are complete
```

- Weight pre-filled from `grind:pr[name].lastWeight`
- Set cards should visually rhyme with the home workout cards: gold framing, luminous active state, dimmed completed state
- Only the active set should be editable and prominent; completed sets collapse into a compact history banner
- The primary button changes by context:
  `PROCEED` when the active set is ready,
  `SKIP REST · mm:ss` while resting,
  `NEXT EXERCISE` or `FINISH WORKOUT` when the exercise is complete
- If any PR hit: before navigating back, flash PR badge

### 6.4 Done

```
  ✦ ✦ ✦ ✦ ✦ [gold confetti]

  JACKPOT.
  Day A complete

  [  7  ]      [  26  ]      [  64m  ]
  exercises      sets        duration

  ✦ NEW RECORDS ──────────────────────────
  Bulgarian Split Squat  +2.5kg max weight
  Pull-Up                +180kg volume PR
  ─────────────────────────────────────────

  ✦ OVERLOAD NUDGES ───────────────────────
  Goblet Squat   Last 3× at 20kg → try 22.5?
  Hammer Curl    Last 3× at 14kg → try 16?
  ──────────────────────────────────────────

  SYNCING...   →   SYNCED ✓
               or  SYNC FAILED [RETRY]

  [BACK TO HOME]
```

### 6.5 History

```
  ← HISTORY

  ┌─────────────────────────────────┐
  │  MON 09 MAR · DAY B · 58m      │
  │  7 exercises · 24 sets          │
  │  PRs: Nordic Curl (volume)      │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │  FRI 06 MAR · DAY C · 71m      │
  │  7 exercises · 27 sets          │
  └─────────────────────────────────┘
  ...

  (tap session → expanded detail)
```

Expanded:
```
  MON 09 MAR · DAY B

  Bulgarian Split Squat    LOWER · QUAD
  Set 1: 40kg × 8  |  Set 2: 42.5kg × 7  ...
  Volume: 1190kg  ✦ PR

  Pull-Up                  PULL · VERTICAL
  Set 1: BW × 8  |  Set 2: BW × 7  ...
  ...
```

---

## 7. Bug Fixes vs. Original HTML Prototype

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| 1 | Day B can serve same exercise twice in one session | `markExerciseUsed` only at completion; Day B has `pull-vertical` in slots 2 AND 5 | Reserve at SPIN time (`session.reservations`); both week-used and session-reserved checked in `pickExercise` |
| 2 | Week key uses 0-indexed month | `getMonth()` returns 0–11 → `week-2026-2-9` instead of `week-2026-3-9` | `toISOString().slice(0,10)` → always `YYYY-MM-DD` |
| 3 | Rest timer drifts when phone locked | `setInterval` ticks pause in background | Timestamp-delta: `endTime = Date.now() + s*1000`; `remaining = ceil((endTime - now)/1000)` every 200ms |
| 4 | Session lost on force-quit | No persistence mid-session | Write `grind:session-active` on every spin + every set confirm |
| 5 | Offline sync silently loses data | Fire-and-forget POST with no fallback | Queue failures in `grind:sync-queue`; flush on next open if online |
| 6 | `calves` category orphaned | In exercise DB, used in no template | Leave in DB; it's available if the user manually adds it to a template in a future builder phase |

---

## 8. PWA Configuration

### manifest.json
```json
{
  "name": "GRIND — Workout Roulette",
  "short_name": "GRIND",
  "description": "Choose A, B, or C each week, then spin for exercise variations.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0B0914",
  "theme_color": "#0B0914",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### sw.js — Cache-first, webhook bypass
```js
const CACHE = 'grind-v1';
const ASSETS = [
  '/', '/app.js', '/index.html', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);
self.addEventListener('fetch', e => {
  if (e.request.url.includes('n8n')) return; // never cache webhook
  e.respondWith(caches.match(e.request).then(r => r ?? fetch(e.request)));
});
```

**Typography delivery** — the current build loads `Caesar Dressing`, `Cormorant Garamond`, and `Alegreya Sans SC` from Google Fonts. The app still has serif/sans fallbacks in CSS, but the branded ancient-Greek look is strongest when those web fonts load.

---

## 9. n8n Workflow Update

The webhook now receives one POST per session (not per exercise). Update n8n:

```
Webhook → Code node (loop over exercises[]) → Google Sheets Append Row per exercise
```

Sheets columns: `Date · Day · Exercise · Category · Sets · Session Volume · PR Weight · PR Volume · Duration · Timestamp`

---

## 10. Implementation Phases

### Phase 1 — Core app + data layer
Port HTML prototype into modular file structure. Fix all 5 bugs. Implement `store.js`, `weekStore.js`, `session.js`.
- Week key fix
- `pickExercise` with reservation layer
- Session auto-save on every interaction
- Session resume banner

### Phase 2 — Rest timer + exercise screen
- Timestamp-delta timer
- Resume timer on app re-open
- Last weight pre-fill

### Phase 3 — PR tracking + overload nudge
- `pr.js`: `checkAndUpdatePR` on exercise complete
- PR badge on SessionView transition
- Overload nudge chip on ExerciseView
- Overload nudge recap on Done screen

### Phase 4 — Sync + Done screen
- `sync.js`: single POST at session end
- Offline queue + flush
- Sync status on Done screen
- Confetti animation on Done

### Phase 5 — History screen
- Read `grind:history`, render session list
- Expandable session detail with per-exercise sets + volume + PR flags

### Phase 6 — PWA shell
- `manifest.json` + icons
- `sw.js` service worker
- "Add to Home Screen" tested on iOS Safari

---

## 11. Required Implementation Details (non-negotiable)

These aren't optional — they prevent silent failures:

| # | Where | What | Why |
|---|---|---|---|
| 1 | `completeExercise()` — first line | `session.restEndsAt = null; saveSession();` | Prevents stale timer firing on next exercise launch |
| 2 | `startSession()` | `session.weekKey = getWeekKey(); saveSession();` | Prevents week-boundary bug (Sunday → Monday session) |
| 3 | All `localStorage.setItem` calls | Wrap in `try { } catch(e) { console.warn('storage full', e); }` | iOS Safari has limited storage; quota exceeded should not crash mid-session |
| 4 | `EXERCISES[categoryKey]` every access | `?? []` nullish coalesce + early return null if pool empty | Typo in slot definition should never throw a JS error |
| 5 | `loadHistory()` for render | `history.slice(-historyOffset)` where `historyOffset = 30` | Prevents slow paint on History screen after extended use |
| 6 | Done screen nudge render loop | Call `markNudgeShown(exerciseName)` per nudge displayed | Prevents 21-day gate from resetting prematurely |

---

## 12. TODOS (explicitly deferred)

### TODO 1 — Rep-count PR tracking for BW exercises
**What:** Track `maxReps` (single set) and `totalReps` (session) for exercises where all set weights are null.
**Why:** Pull-Up, Chin-Up, Deficit Push-Up, Archer Push-Up, Diamond Push-Up generate zero PR feedback under current plan. ~30% of exercises have no PR signal.
**How:** In `checkAndUpdatePR`, when `numericWeights.length === 0`, fall back to rep tracking. Store `maxReps` / `maxRepsVolume` alongside weight fields in `grind:pr`. Show a different badge: `+2 reps` instead of `+2.5kg`.
**Effort:** M — needs schema change in `grind:pr`, new badge variant, new nudge copy.
**Depends on:** `parseWeight()` helper (already in plan).

---

## 13. Deferred (explicitly out of scope for v1)

| Item | Reason |
|---|---|
| Custom exercise builder | Hardcoded pool is sufficient for personal use; adds significant UI complexity |
| Custom day templates | Same reason; A/B/C fixed |
| Apple Watch companion | Requires native SwiftUI |
| HealthKit integration | Requires native app |
| Social / sharing | Post-MVP |
| Sound effects | iOS Safari requires user gesture to unlock audio; adds complexity |
| 4th+ day templates | Would break the "always use all templates" guarantee |

---

*End of plan — v2.0*
