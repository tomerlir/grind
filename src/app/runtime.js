import { AudioEngine } from "../audio/index.js";
import { DAYS, EXERCISES } from "../data/workouts.js";
import { storageDel, storageGet, storageSet } from "../lib/storage.js";
import {
  initAppShell,
  renderAppVersionBadge,
  renderDayPicker,
  goHome,
  discardSessionAndGoHome,
  showPROverlay,
  showScreen,
  renderDoneScreen,
  fireConfetti,
  resumeSession,
  applyAppUpdate,
  closeUpdateAppModal,
  registerAppUpdatePrompt,
} from "./app-shell.js";
import { wireEvents } from "./events.js";
import {
  buildInitialCurrentSets,
  carryForwardSetPrefill,
  initExerciseFlow,
  dismissKeyboard,
  getInitialWeightValue,
  handleExercisePrimaryAction,
  isSetReady,
  launchExercise,
  normalizeWeightValue,
  renderExerciseProgress,
  renderSets,
  resumeCurrentExercise,
  syncExercisePrimaryAction,
  updateCurrentSetField,
} from "./exercise-flow.js";
import {
  appendHistory,
  deleteHistoryEntry,
  getExerciseProgressSeries,
  getLatestCompletedExerciseEntry,
  getLatestCompletedTemplateEntry,
  initHistory,
  loadHistory,
  renderHistory,
  saveHistory,
  showMoreHistory,
} from "./history.js";
import {
  advanceOnboardingStep,
  ensureOnboardingState,
  finishOnboarding,
  initOnboarding,
  isOnboardingActive,
  ONBOARDING_STEP_HOME,
  queueOnboardingRefresh,
  trackOnboardingViewport,
} from "./onboarding.js";
import {
  checkAndUpdatePR,
  getLastWeight,
  getOverloadNudge,
  loadPR,
  markNudgeShown,
  parseWeight,
  saveLastWeight,
} from "./prs.js";
import {
  flushSyncQueue,
  initSync,
  buildSyncPayload,
  showSyncBar,
  syncToSheets,
} from "./sync.js";
import {
  getRemainingRestSeconds,
  initRestTimer,
  resumeRestIfNeeded,
  skipRest,
  startRest,
  stopRest,
} from "./rest-timer.js";
import {
  clearSession,
  closeExitSessionModal,
  getSession,
  initSessionStore,
  loadSession,
  openExitSessionModal,
  saveSession,
  setSession,
  startSession,
} from "./session-store.js";
import {
  cancelPullGesture,
  getSessionSpinState,
  initSpin,
  pickAllExercises,
  pickExercise,
  renderSlotMachine,
  startSpinReveal,
} from "./spin.js";
import {
  createEmptyWeek,
  formatWeekdayLabel,
  getCompletedDays,
  getOrCreateDayAssignment,
  getTodayWeekday,
  getUsedExercises,
  getWeekKey,
  loadWeek,
  markDayComplete,
  markExerciseUsed,
} from "./week-store.js";

let modulesInitialized = false;
let appInitialized = false;

function initializeModules() {
  if (modulesInitialized) return;

  initSync({
    getSession,
  });

  initOnboarding({
    getSession,
    isSetReady,
    loadHistory,
    loadSession,
  });

  initSpin({
    getSession,
    saveSession,
    getUsedExercises,
    advanceOnboardingStep,
    queueOnboardingRefresh,
  });

  initSessionStore({
    getWeekKey,
    goHome,
    pickAllExercises,
    queueOnboardingRefresh,
  });

  initAppShell({
    audioEngine: AudioEngine,
    queueOnboardingRefresh,
    cancelPullGesture,
    stopRest,
    closeExitSessionModal,
    clearSession,
    loadSession,
    setSession,
    pickAllExercises,
    getWeekKey,
    loadWeek,
    getOrCreateDayAssignment,
    formatWeekdayLabel,
    getSessionSpinState,
    getSession,
    renderSlotMachine,
    resumeCurrentExercise,
  });

  initHistory({
    renderDayPicker,
    showSyncBar,
  });

  initExerciseFlow({
    getSession,
    saveSession,
    clearSession,
    markExerciseUsed,
    checkAndUpdatePR,
    getOverloadNudge,
    getLastWeight,
    getExerciseProgressSeries,
    getLatestCompletedExerciseEntry,
    markDayComplete,
    appendHistory,
    buildSyncPayload,
    syncToSheets,
    showPROverlay,
    renderDoneScreen,
    showScreen,
    fireConfetti,
    isOnboardingActive,
    finishOnboarding,
    advanceOnboardingStep,
    queueOnboardingRefresh,
    trackOnboardingViewport,
    startRest,
    stopRest,
    skipRest,
    getRemainingRestSeconds,
    resumeRestIfNeeded,
    pickAllExercises,
  });

  initRestTimer({
    getSession,
    saveSession,
    renderSets,
    syncExercisePrimaryAction,
  });

  modulesInitialized = true;
}

