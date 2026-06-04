# Grind

> Open-source workout PWA. Fork it, edit one file to match the gear in your gym, and train.

Grind is a minimalist hypertrophy app built around an **A/B/C full-body split** with built-in exercise variation, set/PR logging, and a session-reveal flow that picks the day's exercises for you so you stop deciding in the squat rack.

The whole exercise list lives in a single file — **`src/data/workouts.js`** — so adjusting Grind to a home gym, a hotel gym, a cable-only setup, or a barbell-only setup is mostly a matter of editing a few arrays.

## Screenshots

| Home | Session reveal | Exercise log | Session complete |
|---|---|---|---|
| ![Home — week view with A/B/C workouts](screenshots/homepage.png) | ![Session — exercises picked for Full Body B](screenshots/workout_generator.png) | ![Exercise — set logger with tips](screenshots/exercise.png) | ![Done — PR recap and stats](screenshots/workout_complete.png) |

## What it does

- **A/B/C split.** Three full-body workouts per week. Each day defines a sequence of movement slots (lower-quad, push-horizontal, pull-vertical, …).
- **Session reveal.** Tap a workout and Grind picks one exercise per slot from the matching pool, with a slot-machine-style reveal. Swap individual exercises or reshuffle the whole workout if you don't like what came up.
- **Set logging.** Weight × reps per set, last weight pre-filled, with a coaching tip per exercise.
- **Rest timer.** Per-exercise rest with a timestamp-based clock that survives screen lock and tab switch.
- **PR tracking.** Tracks max single-set weight and session volume per exercise. Hits get a badge on the done screen.
- **Progressive-overload nudge.** Three sessions at the same weight on the same exercise → "+2.5kg" suggestion.
- **History.** Every session saved locally; expandable per-exercise breakdown.
- **Offline-first PWA.** Installable to home screen on iOS and Android. All state lives in `localStorage` — no account, no server, no tracking.
- **Optional sync.** Drop in an n8n webhook URL and Grind will POST a session summary at the end of each workout. Off by default.

## Customize your exercises

Everything you'd want to change for your own training lives in **`src/data/workouts.js`**.

### Exercise pools — `EXERCISES`

Each movement category is a key with an array of exercises. The session reveal picks randomly from the matching pool, never repeating an exercise twice in the same week.

```js
export const EXERCISES = {
  "lower-quad": [
    {
      name: "Dumbbell Goblet Squat",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "Pause for a second at the bottom and push your knees out as you stand.",
    },
    // add as many alternatives as you want
  ],
  // ...other categories
};
```

Exercise object fields:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Display name. Used as the PR identifier — rename carefully (PRs are keyed by name). |
| `sets` | number | Working sets. |
| `repsRange` | string | Free-form, e.g. `"6–10"`, `"8–12"`, `"20–24 steps"`. |
| `restSeconds` | number | Default rest timer between sets. |
| `tip` | string | Coaching cue shown on the exercise screen. |
| `bodyweight` | boolean? | Optional. Hides the weight input on the logger and tracks reps only. |

### Categories used out of the box

`lower-quad`, `lower-hinge`, `lower-glute`, `push-horizontal`, `push-vertical`, `pull-horizontal`, `pull-vertical`, `arms-bicep`, `arms-tricep`, `core`, `accessory`, `calves`.

Add your own categories freely — just make sure any new category key is referenced from a day's `slots` in `DAYS` below.

### Day templates — `DAYS`

A/B/C each define a slot sequence. Each slot points at a category and gets a display label.

```js
export const DAYS = {
  A: {
    name: "Full Body A",
    slots: [
      { key: "lower-quad",      label: "LOWER · QUAD" },
      { key: "push-horizontal", label: "PUSH · HORIZONTAL" },
      { key: "pull-vertical",   label: "PULL · VERTICAL" },
      { key: "lower-hinge",     label: "LOWER · HINGE" },
      { key: "pull-horizontal", label: "PULL · HORIZONTAL" },
      { key: "core",            label: "CORE",   supersetGroup: "core-calves-a" },
      { key: "calves",          label: "CALVES", supersetGroup: "core-calves-a" },
    ],
  },
  // B, C...
};
```

Two notes:

- A day can repeat the same category in multiple slots — the spin guarantees a distinct exercise per slot when it does.
- Adjacent slots with the same `supersetGroup` are surfaced as a superset pair in the UI.

### Worked example — cable-only home setup

```js
// in src/data/workouts.js
EXERCISES["push-horizontal"] = [
  { name: "Cable Chest Press",        sets: 4, repsRange: "8–12", restSeconds: 90, tip: "Drive both handles forward together." },
  { name: "Single-Arm Cable Press",   sets: 3, repsRange: "10–12 each", restSeconds: 75, tip: "Resist rotation as you press." },
  { name: "Cable Crossover",          sets: 3, repsRange: "12–15", restSeconds: 60, tip: "Squeeze at the midline, slow eccentric." },
];
```

Run `npm run dev`, pick a workout, and your new exercises will start showing up immediately.

## Running locally

```bash
npm install
npm run dev      # start the dev server on http://localhost:5173
npm run build    # produce a production build in dist/
npm run preview  # serve dist/ locally to sanity-check the build
```

## Self-hosting

`npm run build` produces a static, framework-free PWA in `dist/`. Drop it on any static host:

- **Vercel / Netlify / Cloudflare Pages** — point at the repo, build command `npm run build`, output directory `dist`.
- **GitHub Pages** — push `dist/` to a `gh-pages` branch.
- **Anywhere else** — `dist/` is just static files; serve it with anything that serves HTML.

Once deployed, open the URL on your phone and **Add to Home Screen** — Grind is installable as a PWA on iOS and Android.

### Optional: session sync

Grind can POST a session summary at the end of each workout. To enable it, edit `DEFAULT_CONFIG` in `src/config.js` to point at your own n8n webhook (or any endpoint that accepts a JSON POST). Off by default.

## Tech stack

- **Vanilla JS** (ES2022 modules) — no framework
- **Vite** + `vite-plugin-pwa` for dev server, bundling, and service worker
- **Custom CSS** in `src/styles/app.css` — no component library
- **`localStorage`** for week state, active sessions, history, PRs, and an offline sync queue

## Project structure

```text
grind/
  index.html
  src/
    main.js          # browser entrypoint, app boot, service worker, test harness
    app/
      runtime.js     # session flow, spin logic, exercise logging, history
    data/
      workouts.js    # EXERCISES (pools) + DAYS (A/B/C templates)  ← edit this
    lib/
      storage.js     # guarded localStorage helpers
    styles/
      app.css        # all styles
    config.js        # version label + webhook defaults
  docs/
    ARCHITECTURE.md  # storage schema, screen flow, module boundaries
  screenshots/
  vite.config.mjs
```

For the storage schema, screen flow, and module boundaries, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## License

MIT — see [LICENSE](LICENSE). Free to fork, modify, and run for personal or commercial use.

---

Built by [Tomer Liran](https://github.com/tomer-liran).
