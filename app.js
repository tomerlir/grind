"use strict";
// ═══════════════════════════════════════════════════════════════════════════
// GRIND — Workout Slot Machine  |  app.js  |  Phase 1
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

const DEFAULT_CONFIG = {
  webhookUrl: "YOUR_N8N_WEBHOOK_URL",
  dryRun: true,
};

const CONFIG = {
  ...DEFAULT_CONFIG,
  ...(globalThis.GRIND_CONFIG || {}),
};

// ── DATA ───────────────────────────────────────────────────────────────────
// Exercise pools. Ported verbatim from workout-roulette.html prototype.
// categoryKey → Exercise[]

const EXERCISES = {
  "lower-quad": [
    {
      name: "Bulgarian Split Squat",
      sets: 4,
      repsRange: "6–10",
      restSeconds: 120,
      tip: "Front foot flat, torso upright. Drive through the heel. Control the descent — 2s down.",
    },
    {
      name: "Dumbbell Goblet Squat",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "3-second eccentric. Elbows inside knees at the bottom. Pause 1s at depth.",
    },
    {
      name: "Dumbbell Alternating Lunges",
      sets: 3,
      repsRange: "20–24 steps",
      restSeconds: 90,
      tip: "Long stride so the front shin stays vertical. Drive the back knee down, not forward.",
    },
  ],

  "lower-hinge": [
    {
      name: "Dumbbell Romanian Deadlift",
      sets: 4,
      repsRange: "6–12",
      restSeconds: 90,
      tip: "Hinge at the hip, not the waist. Feel the stretch in hamstrings before reversing. Neutral spine throughout.",
    },
    {
      name: "Single-Leg Romanian Deadlift",
      sets: 3,
      repsRange: "8–10 each",
      restSeconds: 90,
      tip: "Use a wall for balance if needed. Keep hips square — don't rotate to the standing leg.",
    },
    {
      name: "Dumbbell Good Morning",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "Light weight. DB on one shoulder or held at chest. Hinge until you feel hamstring tension, then drive hips forward.",
    },
  ],

  "lower-glute": [
    {
      name: "Dumbbell Hip Thrust",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "Shoulders on sofa edge, DB on hips. Squeeze hard at the top. Lower until hips nearly touch floor.",
    },
    {
      name: "Single-Leg Hip Thrust",
      sets: 3,
      repsRange: "10–12 each",
      restSeconds: 90,
      tip: "Same setup, one leg extended. Drives the contraction into the working glute exclusively.",
    },
  ],

  "push-horizontal": [
    {
      name: "Deficit Push-Up",
      sets: 4,
      repsRange: "8–15",
      restSeconds: 90,
      tip: "Hands on books or dumbbell plates for extra depth. Let chest sink below hand level. Full range is what makes this better.",
    },
    {
      name: "Dumbbell Floor Press",
      sets: 4,
      repsRange: "8–12",
      restSeconds: 90,
      tip: "Elbows 45° from torso. Touch the floor lightly each rep — don't bounce. Control the descent.",
    },
    {
      name: "Dumbbell Floor Fly",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "Slight bend in the elbows throughout. Stretch is everything here — feel the pecs at the bottom.",
    },
    {
      name: "Archer Push-Up",
      sets: 3,
      repsRange: "8–12 each",
      restSeconds: 90,
      tip: "Wide hand position. Shift weight to one arm and lower. The other arm stays straight as a guide. Brutal on the chest.",
    },
  ],

  "push-vertical": [
    {
      name: "Dumbbell Overhead Press",
      sets: 3,
      repsRange: "10–12",
      restSeconds: 90,
      tip: "Press straight up, not forward. Lock out at the top. Lower to shoulder height with control.",
    },
    {
      name: "Arnold Press",
      sets: 3,
      repsRange: "10–12",
      restSeconds: 90,
      tip: "Start with palms facing you, rotate as you press. Slow rotation on the way down is where the work is.",
    },
    {
      name: "Pike Push-Up",
      sets: 3,
      repsRange: "10–15",
      restSeconds: 90,
      tip: "Hips high, body in an inverted V. Head goes to the floor between your hands. Vertical pressing pattern.",
    },
    {
      name: "Dumbbell High Pull",
      sets: 3,
      repsRange: "10–12",
      restSeconds: 90,
      tip: "Pull DBs to chin height, elbows flare out above hands. Explosive up, controlled down.",
    },
  ],

  "pull-vertical": [
    {
      name: "Pull-Up",
      sets: 4,
      repsRange: "6–10",
      restSeconds: 90,
      tip: "Dead hang start. Pull elbows to your hips, not your shoulders to the bar. Full ROM every rep.",
    },
    {
      name: "Chin-Up",
      sets: 4,
      repsRange: "6–10",
      restSeconds: 90,
      tip: "Supinated grip. Biceps assist more here. Same cue: elbows to hips. Squeeze the lat at the top.",
    },
    {
      name: "Dumbbell Pullover",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 90,
      tip: "Lie across a sofa edge, shoulders supported. Arms straight, arc the DB from over your chest to behind your head. Feel the lat stretch.",
    },
  ],

  "pull-horizontal": [
    {
      name: "Dumbbell Incline Row",
      sets: 3,
      repsRange: "10–12 each",
      restSeconds: 90,
      tip: "Lie face-down over a sofa arm or ottoman, chest hanging off. Pull elbows back and squeeze shoulder blades. No momentum.",
    },
    {
      name: "Single-Arm Dumbbell Row",
      sets: 3,
      repsRange: "10–12 each",
      restSeconds: 90,
      tip: "Knee and hand on a sturdy chair or sofa. Drive the elbow back and up, not just up. Full stretch at the bottom.",
    },
    {
      name: "Dumbbell Rear Delt Fly",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 60,
      tip: "Hinge forward 45°. Arms out to the sides with a slight bend. Lead with the elbows, not the hands.",
    },
  ],

  "arms-bicep": [
    {
      name: "Supinating Dumbbell Curl",
      sets: 3,
      repsRange: "10–12",
      restSeconds: 60,
      tip: "Start neutral, supinate at the top. The twist is where the peak contraction lives. Squeeze hard.",
    },
    {
      name: "Hammer Curl",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 60,
      tip: "Neutral grip throughout. Hits brachialis and brachioradialis. Slower tempo = more time under tension.",
    },
  ],

  "arms-tricep": [
    {
      name: "Dumbbell OH Tricep Extension",
      sets: 3,
      repsRange: "10–12",
      restSeconds: 60,
      tip: "Upper arm parallel to floor throughout. Extend fully and hold 1s. Squeeze hard at lockout.",
    },
    {
      name: "Dumbbell Tricep Kickback",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 60,
      tip: "Hinge forward, upper arm parallel to floor. Extend to full lockout. Slow on the way back.",
    },
    {
      name: "Diamond Push-Up",
      sets: 3,
      repsRange: "10–15",
      restSeconds: 60,
      tip: "Hands close, forming a diamond. Elbows track back alongside the torso, not out wide.",
    },
  ],

  core: [
    {
      name: "Hanging Knee Raise",
      sets: 3,
      repsRange: "12–15",
      restSeconds: 60,
      tip: "2s up, 2s down. No swinging. At the top, posterior-tilt the pelvis to fully contract the abs.",
    },
    {
      name: "Hollow Body Hold",
      sets: 3,
      repsRange: "20–30s",
      restSeconds: 60,
      tip: "Lower back pressed into floor. Arms by ears, legs straight and low. If lower back lifts, raise legs higher.",
    },
    {
      name: "Weighted Crunch",
      sets: 3,
      repsRange: "15–20",
      restSeconds: 60,
      tip: "Hold DB on chest. Curl the ribcage toward the pelvis — don't just lift the head. Slow and controlled.",
    },
    {
      name: "Plank Hold",
      sets: 3,
      repsRange: "30–45s",
      restSeconds: 60,
      tip: "Forearms down, squeeze everything: quads, glutes, abs. Body in one rigid line. Don't let hips drop.",
    },
    {
      name: "Dead Bug",
      sets: 3,
      repsRange: "10–12 each",
      restSeconds: 60,
      tip: "Press lower back into floor the entire time. Opposite arm and leg extend slowly. Breathing matters here.",
    },
  ],

  calves: [
    {
      name: "Single-Leg Calf Raise",
      sets: 4,
      repsRange: "12–15 each",
      restSeconds: 60,
      tip: "On a step edge for full ROM. Slow up, pause at top, slow down. Add weight in one hand when it gets easy.",
    },
  ],
};

