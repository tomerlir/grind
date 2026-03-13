'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// GRIND — Workout Roulette  |  app.js  |  Phase 1
// ═══════════════════════════════════════════════════════════════════════════
//
// State machine (session lifecycle):
//
//   null ──[startSession()]──► in_progress
//              │                    │
//              │         [completeExercise()] × N slots
//              │                    │
//              │         [finishSession()] ──► null
//              │                    │
//              └────────[goHome()]──┘  (session preserved for resume)
//

// ── CONFIGURATION ──────────────────────────────────────────────────────────

const CONFIG = {
  webhookUrl: 'YOUR_N8N_WEBHOOK_URL', // paste your n8n webhook URL here
  dryRun: true,                        // flip to false when webhook is ready
};

// ── DATA ───────────────────────────────────────────────────────────────────
// Exercise pools. Ported verbatim from workout-roulette.html prototype.
// categoryKey → Exercise[]

const EXERCISES = {

  'lower-quad': [
    {
      name: 'Bulgarian Split Squat',
      sets: 4, repsRange: '6–10', restSeconds: 120,
      tip: 'Front foot flat, torso upright. Drive through the heel. Control the descent — 2s down.',
    },
    {
      name: 'Dumbbell Goblet Squat',
      sets: 3, repsRange: '12–15', restSeconds: 90,
      tip: '3-second eccentric. Elbows inside knees at the bottom. Pause 1s at depth.',
    },
    {
      name: 'Dumbbell Alternating Lunges',
      sets: 3, repsRange: '20–24 steps', restSeconds: 90,
      tip: 'Long stride so the front shin stays vertical. Drive the back knee down, not forward.',
    },
    {
      name: 'Step-Up with Knee Drive',
      sets: 3, repsRange: '10–12 each', restSeconds: 90,
      tip: 'Step onto a sturdy chair or box. Drive the opposite knee up at the top. Slow on the way down.',
    },
  ],

  'lower-hinge': [
    {
      name: 'Dumbbell Romanian Deadlift',
      sets: 4, repsRange: '6–12', restSeconds: 90,
      tip: 'Hinge at the hip, not the waist. Feel the stretch in hamstrings before reversing. Neutral spine throughout.',
    },
    {
      name: 'Single-Leg Romanian Deadlift',
      sets: 3, repsRange: '8–10 each', restSeconds: 90,
      tip: 'Use a wall for balance if needed. Keep hips square — don\'t rotate to the standing leg.',
    },
    {
      name: 'Nordic Curl (negative)',
      sets: 3, repsRange: '5–8', restSeconds: 120,
      tip: 'Anchor feet under sofa. Take 4s to descend. Catch yourself with your hands and explode back up.',
    },
    {
      name: 'Dumbbell Good Morning',
      sets: 3, repsRange: '12–15', restSeconds: 90,
      tip: 'Light weight. DB on one shoulder or held at chest. Hinge until you feel hamstring tension, then drive hips forward.',
    },
  ],

  'lower-glute': [
    {
      name: 'Dumbbell Hip Thrust',
      sets: 3, repsRange: '12–15', restSeconds: 90,
      tip: 'Shoulders on sofa edge, DB on hips. Squeeze hard at the top. Lower until hips nearly touch floor.',
    },
    {
      name: 'Single-Leg Hip Thrust',
      sets: 3, repsRange: '10–12 each', restSeconds: 90,
      tip: 'Same setup, one leg extended. Drives the contraction into the working glute exclusively.',
    },
    {
      name: 'Donkey Kick with DB',
      sets: 3, repsRange: '15–20 each', restSeconds: 60,
      tip: 'On all fours, DB tucked behind knee. Drive heel toward ceiling. Full squeeze at the top.',
    },
  ],

  'push-horizontal': [
    {
      name: 'Deficit Push-Up',
      sets: 4, repsRange: '8–15', restSeconds: 90,
      tip: 'Hands on books or dumbbell plates for extra depth. Let chest sink below hand level. Full range is what makes this better.',
    },
    {
      name: 'Dumbbell Floor Press',
      sets: 4, repsRange: '8–12', restSeconds: 90,
      tip: 'Elbows 45° from torso. Touch the floor lightly each rep — don\'t bounce. Control the descent.',
    },
    {
      name: 'Dumbbell Floor Fly',
      sets: 3, repsRange: '12–15', restSeconds: 90,
      tip: 'Slight bend in the elbows throughout. Stretch is everything here — feel the pecs at the bottom.',
    },
    {
      name: 'Archer Push-Up',
      sets: 3, repsRange: '8–12 each', restSeconds: 90,
      tip: 'Wide hand position. Shift weight to one arm and lower. The other arm stays straight as a guide. Brutal on the chest.',
    },
  ],

  'push-vertical': [
    {
      name: 'Dumbbell Overhead Press',
      sets: 3, repsRange: '10–12', restSeconds: 90,
      tip: 'Press straight up, not forward. Lock out at the top. Lower to shoulder height with control.',
    },
    {
      name: 'Arnold Press',
      sets: 3, repsRange: '10–12', restSeconds: 90,
      tip: 'Start with palms facing you, rotate as you press. Slow rotation on the way down is where the work is.',
    },
    {
      name: 'Pike Push-Up',
      sets: 3, repsRange: '10–15', restSeconds: 90,
      tip: 'Hips high, body in an inverted V. Head goes to the floor between your hands. Vertical pressing pattern.',
    },
    {
      name: 'Dumbbell High Pull',
      sets: 3, repsRange: '10–12', restSeconds: 90,
      tip: 'Pull DBs to chin height, elbows flare out above hands. Explosive up, controlled down.',
    },
  ],

  'pull-vertical': [
    {
      name: 'Pull-Up',
      sets: 4, repsRange: '6–10', restSeconds: 90,
      tip: 'Dead hang start. Pull elbows to your hips, not your shoulders to the bar. Full ROM every rep.',
    },
    {
      name: 'Chin-Up',
      sets: 4, repsRange: '6–10', restSeconds: 90,
      tip: 'Supinated grip. Biceps assist more here. Same cue: elbows to hips. Squeeze the lat at the top.',
    },
    {
      name: 'Commando Pull-Up',
      sets: 3, repsRange: '6–8 each', restSeconds: 90,
      tip: 'Neutral grip, bar running along your head. Alternate which side the head goes to each rep.',
    },
    {
      name: 'Dumbbell Pullover',
      sets: 3, repsRange: '12–15', restSeconds: 90,
      tip: 'Lie across a sofa edge, shoulders supported. Arms straight, arc the DB from over your chest to behind your head. Feel the lat stretch.',
    },
  ],

  'pull-horizontal': [
    {
      name: 'Chest-Supported Incline Row',
      sets: 3, repsRange: '10–12 each', restSeconds: 90,
      tip: 'Lie face-down over a sofa arm or ottoman, chest hanging off. Pull elbows back and squeeze shoulder blades. No momentum.',
    },
    {
      name: 'Single-Arm Dumbbell Row',
      sets: 3, repsRange: '10–12 each', restSeconds: 90,
      tip: 'Knee and hand on a sturdy chair or sofa. Drive the elbow back and up, not just up. Full stretch at the bottom.',
    },
    {
      name: 'Dumbbell Rear Delt Fly',
      sets: 3, repsRange: '12–15', restSeconds: 60,
      tip: 'Hinge forward 45°. Arms out to the sides with a slight bend. Lead with the elbows, not the hands.',
    },
    {
      name: 'Renegade Row',
      sets: 3, repsRange: '8–10 each', restSeconds: 90,
      tip: 'Push-up position. Row one DB at a time, keeping hips square. Slow and deliberate. Anti-rotation is the point.',
    },
  ],

  'arms-bicep': [
    {
      name: 'Supinating Dumbbell Curl',
      sets: 3, repsRange: '10–12', restSeconds: 60,
      tip: 'Start neutral, supinate at the top. The twist is where the peak contraction lives. Squeeze hard.',
    },
    {
      name: 'Hammer Curl',
      sets: 3, repsRange: '12–15', restSeconds: 60,
      tip: 'Neutral grip throughout. Hits brachialis and brachioradialis. Slower tempo = more time under tension.',
    },
    {
      name: 'Incline Dumbbell Curl',
      sets: 3, repsRange: '10–12', restSeconds: 60,
      tip: 'Recline against a sofa arm or pillows stacked against a wall. Arms hang straight — this stretches the long head of the bicep. Don\'t swing.',
    },
    {
      name: 'Zottman Curl',
      sets: 3, repsRange: '10–12', restSeconds: 60,
      tip: 'Curl supinated up, rotate to pronated, lower slowly. Eccentric load on the forearm extensors. Brutal.',
    },
  ],

  'arms-tricep': [
    {
      name: 'Dumbbell OH Tricep Extension',
      sets: 3, repsRange: '10–12', restSeconds: 60,
      tip: 'Upper arm parallel to floor throughout. Extend fully and hold 1s. Squeeze hard at lockout.',
    },
    {
      name: 'Dumbbell Tricep Kickback',
      sets: 3, repsRange: '12–15', restSeconds: 60,
      tip: 'Hinge forward, upper arm parallel to floor. Extend to full lockout. Slow on the way back.',
    },
    {
      name: 'Diamond Push-Up',
      sets: 3, repsRange: '10–15', restSeconds: 60,
      tip: 'Hands close, forming a diamond. Elbows track back alongside the torso, not out wide.',
    },
  ],

  'core': [
    {
      name: 'Hanging Knee Raise',
      sets: 3, repsRange: '12–15', restSeconds: 60,
      tip: '2s up, 2s down. No swinging. At the top, posterior-tilt the pelvis to fully contract the abs.',
    },
    {
      name: 'Hollow Body Hold',
      sets: 3, repsRange: '20–30s', restSeconds: 60,
      tip: 'Lower back pressed into floor. Arms by ears, legs straight and low. If lower back lifts, raise legs higher.',
    },
    {
      name: 'Weighted Crunch',
      sets: 3, repsRange: '15–20', restSeconds: 60,
      tip: 'Hold DB on chest. Curl the ribcage toward the pelvis — don\'t just lift the head. Slow and controlled.',
    },
    {
      name: 'Plank Hold',
      sets: 3, repsRange: '30–45s', restSeconds: 60,
      tip: 'Forearms down, squeeze everything: quads, glutes, abs. Body in one rigid line. Don\'t let hips drop.',
    },
    {
      name: 'Dead Bug',
      sets: 3, repsRange: '10–12 each', restSeconds: 60,
      tip: 'Press lower back into floor the entire time. Opposite arm and leg extend slowly. Breathing matters here.',
    },
  ],

  'calves': [
    {
      name: 'Single-Leg Calf Raise',
      sets: 4, repsRange: '12–15 each', restSeconds: 60,
      tip: 'On a step edge for full ROM. Slow up, pause at top, slow down. Add weight in one hand when it gets easy.',
    },
    {
      name: 'Seated DB Calf Raise',
      sets: 4, repsRange: '15–20', restSeconds: 60,
      tip: 'DB on knees, seated. Targets soleus (lower calf). Works differently from standing — do both over the week.',
    },
  ],
};

