import { AudioEngine } from "../audio/index.js";

let runtime = {
  getSession: () => null,
  saveSession: () => {},
  clearSession: () => {},
  markExerciseUsed: () => {},
  checkAndUpdatePR: () => ({}),
  getOverloadNudge: () => null,
  getLastWeight: () => null,
  markDayComplete: () => {},
  appendHistory: () => {},
  buildSyncPayload: () => ({}),
  syncToSheets: () => {},
  showPROverlay: (_prs, onDone) => onDone(),
  renderDoneScreen: async () => {},
  showScreen: () => {},
  fireConfetti: () => {},
  isOnboardingActive: () => false,
  finishOnboarding: () => {},
  advanceOnboardingStep: () => {},
  queueOnboardingRefresh: () => {},
  startRest: () => {},
  stopRest: () => {},
  skipRest: () => {},
  getRemainingRestSeconds: () => 0,
  resumeRestIfNeeded: () => {},
};

export function initExerciseFlow(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function renderExerciseProgress() {
  const session = runtime.getSession();
  const strip = document.getElementById("exercise-progress-strip");
  if (!strip || !session) return;

  strip.innerHTML = session.slots
    .map((_, index) => {
      let cls = "progress-dot";
      if (index < session.slotIndex) cls += " done-dot";
      else if (index === session.slotIndex) cls += " active-dot";
      return `<div class="${cls}"></div>`;
    })
    .join("");
}

export function renderSets() {
  const session = runtime.getSession();
  const container = document.getElementById("sets-container");
  if (!container || !session) return;

  const activeIdx = getActiveSetIndex();
  const isResting = Boolean(runtime.getRemainingRestSeconds());

  if (activeIdx === -1) {
    container.innerHTML = `
      <div class="set-row card card--completed fadein done-set all-done-set">
        <div class="set-row-top">
          <div class="set-num title-block__title">ALL SETS LOGGED</div>
        </div>
        <div class="set-summary-copy">Proceed when you are ready for the next exercise.</div>
      </div>`;
    return;
  }

  const activeSet = session.currentSets[activeIdx];
  const loggedSets = session.currentSets.filter((set) => set.done).length;
  const inlineHint = isResting
    ? "Tap timer to skip rest"
    : `${loggedSets}/${session.currentSets.length} sets logged`;

  container.innerHTML = `
    <div class="set-row card card--active fadein active-set focused-set" id="set-row-${activeIdx}">
      <div class="set-line" aria-label="Current set logger">
        <div class="set-cell set-cell--count">
          <div class="set-cell-label title-block__eyebrow">Set</div>
          <div class="set-cell-value">${activeIdx + 1}</div>
        </div>
        <label class="set-cell" for="weight-${activeIdx}">
          <span class="set-cell-label title-block__eyebrow">Weight</span>
          <input class="set-input"
            type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off"
            placeholder="${activeSet.weight || "—"}"
            value="${activeSet.weight || ""}"
            ${isResting ? "disabled" : ""}
            id="weight-${activeIdx}" data-idx="${activeIdx}" data-field="weight">
        </label>
        <label class="set-cell" for="reps-${activeIdx}">
          <span class="set-cell-label title-block__eyebrow">Reps</span>
          <input class="set-input"
            type="number" inputmode="numeric" enterkeyhint="done" autocomplete="off"
            placeholder="—"
            value="${activeSet.reps || ""}"
            ${isResting ? "disabled" : ""}
            id="reps-${activeIdx}" data-idx="${activeIdx}" data-field="reps">
        </label>
        <button
          class="complete-ex-btn button-primary inline"
          id="complete-ex-btn"
          type="button"
          data-exercise-action="primary"
        >
          LOG
        </button>
      </div>
      <div class="set-inline-meta">
        <span class="set-inline-hint">${inlineHint}</span>
      </div>
    </div>`;

  const weightInput = document.getElementById(`weight-${activeIdx}`);
  const repsInput = document.getElementById(`reps-${activeIdx}`);
  [weightInput, repsInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("focus", () => {
      scrollIntoViewCentered(input);
      runtime.trackOnboardingViewport?.();
    });
    input.addEventListener("blur", () => runtime.trackOnboardingViewport?.());
  });

  runtime.queueOnboardingRefresh();
}

export function getActiveSetIndex() {
  const session = runtime.getSession();
  return session.currentSets.findIndex((set) => !set.done);
}

export function isSetReady(idx) {
  const session = runtime.getSession();
  if (idx < 0) return false;
  const set = session.currentSets[idx];
  return Boolean(set?.reps?.trim());
}

function getAutofillValue(value) {
  if (value === null || value === undefined) return "";
  const normalized = String(value).trim();
  return normalized === "—" ? "" : normalized;
}

