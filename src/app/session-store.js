import { DAYS } from "../data/workouts.js";
import { storageDel, storageGet, storageSet } from "../lib/storage.js";

let runtime = {
  getWeekKey: () => "",
  goHome: () => {},
  pickAllExercises: () => {},
  queueOnboardingRefresh: () => {},
};

let session = null;
let exitSessionReturnFocus = null;

export function initSessionStore(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function getSession() {
  return session;
}

export function setSession(nextSession) {
  session = nextSession;
  return session;
}

export function loadSession() {
  return storageGet("grind:session-active", null);
}

export function saveSession() {
  if (session) storageSet("grind:session-active", session);
}

export function clearSession() {
  session = null;
  storageDel("grind:session-active");
}

export function closeExitSessionModal() {
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
  runtime.queueOnboardingRefresh();
}

export function openExitSessionModal(triggerEl = null) {
  if (!loadSession()) {
    runtime.goHome();
    return;
  }

  const modal = document.getElementById("exit-session-modal");
  if (!modal) {
    runtime.goHome();
    return;
  }

  exitSessionReturnFocus = triggerEl;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("exit-session-resume-later")?.focus();
  runtime.queueOnboardingRefresh();
}

export function startSession(templateId) {
  const day = DAYS[templateId];
  const weekKey = runtime.getWeekKey();

  session = {
    templateId,
    weekKey,
    slots: day.slots.slice(),
    slotIndex: 0,
    pickedExercises: [],
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
  runtime.pickAllExercises();
}