// Day definitions: { id → { name, focus, slots: [{ key, label }] } }
// Day B intentionally has pull-vertical in slots [1] and [4].
// Day C intentionally uses lower-quad key with label LOWER · LUNGE.
// Slot position index (0-based) is used as the reservation key.
const DAYS = {
  A: {
    name: 'Day A',
    focus: 'Squat · Horizontal push/pull',
    slots: [
      { key: 'lower-quad',      label: 'LOWER · QUAD' },
      { key: 'push-horizontal', label: 'PUSH · HORIZONTAL' },
      { key: 'pull-horizontal', label: 'PULL · HORIZONTAL' },
      { key: 'lower-hinge',     label: 'LOWER · HINGE' },
      { key: 'push-vertical',   label: 'PUSH · VERTICAL' },
      { key: 'arms-bicep',      label: 'ARMS · BICEP' },
      { key: 'core',            label: 'CORE' },
    ],
  },
  B: {
    name: 'Day B',
    focus: 'Hinge · Vertical push/pull',
    slots: [
      { key: 'lower-hinge',     label: 'LOWER · HINGE' },
      { key: 'pull-vertical',   label: 'PULL · VERTICAL' },   // slot 1
      { key: 'push-vertical',   label: 'PUSH · VERTICAL' },
      { key: 'lower-glute',     label: 'LOWER · GLUTE' },
      { key: 'pull-vertical',   label: 'PULL · VERTICAL' },   // slot 4 — intentional duplicate
      { key: 'push-horizontal', label: 'PUSH · HORIZONTAL' },
      { key: 'core',            label: 'CORE' },
    ],
  },
  C: {
    name: 'Day C',
    focus: 'Lunge · Unilateral · Arms',
    slots: [
      { key: 'lower-quad',      label: 'LOWER · QUAD' },
      { key: 'push-horizontal', label: 'PUSH · HORIZONTAL' },
      { key: 'pull-horizontal', label: 'PULL · HORIZONTAL' },
      { key: 'lower-quad',      label: 'LOWER · LUNGE' },     // same pool, different label — intentional
      { key: 'pull-vertical',   label: 'PULL · LAT' },
      { key: 'arms-bicep',      label: 'ARMS · BICEP' },
      { key: 'arms-tricep',     label: 'ARMS · TRICEP' },
    ],
  },
};

