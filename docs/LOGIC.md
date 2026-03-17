# Core Logic

## Week Key
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

## Weekly Template Choices
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

## Exercise Pick (intra-session)
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

## Rest Timer (background-safe)
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

## PR Detection
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

## Progressive Overload Nudge
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

## TODO: Webhook Payload (once at session end) 
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