function getActiveHomeSession() {
  const saved = loadSession();
  return saved?.status === "in_progress" ? saved : null;
}

export function init() {
  initializeModules();
  if (appInitialized) return;
  appInitialized = true;

  ensureOnboardingState();

  wireEvents({
    audioEngine: AudioEngine,
    renderHistory,
    showScreen,
    getActiveHomeSession,
    getCompletedDays,
    getWeekKey,
    startSession,
    advanceOnboardingStep,
    renderSlotMachine,
    discardSessionAndGoHome,
    startSpinReveal,
    launchExercise,
    openExitSessionModal,
    dismissKeyboard,
    handleExercisePrimaryAction,
    updateCurrentSetField,
    goHome,
    showMoreHistory,
    deleteHistoryEntry,
    closeExitSessionModal,
    applyAppUpdate,
    closeUpdateAppModal,
    finishOnboarding,
    queueOnboardingRefresh,
    trackOnboardingViewport,
    resumeSession,
  });

  const scheduleAudioPreload = () => {
    void AudioEngine.preload().catch((error) => {
      console.error("Audio preload failed:", error);
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(scheduleAudioPreload, { timeout: 1500 });
  } else {
    window.setTimeout(scheduleAudioPreload, 0);
  }

  renderAppVersionBadge();
  renderDayPicker();
  queueOnboardingRefresh();

  if (window.visualViewport) {
    const handleViewportChange = () => {
      trackOnboardingViewport();
      queueOnboardingRefresh();
    };

    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
  }

  void flushSyncQueue();
}

export { registerAppUpdatePrompt };

export function runTests() {
  initializeModules();

  let pass = 0;
  let fail = 0;

  function assert(cond, label) {
    if (cond) {
      console.log(`  ✅ ${label}`);
      pass += 1;
    } else {
      console.error(`  ❌ ${label}`);
      fail += 1;
    }
  }

  console.group("GRIND — Phase 1 Tests");

  {
    const key = getWeekKey();
    assert(
      /^\d{4}-\d{2}-\d{2}$/.test(key),
      `Week key is YYYY-MM-DD format (got "${key}")`,
    );
    const date = new Date(key + "T00:00:00");
    assert(
      date.getDay() === 1,
      `Week key resolves to a Monday (getDay()=${date.getDay()})`,
    );
  }

  {
    assert(parseWeight("—") === null, 'parseWeight("—") → null');
    assert(parseWeight("") === null, 'parseWeight("") → null');
    assert(parseWeight("bw") === null, 'parseWeight("bw") → null');
    assert(parseWeight("BW") === null, 'parseWeight("BW") → null');
    assert(parseWeight("40") === 40, 'parseWeight("40") → 40');
    assert(parseWeight("42.5") === 42.5, 'parseWeight("42.5") → 42.5');
    assert(parseWeight(null) === null, "parseWeight(null) → null");
  }

  {
    assert(
      normalizeWeightValue("bw") === "BW",
      'normalizeWeightValue("bw") → "BW"',
    );
    assert(
      getInitialWeightValue({ bodyweight: true }, null) === "BW",
      "Bodyweight exercise defaults weight to BW",
    );

    const prefillsFromHistory = buildInitialCurrentSets(
      { sets: 3, bodyweight: false },
      [
        { weight: "40", reps: "8" },
        { weight: "42.5", reps: "7" },
      ],
      null,
    );
    assert(
      prefillsFromHistory[0].weight === "40" && prefillsFromHistory[0].reps === "8",
      "Initial set state uses the latest session's first set values",
    );
    assert(
      prefillsFromHistory[1].weight === "42.5" &&
        prefillsFromHistory[1].reps === "7",
      "Initial set state uses the latest session's second set values",
    );
    assert(
      prefillsFromHistory[2].weight === "" && prefillsFromHistory[2].reps === "",
      "Initial set state leaves unmatched later sets empty",
    );

    const carryForwardSets = buildInitialCurrentSets(
      { sets: 3, bodyweight: false },
      [
        { weight: "40", reps: "8" },
        { weight: "40", reps: "8" },
      ],
      null,
    );
    carryForwardSets[0].weight = "42.5";
    carryForwardSets[0].reps = "7";
    carryForwardSets[0].prefilledWeight = false;
    carryForwardSets[0].prefilledReps = false;
    carryForwardSetPrefill(carryForwardSets[0], carryForwardSets[1]);
    assert(
      carryForwardSets[1].weight === "42.5" && carryForwardSets[1].reps === "7",
      "Next set carry-forward replaces historical prefills with the current set values",
    );

    const manualNextSet = {
      weight: "45",
      reps: "6",
      done: false,
      prefilledWeight: false,
      prefilledReps: false,
    };
    carryForwardSetPrefill(carryForwardSets[0], manualNextSet);
    assert(
      manualNextSet.weight === "45" && manualNextSet.reps === "6",
      "Next set carry-forward preserves fields the user already edited manually",
    );
  }

  {
    saveHistory([
      {
        date: "28/01/2099",
        templateId: "A",
        weekKey: "2099-01-26",
        durationMinutes: 40,
        totalSets: 6,
        entries: [
          {
            exerciseName: "Bench Press",
            categoryLabel: "Push",
            sets: [{ weight: "60", reps: "8" }],
          },
        ],
        timestamp: "2099-01-28T12:00:00.000Z",
      },
      {
        date: "30/01/2099",
        templateId: "B",
        weekKey: "2099-01-26",
        durationMinutes: 42,
        totalSets: 9,
        entries: [
          {
            exerciseName: "Bench Press",
            categoryLabel: "Push",
            sets: [
              { weight: "62.5", reps: "8" },
              { weight: "62.5", reps: "7" },
            ],
          },
          {
            exerciseName: "Row",
            categoryLabel: "Pull",
            sets: [{ weight: "50", reps: "10" }],
          },
        ],
        timestamp: "2099-01-30T12:00:00.000Z",
      },
    ]);
    const latestBench = getLatestCompletedExerciseEntry("Bench Press");
    assert(
      latestBench?.sets?.[0]?.weight === "62.5" &&
        latestBench?.sets?.[1]?.reps === "7",
      "Latest completed exercise lookup returns the newest matching workout entry",
    );
    const latestDayA = getLatestCompletedTemplateEntry("A");
    assert(
      latestDayA?.timestamp === "2099-01-28T12:00:00.000Z",
      "Latest completed template lookup returns the newest matching day entry",
    );
    const benchSeries = getExerciseProgressSeries("Bench Press");
    assert(
      benchSeries.length === 2 &&
        benchSeries[0].value === 76 &&
        benchSeries[1].value > benchSeries[0].value,
      "Weighted exercise progress series tracks estimated 1RM (Epley), capturing both weight and rep progression",
    );
    saveHistory([]);
  }

  {
    const fakeSession = {
      weekKey: getWeekKey(),
      slotIndex: 0,
      reservations: {},
    };
    const original = getSession();
    setSession(fakeSession);

    const exercise = pickExercise("lower-quad", 0);
    assert(
      exercise !== null,
      "pickExercise returns an exercise for lower-quad",
    );
    assert(typeof exercise?.name === "string", "Returned exercise has a name");
    assert(
      fakeSession.reservations["lower-quad:0"] === exercise?.name,
      "Reservation written at spin time",
    );

    setSession(original);
  }

  {
    const fakeSession = {
      weekKey: getWeekKey(),
      slotIndex: 0,
      reservations: {},
    };
    const original = getSession();
    setSession(fakeSession);

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

    setSession(original);
  }

  {
    const fakeSession = { weekKey: getWeekKey(), reservations: {} };
    const original = getSession();
    setSession(fakeSession);
    const exercise = pickExercise("nonexistent-category", 0);
    assert(exercise === null, "pickExercise returns null for unknown category");
    setSession(original);
  }

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

  {
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

    const prs2 = checkAndUpdatePR("Test Curl", sets);
    assert(
      Object.keys(prs2).length === 0,
      "Same weights second session = no PR",
    );

    const prs3 = checkAndUpdatePR("Test Curl", [{ weight: "25", reps: "8" }]);
    assert(prs3.weight?.new === 25, "Heavier weight triggers weight PR");

    const nextPR = storageGet("grind:pr", {});
    delete nextPR["Test Curl"];
    storageSet("grind:pr", nextPR);
  }

  {
    const all = storageGet("grind:pr", {});
    delete all["Test Squat"];
    storageSet("grind:pr", all);

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

    markNudgeShown("Test Squat");
    assert(
      getOverloadNudge("Test Squat") === null,
      "21-day gate blocks nudge after markNudgeShown",
    );

    const nextPR = storageGet("grind:pr", {});
    delete nextPR["Test Squat"];
    storageSet("grind:pr", nextPR);
  }

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

    const preBW = getLastWeight("Pull-Up");
    saveLastWeight("Pull-Up", [
      { weight: "—", reps: "8" },
      { weight: "—", reps: "7" },
    ]);
    assert(
      getLastWeight("Pull-Up") === preBW,
      "saveLastWeight skips BW exercise",
    );

    const pr = storageGet("grind:pr", {});
    delete pr["Bulgarian Split Squat"];
    storageSet("grind:pr", pr);
  }

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

    storageDel(`grind:week-${testKey}`);
    storageDel(`grind:week-${legacyKey}`);
    storageDel(`grind:week-${shuffledKey}`);
    storageDel(`grind:week-${completionKey}`);
    storageDel(`grind:week-${deleteWeekKey}`);
    saveHistory([]);
  }

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
