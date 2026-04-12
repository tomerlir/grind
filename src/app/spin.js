import refreshRerollIconSvgRaw from "lucide-static/icons/refresh-ccw-dot.svg?raw";
import { DAYS, EXERCISES } from "../data/workouts.js";

export const SPIN_STATE_READY = "ready";
export const SPIN_STATE_SPINNING = "spinning";
export const SPIN_STATE_LANDED = "landed";

const FALLBACK_PULL_MAX_PX = 168;
const PULL_BOTTOM_CLEARANCE_PX = 12;
const PULL_MOMENTUM_BOOST = 110;
const PULL_MOMENTUM_MIN_RATIO = 0.82;
const DEFAULT_REEL_H = 64;
const WORKOUT_PLAN_SHUFFLE_MS = 220;
const REPEATS = 10;
const REP_TARGET = 7;
const BASE_MS = 2000;
const STAGGER_MS = 350;
const MOBILE_LANDING_GAP_MS = 520;
const IS_TOUCH_DEVICE =
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
const SLOT_DISPLAY_LABELS = {
  "lower-quad": "Lower (Quad)",
  "push-horizontal": "Chest",
  "pull-vertical": "Back (Vertical)",
  "lower-hinge": "Lower (Hinge)",
  "push-vertical": "Shoulders",
  "pull-horizontal": "Back (Horizontal)",
  accessory: "Accessory",
  "lower-glute": "Lower (Glute)",
  "arms-tricep": "Triceps",
  "arms-bicep": "Biceps",
  core: "Core",
  calves: "Calves",
};
const refreshRerollIconSvg = refreshRerollIconSvgRaw
  .replace(/<!--[\s\S]*?-->\s*/, "")
  .replace(
    'class="lucide lucide-refresh-ccw-dot"',
    'class="workout-plan-swap-icon" aria-hidden="true" focusable="false"',
  );

let runtime = {
  getSession: () => null,
  saveSession: () => {},
  getUsedExercises: () => [],
  advanceOnboardingStep: () => {},
  queueOnboardingRefresh: () => {},
};

const pullGesture = {
  active: false,
  pointerId: null,
  startY: 0,
  currentPull: 0,
  lastPull: 0,
  lastTime: 0,
  velocity: 0,
  thresholdReached: false,
  landedCount: 0,
  recoilTimer: null,
};

let spinGeneration = 0;