// ── STORAGE ────────────────────────────────────────────────────────────────
// All localStorage I/O is wrapped in try/catch.
// iOS Safari can hit quota limits; we log and continue rather than crashing.

function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[GRIND] localStorage write failed:', key, e.name);
  }
}

function storageDel(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// ── WEEK STORE ─────────────────────────────────────────────────────────────
//
// Week data stored under grind:week-{YYYY-MM-DD} (Monday of current week).
// Schema:
//   dayAssignment:      { monday: 'C', wednesday: 'A', friday: 'B' }  — set once per week
//   completed:          string[]   — template IDs completed this week
//   completedWeekdays:  string[]   — weekday names of completed sessions (for week strip dots)
//   usedExercises:      { categoryKey: string[] }
//
// Week key uses toISOString().slice(0,10) — always YYYY-MM-DD, never 0-indexed month.

const STRENGTH_DAYS  = ['monday', 'wednesday', 'friday'];
const WEEKDAY_NAMES  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const WEEKDAY_SHORT  = { monday:'MON', tuesday:'TUE', wednesday:'WED', thursday:'THU', friday:'FRI', saturday:'SAT', sunday:'SUN' };

function getTodayWeekday() {
  return WEEKDAY_NAMES[new Date().getDay()];
}

// Shuffle A/B/C once per week and assign to Mon/Wed/Fri.
// All three templates are always used — only the order rotates.
// Stored in week.dayAssignment so the same assignment persists all week.
function getOrCreateDayAssignment(weekKey) {
  const week = loadWeek(weekKey);
  if (week.dayAssignment) return week.dayAssignment;

  // Fisher-Yates shuffle
  const templates = ['A', 'B', 'C'];
  for (let i = templates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [templates[i], templates[j]] = [templates[j], templates[i]];
  }

  week.dayAssignment = Object.fromEntries(STRENGTH_DAYS.map((d, i) => [d, templates[i]]));
  saveWeek(weekKey, week);
  return week.dayAssignment;
}

function getWeekKey() {
  const now = new Date();
  const dow = now.getDay();                   // 0=Sun, 1=Mon … 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;   // days back to reach Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() + offset);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);      // e.g. "2026-03-09"
}

function weekStorageKey(weekKey) {
  return `grind:week-${weekKey}`;
}

function loadWeek(weekKey) {
  return storageGet(weekStorageKey(weekKey), {
    dayAssignment: null,
    completed: [],
    usedExercises: {},
  });
}

function saveWeek(weekKey, data) {
  storageSet(weekStorageKey(weekKey), data);
}

function getUsedExercises(categoryKey, weekKey) {
  const week = loadWeek(weekKey);
  return week.usedExercises[categoryKey] || [];
}

function markExerciseUsed(categoryKey, name, weekKey) {
  const week = loadWeek(weekKey);
  if (!week.usedExercises[categoryKey]) week.usedExercises[categoryKey] = [];
  if (!week.usedExercises[categoryKey].includes(name)) {
    week.usedExercises[categoryKey].push(name);
  }
  saveWeek(weekKey, week);
}

function markDayComplete(templateId, weekKey) {
  const week = loadWeek(weekKey);
  if (!week.completed.includes(templateId)) week.completed.push(templateId);
  // Track the actual weekday so the week strip can show a dot on the right day
  const today = getTodayWeekday();
  if (!week.completedWeekdays) week.completedWeekdays = [];
  if (!week.completedWeekdays.includes(today)) week.completedWeekdays.push(today);
  saveWeek(weekKey, week);
}

function getCompletedDays(weekKey) {
  return loadWeek(weekKey).completed;
}

// ── SESSION ────────────────────────────────────────────────────────────────
//
// session mirrors grind:session-active in localStorage.
// Written on: startSession, every spin, every set confirm, completeExercise.
// Cleared on: finishSession.
//
// grind:session-active schema:
// {
//   templateId, weekKey,      // weekKey snapshot prevents week-boundary bug
//   slots,                    // slot snapshot at session start
//   slotIndex,
//   reservations,             // "categoryKey:slotPosition" → exerciseName
//   currentExercise,          // null when on spin screen
//   currentSlot,
//   currentSets,              // in-progress sets (persisted for mid-exercise resume)
//   entries,                  // completed exercises
//   restEndsAt,               // ms timestamp; null when no timer running
//   startTime,                // ISO string
//   status,
// }

let session = null;

function loadSession() {
  return storageGet('grind:session-active', null);
}

function saveSession() {
  if (session) storageSet('grind:session-active', session);
}

function clearSession() {
  session = null;
  storageDel('grind:session-active');
}

function startSession(templateId) {
  const day = DAYS[templateId];
  const weekKey = getWeekKey();  // snapshot here — prevents Sunday→Monday boundary bug

  session = {
    templateId,
    weekKey,
    slots: day.slots.slice(),     // snapshot so in-flight changes don't affect session
    slotIndex: 0,
    reservations: {},
    currentExercise: null,
    currentSlot: null,
    currentSets: [],
    entries: [],
    restEndsAt: null,
    startTime: new Date().toISOString(),
    status: 'in_progress',
  };
  saveSession();
}

// ── SPIN ───────────────────────────────────────────────────────────────────
//
// pickExercise dedup logic (three layers, in priority order):
//
//   1. session reservations  — exercises already spun in THIS session
//   2. week-used             — exercises used earlier THIS week
//   3. full pool fallback    — when (1+2) exhaust all options
//
// Reservation key: "categoryKey:slotPosition" (e.g. "pull-vertical:1")
// Written at SPIN time, not at exercise completion.
// This prevents Day B's two pull-vertical slots from serving the same exercise.

function getSessionReserved(categoryKey) {
  // Collect all exercise names reserved for this category in this session
  return Object.entries(session.reservations || {})
    .filter(([k]) => k.startsWith(categoryKey + ':'))
    .map(([, v]) => v);
}

function pickExercise(categoryKey, slotPosition) {
  const pool = EXERCISES[categoryKey] ?? [];
  if (pool.length === 0) return null;  // guard: unknown category key

  const weekUsed      = getUsedExercises(categoryKey, session.weekKey);
  const sessionUsed   = getSessionReserved(categoryKey);

  let available = pool.filter(e =>
    !weekUsed.includes(e.name) && !sessionUsed.includes(e.name)
  );

  if (available.length === 0) {
    // Week pool exhausted — reset week layer, keep session layer
    available = pool.filter(e => !sessionUsed.includes(e.name));
  }

  if (available.length === 0) {
    // Session reservations fill the entire pool (pool smaller than same-cat slots)
    available = pool;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];

  // Reserve at spin time — prevents intra-session duplicate
  const reservationKey = `${categoryKey}:${slotPosition}`;
  session.reservations[reservationKey] = chosen.name;
  saveSession();

  return chosen;
}

let spinTimerId = null;

function handleSpin() {
  if (spinTimerId !== null) return; // already spinning
  spinToReveal();
}

function spinToReveal() {
  const slotPos = session.slotIndex;
  const slot    = session.slots[slotPos];

  // If this slot already has a reservation (e.g. resume after going home mid-spin),
  // restore the result immediately without re-animating.
  const reservationKey = `${slot.key}:${slotPos}`;
  if (session.reservations[reservationKey]) {
    const pool   = EXERCISES[slot.key] ?? [];
    const chosen = pool.find(e => e.name === session.reservations[reservationKey]);
    if (chosen) { onSpinComplete(chosen, slot); return; }
  }

  const chosen = pickExercise(slot.key, slotPos);
  if (!chosen) return; // safety — empty pool

  const pool  = EXERCISES[slot.key] ?? [];
  const names = pool.map(e => e.name);

  const display = document.getElementById('slot-display');
  const btn     = document.getElementById('spin-btn');

  display.classList.remove('landed');
  display.textContent = '?';
  btn.disabled  = true;
  btn.textContent = 'SPINNING...';
  btn.classList.add('spinning');

  let i = 0;
  spinTimerId = setInterval(() => {
    display.textContent = names[i % names.length];
    i++;
  }, 80);

  setTimeout(() => {
    clearInterval(spinTimerId);
    spinTimerId = null;
    onSpinComplete(chosen, slot);
  }, 1200);
}

function onSpinComplete(chosen, slot) {
  const display = document.getElementById('slot-display');
  const btn     = document.getElementById('spin-btn');

  // Force reflow so the class change triggers the animation fresh
  void display.offsetWidth;
  display.textContent = chosen.name;
  display.classList.add('landed');

  const restMin = Math.floor(chosen.restSeconds / 60);
  const restSec = String(chosen.restSeconds % 60).padStart(2, '0');
  document.getElementById('slot-label').textContent    = slot.label;
  document.getElementById('slot-sets-info').textContent =
    `${chosen.sets} sets  ·  ${chosen.repsRange}  ·  ${restMin}:${restSec} rest`;

  btn.textContent = 'PLACE YOUR BETS →';
  btn.disabled    = false;
  btn.classList.remove('spinning');
  btn.onclick     = () => launchExercise(chosen, slot);
}

function launchExercise(exercise, slot) {
  const lastWeight = getLastWeight(exercise.name);

  session.currentExercise = exercise;
  session.currentSlot     = slot;
  session.currentSets     = Array.from({ length: exercise.sets }, (_, i) => ({
    setNum: i + 1,
    weight: lastWeight ?? '',   // pre-fill from PR history (null until Phase 4)
    reps:   '',
    done:   false,
  }));
  saveSession();

  // Render exercise screen
  document.getElementById('ex-tag').textContent  = slot.label;
  document.getElementById('ex-name').textContent = exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, '0');
  document.getElementById('ex-meta').textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById('ex-tip').textContent = exercise.tip;

  const doneBtn = document.getElementById('complete-ex-btn');
  const isLast  = session.slotIndex === session.slots.length - 1;
  doneBtn.textContent = isLast ? 'FINISH SESSION ▸' : 'DONE — SPIN NEXT ▸';
  doneBtn.disabled    = true;

  stopRest(); // clear any leftover timer state
  document.getElementById('rest-timer').classList.remove('active');

  renderSets();
  showScreen('screen-exercise');
}