export function normalizeWeightValue(value) {
  const session = runtime.getSession();
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!normalized) return session?.currentExercise?.bodyweight ? "BW" : "—";
  if (normalized.toLowerCase() === "bw") return "BW";
  if (/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return normalized;
  return session?.currentExercise?.bodyweight ? "BW" : "—";
}

export function getInitialWeightValue(exercise, lastWeight) {
  if (
    lastWeight !== null &&
    lastWeight !== undefined &&
    String(lastWeight).trim()
  ) {
    return String(lastWeight).trim();
  }
  return exercise?.bodyweight ? "BW" : "";
}

function prefillNextSetFromCurrent(idx) {
  const session = runtime.getSession();
  const currentSet = session?.currentSets?.[idx];
  const nextSet = session?.currentSets?.[idx + 1];
  if (!currentSet || !nextSet || nextSet.done) return;

  if (!nextSet.weight?.trim()) {
    nextSet.weight = getAutofillValue(currentSet.weight);
    nextSet.prefilledWeight = Boolean(nextSet.weight?.trim());
  }

  if (!nextSet.reps?.trim()) {
    nextSet.reps = getAutofillValue(currentSet.reps);
    nextSet.prefilledReps = Boolean(nextSet.reps?.trim());
  }
}

export function updateCurrentSetField(idx, field, value) {
  const session = runtime.getSession();
  if (!session?.currentSets?.[idx] || session.currentSets[idx].done) return;
  const previousValue = session.currentSets[idx][field];
  session.currentSets[idx][field] = value;
  if (field === "weight" && value !== previousValue) {
    session.currentSets[idx].prefilledWeight = false;
  }
  if (field === "reps" && value !== previousValue) {
    session.currentSets[idx].prefilledReps = false;
  }
  runtime.saveSession();
  syncExercisePrimaryAction();
}

async function confirmCurrentSet(idx) {
  const session = runtime.getSession();
  if (idx < 0 || !session) return;

  const set = session.currentSets[idx];
  if (!set) return;

  const isLastSet = idx === session.currentSets.length - 1;
  set.weight = normalizeWeightValue(set.weight);
  set.reps = set.reps.trim() || "—";
  set.done = true;

  prefillNextSetFromCurrent(idx);
  runtime.saveSession();

  if (idx === 0 && runtime.isOnboardingActive()) {
    runtime.finishOnboarding("completed");
  }

  if (isLastSet) {
    await completeExercise();
    return;
  }

  renderSets();

  try {
    void AudioEngine.play("set-logged");
  } catch (error) {
    console.error("Failed to play set-logged sound:", error);
  }

  if (!runtime.getSession()) return;
  runtime.startRest(session.currentExercise.restSeconds);
}

export async function handleExercisePrimaryAction() {
  const remaining = runtime.getRemainingRestSeconds();
  if (remaining > 0) {
    runtime.skipRest();
    return;
  }

  const activeIdx = getActiveSetIndex();
  if (activeIdx >= 0) {
    if (!isSetReady(activeIdx)) return;
    await confirmCurrentSet(activeIdx);
    return;
  }

  await completeExercise();
}

export function dismissKeyboard() {
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    active.blur();
  }
}

function scrollIntoViewCentered(el) {
  if (!el) return;
  setTimeout(() => {
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, 300);
}

export function syncExercisePrimaryAction() {
  const session = runtime.getSession();
  const btn = document.getElementById("complete-ex-btn");
  if (!btn || !session?.currentSets) return;

  const remaining = runtime.getRemainingRestSeconds();
  const activeIdx = getActiveSetIndex();
  const allDone = activeIdx === -1;

  btn.className = "complete-ex-btn button-primary inline";

  if (remaining > 0) {
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    btn.textContent = `${m}:${s}`;
    btn.disabled = false;
    btn.dataset.mode = "rest";
    btn.classList.add("resting");
    runtime.queueOnboardingRefresh();
    return;
  }

  if (!allDone) {
    btn.textContent = "LOG";
    btn.disabled = !isSetReady(activeIdx);
    btn.dataset.mode = "proceed";
    btn.classList.toggle("ready", isSetReady(activeIdx));
    runtime.queueOnboardingRefresh();
    return;
  }

  btn.textContent = "DONE";
  btn.disabled = false;
  btn.dataset.mode = "next";
  btn.classList.add("advance");
  runtime.queueOnboardingRefresh();
}

function populateExerciseScreen(exercise, slot) {
  const nudge = runtime.getOverloadNudge(exercise.name);
  const nudgeEl = document.getElementById("overload-nudge");
  if (nudgeEl) {
    if (nudge) {
      nudgeEl.textContent = `⚡ Last 3× at ${nudge.currentWeight}kg — try ${nudge.suggestedWeight}kg?`;
      nudgeEl.style.display = "inline-flex";
    } else {
      nudgeEl.style.display = "none";
    }
  }

  document.getElementById("ex-tag").textContent = slot.label;
  document.getElementById("exercise-topbar-title").textContent =
    exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, "0");
  document.getElementById("ex-meta").textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById("ex-tip").textContent = exercise.tip;

  document.getElementById("pr-overlay").classList.remove("show");
  renderExerciseProgress();
  renderSets();
  syncExercisePrimaryAction();
  runtime.showScreen("screen-exercise");
  runtime.queueOnboardingRefresh();
}