export function initSpin(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTemplateDisplayName(templateId) {
  return DAYS[templateId]?.name ?? `Full Body ${templateId}`;
}

function formatPlanSlotLabel(slot) {
  if (!slot) return "";
  return SLOT_DISPLAY_LABELS[slot.key] ?? slot.label;
}

function getSwapIconMarkup() {
  return refreshRerollIconSvg;
}

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

export function normalizeSpinState(state) {
  if (
    [SPIN_STATE_READY, SPIN_STATE_SPINNING, SPIN_STATE_LANDED].includes(state)
  ) {
    return state;
  }
  return SPIN_STATE_LANDED;
}

export function getSessionSpinState() {
  const session = runtime.getSession();
  if (!session) return SPIN_STATE_READY;
  return normalizeSpinState(session.spinState);
}

function setSessionSpinState(nextState) {
  const session = runtime.getSession();
  if (!session || session.spinState === nextState) return;
  session.spinState = nextState;
  runtime.saveSession();
}

function vibrate(pattern) {
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Ignore unsupported or rejected haptics.
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
  const frame = document.getElementById("slot-machine-frame");
  if (!frame) return;
  frame.style.setProperty("--land-progress", clamp(progress, 0, 1).toFixed(3));
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
  const spinBtn = document.getElementById("slot-spin-button");
  const statusBtn = document.getElementById("slot-trigger-status");
  if (!spinBtn && !statusBtn) return;

  const spinState = getSessionSpinState();
  const isSpinning = spinState === SPIN_STATE_SPINNING;
  const canLaunch = spinState !== SPIN_STATE_SPINNING;

  if (spinBtn) {
    spinBtn.hidden = false;
    spinBtn.disabled = isSpinning;
    spinBtn.dataset.state = isSpinning ? "spinning" : "ready";
    spinBtn.textContent = isSpinning ? "Shuffling..." : "Shuffle All";
    spinBtn.setAttribute("aria-disabled", spinBtn.disabled ? "true" : "false");
  }

  if (statusBtn) {
    statusBtn.disabled = !canLaunch;
    statusBtn.tabIndex = canLaunch ? 0 : -1;
    statusBtn.dataset.state = canLaunch ? "landed" : "idle";
    statusBtn.classList.add("is-visible");
    statusBtn.textContent = "Start Workout";
    statusBtn.classList.remove("appearing");
  }

  if (!pullGesture.active) {
    setPullGestureClasses({ dragging: false, charged: false });
    if (!preservePull) setPullProgress(0);
  }

  setReelLandProgress(spinState === SPIN_STATE_SPINNING ? 0.5 : 1);
  runtime.queueOnboardingRefresh();
}

function getSessionReserved(categoryKey, { excludeSlotIndex = null } = {}) {
  const session = runtime.getSession();
  return Object.entries(session?.reservations || {})
    .filter(([key]) => {
      if (!key.startsWith(`${categoryKey}:`)) return false;
      if (excludeSlotIndex === null) return true;
      return key !== `${categoryKey}:${excludeSlotIndex}`;
    })
    .map(([, value]) => value);
}

function pickExerciseFromPool(
  categoryKey,
  { excludeSlotIndex = null, excludeNames = [] } = {},
) {
  const session = runtime.getSession();
  const pool = EXERCISES[categoryKey] ?? [];
  if (pool.length === 0) return null;

  const weekUsed = runtime.getUsedExercises(categoryKey, session.weekKey);
  const sessionUsed = getSessionReserved(categoryKey, { excludeSlotIndex });
  const excludedNameSet = new Set([
    ...sessionUsed,
    ...excludeNames.filter(Boolean),
  ]);

  let available = pool.filter(
    (exercise) =>
      !weekUsed.includes(exercise.name) && !excludedNameSet.has(exercise.name),
  );

  if (available.length === 0) {
    available = pool.filter((exercise) => !excludedNameSet.has(exercise.name));
  }

  if (available.length === 0) {
    available = pool.filter(
      (exercise) =>
        !weekUsed.includes(exercise.name) &&
        !sessionUsed.includes(exercise.name),
    );
  }

  if (available.length === 0) {
    available = pool.filter((exercise) => !sessionUsed.includes(exercise.name));
  }

  if (available.length === 0) {
    available = pool;
  }

  return available[Math.floor(Math.random() * available.length)];
}

export function pickExercise(categoryKey, slotPosition, options = {}) {
  const session = runtime.getSession();
  if (!session) return null;

  session.reservations ||= {};
  const chosen = pickExerciseFromPool(categoryKey, {
    excludeSlotIndex: options.excludeSlotIndex ?? slotPosition,
    excludeNames: options.excludeNames ?? [],
  });
  if (!chosen) return null;

  session.reservations[`${categoryKey}:${slotPosition}`] = chosen.name;
  if (options.save !== false) runtime.saveSession();
  return chosen;
}

export function pickAllExercises(options = {}) {
  const session = runtime.getSession();
  if (!session?.slots?.length) return [];

  session.reservations ||= {};
  const previousNames = Array.isArray(session.pickedExercises)
    ? session.pickedExercises.map((exercise) => exercise?.name ?? "")
    : [];

  if (options.forceNew) {
    session.reservations = {};
  }

  session.pickedExercises = session.slots.map((slot, index) => {
    const existingName = options.forceNew
      ? null
      : session.reservations[`${slot.key}:${index}`];
    if (existingName && !options.excludeCurrent) {
      const pool = EXERCISES[slot.key] ?? [];
      const found = pool.find((exercise) => exercise.name === existingName);
      return (
        found ??
        pickExercise(slot.key, index, {
          save: false,
          excludeNames: previousNames[index] ? [previousNames[index]] : [],
        })
      );
    }

    return pickExercise(slot.key, index, {
      save: false,
      excludeNames:
        options.excludeCurrent && previousNames[index]
          ? [previousNames[index]]
          : [],
    });
  });
  setSessionSpinState(SPIN_STATE_LANDED);
  runtime.saveSession();
  return session.pickedExercises;
}

function rerollExerciseAtSlot(slotIndex) {
  const session = runtime.getSession();
  const slot = session?.slots?.[slotIndex];
  if (!session || !slot) return null;

  session.reservations ||= {};
  const reservationKey = `${slot.key}:${slotIndex}`;
  const currentName =
    session.pickedExercises?.[slotIndex]?.name ??
    session.reservations[reservationKey];

  delete session.reservations[reservationKey];

  const nextExercise = pickExercise(slot.key, slotIndex, {
    save: false,
    excludeNames: currentName ? [currentName] : [],
  });

  if (!nextExercise) return null;

  session.pickedExercises ||= [];
  session.pickedExercises[slotIndex] = nextExercise;
  setSessionSpinState(SPIN_STATE_LANDED);
  runtime.saveSession();
  return nextExercise;
}

function rerollAllExercises() {
  return pickAllExercises({ forceNew: true, excludeCurrent: true });
}

function renderWorkoutPlanRow(slot, exercise, index) {
  const spinState = getSessionSpinState();
  const isBusy = spinState === SPIN_STATE_SPINNING;
  const slotLabel = escapeHtml(formatPlanSlotLabel(slot));
  const exerciseName = escapeHtml(exercise?.name ?? "Exercise unavailable");

  return `
    <div class="workout-plan-row" data-slot-index="${index}">
      <div class="workout-plan-row-copy">
        <div class="workout-plan-row-label">${slotLabel}</div>
        <div class="workout-plan-row-name">${exerciseName}</div>
      </div>
      <button
        class="workout-plan-swap"
        type="button"
        data-workout-swap="${index}"
        aria-label="Swap ${slotLabel}"
        ${isBusy ? "disabled" : ""}
      >
        ${getSwapIconMarkup()}
      </button>
    </div>`;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function animateWorkoutPlan(slotIndices) {
  const rows = slotIndices
    .map((slotIndex) =>
      document.querySelector(
        `.workout-plan-row[data-slot-index="${slotIndex}"]`,
      ),
    )
    .filter(Boolean);

  rows.forEach((row) => row.classList.add("is-shuffling"));
  await wait(WORKOUT_PLAN_SHUFFLE_MS);
}

async function triggerSlotSpin() {
  if (!runtime.getSession() || getSessionSpinState() !== SPIN_STATE_READY)
    return;

  const spinBtn = document.getElementById("slot-spin-button");

  document.getElementById("slot-trigger-status")?.classList.remove("appearing");

  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  pullGesture.landedCount = 0;

  setReelLandProgress(0);

  setSessionSpinState(SPIN_STATE_SPINNING);
  syncSlotTriggerState();
  runtime.advanceOnboardingStep("pull_handle", "start_button");

  spinBtn?.blur();
  vibrate([18, 34, 26]);

  if (!runtime.getSession() || getSessionSpinState() !== SPIN_STATE_SPINNING) {
    return;
  }

  spinAllReels();
}

async function regenerateWorkoutPlan() {
  const session = runtime.getSession();
  if (!session || getSessionSpinState() === SPIN_STATE_SPINNING) return;

  setSessionSpinState(SPIN_STATE_SPINNING);
  syncSlotTriggerState();
  runtime.advanceOnboardingStep("pull_handle", "start_button");
  vibrate([10, 18, 10]);

  await animateWorkoutPlan(session.slots.map((_, index) => index));

  if (!runtime.getSession()) return;

  rerollAllExercises();
  setSessionSpinState(SPIN_STATE_LANDED);
  renderSlotMachine(true);
}

export function startSpinReveal() {
  void regenerateWorkoutPlan();
}

export async function swapWorkoutExercise(slotIndex) {
  const session = runtime.getSession();
  if (!session || getSessionSpinState() === SPIN_STATE_SPINNING) return null;
  if (!session.slots?.[slotIndex]) return null;

  setSessionSpinState(SPIN_STATE_SPINNING);
  syncSlotTriggerState();
  runtime.advanceOnboardingStep("pull_handle", "start_button");
  vibrate(10);

  await animateWorkoutPlan([slotIndex]);

  if (!runtime.getSession()) return null;

  const nextExercise = rerollExerciseAtSlot(slotIndex);
  setSessionSpinState(SPIN_STATE_LANDED);
  renderSlotMachine(true);
  return nextExercise;
}

export async function handlePullTriggerStart(e) {
  if (getSessionSpinState() !== SPIN_STATE_READY) return;
  if (typeof e.button === "number" && e.button !== 0) return;

  const trigger = document.getElementById("slot-pull-trigger");
  if (!trigger) return;

  runtime.advanceOnboardingStep("pull_handle", "start_button");

  pullGesture.active = true;
  pullGesture.pointerId = e.pointerId ?? null;
  pullGesture.startY = e.clientY;
  pullGesture.currentPull = 0;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = e.timeStamp || performance.now();
  pullGesture.velocity = 0;
  pullGesture.thresholdReached = false;

  trigger.setPointerCapture?.(e.pointerId);
  setPullGestureClasses({ dragging: true, charged: false });
  setPullProgress(0);

  e.preventDefault();
}

export function handlePullTriggerMove(e) {
  if (!pullGesture.active) return;
  if (pullGesture.pointerId !== null && e.pointerId !== pullGesture.pointerId) {
    return;
  }

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
  if (charged && !pullGesture.thresholdReached) {
    pullGesture.thresholdReached = true;
    vibrate(12);
  } else if (
    !charged &&
    pullGesture.thresholdReached &&
    nextPull < pullMetrics.triggerPull - 12
  ) {
    pullGesture.thresholdReached = false;
  }

  setPullGestureClasses({ dragging: true, charged });
  setPullProgress(nextPull);
  e.preventDefault();
}

export function finishPullTrigger(e, { cancel = false } = {}) {
  if (!pullGesture.active) return;
  if (
    pullGesture.pointerId !== null &&
    e?.pointerId !== undefined &&
    e.pointerId !== pullGesture.pointerId
  ) {
    return;
  }

  const trigger = document.getElementById("slot-pull-trigger");
  const pullMetrics = getPullMetrics();
  if (trigger && e?.pointerId !== undefined) {
    trigger.releasePointerCapture?.(e.pointerId);
  }

  const effectivePull =
    pullGesture.currentPull +
    Math.max(0, pullGesture.velocity) * PULL_MOMENTUM_BOOST;
  const shouldSpin =
    !cancel &&
    getSessionSpinState() === SPIN_STATE_READY &&
    pullGesture.currentPull >= pullMetrics.momentumMinPull &&
    effectivePull >= pullMetrics.triggerPull;

  pullGesture.active = false;
  pullGesture.pointerId = null;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = 0;
  pullGesture.velocity = 0;
  pullGesture.thresholdReached = false;
  setPullGestureClasses({ dragging: false, charged: false });

  if (shouldSpin) {
    setPullProgress(pullMetrics.maxPull);
    triggerSlotSpin();
  } else {
    setPullProgress(0);
    syncSlotTriggerState();
  }

  if (e) e.preventDefault();
}

export function handlePullTriggerKeydown(e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (getSessionSpinState() !== SPIN_STATE_READY) return;

  const pullMetrics = getPullMetrics();
  e.preventDefault();
  runtime.advanceOnboardingStep("pull_handle", "start_button");
  setPullProgress(pullMetrics.maxPull);
  triggerSlotSpin();
}

function getLandingGapMs() {
  return IS_TOUCH_DEVICE ? MOBILE_LANDING_GAP_MS : STAGGER_MS;
}

function getReelHeight() {
  const reelItem = document.querySelector(".reel-item");
  const reelWindow = document.querySelector(".reel-window");
  const measuredHeight =
    reelItem?.getBoundingClientRect().height ||
    reelWindow?.getBoundingClientRect().height ||
    0;

  return measuredHeight > 0 ? measuredHeight : DEFAULT_REEL_H;
}

function spinAllReels() {
  const session = runtime.getSession();
  if (!session?.slots?.length) return;

  spinGeneration++;
  const gen = spinGeneration;

  const reelCount = session.slots.length;
  const reelHeight = getReelHeight();
  const landingGapMs = getLandingGapMs();
  const maxTime = BASE_MS + (reelCount - 1) * landingGapMs;

  const fallbackTimer = setTimeout(() => {
    if (gen !== spinGeneration) return;
    showStartWorkoutButton();
  }, maxTime + 600);

  pullGesture.landedCount = 0;
  setReelLandProgress(0);
  let landsCompleted = 0;

  session.slots.forEach((slot, index) => {
    const pool = EXERCISES[slot.key] ?? [];
    const picked = session.pickedExercises[index];
    if (!picked || pool.length === 0) return;

    const pickedIdx = pool.findIndex(
      (exercise) => exercise.name === picked.name,
    );
    const safeIdx = pickedIdx < 0 ? 0 : pickedIdx;
    const targetIdx = REP_TARGET * pool.length + safeIdx;
    const translateY = -(targetIdx * reelHeight);
    const duration = BASE_MS + index * landingGapMs;

    const drum = document.getElementById(`reel-drum-${index}`);
    const wrap = document.getElementById(`reel-wrap-${index}`);
    if (!drum || !wrap) return;

    wrap.classList.remove("landed");
    wrap.classList.add("spinning");

    drum.style.transition = "none";
    drum.style.transform = "translateY(0)";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drum.style.transition = `transform ${duration}ms cubic-bezier(0.15, 0.7, 0.25, 1)`;
        drum.style.transform = `translateY(${translateY}px)`;

        drum.addEventListener(
          "transitionend",
          async () => {
            if (gen !== spinGeneration) return;

            await onReelLanded(index, gen);
            landsCompleted++;
            if (landsCompleted >= reelCount) {
              clearTimeout(fallbackTimer);
              showStartWorkoutButton();
            }
          },
          { once: true },
        );
      });
    });
  });
}

