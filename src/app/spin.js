import { AudioEngine } from "../audio/index.js";
import { EXERCISES } from "../data/workouts.js";

export const SPIN_STATE_READY = "ready";
export const SPIN_STATE_SPINNING = "spinning";
export const SPIN_STATE_LANDED = "landed";

const FALLBACK_PULL_MAX_PX = 168;
const PULL_BOTTOM_CLEARANCE_PX = 12;
const PULL_MOMENTUM_BOOST = 110;
const PULL_MOMENTUM_MIN_RATIO = 0.82;
const DEFAULT_REEL_H = 64;
const REPEATS = 10;
const REP_TARGET = 7;
const BASE_MS = 2000;
const STAGGER_MS = 350;
const SHOULD_SERIALIZE_LANDING_CUES =
  typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

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
  thresholdBuzzed: false,
  landedCount: 0,
  statusTimer: null,
  recoilTimer: null,
};

let spinGeneration = 0;
let landingCuePromise = Promise.resolve();
let landingCueHandle = null;
let lastLandingCueAt = 0;

export function initSpin(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
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

function setSlotStageStatus(text, tone = "idle", transientMs = 0) {
  const title = document.getElementById("slot-stage-title");
  if (!title) return;

  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;

  title.textContent = text;
  title.dataset.tone = tone;

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
  statusBtn.dataset.tone = canLaunch ? "landed" : "idle";
  statusBtn.classList.toggle("is-visible", canLaunch);
  if (!canLaunch) statusBtn.classList.remove("appearing");

  if (!pullGesture.active) {
    setPullGestureClasses({ dragging: false, charged: false });
    if (!preservePull) setPullProgress(0);
  }

  if (spinState === SPIN_STATE_READY) {
    setReelLandProgress(0);
    setSlotStageStatus("Pull the handle", "idle");
    runtime.queueOnboardingRefresh();
    return;
  }

  if (spinState === SPIN_STATE_SPINNING) {
    setSlotStageStatus("The fates are turning.", "spinning");
    runtime.queueOnboardingRefresh();
    return;
  }

  setReelLandProgress(1);
  setSlotStageStatus("Your workout is set.", "landed");
  runtime.queueOnboardingRefresh();
}

function getSessionReserved(categoryKey) {
  const session = runtime.getSession();
  return Object.entries(session.reservations || {})
    .filter(([key]) => key.startsWith(categoryKey + ":"))
    .map(([, value]) => value);
}

export function pickExercise(categoryKey, slotPosition) {
  const session = runtime.getSession();
  const pool = EXERCISES[categoryKey] ?? [];
  if (pool.length === 0) return null;

  const weekUsed = runtime.getUsedExercises(categoryKey, session.weekKey);
  const sessionUsed = getSessionReserved(categoryKey);

  let available = pool.filter(
    (exercise) =>
      !weekUsed.includes(exercise.name) && !sessionUsed.includes(exercise.name),
  );

  if (available.length === 0) {
    available = pool.filter((exercise) => !sessionUsed.includes(exercise.name));
  }

  if (available.length === 0) {
    available = pool;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  session.reservations[`${categoryKey}:${slotPosition}`] = chosen.name;
  runtime.saveSession();
  return chosen;
}

export function pickAllExercises() {
  const session = runtime.getSession();
  session.pickedExercises = session.slots.map((slot, index) => {
    const existingName = session.reservations[`${slot.key}:${index}`];
    if (existingName) {
      const pool = EXERCISES[slot.key] ?? [];
      const found = pool.find((exercise) => exercise.name === existingName);
      return found ?? pickExercise(slot.key, index);
    }
    return pickExercise(slot.key, index);
  });
  runtime.saveSession();
}

async function triggerSlotSpin() {
  if (!runtime.getSession() || getSessionSpinState() !== SPIN_STATE_READY)
    return;

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
  runtime.advanceOnboardingStep("pull_handle", "start_button");

  trigger?.classList.add("is-firing");
  vibrate([18, 34, 26]);

  pullGesture.recoilTimer = setTimeout(() => {
    trigger?.classList.remove("is-firing");
    setPullProgress(0);
  }, 180);

  try {
    await AudioEngine.startSpinning();
  } catch (error) {
    console.error("Failed to start spinning audio:", error);
  }

  if (!runtime.getSession() || getSessionSpinState() !== SPIN_STATE_SPINNING) {
    return;
  }

  spinAllReels();
}

export async function handlePullTriggerStart(e) {
  if (getSessionSpinState() !== SPIN_STATE_READY) return;
  if (typeof e.button === "number" && e.button !== 0) return;

  const trigger = document.getElementById("slot-pull-trigger");
  if (!trigger) return;

  void AudioEngine.play("pull-start");
  runtime.advanceOnboardingStep("pull_handle", "start_button");

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
  setSlotStageStatus("Draw it down.", "idle");

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
  if (charged && !pullGesture.thresholdBuzzed) {
    pullGesture.thresholdBuzzed = true;
    vibrate(12);
    setSlotStageStatus("Release the handle", "charged");
  } else if (
    !charged &&
    pullGesture.thresholdBuzzed &&
    nextPull < pullMetrics.triggerPull - 12
  ) {
    pullGesture.thresholdBuzzed = false;
    setSlotStageStatus("Keep pulling.", "idle");
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
      setSlotStageStatus("Not enough force. Pull harder.", "idle", 900);
    } else {
      syncSlotTriggerState();
    }
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

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resetLandingCues() {
  landingCuePromise = Promise.resolve();
  lastLandingCueAt = 0;

  if (landingCueHandle) {
    landingCueHandle.stop();
    landingCueHandle = null;
  }
}

function queueLandingCue(name, options = {}, gen = spinGeneration) {
  const runCue = async () => {
    if (gen !== spinGeneration) return null;

    if (SHOULD_SERIALIZE_LANDING_CUES && lastLandingCueAt > 0) {
      const waitMs = Math.max(
        0,
        lastLandingCueAt + STAGGER_MS - performance.now(),
      );
      if (waitMs > 0) await wait(waitMs);
    }

    if (gen !== spinGeneration) return null;

    if (SHOULD_SERIALIZE_LANDING_CUES && landingCueHandle) {
      landingCueHandle.stop();
      landingCueHandle = null;
    }

    const handle = await AudioEngine.play(name, options);
    if (gen !== spinGeneration) {
      handle?.stop?.();
      return null;
    }

    lastLandingCueAt = performance.now();
    landingCueHandle = handle;
    return handle;
  };

  landingCuePromise = landingCuePromise.catch(() => null).then(runCue);
  return landingCuePromise;
}

function getReelHeight() {
  const reelWindow = document.querySelector(".reel-window");
  const reelItem = document.querySelector(".reel-item");
  const measuredHeight =
    reelWindow?.getBoundingClientRect().height ||
    reelItem?.getBoundingClientRect().height ||
    0;

  return measuredHeight > 0 ? measuredHeight : DEFAULT_REEL_H;
}

function spinAllReels() {
  const session = runtime.getSession();
  if (!session?.slots?.length) return;

  spinGeneration++;
  const gen = spinGeneration;
  resetLandingCues();

  const reelCount = session.slots.length;
  const reelHeight = getReelHeight();
  const maxTime = BASE_MS + (reelCount - 1) * STAGGER_MS;

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
    const duration = BASE_MS + index * STAGGER_MS;

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
    await AudioEngine.stopSpinning();
    if (gen !== spinGeneration) return;

    void queueLandingCue("reel-lock", { volume: 0.8 }, gen);
    if (gen !== spinGeneration) return;

    setSlotStageStatus(`Reel ${index + 1} locked.`, "charged", 550);
    vibrate(12);
  } else {
    await AudioEngine.stopSpinning();
    if (gen !== spinGeneration) return;

    void queueLandingCue("final-lock", {}, gen);
    if (gen !== spinGeneration) return;

    setSlotStageStatus("Your workout is set.", "landed");
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

export function renderSlotMachine(skipSpin = false) {
  const session = runtime.getSession();

  const container = document.getElementById("reels-container");
  const statusBtn = document.getElementById("slot-trigger-status");
  const trigger = document.getElementById("slot-pull-trigger");

  container.innerHTML = session.slots
    .map((slot, index) => {
      const pool = EXERCISES[slot.key] ?? [];
      const items = Array.from({ length: REPEATS }, () =>
        pool.map((exercise) => exercise.name),
      ).flat();
      const drums = items
        .map((name) => `<div class="reel-item">${name.toUpperCase()}</div>`)
        .join("");
      return `
      <div class="reel-wrap card card--muted" id="reel-wrap-${index}">
        <div class="reel-window">
          <div class="reel-drum" id="reel-drum-${index}" style="transform:translateY(0)">
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
    session.slots.forEach((slot, index) => {
      const picked = session.pickedExercises?.[index];
      if (!picked) return;
      const pool = EXERCISES[slot.key] ?? [];
      const pickedIndex = pool.findIndex(
        (exercise) => exercise.name === picked.name,
      );
      const safeIdx = pickedIndex < 0 ? 0 : pickedIndex;
      const targetIdx = REP_TARGET * pool.length + safeIdx;
      const drum = document.getElementById(`reel-drum-${index}`);
      const wrap = document.getElementById(`reel-wrap-${index}`);
      if (drum) {
        drum.style.transform = `translateY(${-(targetIdx * getReelHeight())}px)`;
      }
      if (wrap) wrap.classList.add("landed");
    });
    pullGesture.landedCount = session.slots.length;
    statusBtn?.classList.remove("appearing");
  } else {
    statusBtn?.classList.remove("appearing");
  }

  syncSlotTriggerState();
  runtime.queueOnboardingRefresh();
}

export function cancelPullGesture() {
  finishPullTrigger(null, { cancel: true });
  clearTimeout(pullGesture.statusTimer);
  pullGesture.statusTimer = null;
}