// Day definitions: { id → { name, focus, slots: [{ key, label }] } }
// Slot position index (0-based) is used as the reservation key.
const DAYS = {
  A: {
    name: "Day A",
    focus: "Squat · Push · Pull",
    slots: [
      { key: "lower-quad", label: "LOWER · QUAD" },
      { key: "push-horizontal", label: "PUSH · HORIZONTAL" },
      { key: "pull-vertical", label: "PULL · VERTICAL" },
      { key: "lower-hinge", label: "LOWER · HINGE" },
      { key: "push-vertical", label: "PUSH · VERTICAL" },
      { key: "arms-bicep", label: "ARMS · BICEP" },
      { key: "core", label: "CORE" },
    ],
  },
  B: {
    name: "Day B",
    focus: "Hinge · Push · Pull",
    slots: [
      { key: "lower-hinge", label: "LOWER · HINGE" },
      { key: "pull-vertical", label: "PULL · VERTICAL" }, // slot 1
      { key: "push-vertical", label: "PUSH · VERTICAL" },
      { key: "lower-glute", label: "LOWER · GLUTE" },
      { key: "pull-horizontal", label: "PULL · HORIZONTAL" },
      { key: "push-horizontal", label: "PUSH · HORIZONTAL" },
      { key: "core", label: "CORE" },
    ],
  },
  C: {
    name: "Day C",
    focus: "Lunge · Unilateral · Arms",
    slots: [
      { key: "lower-quad", label: "LOWER · QUAD" },
      { key: "push-horizontal", label: "PUSH · HORIZONTAL" },
      { key: "pull-horizontal", label: "PULL · HORIZONTAL" },
      { key: "lower-quad", label: "LOWER · LUNGE" }, // same pool, different label — intentional
      { key: "pull-vertical", label: "PULL · LAT" },
      { key: "arms-bicep", label: "ARMS · BICEP" },
      { key: "arms-tricep", label: "ARMS · TRICEP" },
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
    console.warn("[GRIND] localStorage write failed:", key, e.name);
  }
}

function storageDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ── WEEK STORE ─────────────────────────────────────────────────────────────
//
// Week data stored under grind:week-{YYYY-MM-DD} (Monday of current week).
// Schema:
//   templateChoices:    ['A', 'B', 'C']  — fixed weekly choices, selectable any day
//   completed:          string[]   — template IDs completed this week
//   completedByTemplate:{ A: 'tuesday' } — actual weekday each template was completed
//   completedWeekdays:  string[]   — legacy weekday list kept for migration
//   usedExercises:      { categoryKey: string[] }
//
// Week key uses toISOString().slice(0,10) — always YYYY-MM-DD, never 0-indexed month.

const DAY_TEMPLATES = ["A", "B", "C"];
const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function getTodayWeekday() {
  return WEEKDAY_NAMES[new Date().getDay()];
}

function formatWeekdayLabel(weekday) {
  if (!weekday) return "";
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function createEmptyWeek() {
  return {
    templateChoices: DAY_TEMPLATES.slice(),
    completed: [],
    completedByTemplate: {},
    completedWeekdays: [],
    usedExercises: {},
  };
}

function normalizeWeekData(week) {
  const normalized = {
    ...createEmptyWeek(),
    ...(week && typeof week === "object" ? week : {}),
  };
  let changed = false;

  const templateChoices = Array.isArray(normalized.templateChoices)
    ? normalized.templateChoices.filter((id) => DAY_TEMPLATES.includes(id))
    : [];
  const hasAllTemplates =
    templateChoices.length === DAY_TEMPLATES.length &&
    DAY_TEMPLATES.every((id) => templateChoices.includes(id));
  const isCanonicalOrder =
    hasAllTemplates &&
    templateChoices.every((id, index) => id === DAY_TEMPLATES[index]);
  if (!hasAllTemplates || !isCanonicalOrder) {
    normalized.templateChoices = DAY_TEMPLATES.slice();
    changed = true;
  }

  if ("dayAssignment" in normalized) {
    delete normalized.dayAssignment;
    changed = true;
  }

  if (!Array.isArray(normalized.completed)) {
    normalized.completed = [];
    changed = true;
  }

  if (
    !normalized.completedByTemplate ||
    typeof normalized.completedByTemplate !== "object" ||
    Array.isArray(normalized.completedByTemplate)
  ) {
    normalized.completedByTemplate = {};
    changed = true;
  }

  if (!Array.isArray(normalized.completedWeekdays)) {
    normalized.completedWeekdays = [];
    changed = true;
  }

  // Migrate older week data by pairing completion order with weekday order.
  if (
    normalized.completed.length > 0 &&
    Object.keys(normalized.completedByTemplate).length === 0 &&
    normalized.completedWeekdays.length > 0
  ) {
    normalized.completed.forEach((templateId, index) => {
      const weekday = normalized.completedWeekdays[index];
      if (
        DAY_TEMPLATES.includes(templateId) &&
        WEEKDAY_NAMES.includes(weekday)
      ) {
        normalized.completedByTemplate[templateId] = weekday;
      }
    });
    changed = true;
  }

  if (
    !normalized.usedExercises ||
    typeof normalized.usedExercises !== "object" ||
    Array.isArray(normalized.usedExercises)
  ) {
    normalized.usedExercises = {};
    changed = true;
  }

  return { week: normalized, changed };
}

// Legacy name, new behavior: return the fixed weekly A/B/C choices.
// Users can complete any remaining template on any day of the week.
function getOrCreateDayAssignment(weekKey) {
  const week = loadWeek(weekKey);
  if (Array.isArray(week.templateChoices)) return week.templateChoices;

  week.templateChoices = DAY_TEMPLATES.slice();
  saveWeek(weekKey, week);
  return week.templateChoices;
}

function getWeekKey() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const offset = dow === 0 ? -6 : 1 - dow; // days back to reach Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() + offset);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10); // e.g. "2026-03-09"
}

function weekStorageKey(weekKey) {
  return `grind:week-${weekKey}`;
}

function getStoredWeekKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith("grind:week-")) {
        keys.push(key.slice("grind:week-".length));
      }
    }
  } catch {
    return [];
  }
  return keys;
}

function loadWeek(weekKey) {
  const key = weekStorageKey(weekKey);
  const stored = storageGet(key, createEmptyWeek());
  const { week, changed } = normalizeWeekData(stored);
  if (changed) storageSet(key, week);
  return week;
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
  const today = getTodayWeekday();
  if (!week.completedByTemplate) week.completedByTemplate = {};
  week.completedByTemplate[templateId] = today;
  if (!week.completedWeekdays) week.completedWeekdays = [];
  if (!week.completedWeekdays.includes(today))
    week.completedWeekdays.push(today);
  saveWeek(weekKey, week);
}

function getCompletedDays(weekKey) {
  return loadWeek(weekKey).completed;
}

function getHistoryEntryWeekday(entry) {
  if (entry?.timestamp) {
    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime())) {
      return WEEKDAY_NAMES[date.getDay()] || "";
    }
  }

  if (typeof entry?.date === "string") {
    const match = entry.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const date = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return WEEKDAY_NAMES[date.getDay()] || "";
      }
    }
  }

  return "";
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
//   spinState,                // "ready" | "spinning" | "landed"
//   entries,                  // completed exercises
//   restEndsAt,               // ms timestamp; null when no timer running
//   startTime,                // ISO string
//   status,
// }

let session = null;
let exitSessionReturnFocus = null;

function loadSession() {
  return storageGet("grind:session-active", null);
}

function saveSession() {
  if (session) storageSet("grind:session-active", session);
}

function clearSession() {
  session = null;
  storageDel("grind:session-active");
}

function closeExitSessionModal() {
  const modal = document.getElementById("exit-session-modal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (
    exitSessionReturnFocus &&
    typeof exitSessionReturnFocus.focus === "function"
  ) {
    exitSessionReturnFocus.focus();
  }
  exitSessionReturnFocus = null;
}

function openExitSessionModal(triggerEl = null) {
  if (!loadSession()) {
    goHome();
    return;
  }

  const modal = document.getElementById("exit-session-modal");
  if (!modal) {
    goHome();
    return;
  }

  exitSessionReturnFocus = triggerEl;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("exit-session-resume-later")?.focus();
}

function startSession(templateId) {
  const day = DAYS[templateId];
  const weekKey = getWeekKey(); // snapshot — prevents Sunday→Monday boundary bug

  session = {
    templateId,
    weekKey,
    slots: day.slots.slice(),
    slotIndex: 0,
    pickedExercises: [], // filled by pickAllExercises() immediately below
    reservations: {},
    currentExercise: null,
    currentSlot: null,
    currentSets: [],
    spinState: "ready",
    entries: [],
    restEndsAt: null,
    startTime: new Date().toISOString(),
    status: "in_progress",
  };
  pickAllExercises(); // picks all exercises at once; saves session
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

const SPIN_STATE_READY = "ready";
const SPIN_STATE_SPINNING = "spinning";
const SPIN_STATE_LANDED = "landed";

const FALLBACK_PULL_MAX_PX = 168;
const PULL_BOTTOM_CLEARANCE_PX = 12;
const PULL_MOMENTUM_BOOST = 110;
const PULL_MOMENTUM_MIN_RATIO = 0.82;

const pullGesture = {
  active: false,
  pointerId: null,
  startY: 0,
  currentPull: 0,
  lastPull: 0,
  lastTime: 0,
  velocity: 0,
  thresholdBuzzed: false,
  landedCount: 0,
  statusTimer: null,
  recoilTimer: null,
};

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function getPullMetrics() {
  const track = document.querySelector(
    "#slot-pull-trigger .pull-trigger-track",
  );
  const handle = document.getElementById("pull-trigger-handle");

  if (!track || !handle) {
    return {
      maxPull: FALLBACK_PULL_MAX_PX,
      triggerPull: FALLBACK_PULL_MAX_PX,
      momentumMinPull: Math.max(
        36,
        FALLBACK_PULL_MAX_PX * PULL_MOMENTUM_MIN_RATIO,
      ),
    };
  }

  const availablePull =
    track.clientHeight -
    handle.offsetTop -
    handle.offsetHeight -
    PULL_BOTTOM_CLEARANCE_PX;

  const maxPull =
    availablePull > 0 ? Math.floor(availablePull) : FALLBACK_PULL_MAX_PX;

  return {
    maxPull,
    triggerPull: maxPull,
    momentumMinPull: Math.max(36, maxPull * PULL_MOMENTUM_MIN_RATIO),
  };
}

function normalizeSpinState(state) {
  if (
    [SPIN_STATE_READY, SPIN_STATE_SPINNING, SPIN_STATE_LANDED].includes(state)
  ) {
    return state;
  }
  return SPIN_STATE_LANDED;
}

function getSessionSpinState() {
  if (!session) return SPIN_STATE_READY;
  return normalizeSpinState(session.spinState);
}

function setSessionSpinState(nextState) {
  if (!session || session.spinState === nextState) return;
  session.spinState = nextState;
  saveSession();
}

function vibrate(pattern) {
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported or rejected haptics
  }
}

function setSlotTriggerStatus(text, tone = "idle", transientMs = 0) {
  const status = document.getElementById("slot-trigger-status");
  if (!status) return;

  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;

  status.textContent = text;
  status.dataset.tone = tone;

  if (transientMs > 0) {
    pullGesture.statusTimer = setTimeout(() => {
      pullGesture.statusTimer = null;
      syncSlotTriggerState();
    }, transientMs);
  }
}

function setPullProgress(pullPx) {
  const stage = document.getElementById("slot-machine-stage");
  const trigger = document.getElementById("slot-pull-trigger");
  const pullMetrics = getPullMetrics();
  const clamped = clamp(pullPx, 0, pullMetrics.maxPull);
  if (!stage || !trigger) return;

  pullGesture.currentPull = clamped;
  stage.style.setProperty(
    "--pull-energy",
    (clamped / pullMetrics.maxPull).toFixed(3),
  );
  trigger.style.setProperty("--pull-offset", `${clamped}px`);
}

function setReelLandProgress(progress) {
  const trigger = document.getElementById("slot-pull-trigger");
  if (!trigger) return;
  trigger.style.setProperty(
    "--land-progress",
    clamp(progress, 0, 1).toFixed(3),
  );
}

function setPullGestureClasses({ dragging = false, charged = false } = {}) {
  const stage = document.getElementById("slot-machine-stage");
  const trigger = document.getElementById("slot-pull-trigger");
  if (!stage || !trigger) return;

  stage.classList.toggle("is-pulling", dragging);
  stage.classList.toggle("is-charged", charged);
  trigger.classList.toggle("is-dragging", dragging);
  trigger.classList.toggle("is-charged", charged);
}