function renderSets() {
  const container = document.getElementById('sets-container');
  container.innerHTML = session.currentSets.map((set, i) => {
    const isDone   = set.done;
    const isActive = !isDone && session.currentSets.slice(0, i).every(s => s.done);
    return `
      <div class="set-row fadein ${isDone ? 'done-set' : ''} ${isActive ? 'active-set' : ''}"
           id="set-row-${i}">
        <div class="set-num">${i + 1}</div>
        <div class="input-group">
          <div class="input-label">KG</div>
          <input class="set-input"
            type="number" inputmode="decimal" step="0.5"
            placeholder="${set.weight || '—'}"
            value="${isDone ? (set.weight !== '' ? set.weight : '') : (set.weight || '')}"
            ${isDone || !isActive ? 'disabled' : ''}
            id="weight-${i}" data-idx="${i}" data-field="weight">
        </div>
        <div class="input-group">
          <div class="input-label">REPS</div>
          <input class="set-input"
            type="number" inputmode="numeric"
            placeholder="—"
            value="${isDone ? set.reps : ''}"
            ${isDone || !isActive ? 'disabled' : ''}
            id="reps-${i}" data-idx="${i}" data-field="reps">
        </div>
        <button class="set-done-btn ${isDone ? 'confirmed' : ''}"
                ${isDone ? 'disabled' : ''}
                data-confirm="${i}">
          ${isDone ? '✓' : '→'}
        </button>
      </div>`;
  }).join('');
}

function confirmSet(idx) {
  // Read directly from DOM — more reliable than relying on oninput having fired
  const weightInput = document.getElementById(`weight-${idx}`);
  const repsInput   = document.getElementById(`reps-${idx}`);
  const weight = weightInput ? (weightInput.value.trim() || '—') : '—';
  const reps   = repsInput   ? (repsInput.value.trim()   || '—') : '—';

  session.currentSets[idx].weight = weight;
  session.currentSets[idx].reps   = reps;
  session.currentSets[idx].done   = true;
  saveSession(); // persist every set confirm

  renderSets();

  const allDone = session.currentSets.every(s => s.done);
  if (allDone) {
    document.getElementById('complete-ex-btn').disabled = false;
    return;
  }

  // Non-last set: start rest timer
  startRest(session.currentExercise.restSeconds);
}

