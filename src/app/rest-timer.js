import { AudioEngine } from "../audio/index.js";

let runtime = {
  getSession: () => null,
  saveSession: () => {},
  renderSets: () => {},
  syncExercisePrimaryAction: () => {},
};

let restTimerId = null;

export function initRestTimer(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function getRemainingRestSeconds() {
  const session = runtime.getSession();
  if (!session?.restEndsAt) return 0;
  return Math.max(0, Math.ceil((session.restEndsAt - Date.now()) / 1000));
}

export function startRest(seconds) {
  const session = runtime.getSession();
  if (!session) return;

  stopRest();
  const endTime = Date.now() + seconds * 1000;
  session.restEndsAt = endTime;
  runtime.saveSession();
  runtime.renderSets();
  runtime.syncExercisePrimaryAction();

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

export function stopRest() {
  if (restTimerId) {
    clearTimeout(restTimerId);
    restTimerId = null;
  }
}

export function skipRest() {
  const session = runtime.getSession();
  if (!session) return;

  stopRest();
  session.restEndsAt = null;
  runtime.saveSession();
  runtime.renderSets();
  runtime.syncExercisePrimaryAction();
}

async function onRestComplete() {
  try {
    void AudioEngine.play("rest-timer-end");
  } catch (error) {
    console.error("Failed to play rest-timer-end sound:", error);
  }

  const session = runtime.getSession();
  if (!session) return;

  stopRest();
  session.restEndsAt = null;
  runtime.saveSession();
  runtime.renderSets();
  runtime.syncExercisePrimaryAction();

  const nextIdx = session.currentSets.findIndex((set) => !set.done);
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
  btn.textContent = `${m}:${s}`;
}

export function resumeRestIfNeeded() {
  const session = runtime.getSession();
  if (!session?.restEndsAt) return;

  const remaining = Math.ceil((session.restEndsAt - Date.now()) / 1000);
  if (remaining > 0) {
    runtime.renderSets();
    runtime.syncExercisePrimaryAction();
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