function syncSlotTriggerState({ preservePull = false } = {}) {
  const trigger = document.getElementById("slot-pull-trigger");
  const statusBtn = document.getElementById("slot-trigger-status");
  if (!trigger || !statusBtn) return;

  const spinState = getSessionSpinState();
  const isReady = spinState === SPIN_STATE_READY;
  const canLaunch = spinState === SPIN_STATE_LANDED;

  trigger.dataset.spinState = spinState;
  trigger.setAttribute("aria-disabled", isReady ? "false" : "true");
  trigger.tabIndex = isReady ? 0 : -1;

  statusBtn.disabled = !canLaunch;
  statusBtn.tabIndex = canLaunch ? 0 : -1;
  if (!canLaunch) statusBtn.classList.remove("appearing");

  if (!pullGesture.active) {
    setPullGestureClasses({ dragging: false, charged: false });
    if (!preservePull) setPullProgress(0);
  }

  if (spinState === SPIN_STATE_READY) {
    setReelLandProgress(0);
    setSlotTriggerStatus("Pull the gold handle down and release.", "idle");
    return;
  }

  if (spinState === SPIN_STATE_SPINNING) {
    setSlotTriggerStatus("The fates are turning.", "spinning");
    return;
  }

  setReelLandProgress(1);
  setSlotTriggerStatus(
    "The Omens Are Set,\n Click Here to Start Workout",
    "landed",
  );
}

function getSessionReserved(categoryKey) {
  // Collect all exercise names reserved for this category in this session
  return Object.entries(session.reservations || {})
    .filter(([k]) => k.startsWith(categoryKey + ":"))
    .map(([, v]) => v);
}