function completeExercise() {
  // Required: clear rest timer state before anything else
  stopRest();
  session.restEndsAt = null;

  const ex   = session.currentExercise;
  const slot = session.currentSlot;

  // Save last weight for pre-fill on next session (Phase 3)
  saveLastWeight(ex.name, session.currentSets);

  // PR detection (stub — returns {}; replaced with full logic in Phase 4)
  const prs = checkAndUpdatePR(ex.name, session.currentSets);

  // Mark exercise used in the week store
  markExerciseUsed(slot.key, ex.name, session.weekKey);

  // Record the completed exercise
  session.entries.push({
    exerciseName:  ex.name,
    categoryLabel: slot.label,
    sets: session.currentSets.map(s => ({ weight: s.weight, reps: s.reps })),
    timestamp: new Date().toISOString(),
    prs,
  });

  // Advance slot index and clear current exercise state
  session.slotIndex++;
  session.currentExercise = null;
  session.currentSlot     = null;
  session.currentSets     = [];
  saveSession();

  if (session.slotIndex >= session.slots.length) {
    finishSession();
    return;
  }

  // Return to session screen for next spin
  renderSessionScreen();
  showScreen('screen-session');
}

function finishSession() {
  const duration   = Math.round((Date.now() - new Date(session.startTime)) / 60000);
  const totalSets  = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const templateId = session.templateId;
  const weekKey    = session.weekKey;
  const payload    = buildSyncPayload(duration, totalSets);

  markDayComplete(templateId, weekKey);
  appendHistory({
    date:            new Date().toLocaleDateString('en-GB'),
    templateId,
    durationMinutes: duration,
    totalSets,
    entries:         session.entries,
    timestamp:       new Date().toISOString(),
  });

  // Collect PRs and nudges across this session (Phase 4 populates these)
  const sessionPRs    = session.entries.flatMap(e =>
    Object.entries(e.prs || {}).map(([type, data]) =>
      ({ exerciseName: e.exerciseName, type, ...data })
    )
  );
  const sessionNudges = session.entries
    .map(e => ({ exerciseName: e.exerciseName, nudge: getOverloadNudge(e.exerciseName) }))
    .filter(n => n.nudge !== null);

  clearSession();

  renderDoneScreen({ templateId, exerciseCount: session?.entries?.length ?? payload.exercises.length, totalSets, duration, sessionPRs, sessionNudges });
  showScreen('screen-done');
  syncToSheets(payload);
}

// ── TIMER ──────────────────────────────────────────────────────────────────
//
// Timestamp-delta approach: endTime is stored in session so the timer
// resumes correctly after the app is backgrounded or the tab is closed.
//
// tick() runs every 200ms and computes remaining = ceil((endTime - now) / 1000).
// This is immune to setInterval drift and background throttling.

let restTimerId = null;

function startRest(seconds) {
  stopRest(); // cancel any existing timer
  const endTime       = Date.now() + seconds * 1000;
  session.restEndsAt  = endTime;
  saveSession();

  document.getElementById('rest-timer').classList.add('active');

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining <= 0) { onRestComplete(); return; }
    updateTimerDisplay(remaining);
    restTimerId = setTimeout(tick, 200);
  };
  tick();
}

function stopRest() {
  if (restTimerId) { clearTimeout(restTimerId); restTimerId = null; }
}

function skipRest() {
  stopRest();
  session.restEndsAt = null;
  saveSession();
  document.getElementById('rest-timer').classList.remove('active');
}

function onRestComplete() {
  stopRest();
  session.restEndsAt = null;
  saveSession();
  document.getElementById('rest-timer').classList.remove('active');

  // Auto-focus next active set weight input
  const nextIdx = session.currentSets.findIndex(s => !s.done);
  if (nextIdx >= 0) {
    const el = document.getElementById(`weight-${nextIdx}`);
    if (el) el.focus();
  }
}

function updateTimerDisplay(remaining) {
  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('rest-countdown').textContent = `${m}:${s}`;
}

function resumeRestIfNeeded() {
  if (!session?.restEndsAt) return;
  const remaining = Math.ceil((session.restEndsAt - Date.now()) / 1000);
  if (remaining > 0) {
    document.getElementById('rest-timer').classList.add('active');
    updateTimerDisplay(remaining);
    const endTime = session.restEndsAt;
    const tick = () => {
      const r = Math.ceil((endTime - Date.now()) / 1000);
      if (r <= 0) { onRestComplete(); return; }
      updateTimerDisplay(r);
      restTimerId = setTimeout(tick, 200);
    };
    tick();
  } else {
    onRestComplete();
  }
}

// ── PR TRACKING ────────────────────────────────────────────────────────────
// Stub implementations for Phase 1.
// Phase 4 replaces these with full logic.

function parseWeight(w) {
  if (!w || w === '—' || (typeof w === 'string' && w.toLowerCase() === 'bw')) return null;
  const n = parseFloat(w);
  return isNaN(n) ? null : n;
}

// Saves the heaviest numeric set weight from a completed exercise.
// This is the only grind:pr write in Phase 3.
// Phase 4 (checkAndUpdatePR) extends this same record with full PR data.
function saveLastWeight(exerciseName, sets) {
  const numericWeights = sets.map(s => parseWeight(s.weight)).filter(w => w !== null);
  if (numericWeights.length === 0) return; // BW exercise — nothing to save
  const max = Math.max(...numericWeights);
  const pr = storageGet('grind:pr', {});
  if (!pr[exerciseName]) pr[exerciseName] = {};
  pr[exerciseName].lastWeight = String(max);
  storageSet('grind:pr', pr);
}

// Phase 1 stub — returns {} (no PRs)
function checkAndUpdatePR(exerciseName, sets) {   // eslint-disable-line no-unused-vars
  return {};
}

// Phase 1 stub — returns null (no nudges)
function getOverloadNudge(exerciseName) {          // eslint-disable-line no-unused-vars
  return null;
}

// Phase 1 stub
function markNudgeShown(exerciseName) {}           // eslint-disable-line no-unused-vars

function getLastWeight(exerciseName) {
  const pr = storageGet('grind:pr', {});
  const val = pr[exerciseName]?.lastWeight;
  return val ?? null;
}

// ── HISTORY ────────────────────────────────────────────────────────────────

function loadHistory() {
  return storageGet('grind:history', []);
}

function appendHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  storageSet('grind:history', history);
}

let historyOffset = 30; // display cap — shows last 30, "Show more" adds 30

