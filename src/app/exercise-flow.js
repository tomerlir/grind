import { AudioEngine } from "../audio/index.js";

let runtime = {
  getSession: () => null,
  saveSession: () => {},
  clearSession: () => {},
  markExerciseUsed: () => {},
  checkAndUpdatePR: () => ({}),
  getOverloadNudge: () => null,
  getLastWeight: () => null,
  getLatestCompletedExerciseEntry: () => null,
  getExerciseProgressSeries: () => [],
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

let focusScrollTimer = null;
let blurSnapTimer = null;

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

  const seenGroups = new Set();
  const dots = [];

  session.slots.forEach((slot, index) => {
    if (slot.supersetGroup) {
      if (seenGroups.has(slot.supersetGroup)) return;
      seenGroups.add(slot.supersetGroup);
      const groupIndices = session.slots
        .map((s, i) => (s.supersetGroup === slot.supersetGroup ? i : -1))
        .filter((i) => i !== -1);
      const allDone = groupIndices.every((i) => i < session.slotIndex);
      const anyActive = groupIndices.some((i) => i === session.slotIndex);
      let cls = "progress-dot";
      if (allDone) cls += " done-dot";
      else if (anyActive) cls += " active-dot";
      dots.push(`<div class="${cls}"></div>`);
    } else {
      let cls = "progress-dot";
      if (index < session.slotIndex) cls += " done-dot";
      else if (index === session.slotIndex) cls += " active-dot";
      dots.push(`<div class="${cls}"></div>`);
    }
  });

  strip.innerHTML = dots.join("");
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
      </div>
      <button
        class="complete-ex-btn button-primary"
        id="complete-ex-btn"
        type="button"
        data-exercise-action="primary"
      >
        LOG
      </button>
      <div class="set-inline-meta">
        <span class="set-inline-hint">${inlineHint}</span>
      </div>
    </div>`;

  const weightInput = document.getElementById(`weight-${activeIdx}`);
  const repsInput = document.getElementById(`reps-${activeIdx}`);
  [weightInput, repsInput].forEach((input) => {
    if (!input) return;
    input.addEventListener("focus", () => {
      scheduleInputVisibility(input);
      runtime.trackOnboardingViewport?.();
    });
    input.addEventListener("blur", () => {
      scheduleExerciseScreenSnap();
      runtime.trackOnboardingViewport?.();
    });
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

export function buildInitialCurrentSets(
  exercise,
  previousSets = [],
  lastWeight = null,
) {
  const initialWeight = getInitialWeightValue(exercise, lastWeight);

  return Array.from({ length: exercise.sets }, (_, index) => {
    const previousSet = previousSets[index];
    const weight = getAutofillValue(previousSet?.weight) || initialWeight;
    const reps = getAutofillValue(previousSet?.reps);

    return {
      setNum: index + 1,
      weight,
      reps,
      done: false,
      prefilledWeight: Boolean(weight),
      prefilledReps: Boolean(reps),
    };
  });
}

export function carryForwardSetPrefill(currentSet, nextSet) {
  if (!currentSet || !nextSet || nextSet.done) return;

  if (nextSet.prefilledWeight || !nextSet.weight?.trim()) {
    nextSet.weight = getAutofillValue(currentSet.weight);
    nextSet.prefilledWeight = Boolean(nextSet.weight?.trim());
  }

  if (nextSet.prefilledReps || !nextSet.reps?.trim()) {
    nextSet.reps = getAutofillValue(currentSet.reps);
    nextSet.prefilledReps = Boolean(nextSet.reps?.trim());
  }
}

function prefillNextSetFromCurrent(idx) {
  const session = runtime.getSession();
  const currentSet = session?.currentSets?.[idx];
  const nextSet = session?.currentSets?.[idx + 1];
  carryForwardSetPrefill(currentSet, nextSet);
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

  // Superset round-robin: if this slot belongs to a superset group, handle
  // the jump to the next partner (or complete the whole group) instead of the
  // normal single-exercise advance/rest path.
  const supersetTarget = getNextSupersetTarget(session, idx);
  if (supersetTarget) {
    try {
      void AudioEngine.play("set-logged");
    } catch (error) {
      console.error("Failed to play set-logged sound:", error);
    }

    if (supersetTarget.type === "complete-all") {
      await completeSupersetGroup(supersetTarget.slotIndices);
      return;
    }

    // type === "jump": persist current progress as partial state and switch slots.
    session.partialSets = session.partialSets || {};
    session.partialSets[session.slotIndex] = session.currentSets;

    if (supersetTarget.needsRest) {
      // Start rest BEFORE switching slots so it's anchored to the exercise
      // that just finished. launchExercise is called with keepRest so it
      // doesn't cancel the timer we just started.
      runtime.startRest(session.currentExercise.restSeconds);
    }

    session.slotIndex = supersetTarget.slotIndex;
    runtime.saveSession();
    launchExercise({ keepRest: supersetTarget.needsRest });
    return;
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
  window.clearTimeout(focusScrollTimer);
  focusScrollTimer = window.setTimeout(() => {
    if (document.activeElement !== el) return;
    const screen = document.getElementById("screen-exercise");
    if (!(screen instanceof HTMLElement)) {
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
      return;
    }

    const screenRect = screen.getBoundingClientRect();
    const inputRect = el.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const topPadding = 16;
    const bottomPadding = 24;
    const visibleTop = Math.max(screenRect.top, viewportTop) + topPadding;
    const visibleBottom =
      Math.min(screenRect.bottom, viewportBottom) - bottomPadding;

    if (inputRect.bottom > visibleBottom) {
      screen.scrollTop += inputRect.bottom - visibleBottom;
      return;
    }

    if (inputRect.top < visibleTop) {
      screen.scrollTop -= visibleTop - inputRect.top;
    }
  }, window.visualViewport ? 180 : 0);
}

function scheduleInputVisibility(el) {
  scrollIntoViewCentered(el);
}

function scheduleExerciseScreenSnap() {
  window.clearTimeout(blurSnapTimer);
  blurSnapTimer = window.setTimeout(() => {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const screen = document.getElementById("screen-exercise");
    if (screen) screen.scrollTop = 0;

    const scrollingRoot = document.scrollingElement;
    if (scrollingRoot) scrollingRoot.scrollTop = 0;
  }, 180);
}

function formatGraphValue(value) {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function formatGraphDateLabel(point) {
  const timestampDate = point?.timestamp ? new Date(point.timestamp) : null;
  if (timestampDate && !Number.isNaN(timestampDate.getTime())) {
    return timestampDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  }

  const match = String(point?.date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  const fallbackDate = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(fallbackDate.getTime())) return "";

  return fallbackDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function buildMiniGraphMarkup(points) {
  if (points.length < 2) return "";

  const width = 100;
  const height = 100;
  const padLeft = 13;
  const padRight = 3;
  const padTop = 8;
  const padBottom = 20;
  const chartLeft = padLeft;
  const chartRight = width - padRight;
  const chartTop = padTop;
  const chartBottom = height - padBottom;
  const drawableWidth = chartRight - chartLeft;
  const drawableHeight = chartBottom - chartTop;
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const flatLine = range === 0;
  const tickSpread = flatLine ? Math.max(minValue * 0.1, 2.5) : range / 2;
  const tickMid = minValue + (flatLine ? 0 : range / 2);
  const yTicks = [
    { value: flatLine ? minValue + tickSpread : maxValue, y: chartTop },
    { value: tickMid, y: chartTop + drawableHeight / 2 },
    { value: flatLine ? minValue - tickSpread : minValue, y: chartBottom },
  ];

  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : chartLeft + (drawableWidth * index) / (points.length - 1);
    const y =
      range === 0
        ? chartTop + drawableHeight / 2
        : chartTop + ((maxValue - point.value) / range) * drawableHeight;

    return {
      ...point,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });

  const linePath = coords
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");
  const areaPath = `${linePath} L ${coords.at(-1).x} ${chartBottom} L ${coords[0].x} ${chartBottom} Z`;
  const gridLines = yTicks
    .map(
      (tick) => `
        <line x1="${chartLeft}" y1="${tick.y}" x2="${chartRight}" y2="${tick.y}" stroke="var(--border)" stroke-width="1"></line>`,
    )
    .join("");
  const yLabels = yTicks
    .map(
      (tick) => `
        <text x="${padLeft - 1.5}" y="${tick.y}" fill="var(--silver2)" font-size="4.5" text-anchor="end" dominant-baseline="middle">${formatGraphValue(tick.value)}</text>`,
    )
    .join("");
  const minLabelSpacing = 18; // SVG units — minimum gap between x-axis labels
  const maxLabels = Math.max(2, Math.floor(drawableWidth / minLabelSpacing));
  const labelIndices = new Set([0, coords.length - 1]);
  if (maxLabels > 2) {
    const interval = (coords.length - 1) / (maxLabels - 1);
    for (let i = 1; i < maxLabels - 1; i++) labelIndices.add(Math.round(i * interval));
  }
  const xLabels = coords
    .filter((_, i) => labelIndices.has(i))
    .map(
      (point) => `
        <text x="${point.x}" y="${height - 6}" fill="var(--silver2)" font-size="4.2" text-anchor="middle">${formatGraphDateLabel(point)}</text>`,
    )
    .join("");
  const unitLabel = points[0]?.unit === "reps" ? "total reps" : "estimated 1-rep max";

  return `
    <svg
      class="exercise-mini-graph-svg"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="none"
      role="img"
      aria-label="Exercise progress chart showing ${points.length} past sessions by ${unitLabel}."
    >
      ${gridLines}
      ${yLabels}
      ${xLabels}
      <path d="${areaPath}" fill="var(--electric)" opacity="0.2"></path>
      <path
        d="${linePath}"
        fill="none"
        stroke="var(--electric)"
        stroke-width="0.625"
        stroke-linecap="butt"
        stroke-linejoin="miter"
      ></path>
    </svg>`;
}

function renderExerciseMiniGraph(exercise) {
  const graphEl = document.getElementById("exercise-mini-graph");
  const graphStageEl = document.getElementById("exercise-graph-stage");
  if (!graphEl || !graphStageEl || !exercise) return;

  const series = runtime
    .getExerciseProgressSeries(exercise.name, Boolean(exercise.bodyweight))
    .map((point) => ({
      ...point,
      unit: exercise.bodyweight ? "reps" : "weight",
    }));

  if (series.length < 2) {
    graphEl.innerHTML = "";
    graphStageEl.classList.remove("is-visible");
    return;
  }

  graphEl.innerHTML = buildMiniGraphMarkup(series);
  graphStageEl.classList.add("is-visible");
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

function getSupersetTag(slots, slot) {
  if (!slot.supersetGroup) return null;
  const group = slots.filter((s) => s.supersetGroup === slot.supersetGroup);
  const pos = group.findIndex((s) => s.key === slot.key);
  return `SUPERSET ${pos + 1}/${group.length}`;
}

function populateExerciseScreen(exercise, slot) {
  const session = runtime.getSession();
  const nudge = runtime.getOverloadNudge(exercise.name);
  const nudgeEl = document.getElementById("overload-nudge");
  if (nudgeEl) {
    if (nudge) {
      nudgeEl.textContent = `⚡ Try +2.5 kg today`;
      nudgeEl.style.display = "inline-flex";
    } else {
      nudgeEl.style.display = "none";
    }
  }

  const supersetTag = getSupersetTag(session?.slots ?? [], slot);
  document.getElementById("ex-tag").textContent = supersetTag ?? slot.label;
  document.getElementById("exercise-topbar-title").textContent =
    exercise.name.toUpperCase();
  const restMin = Math.floor(exercise.restSeconds / 60);
  const restSec = String(exercise.restSeconds % 60).padStart(2, "0");
  document.getElementById("ex-meta").textContent =
    `${exercise.sets} sets  ·  ${exercise.repsRange}  ·  ${restMin}:${restSec} rest`;
  document.getElementById("ex-tip").textContent = exercise.tip;
  renderExerciseMiniGraph(exercise);

  document.getElementById("pr-overlay").classList.remove("show");
  renderExerciseProgress();
  renderSets();
  syncExercisePrimaryAction();
  runtime.showScreen("screen-exercise");
  runtime.queueOnboardingRefresh();
}

export function launchExercise(options = {}) {
  // Defensive: callers may pass unexpected positional args (e.g. callbacks).
  const keepRest =
    options && typeof options === "object" && options.keepRest === true;

  const session = runtime.getSession();
  if (!session.pickedExercises?.length) runtime.pickAllExercises?.();

  runtime.advanceOnboardingStep("start_button", "exercise_log");

  const exercise = session.pickedExercises[session.slotIndex];
  const slot = session.slots[session.slotIndex];
  if (!exercise || !slot) {
    finishSession();
    return;
  }

  // Superset resume: if this slot has partial sets from a prior round, restore them
  // instead of rebuilding from history. Preserves done state across round-robin jumps.
  const partial = session.partialSets?.[session.slotIndex];

  session.currentExercise = exercise;
  session.currentSlot = slot;

  if (Array.isArray(partial) && partial.length > 0) {
    session.currentSets = partial;
  } else {
    const previousEntry = runtime.getLatestCompletedExerciseEntry(exercise.name);
    const previousSets = previousEntry?.sets || [];
    const lastWeight =
      previousSets.length > 0 ? null : runtime.getLastWeight(exercise.name);
    session.currentSets = buildInitialCurrentSets(
      exercise,
      previousSets,
      lastWeight,
    );
  }

  runtime.saveSession();
  if (!keepRest) runtime.stopRest();
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

function getSupersetGroupIndices(session, slotIdx) {
  const slot = session.slots[slotIdx];
  if (!slot?.supersetGroup) return null;
  return session.slots
    .map((s, i) => (s.supersetGroup === slot.supersetGroup ? i : -1))
    .filter((i) => i !== -1);
}

// Determines what should happen after logging `loggedSetIdx` in a superset slot.
// Returns null when the current slot is not part of a superset.
// Return shapes:
//   { type: "jump", slotIndex, needsRest }  — switch to another slot in the group
//   { type: "complete-all", slotIndices }   — the whole superset group is done
function getNextSupersetTarget(session, loggedSetIdx) {
  const slotIdx = session.slotIndex;
  const groupIndices = getSupersetGroupIndices(session, slotIdx);
  if (!groupIndices) return null;

  const posInGroup = groupIndices.indexOf(slotIdx);

  // More partners after the current one in the group → jump with no rest.
  // This is the "A1 → A2" transition inside a single superset round.
  if (posInGroup < groupIndices.length - 1) {
    return {
      type: "jump",
      slotIndex: groupIndices[posInGroup + 1],
      needsRest: false,
    };
  }

  // We just finished the last partner in the group. Decide between:
  //   - completing the whole group (if that was also the last set), or
  //   - starting another round (go back to the first partner with rest)
  const isLastSet = loggedSetIdx === session.currentSets.length - 1;
  if (isLastSet) {
    return { type: "complete-all", slotIndices: groupIndices };
  }

  return {
    type: "jump",
    slotIndex: groupIndices[0],
    needsRest: true,
  };
}

async function completeSupersetGroup(slotIndices) {
  const session = runtime.getSession();
  runtime.stopRest();
  session.restEndsAt = null;

  try {
    void AudioEngine.play("level-up");
  } catch (error) {
    console.error("Failed to play level-up sound:", error);
  }

  if (!runtime.getSession()) return;

  const aggregatedPRs = {};

  // Push an entry per slot in the group, in slot order, using whichever source
  // holds the sets for that slot (currentSets for the active slot, partialSets
  // for any slot we've bounced away from).
  for (const idx of slotIndices) {
    const exercise = session.pickedExercises[idx];
    const slot = session.slots[idx];
    if (!exercise || !slot) continue;

    const sets =
      idx === session.slotIndex
        ? session.currentSets
        : session.partialSets?.[idx] ?? [];

    const prs = runtime.checkAndUpdatePR(exercise.name, sets);
    Object.assign(aggregatedPRs, prs);
    runtime.markExerciseUsed(slot.key, exercise.name, session.weekKey);

    session.entries.push({
      exerciseName: exercise.name,
      categoryLabel: slot.label,
      sets: sets.map((set) => ({ weight: set.weight, reps: set.reps })),
      timestamp: new Date().toISOString(),
      prs,
    });
  }

  // Clear partial state for all slots in this group.
  if (session.partialSets) {
    for (const idx of slotIndices) {
      delete session.partialSets[idx];
    }
  }

  // Advance past the entire group (jump to the slot after the last in the group).
  session.slotIndex = Math.max(...slotIndices) + 1;
  session.currentExercise = null;
  session.currentSlot = null;
  session.currentSets = [];
  runtime.saveSession();

  const hasPR = Object.keys(aggregatedPRs).length > 0;
  if (session.slotIndex >= session.slots.length) {
    if (hasPR) {
      runtime.showPROverlay(aggregatedPRs, finishSession);
    } else {
      finishSession();
    }
    return;
  }

  if (hasPR) {
    runtime.showPROverlay(aggregatedPRs, launchExercise);
  } else {
    launchExercise();
  }
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