function pickExercise(categoryKey, slotPosition) {
  const pool = EXERCISES[categoryKey] ?? [];
  if (pool.length === 0) return null; // guard: unknown category key

  const weekUsed = getUsedExercises(categoryKey, session.weekKey);
  const sessionUsed = getSessionReserved(categoryKey);

  let available = pool.filter(
    (e) => !weekUsed.includes(e.name) && !sessionUsed.includes(e.name),
  );

  if (available.length === 0) {
    // Week pool exhausted — reset week layer, keep session layer
    available = pool.filter((e) => !sessionUsed.includes(e.name));
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

// ── pickAllExercises ───────────────────────────────────────────────
// Picks all exercises for the session at once (called from startSession).
// Respects existing reservations for resume safety — if an exercise was
// already reserved (old session), re-uses it rather than re-picking.
//
//   slots[0..N-1]  ──►  pickedExercises[0..N-1]
//   (via pickExercise which writes reservations per slot position)

function pickAllExercises() {
  session.pickedExercises = session.slots.map((slot, i) => {
    const existingName = session.reservations[`${slot.key}:${i}`];
    if (existingName) {
      const pool = EXERCISES[slot.key] ?? [];
      const found = pool.find((e) => e.name === existingName);
      // Guard: name might no longer exist in pool after data changes
      return found ?? pickExercise(slot.key, i);
    }
    return pickExercise(slot.key, i);
  });
  saveSession();
}

function triggerSlotSpin() {
  if (!session || getSessionSpinState() !== SPIN_STATE_READY) return;

  const trigger = document.getElementById("slot-pull-trigger");
  const pullMetrics = getPullMetrics();

  document.getElementById("slot-trigger-status")?.classList.remove("appearing");

  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  pullGesture.landedCount = 0;
  setPullProgress(pullMetrics.maxPull);
  setReelLandProgress(0);

  setSessionSpinState(SPIN_STATE_SPINNING);
  syncSlotTriggerState({ preservePull: true });

  trigger?.classList.add("is-firing");
  vibrate([18, 34, 26]);

  pullGesture.recoilTimer = setTimeout(() => {
    trigger?.classList.remove("is-firing");
    setPullProgress(0);
  }, 180);

  spinAllReels();
}

function handlePullTriggerStart(e) {
  if (getSessionSpinState() !== SPIN_STATE_READY) return;
  if (typeof e.button === "number" && e.button !== 0) return;

  const trigger = document.getElementById("slot-pull-trigger");
  if (!trigger) return;

  pullGesture.active = true;
  pullGesture.pointerId = e.pointerId ?? null;
  pullGesture.startY = e.clientY;
  pullGesture.currentPull = 0;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = e.timeStamp || performance.now();
  pullGesture.velocity = 0;
  pullGesture.thresholdBuzzed = false;

  trigger.setPointerCapture?.(e.pointerId);
  setPullGestureClasses({ dragging: true, charged: false });
  setPullProgress(0);
  setSlotTriggerStatus("Draw it down.", "idle");

  e.preventDefault();
}

function handlePullTriggerMove(e) {
  if (!pullGesture.active) return;
  if (pullGesture.pointerId !== null && e.pointerId !== pullGesture.pointerId)
    return;

  const pullMetrics = getPullMetrics();
  const nextPull = clamp(
    e.clientY - pullGesture.startY,
    0,
    pullMetrics.maxPull,
  );
  const nextTime = e.timeStamp || performance.now();
  const dt = Math.max(1, nextTime - pullGesture.lastTime);
  const instantVelocity = (nextPull - pullGesture.lastPull) / dt;

  pullGesture.velocity = pullGesture.velocity * 0.45 + instantVelocity * 0.55;
  pullGesture.lastPull = nextPull;
  pullGesture.lastTime = nextTime;

  const charged = nextPull >= pullMetrics.triggerPull;
  if (charged && !pullGesture.thresholdBuzzed) {
    pullGesture.thresholdBuzzed = true;
    vibrate(12);
    setSlotTriggerStatus("Release to invoke the spin.", "charged");
  } else if (
    !charged &&
    pullGesture.thresholdBuzzed &&
    nextPull < pullMetrics.triggerPull - 12
  ) {
    pullGesture.thresholdBuzzed = false;
    setSlotTriggerStatus("Keep pulling.", "idle");
  }

  setPullGestureClasses({ dragging: true, charged });
  setPullProgress(nextPull);

  e.preventDefault();
}

function finishPullTrigger(e, { cancel = false } = {}) {
  if (!pullGesture.active) return;
  if (
    pullGesture.pointerId !== null &&
    e?.pointerId !== undefined &&
    e.pointerId !== pullGesture.pointerId
  )
    return;

  const trigger = document.getElementById("slot-pull-trigger");
  const pullMetrics = getPullMetrics();
  if (trigger && e?.pointerId !== undefined)
    trigger.releasePointerCapture?.(e.pointerId);

  const effectivePull =
    pullGesture.currentPull +
    Math.max(0, pullGesture.velocity) * PULL_MOMENTUM_BOOST;
  const shouldSpin =
    !cancel &&
    getSessionSpinState() === SPIN_STATE_READY &&
    pullGesture.currentPull >= pullMetrics.momentumMinPull &&
    effectivePull >= pullMetrics.triggerPull;

  const releasedPull = pullGesture.currentPull;

  pullGesture.active = false;
  pullGesture.pointerId = null;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = 0;
  pullGesture.velocity = 0;
  pullGesture.thresholdBuzzed = false;
  setPullGestureClasses({ dragging: false, charged: false });

  if (shouldSpin) {
    setPullProgress(pullMetrics.maxPull);
    triggerSlotSpin();
  } else {
    setPullProgress(0);
    if (!cancel && releasedPull >= 28) {
      setSlotTriggerStatus("Not enough force. Pull deeper.", "idle", 900);
    } else {
      syncSlotTriggerState();
    }
  }

  if (e) e.preventDefault();
}

function handlePullTriggerKeydown(e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (getSessionSpinState() !== SPIN_STATE_READY) return;

  const pullMetrics = getPullMetrics();
  e.preventDefault();
  setPullProgress(pullMetrics.maxPull);
  triggerSlotSpin();
}

// ── spinAllReels ───────────────────────────────────────────────────
// Animates all vertical reel drums simultaneously with staggered landing.
//
// Animation algorithm:
//   - Drum = pool repeated REPEATS times (enough travel distance)
//   - targetItemIdx = REP_TARGET × poolSize + indexOfChosenInPool
//   - translateY = -(targetItemIdx × reelHeight)
//   - Each reel i lands at BASE_MS + i × STAGGER_MS via its transition-duration
//   - transitionend fires onReelLanded(i); setTimeout fallback if it never fires
//   - spinGeneration guard prevents stale listeners from double-firing

const DEFAULT_REEL_H = 64; // fallback when reel elements are not mounted yet
const REPEATS = 10; // copies of the pool in each drum
const REP_TARGET = 7; // which repetition to land on (0-based)
const BASE_MS = 2000; // reel 0 lands at 2000ms
const STAGGER_MS = 350; // each subsequent reel 350ms later

let spinGeneration = 0; // incremented each spinAllReels() call to invalidate stale listeners

function getReelHeight() {
  // Custom properties return the raw `clamp(...)` string, so measure the reel.
  const reelWindow = document.querySelector(".reel-window");
  const reelItem = document.querySelector(".reel-item");
  const measuredHeight =
    reelWindow?.getBoundingClientRect().height ||
    reelItem?.getBoundingClientRect().height ||
    0;

  return measuredHeight > 0 ? measuredHeight : DEFAULT_REEL_H;
}

function spinAllReels() {
  if (!session?.slots?.length) return;

  spinGeneration++;
  const gen = spinGeneration; // captured in closure

  const N = session.slots.length;
  const reelHeight = getReelHeight();
  const maxTime = BASE_MS + (N - 1) * STAGGER_MS;

  // Fallback: if ANY transitionend never fires, force-show the button
  const fallbackTimer = setTimeout(() => {
    if (gen !== spinGeneration) return;
    showStartWorkoutButton();
  }, maxTime + 600);

  pullGesture.landedCount = 0;
  setReelLandProgress(0);
  let landsCompleted = 0;

  session.slots.forEach((slot, i) => {
    const pool = EXERCISES[slot.key] ?? [];
    const picked = session.pickedExercises[i];
    if (!picked || pool.length === 0) return;

    const pickedIdx = pool.findIndex((e) => e.name === picked.name);
    const safeIdx = pickedIdx < 0 ? 0 : pickedIdx; // guard: name not in pool
    const targetIdx = REP_TARGET * pool.length + safeIdx;
    const translateY = -(targetIdx * reelHeight);
    const duration = BASE_MS + i * STAGGER_MS;

    const drum = document.getElementById(`reel-drum-${i}`);
    const wrap = document.getElementById(`reel-wrap-${i}`);
    if (!drum || !wrap) return;

    // Mark as spinning (enables blur CSS)
    wrap.classList.remove("landed");
    wrap.classList.add("spinning");

    // Reset to top with no transition (double-rAF ensures browser paints it)
    drum.style.transition = "none";
    drum.style.transform = "translateY(0)";

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        drum.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.7, 0.25, 1)`;
        drum.style.transform = `translateY(${translateY}px)`;

        drum.addEventListener(
          "transitionend",
          () => {
            if (gen !== spinGeneration) return; // stale listener — different spin in progress
            onReelLanded(i);
            landsCompleted++;
            if (landsCompleted >= N) {
              clearTimeout(fallbackTimer);
              showStartWorkoutButton();
            }
          },
          { once: true },
        );
      }),
    );
  });
}

function onReelLanded(i) {
  const wrap = document.getElementById(`reel-wrap-${i}`);
  if (!wrap) return;
  wrap.classList.remove("spinning");
  wrap.classList.add("landed");
  // Brief flash: brighter glow on landing, then settles to .landed CSS
  const win = wrap.querySelector(".reel-window");
  if (win) {
    // Thunder strike flash — peaks at electric white, settles to steady electric glow
    win.style.boxShadow =
      "0 0 40px rgba(0,220,255,0.95), 0 0 80px rgba(0,200,255,0.5)";
    setTimeout(() => {
      win.style.boxShadow = "";
    }, 380); // CSS .landed takes over
  }

  const totalReels = session?.slots?.length || 1;
  pullGesture.landedCount = clamp(pullGesture.landedCount + 1, 0, totalReels);
  setReelLandProgress(pullGesture.landedCount / totalReels);

  if (pullGesture.landedCount < totalReels) {
    setSlotTriggerStatus(`Reel ${i + 1} locked.`, "charged", 550);
    vibrate(12);
  } else {
    setSlotTriggerStatus(
      "The Omens Are Set,\n Click Here to Start Workout",
      "landed",
    );
    vibrate([16, 26, 34]);
  }
}

function showStartWorkoutButton() {
  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  setPullProgress(0);
  pullGesture.landedCount = session?.slots?.length ?? pullGesture.landedCount;
  setSessionSpinState(SPIN_STATE_LANDED);
  syncSlotTriggerState();

  const btn = document.getElementById("slot-trigger-status");
  if (!btn) return;
  btn.classList.remove("appearing");
  void btn.offsetWidth;
  btn.classList.add("appearing");
}

function launchExercise() {
  // Migration guard: old sessions pre-refactor won't have pickedExercises
  if (!session.pickedExercises?.length) pickAllExercises();

  const exercise = session.pickedExercises[session.slotIndex];
  const slot = session.slots[session.slotIndex];
  if (!exercise || !slot) {
    finishSession();
    return;
  }

  const lastWeight = getLastWeight(exercise.name);

  session.currentExercise = exercise;
  session.currentSlot = slot;
  session.currentSets = Array.from({ length: exercise.sets }, (_, i) => ({
    setNum: i + 1,
    weight: lastWeight ?? "", // pre-fill from PR history (null until Phase 4)
    reps: "",
    done: false,
  }));
  saveSession();

  // Overload nudge chip
  const nudge = getOverloadNudge(exercise.name);
  const nudgeEl = document.getElementById("overload-nudge");
  if (nudgeEl) {
    if (nudge) {
      nudgeEl.textContent = `⚡ Last 3× at ${nudge.currentWeight}kg — try ${nudge.suggestedWeight}kg?`;
      nudgeEl.style.display = "inline-flex";
    } else {
      nudgeEl.style.display = "none";
    }
  }

  // Render exercise screen
  document.getElementById("ex-tag").textContent = slot.label;
  document.getElementById("ex-name").textContent = exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, "0");
  document.getElementById("ex-meta").textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById("ex-tip").textContent = exercise.tip;

  stopRest();
  document.getElementById("pr-overlay").classList.remove("show"); // clear any lingering overlay

  renderExerciseProgress();
  renderSets();
  syncExercisePrimaryAction();
  showScreen("screen-exercise");
}

function renderExerciseProgress() {
  const strip = document.getElementById("exercise-progress-strip");
  if (!strip) return;
  strip.innerHTML = session.slots
    .map((_, i) => {
      let cls = "progress-dot";
      if (i < session.slotIndex) cls += " done-dot";
      else if (i === session.slotIndex) cls += " active-dot";
      return `<div class="${cls}"></div>`;
    })
    .join("");
}

function renderSets() {
  const container = document.getElementById("sets-container");
  const activeIdx = getActiveSetIndex();
  const isResting = Boolean(getRemainingRestSeconds());
  const completedMarkup = session.currentSets
    .map((set, i) => ({ ...set, idx: i }))
    .filter((set) => set.done)
    .map((set) => {
      const weightLabel =
        set.weight && set.weight !== "—" ? `${set.weight}kg` : "BW";
      const repsLabel = set.reps || "—";
      return `<div class="set-history-chip">SET ${set.idx + 1} · ${weightLabel} × ${repsLabel}</div>`;
    })
    .join("");

  const completedBlock = completedMarkup
    ? `<div class="set-history fadein">
        <div class="set-history-label">Previous Sets</div>
        <div class="set-history-chips">${completedMarkup}</div>
      </div>`
    : "";

  if (activeIdx === -1) {
    container.innerHTML = `${completedBlock}
      <div class="set-row fadein done-set all-done-set">
        <div class="set-row-top">
          <div class="set-num">ALL SETS LOGGED</div>
          <div class="set-status">READY</div>
        </div>
        <div class="set-summary-copy">Proceed when you are ready for the next exercise.</div>
      </div>`;
    return;
  }

  const activeSet = session.currentSets[activeIdx];
  const remainingAfterActive = session.currentSets.length - activeIdx - 1;
  const upcomingLabel =
    remainingAfterActive > 0
      ? `${remainingAfterActive} set${remainingAfterActive === 1 ? "" : "s"} remaining after this one`
      : "This is the final set for this exercise";

  container.innerHTML = `${completedBlock}
    <div class="set-row fadein active-set focused-set" id="set-row-${activeIdx}">
      <div class="set-row-top">
        <div class="set-num">SET ${activeIdx + 1}</div>
        <div class="set-status">${isResting ? "RESTING" : "ACTIVE"}</div>
      </div>
      <div class="set-fields">
        <div class="input-group">
          <div class="input-label">Weight</div>
          <input class="set-input"
            type="number" inputmode="decimal" step="0.5"
            placeholder="${activeSet.weight || "—"}"
            value="${activeSet.weight || ""}"
            ${isResting ? "disabled" : ""}
            id="weight-${activeIdx}" data-idx="${activeIdx}" data-field="weight">
        </div>
        <div class="input-group">
          <div class="input-label">Reps</div>
          <input class="set-input"
            type="number" inputmode="numeric"
            placeholder="—"
            value="${activeSet.reps || ""}"
            ${isResting ? "disabled" : ""}
            id="reps-${activeIdx}" data-idx="${activeIdx}" data-field="reps">
        </div>
      </div>
    </div>`;
}

function getActiveSetIndex() {
  return session.currentSets.findIndex((set) => !set.done);
}

function isSetReady(idx) {
  if (idx < 0) return false;
  const set = session.currentSets[idx];
  return Boolean(set?.reps?.trim());
}

function getRemainingRestSeconds() {
  if (!session?.restEndsAt) return 0;
  return Math.max(0, Math.ceil((session.restEndsAt - Date.now()) / 1000));
}

function updateCurrentSetField(idx, field, value) {
  if (!session?.currentSets?.[idx] || session.currentSets[idx].done) return;
  session.currentSets[idx][field] = value;
  saveSession();
  syncExercisePrimaryAction();
}

function confirmCurrentSet(idx) {
  if (idx < 0) return;
  const set = session.currentSets[idx];
  if (!set) return;

  set.weight = set.weight.trim() || "—";
  set.reps = set.reps.trim() || "—";
  set.done = true;
  saveSession();

  renderSets();

  if (session.currentSets.every((s) => s.done)) {
    syncExercisePrimaryAction();
    return;
  }

  startRest(session.currentExercise.restSeconds);
}

function handleExercisePrimaryAction() {
  const remaining = getRemainingRestSeconds();
  if (remaining > 0) {
    skipRest();
    return;
  }

  const activeIdx = getActiveSetIndex();
  if (activeIdx >= 0) {
    if (!isSetReady(activeIdx)) return;
    confirmCurrentSet(activeIdx);
    return;
  }

  completeExercise();
}

function syncExercisePrimaryAction() {
  const btn = document.getElementById("complete-ex-btn");
  if (!btn || !session?.currentSets) return;

  const remaining = getRemainingRestSeconds();
  const activeIdx = getActiveSetIndex();
  const allDone = activeIdx === -1;
  const isLastExercise = session.slotIndex === session.slots.length - 1;

  btn.className = "complete-ex-btn";

  if (remaining > 0) {
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    btn.textContent = `SKIP REST · ${m}:${s}`;
    btn.disabled = false;
    btn.dataset.mode = "rest";
    btn.classList.add("resting");
    return;
  }

  if (!allDone) {
    btn.textContent = isSetReady(activeIdx)
      ? "PROCEED ▸"
      : "ENTER REPS TO PROCEED";
    btn.disabled = !isSetReady(activeIdx);
    btn.dataset.mode = "proceed";
    btn.classList.toggle("ready", isSetReady(activeIdx));
    return;
  }

  btn.textContent = isLastExercise ? "FINISH WORKOUT ▸" : "NEXT EXERCISE ▸";
  btn.disabled = false;
  btn.dataset.mode = "next";
  btn.classList.add("advance");
}

function completeExercise() {
  // Required: clear rest timer state before anything else
  stopRest();
  session.restEndsAt = null;

  const ex = session.currentExercise;
  const slot = session.currentSlot;

  // PR detection + lastWeight write (checkAndUpdatePR handles both)
  const prs = checkAndUpdatePR(ex.name, session.currentSets);

  // Mark exercise used in the week store
  markExerciseUsed(slot.key, ex.name, session.weekKey);

  // Record the completed exercise
  session.entries.push({
    exerciseName: ex.name,
    categoryLabel: slot.label,
    sets: session.currentSets.map((s) => ({ weight: s.weight, reps: s.reps })),
    timestamp: new Date().toISOString(),
    prs,
  });

  // Advance slot index and clear current exercise state
  session.slotIndex++;
  session.currentExercise = null;
  session.currentSlot = null;
  session.currentSets = [];
  saveSession();

  const hasPR = Object.keys(prs).length > 0;

  if (session.slotIndex >= session.slots.length) {
    hasPR ? showPROverlay(prs, finishSession) : finishSession();
    return;
  }

  hasPR ? showPROverlay(prs, launchExercise) : launchExercise();
}

function finishSession() {
  const duration = Math.round(
    (Date.now() - new Date(session.startTime)) / 60000,
  );
  const totalSets = session.entries.reduce((n, e) => n + e.sets.length, 0);
  const exerciseCount = session.entries.length; // capture before clearSession
  const templateId = session.templateId;
  const weekKey = session.weekKey;
  const payload = buildSyncPayload(duration, totalSets);

  markDayComplete(templateId, weekKey);
  appendHistory({
    date: new Date().toLocaleDateString("en-GB"),
    templateId,
    durationMinutes: duration,
    totalSets,
    entries: session.entries,
    timestamp: new Date().toISOString(),
  });

  // Collect PRs and nudges across this session
  const sessionPRs = session.entries.flatMap((e) =>
    Object.entries(e.prs || {}).map(([type, data]) => ({
      exerciseName: e.exerciseName,
      type,
      ...data,
    })),
  );
  const sessionNudges = session.entries
    .map((e) => ({
      exerciseName: e.exerciseName,
      nudge: getOverloadNudge(e.exerciseName),
    }))
    .filter((n) => n.nudge !== null);

  clearSession();

  renderDoneScreen({
    templateId,
    exerciseCount,
    totalSets,
    duration,
    sessionPRs,
    sessionNudges,
  });
  showScreen("screen-done");
  setTimeout(fireConfetti, 80); // slight delay so screen transition completes first
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
  const endTime = Date.now() + seconds * 1000;
  session.restEndsAt = endTime;
  saveSession();
  renderSets();
  syncExercisePrimaryAction();

  const tick = () => {
    const remaining = Math.ceil((endTime - Date.now()) / 1000);
    if (remaining <= 0) {
      onRestComplete();
      return;
    }
    updateTimerDisplay(remaining);
    restTimerId = setTimeout(tick, 200);
  };
  tick();
}

function stopRest() {
  if (restTimerId) {
    clearTimeout(restTimerId);
    restTimerId = null;
  }
}

function skipRest() {
  stopRest();
  session.restEndsAt = null;
  saveSession();
  renderSets();
  syncExercisePrimaryAction();
}

function onRestComplete() {
  stopRest();
  session.restEndsAt = null;
  saveSession();
  renderSets();
  syncExercisePrimaryAction();

  // Auto-focus next active set weight input
  const nextIdx = session.currentSets.findIndex((s) => !s.done);
  if (nextIdx >= 0) {
    const el = document.getElementById(`weight-${nextIdx}`);
    if (el) el.focus();
  }
}

function updateTimerDisplay(remaining) {
  const btn = document.getElementById("complete-ex-btn");
  if (!btn || btn.dataset.mode !== "rest") return;
  const m = Math.floor(remaining / 60);
  const s = String(remaining % 60).padStart(2, "0");
  btn.textContent = `SKIP REST · ${m}:${s}`;
}

function resumeRestIfNeeded() {
  if (!session?.restEndsAt) return;
  const remaining = Math.ceil((session.restEndsAt - Date.now()) / 1000);
  if (remaining > 0) {
    renderSets();
    syncExercisePrimaryAction();
    updateTimerDisplay(remaining);
    const endTime = session.restEndsAt;
    const tick = () => {
      const r = Math.ceil((endTime - Date.now()) / 1000);
      if (r <= 0) {
        onRestComplete();
        return;
      }
      updateTimerDisplay(r);
      restTimerId = setTimeout(tick, 200);
    };
    tick();
  } else {
    onRestComplete();
  }
}

// ── PR TRACKING ────────────────────────────────────────────────────────────
//
// grind:pr schema (one key per exercise name):
// {
//   maxWeight:    number   — heaviest single set across all time
//   maxVolume:    number   — best session volume (sum weight×reps) across all time
//   lastWeight:   string   — heaviest set from last session (drives pre-fill)
//   lastNudgeDate: string  — ISO timestamp of last overload nudge shown
//   sessions: [{ date, weekKey, maxSetWeight, sessionVolume }]  — last 52 entries
// }

function parseWeight(w) {
  if (!w || w === "—" || (typeof w === "string" && w.toLowerCase() === "bw"))
    return null;
  const n = parseFloat(w);
  return isNaN(n) ? null : n;
}

// Format a kg value: omit trailing .0 for whole numbers (42 not 42.0, 42.5 stays 42.5)
function fmtKg(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function todayFormatted() {
  return new Date().toLocaleDateString("en-GB"); // "dd/MM/yyyy"
}

function loadPR(exerciseName) {
  return storageGet("grind:pr", {})[exerciseName] ?? {};
}

function savePR(exerciseName, data) {
  const all = storageGet("grind:pr", {});
  all[exerciseName] = data;
  storageSet("grind:pr", all);
}

// saveLastWeight is kept for reference; checkAndUpdatePR supersedes it for
// non-BW exercises. BW exercises never write lastWeight (no weight to pre-fill).
function saveLastWeight(exerciseName, sets) {
  const numericWeights = sets
    .map((s) => parseWeight(s.weight))
    .filter((w) => w !== null);
  if (numericWeights.length === 0) return;
  const max = Math.max(...numericWeights);
  const all = storageGet("grind:pr", {});
  if (!all[exerciseName]) all[exerciseName] = {};
  all[exerciseName].lastWeight = String(max);
  storageSet("grind:pr", all);
}

// Checks for new weight/volume PRs and updates grind:pr.
// Returns { weight?: { prev, new }, volume?: { prev, new } } or {}.
// BW exercises (all null weights) return {} and are not tracked.
function checkAndUpdatePR(exerciseName, sets) {
  const numericWeights = sets
    .map((s) => parseWeight(s.weight))
    .filter((w) => w !== null);
  if (numericWeights.length === 0) return {}; // BW exercise

  const maxSetWeight = Math.max(...numericWeights);
  const sessionVolume = sets.reduce((sum, s) => {
    return sum + (parseWeight(s.weight) ?? 0) * (parseInt(s.reps) || 0);
  }, 0);

  const history = loadPR(exerciseName);
  const prs = {};

  if (maxSetWeight > (history.maxWeight || 0)) {
    prs.weight = { prev: history.maxWeight || 0, new: maxSetWeight };
    history.maxWeight = maxSetWeight;
  }
  if (sessionVolume > (history.maxVolume || 0)) {
    prs.volume = { prev: history.maxVolume || 0, new: sessionVolume };
    history.maxVolume = sessionVolume;
  }

  // Always update lastWeight and session log
  history.lastWeight = String(maxSetWeight);
  history.sessions = [
    ...(history.sessions || []),
    {
      date: todayFormatted(),
      weekKey: getWeekKey(),
      maxSetWeight,
      sessionVolume,
    },
  ].slice(-52); // keep ~1 year

  savePR(exerciseName, history);
  return prs;
}

// Returns a nudge if the user has done the same weight 3 times in a row
// and hasn't been nudged for this exercise in the last 21 days.
function getOverloadNudge(exerciseName) {
  const h = loadPR(exerciseName);
  const recent = (h.sessions || []).slice(-3);
  if (recent.length < 3) return null;

  if (h.lastNudgeDate) {
    const daysSince = (Date.now() - new Date(h.lastNudgeDate)) / 86400000;
    if (daysSince < 21) return null;
  }

  const weights = recent.map((s) => s.maxSetWeight).filter(Boolean);
  if (weights.length < 3) return null; // recent BW sessions mixed in
  if (!weights.every((w) => w === weights[0])) return null;

  return { currentWeight: weights[0], suggestedWeight: weights[0] + 2.5 };
}

// Called when a nudge is displayed — resets the 21-day gate.
function markNudgeShown(exerciseName) {
  const h = loadPR(exerciseName);
  h.lastNudgeDate = new Date().toISOString();
  savePR(exerciseName, h);
}

function getLastWeight(exerciseName) {
  return loadPR(exerciseName).lastWeight ?? null;
}

// ── HISTORY ────────────────────────────────────────────────────────────────

function loadHistory() {
  return storageGet("grind:history", []);
}

function saveHistory(entries) {
  storageSet("grind:history", entries);
}

function appendHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  saveHistory(history);
}

let historyOffset = 30; // display cap — shows last 30, "Show more" adds 30

function rebuildPRStateFromHistory(historyEntries = loadHistory()) {
  const previousPR = storageGet("grind:pr", {});
  const nextPR = {};

  historyEntries.forEach((sessionEntry) => {
    (sessionEntry.entries || []).forEach((exerciseEntry) => {
      const numericWeights = exerciseEntry.sets
        .map((set) => parseWeight(set.weight))
        .filter((weight) => weight !== null);

      if (numericWeights.length === 0) return;

      const maxSetWeight = Math.max(...numericWeights);
      const sessionVolume = exerciseEntry.sets.reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      );
      const exerciseName = exerciseEntry.exerciseName;

      if (!nextPR[exerciseName]) {
        nextPR[exerciseName] = {
          maxWeight: 0,
          maxVolume: 0,
          sessions: [],
        };
      }

      nextPR[exerciseName].maxWeight = Math.max(
        nextPR[exerciseName].maxWeight,
        maxSetWeight,
      );
      nextPR[exerciseName].maxVolume = Math.max(
        nextPR[exerciseName].maxVolume,
        sessionVolume,
      );
      nextPR[exerciseName].lastWeight = String(maxSetWeight);
      nextPR[exerciseName].sessions.push({
        date: sessionEntry.date,
        weekKey: sessionEntry.weekKey ?? null,
        maxSetWeight,
        sessionVolume,
      });
    });
  });

  Object.entries(nextPR).forEach(([exerciseName, data]) => {
    data.sessions = data.sessions.slice(-52);
    if (previousPR[exerciseName]?.lastNudgeDate) {
      data.lastNudgeDate = previousPR[exerciseName].lastNudgeDate;
    }
  });

  storageSet("grind:pr", nextPR);
}

function rebuildWeekCompletionFromHistory(historyEntries = loadHistory()) {
  const completionByWeek = {};

  historyEntries.forEach((entry) => {
    if (!entry?.weekKey || !DAY_TEMPLATES.includes(entry.templateId)) return;
    if (!completionByWeek[entry.weekKey]) completionByWeek[entry.weekKey] = {};
    completionByWeek[entry.weekKey][entry.templateId] =
      getHistoryEntryWeekday(entry);
  });

  const allWeekKeys = new Set([
    ...getStoredWeekKeys(),
    ...Object.keys(completionByWeek),
  ]);

  allWeekKeys.forEach((weekKey) => {
    const week = loadWeek(weekKey);
    const completedByTemplate = completionByWeek[weekKey] || {};
    const completed = DAY_TEMPLATES.filter(
      (templateId) => templateId in completedByTemplate,
    );

    week.completed = completed;
    week.completedByTemplate = completed.reduce((acc, templateId) => {
      const weekday = completedByTemplate[templateId];
      if (weekday) acc[templateId] = weekday;
      return acc;
    }, {});
    week.completedWeekdays = Array.from(
      new Set(
        completed
          .map((templateId) => completedByTemplate[templateId])
          .filter(Boolean),
      ),
    );

    saveWeek(weekKey, week);
  });
}

function deleteHistoryEntry(historyIndex) {
  const history = loadHistory();
  if (historyIndex < 0 || historyIndex >= history.length) return;

  history.splice(historyIndex, 1);
  saveHistory(history);
  rebuildPRStateFromHistory(history);
  rebuildWeekCompletionFromHistory(history);
  historyOffset = Math.min(historyOffset, Math.max(30, history.length));
  renderHistory();
  renderDayPicker();
  showSyncBar("History entry deleted", "success");
}

function renderHistory({ resetOffset = false } = {}) {
  if (resetOffset) historyOffset = 30;
  const all = loadHistory();
  const list = document.getElementById("history-list");
  const moreBtn = document.getElementById("history-more-btn");

  if (all.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">⚡</div>
        <div class="history-empty-title">No Victories Yet</div>
        <div class="history-empty-copy">Complete your first workout and your chronicle will be carved here.</div>
      </div>`;
    moreBtn.style.display = "none";
    return;
  }

  historyOffset = Math.min(historyOffset, Math.max(30, all.length));
  const visible = all
    .map((session, index) => ({ session, index }))
    .slice(-historyOffset)
    .reverse(); // most recent first
  list.innerHTML = visible
    .map(({ session, index }) => renderHistoryCard(session, index))
    .join("");
  moreBtn.style.display = all.length > historyOffset ? "block" : "none";
}

function renderHistoryCard(s, historyIndex) {
  const day = DAYS[s.templateId];
  const dayName = day?.name ?? `Day ${s.templateId}`;
  const entries = s.entries ?? [];

  // Session total volume (sum across all exercises, BW = 0)
  const sessionVolume = entries.reduce(
    (total, e) =>
      total +
      e.sets.reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      ),
    0,
  );

  const prEntries = entries.filter((e) => Object.keys(e.prs || {}).length > 0);
  const prLine =
    prEntries.length > 0
      ? `<div class="history-card-prs">✦ PRs: ${prEntries.map((e) => e.exerciseName).join(", ")}</div>`
      : "";

  const volStat =
    sessionVolume > 0 ? ` · ${sessionVolume.toLocaleString()}kg vol` : "";

  const detail = entries
    .map((e) => {
      const exVolume = e.sets.reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      );
      const hasPR = Object.keys(e.prs || {}).length > 0;

      const chips = e.sets
        .map((set, si) => {
          const wStr =
            parseWeight(set.weight) !== null ? `${set.weight}kg` : "BW";
          return `<span class="history-set-chip">${si + 1}: ${wStr} × ${set.reps}</span>`;
        })
        .join("");

      const volLine =
        exVolume > 0
          ? `<div class="history-entry-vol">${exVolume.toLocaleString()}kg vol${hasPR ? '<span class="history-pr-tag">✦ PR</span>' : ""}</div>`
          : hasPR
            ? `<div class="history-entry-vol"><span class="history-pr-tag">✦ PR</span></div>`
            : "";

      return `
      <div class="history-entry">
        <div class="history-entry-header">
          <span class="history-entry-name">${e.exerciseName}</span>
          <span class="history-entry-cat">${e.categoryLabel}</span>
        </div>
        <div class="history-entry-sets">${chips}</div>
        ${volLine}
      </div>`;
    })
    .join("");

  return `
    <div class="history-card fadein" data-history-idx="${historyIndex}">
      <div class="history-card-meta">${s.date} · ${s.durationMinutes} min</div>
      <div class="history-card-day">${dayName}</div>
      <div class="history-card-stats">${entries.length} exercises · ${s.totalSets} sets${volStat}</div>
      ${prLine}
      <div class="history-expand-hint">details</div>
      <div class="history-card-detail">
        ${detail}
        <button class="history-delete-btn" type="button" data-history-delete="${historyIndex}">DELETE</button>
      </div>
    </div>`;
}

