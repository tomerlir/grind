# Grind — Olympus Workouts

Minimalist fitness PWA for structured, slightly randomized hypertrophy training. Including gamified features like slot-machine randomizations, animations, and sounds for entertainment value.

---

## Concept

Grind solves a simple problem:

> repeating the exact same workout and tracking it every week for months on end is boring.

The app keeps structure (A/B/C full-body split) while introducing controlled variation through randomized exercise selection within predefined categories.

Result:

* consistent training
* less boredom
* no planning required
* can focus on progressive overload
* gamified features to keep workouts more fun 

---

## Core Loop

1. Open app
2. Select available workout (A / B / C)
3. Generate exercises (slot-machine style)
4. Log sets (weight + reps)
5. Complete session → saved locally

Sessions are auto-saved and deletable. During session they are pausable, resumable or discardable.

---

## Key Rules (Important)

* 3 workouts per week (A/B/C)
* Each workout can be completed once per week
* Exercises are randomised dynamically at the beginning of the session
* No custom exercises or templates (intentional constraint)

---

## Features

* Structured full-body training
* Randomized exercise selection within categories
* Session persistence (localStorage)
* PR tracking:

  * max weight
  * session volume
* Progressive overload nudges
* Offline-first (PWA)

---

## Tech Stack

* Vanilla JavaScript (no framework, no build step)
* HTML + custom CSS
* localStorage (state)
* Service Worker (offline)
* PWA (installable)

---

## Project Structure

grind/
index.html
app.js
manifest.json
sw.js
icons/

All logic lives in `app.js`, grouped by sections:

* data
* storage
* week state
* session
* logic (randomization, PRs)
* UI / routing

---

## Running Locally

Serve the project:

npx serve .

or

python -m http.server

Open:

http://localhost:3000

---

## Data Model (Overview)

State is stored in localStorage:

* week state (progress, used exercises)
* active session
* history (completed sessions)
* PR tracking
* sync queue (offline fallback)

See `/docs/ARCHITECTURE.md` for full schema.

---

## Sync (TODO)

* One POST request per completed session
* If offline → queued and retried on next open

---

## Design Notes

Theme: Zeus / Olympus / slot-machine hybrid

* structured randomness
* ritualized interaction
* minimal UI, strong feedback moments

Theme is secondary to clarity.

---

## Status

Beta — built for personal use, currently being tested for broader adoption.

---

## Notes for Developers / Agents

This project is intentionally:

* single-file logic (`app.js`)
* no build system
* no dependencies

When modifying:

* preserve simplicity
* avoid introducing frameworks
* prefer explicit over abstract

Key areas:

* exercise selection logic (`pickExercise`)
* session persistence
* PR tracking + overload logic

---

## License

Private repository — not for redistribution.