function renderHistory() {
  historyOffset = 30; // reset on each open
  const all     = loadHistory();
  const list    = document.getElementById('history-list');
  const moreBtn = document.getElementById('history-more-btn');

  if (all.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">🎰</div>
        <div>No sessions yet. Deal your first hand.</div>
      </div>`;
    moreBtn.style.display = 'none';
    return;
  }

  const visible = all.slice(-historyOffset).reverse(); // most recent first
  list.innerHTML = visible.map((session, i) => renderHistoryCard(session, i)).join('');
  moreBtn.style.display = all.length > historyOffset ? 'block' : 'none';
}

function renderHistoryCard(s, i) {
  const dayName = DAYS[s.templateId]?.name ?? `Day ${s.templateId}`;
  const prEntries = s.entries?.filter(e => Object.keys(e.prs || {}).length > 0) ?? [];
  const prLine    = prEntries.length > 0
    ? `<div class="history-card-prs">✦ PRs: ${prEntries.map(e => e.exerciseName).join(', ')}</div>`
    : '';
  const detail = (s.entries ?? []).map(e => `
    <div class="history-entry">
      <div><span class="history-entry-name">${e.exerciseName}</span>
           &nbsp;<span class="history-entry-cat">${e.categoryLabel}</span></div>
      <div class="history-entry-sets">${e.sets.map((set, si) =>
        `Set ${si + 1}: ${set.weight}kg × ${set.reps}`).join('  |  ')}</div>
    </div>`).join('');

  return `
    <div class="history-card fadein" data-history-idx="${i}">
      <div class="history-card-meta">${s.date} · ${dayName} · ${s.durationMinutes}m</div>
      <div class="history-card-stats">${s.entries?.length ?? '?'} exercises · ${s.totalSets} sets</div>
      ${prLine}
      <div class="history-card-detail">${detail}</div>
    </div>`;
}

// ── SYNC ───────────────────────────────────────────────────────────────────

function buildSyncPayload(duration, totalSets) {
  return {
    date:             new Date().toLocaleDateString('en-GB'),
    day:              session.templateId,
    duration_minutes: duration,
    total_sets:       totalSets,
    exercises:        session.entries.map(e => ({
      exercise:          e.exerciseName,
      category:          e.categoryLabel,
      sets:              e.sets.map((s, i) => `Set ${i + 1}: ${s.weight}kg × ${s.reps}`).join(' | '),
      session_volume_kg: e.sets.reduce((sum, s) => sum + (parseWeight(s.weight) ?? 0) * (parseInt(s.reps) || 0), 0),
      pr_weight:         !!(e.prs?.weight),
      pr_volume:         !!(e.prs?.volume),
      timestamp:         e.timestamp,
    })),
  };
}

async function syncToSheets(payload) {
  const syncEl = document.getElementById('done-sync');

  if (CONFIG.dryRun || !CONFIG.webhookUrl || CONFIG.webhookUrl.includes('YOUR_N8N')) {
    if (syncEl) { syncEl.textContent = 'DRY RUN — set webhookUrl in CONFIG'; syncEl.className = 'done-sync success'; }
    return;
  }

  if (syncEl) { syncEl.textContent = 'SYNCING...'; syncEl.className = 'done-sync syncing'; }
  try {
    const res = await fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (syncEl) { syncEl.textContent = 'SYNCED ✓'; syncEl.className = 'done-sync success'; }
  } catch (e) {
    console.warn('[GRIND] sync failed:', e.message);
    if (syncEl) {
      syncEl.textContent = 'SYNC FAILED — tap to retry';
      syncEl.className   = 'done-sync error';
      syncEl.onclick     = () => syncToSheets(payload);
    }
    enqueueSyncPayload(payload);
  }
}

function enqueueSyncPayload(payload) {
  const queue = storageGet('grind:sync-queue', []);
  queue.push({ payload, failedAt: new Date().toISOString() });
  storageSet('grind:sync-queue', queue);
}

function showSyncBar(msg, type = '') {
  const bar = document.getElementById('sync-bar');
  if (!bar) return;
  bar.textContent  = msg;
  bar.className    = `sync-bar show ${type}`;
  clearTimeout(showSyncBar._timer);
  showSyncBar._timer = setTimeout(() => bar.classList.remove('show'), 3000);
}

// ── APP / ROUTER ────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  window.scrollTo(0, 0);
}

function goHome() {
  stopRest();
  renderHome();
  showScreen('screen-home');
}

function renderHome() {
  renderWeekStrip();
  renderDayCards();
  renderResumeBanner();
}

function renderWeekStrip() {
  const weekKey           = getWeekKey();
  const week              = loadWeek(weekKey);
  const completedWeekdays = week.completedWeekdays || [];
  const todayWeekday      = getTodayWeekday();
  // Mon-first labels and weekday name mapping
  const labels            = ['M','T','W','T','F','S','S'];
  const weekdays          = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const strip             = document.getElementById('week-strip');

  strip.innerHTML = labels.map((label, i) => {
    const weekday = weekdays[i];
    const isToday = weekday === todayWeekday;
    const isDone  = completedWeekdays.includes(weekday);
    return `<div class="week-day ${isToday ? 'today' : ''} ${isDone ? 'done' : ''}">
      ${label}<div class="dot"></div>
    </div>`;
  }).join('');
}

function renderDayCards() {
  const weekKey      = getWeekKey();
  const assignment   = getOrCreateDayAssignment(weekKey);   // { monday:'C', wednesday:'A', friday:'B' }
  const completed    = getCompletedDays(weekKey);
  const todayWeekday = getTodayWeekday();
  const isStrengthDay = STRENGTH_DAYS.includes(todayWeekday);
  const container    = document.getElementById('day-cards');

  // Show one card per strength day in Mon / Wed / Fri order
  container.innerHTML = STRENGTH_DAYS.map(weekday => {
    const templateId = assignment[weekday];
    const day        = DAYS[templateId];
    const isDone     = completed.includes(templateId);
    const isToday    = weekday === todayWeekday;
    const tags       = day.slots.map(s => `<span class="slot-tag">${s.label}</span>`).join('');

    return `
      <div class="day-card fadein ${isDone ? 'completed' : ''} ${isToday ? 'today-card' : ''}"
           data-day="${templateId}">
        <div class="day-card-top">
          <div class="day-letter">${templateId}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <div class="day-weekday-label">${WEEKDAY_SHORT[weekday]}</div>
            <div class="day-done-badge">DONE ✓</div>
          </div>
        </div>
        <div class="day-name">${day.name}</div>
        <div class="day-focus">${day.focus}</div>
        <div class="day-slots">${tags}</div>
        <div class="day-cta">${isToday ? 'DEAL CARDS NOW →' : 'DEAL CARDS →'}</div>
      </div>`;
  }).join('');
}

function renderResumeBanner() {
  const saved  = loadSession();
  const banner = document.getElementById('resume-banner');
  if (!saved || saved.status !== 'in_progress') {
    banner.style.display = 'none';
    return;
  }
  const day       = DAYS[saved.templateId];
  const slotLabel = day ? `Exercise ${saved.slotIndex + 1}/${saved.slots.length}` : '';
  document.getElementById('resume-text').textContent =
    `♠ SESSION IN PROGRESS · ${saved.templateId ? `Day ${saved.templateId}` : ''} · ${slotLabel}`;
  banner.style.display = 'flex';
}

function resumeSession() {
  session = loadSession();
  if (!session) return;

  if (session.currentExercise) {
    // Was mid-exercise — restore exercise screen with saved sets
    launchExerciseFromSession();
  } else {
    // Was on spin screen — restore session screen
    renderSessionScreen();
    showScreen('screen-session');
    resumeRestIfNeeded(); // unlikely but safe
  }
}

function launchExerciseFromSession() {
  const exercise = session.currentExercise;
  const slot     = session.currentSlot;

  document.getElementById('ex-tag').textContent  = slot.label;
  document.getElementById('ex-name').textContent = exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, '0');
  document.getElementById('ex-meta').textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById('ex-tip').textContent  = exercise.tip;

  const doneBtn = document.getElementById('complete-ex-btn');
  const isLast  = session.slotIndex === session.slots.length - 1;
  doneBtn.textContent = isLast ? 'FINISH SESSION ▸' : 'DONE — SPIN NEXT ▸';
  doneBtn.disabled    = !session.currentSets.every(s => s.done);

  document.getElementById('rest-timer').classList.remove('active');
  renderSets();
  showScreen('screen-exercise');
  resumeRestIfNeeded();
}

function renderSessionScreen() {
  const day  = DAYS[session.templateId];
  document.getElementById('sess-title').textContent = `DAY ${session.templateId}`;
  document.getElementById('sess-sub').textContent   =
    `${day.focus} · ${session.slots.length} exercises`;

  updateProgress();

  const slot           = session.slots[session.slotIndex];
  const reservationKey = `${slot.key}:${session.slotIndex}`;
  const alreadySpun    = session.reservations[reservationKey];

  const display = document.getElementById('slot-display');
  const btn     = document.getElementById('spin-btn');

  display.classList.remove('landed');

  if (alreadySpun) {
    // Slot was already spun before going Home — restore result
    const pool   = EXERCISES[slot.key] ?? [];
    const chosen = pool.find(e => e.name === alreadySpun);
    if (chosen) {
      onSpinComplete(chosen, slot);
      return;
    }
  }

  // Fresh spin state
  display.textContent = '?';
  document.getElementById('slot-label').textContent     = 'READY TO SPIN';
  document.getElementById('slot-sets-info').textContent = '';
  btn.textContent = 'SPIN';
  btn.disabled    = false;
  btn.classList.remove('spinning');
  btn.onclick     = handleSpin;
}

function renderDoneScreen({ templateId, totalSets, duration, sessionPRs, sessionNudges }) {
  const day = DAYS[templateId];
  document.getElementById('done-sub').textContent =
    `${day?.name ?? `Day ${templateId}`} complete`;

  const entries = loadHistory().slice(-1)[0]?.entries ?? [];
  document.getElementById('done-stats').innerHTML = `
    <div class="done-stat">
      <div class="done-stat-val">${entries.length}</div>
      <div class="done-stat-label">Exercises</div>
    </div>
    <div class="done-stat">
      <div class="done-stat-val">${totalSets}</div>
      <div class="done-stat-label">Sets</div>
    </div>
    <div class="done-stat">
      <div class="done-stat-val">${duration}m</div>
      <div class="done-stat-label">Duration</div>
    </div>`;

  // Phase 4: PR section
  const prsBlock = document.getElementById('done-prs');
  if (sessionPRs?.length > 0) {
    document.getElementById('done-prs-list').innerHTML = sessionPRs.map(pr =>
      `<div class="done-pr-item">${pr.exerciseName} — ${pr.type === 'weight' ? `+${(pr.new - pr.prev).toFixed(1)}kg max weight` : `volume PR`}</div>`
    ).join('');
    prsBlock.style.display = 'block';
  } else {
    prsBlock.style.display = 'none';
  }

  // Phase 4: Nudges section
  const nudgesBlock = document.getElementById('done-nudges');
  if (sessionNudges?.length > 0) {
    document.getElementById('done-nudges-list').innerHTML = sessionNudges.map(n =>
      `<div class="done-pr-item">${n.exerciseName} — Last 3× at ${n.nudge.currentWeight}kg → try ${n.nudge.suggestedWeight}kg?</div>`
    ).join('');
    nudgesBlock.style.display = 'block';
    // Mark nudges shown
    sessionNudges.forEach(n => markNudgeShown(n.exerciseName));
  } else {
    nudgesBlock.style.display = 'none';
  }

  document.getElementById('done-sync').textContent = '';
  document.getElementById('done-sync').className   = 'done-sync';
}

function updateProgress() {
  const pct = session.slots.length > 0
    ? (session.slotIndex / session.slots.length) * 100
    : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

// ── EVENT WIRING ────────────────────────────────────────────────────────────

function wireEvents() {
  // Home
  document.getElementById('resume-btn').addEventListener('click', resumeSession);
  document.getElementById('history-btn').addEventListener('click', () => {
    renderHistory();
    showScreen('screen-history');
  });

  // Day cards (event delegation)
  document.getElementById('day-cards').addEventListener('click', e => {
    const card = e.target.closest('[data-day]');
    if (!card) return;
    const id = card.dataset.day;
    startSession(id);
    renderSessionScreen();
    showScreen('screen-session');
  });

  // Session screen
  document.getElementById('session-back').addEventListener('click', goHome);
  document.getElementById('spin-btn').addEventListener('click', handleSpin);

  // Exercise screen
  document.getElementById('rest-skip-btn').addEventListener('click', skipRest);
  document.getElementById('complete-ex-btn').addEventListener('click', completeExercise);

  // Set confirm (event delegation on container)
  document.getElementById('sets-container').addEventListener('click', e => {
    const btn = e.target.closest('[data-confirm]');
    if (btn) confirmSet(parseInt(btn.dataset.confirm, 10));
  });

  // Done screen
  document.getElementById('done-back-btn').addEventListener('click', goHome);

  // History screen
  document.getElementById('history-back').addEventListener('click', () => showScreen('screen-home'));
  document.getElementById('history-more-btn').addEventListener('click', () => {
    historyOffset += 30;
    renderHistory();
  });

  // History card expand/collapse (event delegation)
  document.getElementById('history-list').addEventListener('click', e => {
    const card = e.target.closest('.history-card');
    if (card) card.classList.toggle('expanded');
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────

function init() {
  wireEvents();
  renderHome();

  // Flush any queued sync payloads from previous offline sessions
  flushSyncQueue();
}

async function flushSyncQueue() {
  const queue = storageGet('grind:sync-queue', []);
  if (queue.length === 0) return;
  if (!navigator.onLine) return;
  if (CONFIG.dryRun || !CONFIG.webhookUrl || CONFIG.webhookUrl.includes('YOUR_N8N')) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(CONFIG.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSyncBar(`Flushed queued session from ${item.failedAt.slice(0, 10)}`, 'success');
    } catch {
      remaining.push(item);
    }
  }
  storageSet('grind:sync-queue', remaining);
}

document.addEventListener('DOMContentLoaded', init);

// ── TESTS ──────────────────────────────────────────────────────────────────
// Run via: open index.html?test in the browser, then check the console.
// Tests run after DOM is ready (safe to call storage + logic functions).
//
// NOTE: checkAndUpdatePR and getOverloadNudge are stubs in Phase 1.
//       Tests for those functions will be activated in Phase 4.

function runTests() {
  let pass = 0, fail = 0;
  function assert(cond, label) {
    if (cond) { console.log(`  ✅ ${label}`); pass++; }
    else       { console.error(`  ❌ ${label}`); fail++; }
  }
  console.group('GRIND — Phase 1 Tests');

  // 1. getWeekKey() — format and Monday assertion
  {
    const key = getWeekKey();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(key), `Week key is YYYY-MM-DD format (got "${key}")`);
    const d = new Date(key + 'T00:00:00');
    assert(d.getDay() === 1, `Week key resolves to a Monday (getDay()=${d.getDay()})`);
  }

  // 2. parseWeight — edge cases
  {
    assert(parseWeight('—')   === null, 'parseWeight("—") → null');
    assert(parseWeight('')    === null, 'parseWeight("") → null');
    assert(parseWeight('bw')  === null, 'parseWeight("bw") → null');
    assert(parseWeight('BW')  === null, 'parseWeight("BW") → null');
    assert(parseWeight('40')  === 40,   'parseWeight("40") → 40');
    assert(parseWeight('42.5') === 42.5, 'parseWeight("42.5") → 42.5');
    assert(parseWeight(null)  === null, 'parseWeight(null) → null');
  }

  // 3. pickExercise — basic pick
  {
    const fakeSession = {
      weekKey: getWeekKey(),
      slotIndex: 0,
      reservations: {},
    };
    const orig = session;
    session    = fakeSession;

    const ex = pickExercise('lower-quad', 0);
    assert(ex !== null, 'pickExercise returns an exercise for lower-quad');
    assert(typeof ex?.name === 'string', 'Returned exercise has a name');
    assert(fakeSession.reservations['lower-quad:0'] === ex?.name,
      'Reservation written at spin time');

    session = orig;
  }

  // 4. pickExercise — intra-session dedup (Day B: pull-vertical × 2)
  {
    const fakeSession = {
      weekKey: getWeekKey(),
      slotIndex: 0,
      reservations: {},
    };
    const orig = session;
    session    = fakeSession;

    const ex1 = pickExercise('pull-vertical', 1);
    const ex2 = pickExercise('pull-vertical', 4);

    assert(ex1 !== null && ex2 !== null, 'Both pull-vertical picks return exercises');
    if (ex1 && ex2) {
      assert(ex1.name !== ex2.name,
        `Intra-session dedup: slot 1 got "${ex1?.name}", slot 4 got "${ex2?.name}"`);
    }

    session = orig;
  }

  // 5. pickExercise — unknown category returns null
  {
    const fakeSession = { weekKey: getWeekKey(), reservations: {} };
    const orig = session;
    session    = fakeSession;
    const ex = pickExercise('nonexistent-category', 0);
    assert(ex === null, 'pickExercise returns null for unknown category');
    session = orig;
  }

  // 6. checkAndUpdatePR stub — BW exercise
  {
    const prs = checkAndUpdatePR('Pull-Up', [{ weight: '—', reps: '8' }]);
    assert(Object.keys(prs).length === 0,
      'checkAndUpdatePR (stub) returns {} for BW exercise');
  }

  // 7. getOverloadNudge stub — returns null
  {
    const nudge = getOverloadNudge('Bulgarian Split Squat');
    assert(nudge === null, 'getOverloadNudge (stub) returns null');
  }

  // 8. saveLastWeight — stores max weight, skips BW
  {
    const testSets = [{ weight: '40', reps: '8' }, { weight: '42.5', reps: '7' }, { weight: '40', reps: '6' }];
    saveLastWeight('Bulgarian Split Squat', testSets);
    const saved = getLastWeight('Bulgarian Split Squat');
    assert(saved === '42.5', `saveLastWeight stores heaviest set (got "${saved}")`);

    // BW exercise — should not overwrite existing or create entry
    const preBW = getLastWeight('Pull-Up');
    saveLastWeight('Pull-Up', [{ weight: '—', reps: '8' }, { weight: '—', reps: '7' }]);
    assert(getLastWeight('Pull-Up') === preBW, 'saveLastWeight skips BW exercise');

    // Cleanup test data
    const pr = storageGet('grind:pr', {});
    delete pr['Bulgarian Split Squat'];
    storageSet('grind:pr', pr);
  }

  // 9. getOrCreateDayAssignment — all templates used, persists on second call
  {
    const testKey = 'test-week-2099-01-01';
    const assignment1 = getOrCreateDayAssignment(testKey);
    const values = Object.values(assignment1).sort().join(',');
    assert(values === 'A,B,C', `Day assignment uses all 3 templates (got "${values}")`);
    assert(Object.keys(assignment1).length === 3, 'Assignment covers 3 weekdays');

    const assignment2 = getOrCreateDayAssignment(testKey);
    assert(JSON.stringify(assignment1) === JSON.stringify(assignment2),
      'Day assignment is stable across calls same week');

    // Cleanup
    storageDel(`grind:week-${testKey}`);
  }

  // 10. Data integrity — all day slots reference valid EXERCISES keys
  {
    let allValid = true;
    Object.entries(DAYS).forEach(([dayId, day]) => {
      day.slots.forEach(slot => {
        if (!(slot.key in EXERCISES)) {
          console.error(`  ⚠️  Day ${dayId} slot "${slot.label}" key "${slot.key}" not in EXERCISES`);
          allValid = false;
        }
      });
    });
    assert(allValid, 'All day slot keys reference valid EXERCISES entries');
  }

  console.groupEnd();
  const status = fail === 0 ? '✅ All tests passed' : `⚠️  ${fail} test(s) failed`;
  console.log(`\n${status} (${pass} passed, ${fail} failed)`);
}

if (location.search.includes('test')) {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(runTests, 100); // let init() finish first
  });
}