// ── SYNC ───────────────────────────────────────────────────────────────────

function buildSyncPayload(duration, totalSets) {
  return {
    date: new Date().toLocaleDateString("en-GB"),
    day: session.templateId,
    duration_minutes: duration,
    total_sets: totalSets,
    exercises: session.entries.map((e) => ({
      exercise: e.exerciseName,
      category: e.categoryLabel,
      sets: e.sets
        .map((s, i) => `Set ${i + 1}: ${s.weight}kg × ${s.reps}`)
        .join(" | "),
      session_volume_kg: e.sets.reduce(
        (sum, s) =>
          sum + (parseWeight(s.weight) ?? 0) * (parseInt(s.reps) || 0),
        0,
      ),
      pr_weight: !!e.prs?.weight,
      pr_volume: !!e.prs?.volume,
      timestamp: e.timestamp,
    })),
  };
}

async function syncToSheets(payload) {
  const syncEl = document.getElementById("done-sync");

  if (
    CONFIG.dryRun ||
    !CONFIG.webhookUrl ||
    CONFIG.webhookUrl.includes("YOUR_N8N")
  ) {
    if (syncEl) {
      syncEl.textContent = "DRY RUN — set webhookUrl in CONFIG";
      syncEl.className = "done-sync success";
    }
    return;
  }

  if (syncEl) {
    syncEl.textContent = "SYNCING...";
    syncEl.className = "done-sync syncing";
  }
  try {
    const res = await fetch(CONFIG.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (syncEl) {
      syncEl.textContent = "SYNCED ✓";
      syncEl.className = "done-sync success";
    }
  } catch (e) {
    console.warn("[GRIND] sync failed:", e.message);
    if (syncEl) {
      syncEl.textContent = "SYNC FAILED — tap to retry";
      syncEl.className = "done-sync error";
      syncEl.onclick = () => syncToSheets(payload);
    }
    enqueueSyncPayload(payload);
  }
}

function enqueueSyncPayload(payload) {
  const queue = storageGet("grind:sync-queue", []);
  queue.push({ payload, failedAt: new Date().toISOString() });
  storageSet("grind:sync-queue", queue);
}

// Casino confetti: gold + neon strips and circles, falls ~3 seconds.
function fireConfetti() {
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = [
    "#F5C842",
    "#00C8FF",
    "#ffffff",
    "#C8960C",
    "#00EEFF",
    "#B8D8F0",
  ];
  const COUNT = 90;
  const GRAVITY = 0.12;
  const DURATION = 3200; // ms total

  const particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 120,
    vx: (Math.random() - 0.5) * 4,
    vy: 1.5 + Math.random() * 4,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.18,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w: 5 + Math.random() * 8,
    h: 3 + Math.random() * 4,
    circle: Math.random() < 0.25,
  }));

  let start = null;

  function frame(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    for (const p of particles) {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;

      // Fade out in second half of duration
      const fade =
        elapsed < DURATION * 0.55
          ? 1
          : Math.max(0, 1 - (elapsed - DURATION * 0.55) / (DURATION * 0.45));
      if (p.y < canvas.height + 30) alive = true;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.circle) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }

    if (alive && elapsed < DURATION + 800) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  requestAnimationFrame(frame);
}