export function launchExercise() {
  const session = runtime.getSession();
  if (!session.pickedExercises?.length) runtime.pickAllExercises?.();

  runtime.advanceOnboardingStep("start_button", "exercise_log");

  const exercise = session.pickedExercises[session.slotIndex];
  const slot = session.slots[session.slotIndex];
  if (!exercise || !slot) {
    finishSession();
    return;
  }

  const lastWeight = runtime.getLastWeight(exercise.name);
  const initialWeight = getInitialWeightValue(exercise, lastWeight);

  session.currentExercise = exercise;
  session.currentSlot = slot;
  session.currentSets = Array.from({ length: exercise.sets }, (_, index) => ({
    setNum: index + 1,
    weight: initialWeight,
    reps: "",
    done: false,
    prefilledWeight: Boolean(initialWeight),
    prefilledReps: false,
  }));
  runtime.saveSession();
  runtime.stopRest();
  populateExerciseScreen(exercise, slot);
}

export function resumeCurrentExercise() {
  const session = runtime.getSession();
  const exercise = session.currentExercise;
  const slot = session.currentSlot;
  runtime.advanceOnboardingStep("start_button", "exercise_log");
  populateExerciseScreen(exercise, slot);
  runtime.resumeRestIfNeeded();
}

async function completeExercise() {
  const session = runtime.getSession();
  runtime.stopRest();
  session.restEndsAt = null;

  try {
    void AudioEngine.play("level-up");
  } catch (error) {
    console.error("Failed to play level-up sound:", error);
  }

  if (!runtime.getSession()) return;

  const exercise = session.currentExercise;
  const slot = session.currentSlot;
  if (!exercise || !slot) return;

  const prs = runtime.checkAndUpdatePR(exercise.name, session.currentSets);
  runtime.markExerciseUsed(slot.key, exercise.name, session.weekKey);

  session.entries.push({
    exerciseName: exercise.name,
    categoryLabel: slot.label,
    sets: session.currentSets.map((set) => ({ weight: set.weight, reps: set.reps })),
    timestamp: new Date().toISOString(),
    prs,
  });

  session.slotIndex += 1;
  session.currentExercise = null;
  session.currentSlot = null;
  session.currentSets = [];
  runtime.saveSession();

  const hasPR = Object.keys(prs).length > 0;
  if (session.slotIndex >= session.slots.length) {
    if (hasPR) {
      runtime.showPROverlay(prs, finishSession);
    } else {
      finishSession();
    }
    return;
  }

  if (hasPR) {
    runtime.showPROverlay(prs, launchExercise);
  } else {
    launchExercise();
  }
}

function finishSession() {
  const session = runtime.getSession();
  const duration = Math.round((Date.now() - new Date(session.startTime)) / 60000);
  const totalSets = session.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const templateId = session.templateId;
  const weekKey = session.weekKey;
  const payload = runtime.buildSyncPayload(duration, totalSets);

  runtime.markDayComplete(templateId, weekKey);
  runtime.appendHistory({
    date: new Date().toLocaleDateString("en-GB"),
    templateId,
    weekKey,
    durationMinutes: duration,
    totalSets,
    entries: session.entries,
    timestamp: new Date().toISOString(),
  });

  const sessionPRs = session.entries.flatMap((entry) =>
    Object.entries(entry.prs || {}).map(([type, data]) => ({
      exerciseName: entry.exerciseName,
      type,
      ...data,
    })),
  );
  const sessionNudges = session.entries
    .map((entry) => ({
      exerciseName: entry.exerciseName,
      nudge: runtime.getOverloadNudge(entry.exerciseName),
    }))
    .filter((entry) => entry.nudge !== null);

  runtime.clearSession();

  runtime.renderDoneScreen({
    templateId,
    totalSets,
    duration,
    sessionPRs,
    sessionNudges,
  });
  runtime.showScreen("screen-done");
  setTimeout(runtime.fireConfetti, 80);
  runtime.syncToSheets(payload);
}