async function onReelLanded(index, gen = spinGeneration) {
  const wrap = document.getElementById(`reel-wrap-${index}`);
  if (!wrap) return;

  wrap.classList.remove("spinning");
  wrap.classList.add("landed");

  const win = wrap.querySelector(".reel-window");
  if (win) {
    win.style.boxShadow =
      "0 0 40px rgba(0,220,255,0.95), 0 0 80px rgba(0,200,255,0.5)";
    setTimeout(() => {
      win.style.boxShadow = "";
    }, 380);
  }

  const totalReels = runtime.getSession()?.slots?.length || 1;
  pullGesture.landedCount = clamp(pullGesture.landedCount + 1, 0, totalReels);
  setReelLandProgress(pullGesture.landedCount / totalReels);

  if (gen !== spinGeneration) return;

  if (pullGesture.landedCount < totalReels) {
    vibrate(12);
  } else {
    vibrate([16, 26, 34]);
  }
}

function showStartWorkoutButton() {
  const session = runtime.getSession();
  const btn = document.getElementById("slot-trigger-status");

  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  setPullProgress(0);
  pullGesture.landedCount = session?.slots?.length ?? pullGesture.landedCount;

  btn?.classList.remove("appearing");
  btn?.classList.remove("is-visible");
  void btn?.offsetWidth;

  setSessionSpinState(SPIN_STATE_LANDED);
  syncSlotTriggerState();
  if (!btn) return;
  requestAnimationFrame(() => {
    btn.classList.add("appearing");
  });
}