function showSyncBar(msg, type = "") {
  const bar = document.getElementById("sync-bar");
  if (!bar) return;
  bar.textContent = msg;
  bar.className = `sync-bar show ${type}`;
  clearTimeout(showSyncBar._timer);
  showSyncBar._timer = setTimeout(() => bar.classList.remove("show"), 3000);
}

// ── PR OVERLAY ─────────────────────────────────────────────────────────────
// Shows a 1.6s fullscreen overlay celebrating a new PR, then calls onDone().
// The DONE button is already disabled from the set-confirm flow; the overlay's
// pointer-events:none in CSS means nothing can be tapped through it.

function showPROverlay(prs, onDone) {
  const parts = [];
  if (prs.weight)
    parts.push(`+${fmtKg(prs.weight.new - prs.weight.prev)}KG MAX`);
  if (prs.volume) parts.push("VOLUME PR");
  if (parts.length === 0) {
    onDone();
    return;
  }

  const overlay = document.getElementById("pr-overlay");
  const text = document.getElementById("pr-overlay-text");
  const btn = document.getElementById("pr-overlay-continue");
  if (!overlay || !text || !btn) {
    onDone();
    return;
  }

  text.textContent = parts.join(" · ");
  overlay.classList.add("show");

  // Replace any previous listener with a fresh one-shot handler
  const handler = () => {
    overlay.classList.remove("show");
    onDone();
  };
  btn.replaceWith(btn.cloneNode(true)); // strip old listeners
  document
    .getElementById("pr-overlay-continue")
    .addEventListener("click", handler, { once: true });
}

// ── APP / ROUTER ────────────────────────────────────────────────────────────

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  window.scrollTo(0, 0);
}

function goHome() {
  finishPullTrigger(null, { cancel: true });
  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;
  stopRest();
  exitSessionReturnFocus = null;
  closeExitSessionModal();
  renderDayPicker();
  showScreen("screen-day-picker");
}

function discardSessionAndGoHome() {
  finishPullTrigger(null, { cancel: true });
  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;
  stopRest();
  clearSession();
  exitSessionReturnFocus = null;
  closeExitSessionModal();
  renderDayPicker();
  showScreen("screen-day-picker");
}

function renderDayPicker() {
  renderDayPickerCards();
  renderResumeBanner();
}

function getActiveHomeSession() {
  const saved = loadSession();
  return saved?.status === "in_progress" ? saved : null;
}

function renderDayPickerCards() {
  const weekKey = getWeekKey();
  const week = loadWeek(weekKey);
  const templateChoices = getOrCreateDayAssignment(weekKey);
  const completed = week.completed;
  const activeSession = getActiveHomeSession();
  const container = document.getElementById("day-picker-cards");

  container.innerHTML = templateChoices
    .map((templateId) => {
      const day = DAYS[templateId];
      const isDone = completed.includes(templateId);
      const isActiveSession = activeSession?.templateId === templateId;
      const isLocked = Boolean(activeSession) && !isDone;
      const completedWeekday = formatWeekdayLabel(
        week.completedByTemplate?.[templateId],
      );
      let statusLabel = "";
      let ctaLabel = "START SESSION ▸";

      if (isDone) {
        statusLabel = `Completed on ${completedWeekday || "this week"}`;
        ctaLabel = `COMPLETED ON ${(completedWeekday || "THIS WEEK").toUpperCase()}`;
      } else if (isActiveSession) {
        statusLabel = "Session in progress";
        ctaLabel = "RESUME FROM BANNER ABOVE";
      } else if (isLocked) {
        statusLabel = "Locked while session is active";
        ctaLabel = "FINISH OR DISCARD CURRENT SESSION";
      }

      return `
      <div class="day-picker-card fadein ${isDone ? "completed" : ""} ${isLocked ? "locked" : ""} ${isActiveSession ? "active-session" : ""}"
           data-day="${templateId}">
        <div class="day-card-top">
          <div class="day-card-letter">${templateId}</div>
        </div>
        <div class="day-card-name">${day.focus.toUpperCase()}</div>
        <div class="day-card-cta">${ctaLabel}</div>
      </div>`;
    })
    .join("");
}

function renderResumeBanner() {
  const saved = loadSession();
  const banner = document.getElementById("resume-banner");
  if (!saved || saved.status !== "in_progress") {
    banner.style.display = "none";
    return;
  }
  const day = DAYS[saved.templateId];
  const spinState = normalizeSpinState(saved.spinState);
  const slotLabel = day
    ? spinState === SPIN_STATE_READY && !saved.currentExercise
      ? "Awaiting spin"
      : `Exercise ${saved.slotIndex + 1}/${saved.slots.length}`
    : "";
  document.getElementById("resume-text").textContent =
    `SESSION IN PROGRESS · Day ${saved.templateId} · ${slotLabel}`;
  banner.style.display = "flex";
}