export function renderSlotMachine(_skipSpin = false) {
  const session = runtime.getSession();
  if (!session) return;

  const container = document.getElementById("reels-container");
  const title = document.getElementById("slot-screen-title");
  if (!container) return;

  if (!session.pickedExercises?.length) {
    pickAllExercises();
  }

  if (getSessionSpinState() !== SPIN_STATE_SPINNING) {
    setSessionSpinState(SPIN_STATE_LANDED);
  }

  if (title) {
    title.textContent = `Optimized for ${getTemplateDisplayName(session.templateId)}`;
  }

  container.innerHTML = session.slots
    .map((slot, index) =>
      renderWorkoutPlanRow(slot, session.pickedExercises?.[index], index),
    )
    .join("");

  clearTimeout(pullGesture.recoilTimer);
  pullGesture.recoilTimer = null;
  pullGesture.active = false;
  pullGesture.pointerId = null;
  pullGesture.currentPull = 0;
  pullGesture.lastPull = 0;
  pullGesture.lastTime = 0;
  pullGesture.velocity = 0;
  pullGesture.thresholdReached = false;
  pullGesture.landedCount = session.slots.length;

  syncSlotTriggerState();
  runtime.queueOnboardingRefresh();
}

export function cancelPullGesture() {
  finishPullTrigger(null, { cancel: true });
}