function resumeSession() {
  session = loadSession();
  if (!session) return;

  // Migration: old sessions pre-refactor won't have pickedExercises
  if (!session.pickedExercises?.length) pickAllExercises();

  if (session.currentExercise) {
    launchExerciseFromSession();
  } else {
    const spinState = getSessionSpinState();
    renderSlotMachine(/* skipSpin = */ spinState !== SPIN_STATE_READY);
    showScreen("screen-slot-machine");
  }
}

function launchExerciseFromSession() {
  const exercise = session.currentExercise;
  const slot = session.currentSlot;
  document.getElementById("exercise-topbar-day").textContent =
    `DAY ${session.templateId}`;

  const nudge = getOverloadNudge(exercise.name);
  const nudgeEl = document.getElementById("overload-nudge");
  if (nudgeEl) {
    nudgeEl.textContent = nudge
      ? `⚡ Last 3× at ${nudge.currentWeight}kg — try ${nudge.suggestedWeight}kg?`
      : "";
    nudgeEl.style.display = nudge ? "inline-flex" : "none";
  }

  document.getElementById("ex-tag").textContent = slot.label;
  document.getElementById("ex-name").textContent = exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, "0");
  document.getElementById("ex-meta").textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById("ex-tip").textContent = exercise.tip;

  document.getElementById("pr-overlay").classList.remove("show");
  renderExerciseProgress();
  renderSets();
  syncExercisePrimaryAction();
  showScreen("screen-exercise");
  resumeRestIfNeeded();
}

// Builds the slot machine screen.
// skipSpin=true: reels shown in landed state (resume or interrupted spin path).
// skipSpin=false (default): reels wait in ready state for the pull trigger.
function renderSlotMachine(skipSpin = false) {
  const day = DAYS[session.templateId];
  document.getElementById("slot-day-title").textContent =
    `DAY ${session.templateId}`;
  document.getElementById("slot-day-sub").textContent =
    `${day.focus} · ${session.slots.length} exercises`;

  const container = document.getElementById("reels-container");
  const statusBtn = document.getElementById("slot-trigger-status");
  const trigger = document.getElementById("slot-pull-trigger");

  container.innerHTML = session.slots
    .map((slot, i) => {
      const pool = EXERCISES[slot.key] ?? [];
      const items = Array.from({ length: REPEATS }, () =>
        pool.map((e) => e.name),
      ).flat();
      const drums = items
        .map((name) => `<div class="reel-item">${name.toUpperCase()}</div>`)
        .join("");
      return `
      <div class="reel-wrap" id="reel-wrap-${i}">
        <div class="reel-window">
          <div class="reel-drum" id="reel-drum-${i}" style="transform:translateY(0)">
            ${drums}
          </div>
        </div>
      </div>`;
    })
    .join("");

  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;
  pullGesture.active = false;
  pullGesture.pointerId = null;
  pullGesture.currentPull = 0;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = 0;
  pullGesture.velocity = 0;
  pullGesture.thresholdBuzzed = false;
  pullGesture.landedCount = 0;
  trigger?.classList.remove("is-firing");

  if (skipSpin) {
    setSessionSpinState(SPIN_STATE_LANDED);

    // Restore landed state (resume or coming back after START WORKOUT)
    session.slots.forEach((slot, i) => {
      const picked = session.pickedExercises?.[i];
      if (!picked) return;
      const pool = EXERCISES[slot.key] ?? [];
      const pidx = pool.findIndex((e) => e.name === picked.name);
      const safeIdx = pidx < 0 ? 0 : pidx;
      const targetIdx = REP_TARGET * pool.length + safeIdx;
      const drum = document.getElementById(`reel-drum-${i}`);
      const wrap = document.getElementById(`reel-wrap-${i}`);
      if (drum)
        drum.style.transform = `translateY(${-(targetIdx * getReelHeight())}px)`;
      if (wrap) wrap.classList.add("landed");
    });
    pullGesture.landedCount = session.slots.length;
    statusBtn?.classList.remove("appearing");
  } else {
    statusBtn?.classList.remove("appearing");
  }

  syncSlotTriggerState();
}

function renderDoneScreen({
  templateId,
  totalSets,
  duration,
  sessionPRs,
  sessionNudges,
}) {
  const day = DAYS[templateId];
  document.getElementById("done-sub").textContent =
    `${day?.name ?? `Day ${templateId}`} complete`;

  const entries = loadHistory().slice(-1)[0]?.entries ?? [];
  document.getElementById("done-stats").innerHTML = `
    <div class="done-stat">
      <div class="done-stat-val">${entries.length}</div>
      <div class="done-stat-label">Exercises</div>
    </div>
    <div class="done-stat">
      <div class="done-stat-val">${totalSets}</div>
      <div class="done-stat-label">Sets</div>
    </div>
    <div class="done-stat">
      <div class="done-stat-val">${duration} MIN</div>
      <div class="done-stat-label">Duration</div>
    </div>`;

  // Phase 4: PR section
  const prsBlock = document.getElementById("done-prs");
  if (sessionPRs?.length > 0) {
    document.getElementById("done-prs-list").innerHTML = sessionPRs
      .map(
        (pr) =>
          `<div class="done-pr-item">${pr.exerciseName} — ${pr.type === "weight" ? `+${fmtKg(pr.new - pr.prev)}kg max weight` : `volume PR`}</div>`,
      )
      .join("");
    prsBlock.style.display = "block";
  } else {
    prsBlock.style.display = "none";
  }

  // Phase 4: Nudges section
  const nudgesBlock = document.getElementById("done-nudges");
  if (sessionNudges?.length > 0) {
    document.getElementById("done-nudges-list").innerHTML = sessionNudges
      .map(
        (n) =>
          `<div class="done-pr-item">${n.exerciseName} — Last 3× at ${n.nudge.currentWeight}kg → try ${n.nudge.suggestedWeight}kg?</div>`,
      )
      .join("");
    nudgesBlock.style.display = "block";
    // Mark nudges shown
    sessionNudges.forEach((n) => markNudgeShown(n.exerciseName));
  } else {
    nudgesBlock.style.display = "none";
  }

  document.getElementById("done-sync").textContent = "";
  document.getElementById("done-sync").className = "done-sync";
}

// ── EVENT WIRING ────────────────────────────────────────────────────────────

function wireEvents() {
  // Day picker
  document
    .getElementById("resume-btn")
    .addEventListener("click", resumeSession);
  document.getElementById("history-btn").addEventListener("click", () => {
    renderHistory({ resetOffset: true });
    showScreen("screen-history");
  });

  // Day cards (event delegation on new container)
  document.getElementById("day-picker-cards").addEventListener("click", (e) => {
    const card = e.target.closest("[data-day]");
    if (!card) return;
    if (getActiveHomeSession()) return;
    if (card.classList.contains("completed")) return;
    if (getCompletedDays(getWeekKey()).includes(card.dataset.day)) return;
    startSession(card.dataset.day); // picks all exercises inside startSession
    renderSlotMachine();
    showScreen("screen-slot-machine");
  });

  // Slot machine screen
  document
    .getElementById("slot-machine-back")
    .addEventListener("click", (e) => openExitSessionModal(e.currentTarget));
  document
    .getElementById("slot-trigger-status")
    .addEventListener("click", launchExercise);
  const pullTrigger = document.getElementById("slot-pull-trigger");
  pullTrigger.addEventListener("pointerdown", handlePullTriggerStart);
  pullTrigger.addEventListener("pointermove", handlePullTriggerMove);
  pullTrigger.addEventListener("pointerup", (e) => finishPullTrigger(e));
  pullTrigger.addEventListener("pointercancel", (e) =>
    finishPullTrigger(e, { cancel: true }),
  );
  pullTrigger.addEventListener("lostpointercapture", (e) =>
    finishPullTrigger(e, { cancel: true }),
  );
  pullTrigger.addEventListener("keydown", handlePullTriggerKeydown);

  // Exercise screen
  document
    .getElementById("exercise-back")
    .addEventListener("click", (e) => openExitSessionModal(e.currentTarget));
  document
    .getElementById("complete-ex-btn")
    .addEventListener("click", handleExercisePrimaryAction);
  document.getElementById("sets-container").addEventListener("input", (e) => {
    const input = e.target.closest("[data-field]");
    if (!input) return;
    updateCurrentSetField(
      parseInt(input.dataset.idx, 10),
      input.dataset.field,
      input.value,
    );
  });

  // Done screen
  document.getElementById("done-back-btn").addEventListener("click", goHome);

  // History screen
  document
    .getElementById("history-back")
    .addEventListener("click", () => showScreen("screen-day-picker"));
  document.getElementById("history-more-btn").addEventListener("click", () => {
    historyOffset += 30;
    renderHistory();
  });
  document.getElementById("history-list").addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-history-delete]");
    if (deleteBtn) {
      deleteHistoryEntry(Number(deleteBtn.dataset.historyDelete));
      return;
    }
    const toggle = e.target.closest(".history-expand-hint");
    if (!toggle) return;
    const card = toggle.closest(".history-card");
    if (card) card.classList.toggle("expanded");
  });

  // Exit session modal
  document
    .getElementById("exit-session-cancel")
    .addEventListener("click", closeExitSessionModal);
  document
    .getElementById("exit-session-resume-later")
    .addEventListener("click", goHome);
  document
    .getElementById("exit-session-discard")
    .addEventListener("click", discardSessionAndGoHome);
  document
    .getElementById("exit-session-modal")
    .addEventListener("click", (e) => {
      if (e.target.id === "exit-session-modal") closeExitSessionModal();
    });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modal = document.getElementById("exit-session-modal");
    if (modal?.classList.contains("show")) closeExitSessionModal();
  });
}

// ── INIT ───────────────────────────────────────────────────────────────────

function init() {
  wireEvents();
  renderDayPicker();

  // Flush any queued sync payloads from previous offline sessions
  flushSyncQueue();
}

async function flushSyncQueue() {
  const queue = storageGet("grind:sync-queue", []);
  if (queue.length === 0) return;
  if (!navigator.onLine) return;
  if (
    CONFIG.dryRun ||
    !CONFIG.webhookUrl ||
    CONFIG.webhookUrl.includes("YOUR_N8N")
  )
    return;

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSyncBar(
        `Flushed queued session from ${item.failedAt.slice(0, 10)}`,
        "success",
      );
    } catch {
      remaining.push(item);
    }
  }
  storageSet("grind:sync-queue", remaining);
}

document.addEventListener("DOMContentLoaded", init);

// Register service worker — enables offline use and "Add to Home Screen"
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[GRIND] SW registered, scope:", reg.scope))
      .catch((err) => console.warn("[GRIND] SW registration failed:", err));
  });
}

// ── TESTS ──────────────────────────────────────────────────────────────────
// Run via: open index.html?test in the browser, then check the console.
// Tests run after DOM is ready (safe to call storage + logic functions).
//
// NOTE: checkAndUpdatePR and getOverloadNudge are stubs in Phase 1.
//       Tests for those functions will be activated in Phase 4.

function runTests() {
  let pass = 0,
    fail = 0;
  function assert(cond, label) {
    if (cond) {
      console.log(`  ✅ ${label}`);
      pass++;
    } else {
      console.error(`  ❌ ${label}`);
      fail++;
    }
  }
  console.group("GRIND — Phase 1 Tests");

  // 1. getWeekKey() — format and Monday assertion
  {
    const key = getWeekKey();
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(key),
      `Week key is YYYY-MM-DD format (got "${key}")`,
    );
    const d = new Date(key + "T00:00:00");
    assert(
      d.getDay() === 1,
      `Week key resolves to a Monday (getDay()=${d.getDay()})`,
    );
  }

  // 2. parseWeight — edge cases
  {
    assert(parseWeight("—") === null, 'parseWeight("—") → null');
    assert(parseWeight("") === null, 'parseWeight("") → null');
    assert(parseWeight("bw") === null, 'parseWeight("bw") → null');
    assert(parseWeight("BW") === null, 'parseWeight("BW") → null');
    assert(parseWeight("40") === 40, 'parseWeight("40") → 40');
    assert(parseWeight("42.5") === 42.5, 'parseWeight("42.5") → 42.5');
    assert(parseWeight(null) === null, "parseWeight(null) → null");
  }

  // 3. pickExercise — basic pick
  {
    const fakeSession = {
      weekKey: getWeekKey(),
      slotIndex: 0,
      reservations: {},
    };
    const orig = session;
    session = fakeSession;

    const ex = pickExercise("lower-quad", 0);
    assert(ex !== null, "pickExercise returns an exercise for lower-quad");
    assert(typeof ex?.name === "string", "Returned exercise has a name");
    assert(
      fakeSession.reservations["lower-quad:0"] === ex?.name,
      "Reservation written at spin time",
    );

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
    session = fakeSession;

    const ex1 = pickExercise("pull-vertical", 1);
    const ex2 = pickExercise("pull-vertical", 4);

    assert(
      ex1 !== null && ex2 !== null,
      "Both pull-vertical picks return exercises",
    );
    if (ex1 && ex2) {
      assert(
        ex1.name !== ex2.name,
        `Intra-session dedup: slot 1 got "${ex1?.name}", slot 4 got "${ex2?.name}"`,
      );
    }

    session = orig;
  }

  // 5. pickExercise — unknown category returns null
  {
    const fakeSession = { weekKey: getWeekKey(), reservations: {} };
    const orig = session;
    session = fakeSession;
    const ex = pickExercise("nonexistent-category", 0);
    assert(ex === null, "pickExercise returns null for unknown category");
    session = orig;
  }

  // 6. checkAndUpdatePR — BW exercise returns {}
  {
    const prs = checkAndUpdatePR("Pull-Up", [
      { weight: "—", reps: "8" },
      { weight: "—", reps: "7" },
    ]);
    assert(
      Object.keys(prs).length === 0,
      "checkAndUpdatePR returns {} for BW exercise",
    );
    assert(
      loadPR("Pull-Up").lastWeight === undefined,
      "BW exercise does not write lastWeight",
    );
  }

  // 7. checkAndUpdatePR — first session is always a weight PR (prev = 0)
  {
    // Clean slate for this exercise
    const all = storageGet("grind:pr", {});
    delete all["Test Curl"];
    storageSet("grind:pr", all);
    const sets = [
      { weight: "20", reps: "10" },
      { weight: "22.5", reps: "8" },
    ];
    const prs = checkAndUpdatePR("Test Curl", sets);
    assert(prs.weight?.new === 22.5, "First session sets maxWeight PR to 22.5");
    assert(
      prs.volume?.new === 380,
      `Volume PR = 20×10 + 22.5×8 = 380 (got ${prs.volume?.new})`,
    );
    assert(
      loadPR("Test Curl").lastWeight === "22.5",
      "lastWeight written as string",
    );
    assert(
      loadPR("Test Curl").sessions?.length === 1,
      "Session appended to history",
    );

    // Second session — same weights, no new PR
    const prs2 = checkAndUpdatePR("Test Curl", sets);
    assert(
      Object.keys(prs2).length === 0,
      "Same weights second session = no PR",
    );

    // Third session — heavier weight, new PR
    const prs3 = checkAndUpdatePR("Test Curl", [{ weight: "25", reps: "8" }]);
    assert(prs3.weight?.new === 25, "Heavier weight triggers weight PR");

    // Cleanup
    const pr2 = storageGet("grind:pr", {});
    delete pr2["Test Curl"];
    storageSet("grind:pr", pr2);
  }

  // 8. getOverloadNudge — fires after 3 same-weight sessions, respects 21-day gate
  {
    const all2 = storageGet("grind:pr", {});
    delete all2["Test Squat"];
    storageSet("grind:pr", all2);
    // 3 sessions at 40kg
    ["s1", "s2", "s3"].forEach(() =>
      checkAndUpdatePR("Test Squat", [
        { weight: "40", reps: "8" },
        { weight: "40", reps: "8" },
      ]),
    );
    const nudge = getOverloadNudge("Test Squat");
    assert(nudge !== null, "Nudge fires after 3 sessions at same weight");
    assert(
      nudge?.currentWeight === 40,
      `currentWeight is 40 (got ${nudge?.currentWeight})`,
    );
    assert(
      nudge?.suggestedWeight === 42.5,
      `suggestedWeight is 42.5 (got ${nudge?.suggestedWeight})`,
    );

    // After markNudgeShown, 21-day gate blocks it
    markNudgeShown("Test Squat");
    assert(
      getOverloadNudge("Test Squat") === null,
      "21-day gate blocks nudge after markNudgeShown",
    );

    // Cleanup
    const pr3 = storageGet("grind:pr", {});
    delete pr3["Test Squat"];
    storageSet("grind:pr", pr3);
  }

  // 8. saveLastWeight — stores max weight, skips BW
  {
    const testSets = [
      { weight: "40", reps: "8" },
      { weight: "42.5", reps: "7" },
      { weight: "40", reps: "6" },
    ];
    saveLastWeight("Bulgarian Split Squat", testSets);
    const saved = getLastWeight("Bulgarian Split Squat");
    assert(
      saved === "42.5",
      `saveLastWeight stores heaviest set (got "${saved}")`,
    );

    // BW exercise — should not overwrite existing or create entry
    const preBW = getLastWeight("Pull-Up");
    saveLastWeight("Pull-Up", [
      { weight: "—", reps: "8" },
      { weight: "—", reps: "7" },
    ]);
    assert(
      getLastWeight("Pull-Up") === preBW,
      "saveLastWeight skips BW exercise",
    );

    // Cleanup test data
    const pr = storageGet("grind:pr", {});
    delete pr["Bulgarian Split Squat"];
    storageSet("grind:pr", pr);
  }

  // 9. getOrCreateDayAssignment — returns fixed weekly choices and migrates legacy data
  {
    const testKey = "test-week-2099-01-01";
    const assignment1 = getOrCreateDayAssignment(testKey);
    assert(Array.isArray(assignment1), "Weekly choices are stored as an array");
    assert(
      assignment1.join(",") === "A,B,C",
      `Weekly choices include A, B, C in fixed order (got "${assignment1.join(",")}")`,
    );

    const assignment2 = getOrCreateDayAssignment(testKey);
    assert(
      JSON.stringify(assignment1) === JSON.stringify(assignment2),
      "Weekly choices are stable across calls in the same week",
    );

    const legacyKey = "test-week-2099-01-08";
    storageSet(`grind:week-${legacyKey}`, {
      dayAssignment: { monday: "C", wednesday: "A", friday: "B" },
      completed: ["C"],
      usedExercises: {},
    });
    const migratedChoices = getOrCreateDayAssignment(legacyKey);
    const migratedWeek = loadWeek(legacyKey);
    assert(
      migratedChoices.join(",") === "A,B,C",
      "Legacy weekday assignments migrate to fixed weekly choices",
    );
    assert(
      !("dayAssignment" in migratedWeek),
      "Legacy dayAssignment is removed during week migration",
    );

    const shuffledKey = "test-week-2099-01-15";
    storageSet(`grind:week-${shuffledKey}`, {
      templateChoices: ["B", "C", "A"],
      completed: ["B"],
      usedExercises: {},
    });
    const canonicalChoices = getOrCreateDayAssignment(shuffledKey);
    assert(
      canonicalChoices.join(",") === "A,B,C",
      "Shuffled stored template choices are normalized to A, B, C",
    );

    const completionKey = "test-week-2099-01-22";
    markDayComplete("A", completionKey);
    const completedWeek = loadWeek(completionKey);
    assert(
      completedWeek.completedByTemplate?.A === getTodayWeekday(),
      "Completed template stores the actual weekday it was finished",
    );

    const deleteWeekKey = "2099-01-29";
    storageSet(`grind:week-${deleteWeekKey}`, {
      ...createEmptyWeek(),
      completed: ["A"],
      completedByTemplate: { A: "monday" },
      completedWeekdays: ["monday"],
    });
    saveHistory([
      {
        date: "29/01/2099",
        weekKey: deleteWeekKey,
        templateId: "A",
        durationMinutes: 42,
        totalSets: 10,
        entries: [],
        timestamp: "2099-01-29T12:00:00.000Z",
      },
    ]);
    deleteHistoryEntry(0);
    const clearedWeek = loadWeek(deleteWeekKey);
    assert(
      clearedWeek.completed.length === 0,
      "Deleting the only history entry clears week completion state",
    );
    assert(
      !clearedWeek.completedByTemplate?.A,
      "Deleting the only history entry removes completedByTemplate status",
    );

    // Cleanup
    storageDel(`grind:week-${testKey}`);
    storageDel(`grind:week-${legacyKey}`);
    storageDel(`grind:week-${shuffledKey}`);
    storageDel(`grind:week-${completionKey}`);
    storageDel(`grind:week-${deleteWeekKey}`);
    saveHistory([]);
  }

  // 10. Data integrity — all day slots reference valid EXERCISES keys
  {
    let allValid = true;
    Object.entries(DAYS).forEach(([dayId, day]) => {
      day.slots.forEach((slot) => {
        if (!(slot.key in EXERCISES)) {
          console.error(
            `  ⚠️  Day ${dayId} slot "${slot.label}" key "${slot.key}" not in EXERCISES`,
          );
          allValid = false;
        }
      });
    });
    assert(allValid, "All day slot keys reference valid EXERCISES entries");
  }

  console.groupEnd();
  const status =
    fail === 0 ? "✅ All tests passed" : `⚠️  ${fail} test(s) failed`;
  console.log(`\n${status} (${pass} passed, ${fail} failed)`);
}

if (location.search.includes("test")) {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(runTests, 100); // let init() finish first
  });
}
