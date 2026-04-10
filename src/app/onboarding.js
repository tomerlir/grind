import { storageGet, storageSet } from "../lib/storage.js";

const ONBOARDING_STORAGE_KEY = "grind:onboarding";
export const ONBOARDING_STEP_HOME = "home_card";
export const ONBOARDING_STEP_PULL = "pull_handle";
export const ONBOARDING_STEP_START = "start_button";
export const ONBOARDING_STEP_EXERCISE_LOG = "exercise_log";
export const ONBOARDING_STEP_EXERCISE_BUTTON = "exercise_button";

const ONBOARDING_STEPS = [
  ONBOARDING_STEP_HOME,
  ONBOARDING_STEP_PULL,
  ONBOARDING_STEP_START,
  ONBOARDING_STEP_EXERCISE_LOG,
  ONBOARDING_STEP_EXERCISE_BUTTON,
];
const ONBOARDING_STATUSES = ["active", "completed", "dismissed"];
const ONBOARDING_SHOW_DELAY_MS = 1400;
const ONBOARDING_VIEWPORT_SETTLE_MS = 450;

let runtime = {
  getSession: () => null,
  isSetReady: () => false,
  loadHistory: () => [],
  loadSession: () => null,
};

let onboarding = null;
let onboardingTargetNodes = [];
let onboardingRefreshFrame = 0;
let onboardingShowTimer = null;
let onboardingScheduledKey = "";
let onboardingShownKey = "";
let onboardingViewportTrackFrame = 0;
let onboardingViewportTrackUntil = 0;

export function initOnboarding(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

function getActiveSetIndex() {
  return runtime.getSession()?.currentSets?.findIndex((set) => !set.done) ?? -1;
}

function getActiveSetRow() {
  const activeIdx = getActiveSetIndex();
  return activeIdx >= 0 ? document.getElementById(`set-row-${activeIdx}`) : null;
}

const ONBOARDING_CONFIG = {
  [ONBOARDING_STEP_HOME]: {
    label: "Home",
    copy: "Pick a session to begin",
    getTargets: () =>
      document.querySelector('[data-onboarding-target="home-card"]'),
  },
  [ONBOARDING_STEP_PULL]: {
    label: "Adjust",
    copy: "Refresh the plan if you want a different mix",
    getTargets: () => {
      const button = document.getElementById("slot-spin-button");
      return button && !button.disabled ? button : null;
    },
  },
  [ONBOARDING_STEP_START]: {
    label: "Start",
    copy: "Start when this workout looks right",
    getTargets: () => {
      const button = document.getElementById("slot-trigger-status");
      return button && !button.disabled ? button : null;
    },
  },
  [ONBOARDING_STEP_EXERCISE_LOG]: {
    label: "Exercise",
    copy: "Log each set to move forward",
    getTargets: () => getActiveSetRow(),
    getTooltipAnchor: () => getActiveSetRow(),
    tooltipPlacement: "above",
  },
  [ONBOARDING_STEP_EXERCISE_BUTTON]: {
    label: "Exercise",
    copy: "Tap the button to log this set",
    getTargets: () => {
      const button = document.getElementById("complete-ex-btn");
      return button && !button.disabled ? button : null;
    },
    getTooltipAnchor: () => getActiveSetRow(),
    tooltipPlacement: "below",
  },
};

function createDefaultOnboardingState() {
  return {
    step: ONBOARDING_STEP_HOME,
    status: "active",
    hasCompletedOnboarding: false,
    hasDismissedOnboarding: false,
  };
}

function normalizeOnboardingState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const normalized = {
    ...createDefaultOnboardingState(),
    ...value,
  };

  if (normalized.step === "exercise_log_ready") {
    normalized.step = ONBOARDING_STEP_EXERCISE_BUTTON;
  }

  if (!ONBOARDING_STEPS.includes(normalized.step)) {
    normalized.step = ONBOARDING_STEP_HOME;
  }

  if (normalized.hasCompletedOnboarding) normalized.status = "completed";
  if (normalized.hasDismissedOnboarding) normalized.status = "dismissed";
  if (!ONBOARDING_STATUSES.includes(normalized.status)) {
    normalized.status = "active";
  }

  normalized.hasCompletedOnboarding = normalized.status === "completed";
  normalized.hasDismissedOnboarding = normalized.status === "dismissed";
  return normalized;
}

function saveOnboarding() {
  if (!onboarding) return;
  storageSet(ONBOARDING_STORAGE_KEY, onboarding);
}

export function ensureOnboardingState() {
  const stored = normalizeOnboardingState(
    storageGet(ONBOARDING_STORAGE_KEY, null),
  );

  if (stored) {
    onboarding = stored;
    return onboarding;
  }

  const hasExistingActivity =
    runtime.loadHistory().length > 0 ||
    runtime.loadSession()?.status === "in_progress";

  onboarding = {
    ...createDefaultOnboardingState(),
    status: hasExistingActivity ? "completed" : "active",
    hasCompletedOnboarding: hasExistingActivity,
  };
  saveOnboarding();
  return onboarding;
}

export function isOnboardingActive() {
  return onboarding?.status === "active";
}

function clearOnboardingTargets() {
  onboardingTargetNodes.forEach((node) =>
    node.classList.remove("coachmark-target-active"),
  );
  onboardingTargetNodes = [];
}

function hideOnboardingOverlay() {
  stopOnboardingViewportTracking();
  clearOnboardingTargets();
  const overlay = document.getElementById("coachmark-overlay");
  if (!overlay) return;
  overlay.classList.remove("show");
  overlay.setAttribute("aria-hidden", "true");
}

function clearOnboardingShowTimer() {
  if (onboardingShowTimer) clearTimeout(onboardingShowTimer);
  onboardingShowTimer = null;
  onboardingScheduledKey = "";
}

function stopOnboardingViewportTracking() {
  onboardingViewportTrackUntil = 0;
  if (!onboardingViewportTrackFrame) return;
  cancelAnimationFrame(onboardingViewportTrackFrame);
  onboardingViewportTrackFrame = 0;
}

export function trackOnboardingViewport(duration = ONBOARDING_VIEWPORT_SETTLE_MS) {
  onboardingViewportTrackUntil = Math.max(
    onboardingViewportTrackUntil,
    performance.now() + duration,
  );
  if (onboardingViewportTrackFrame) return;

  const tick = () => {
    onboardingViewportTrackFrame = 0;
    queueOnboardingRefresh();
    if (performance.now() < onboardingViewportTrackUntil) {
      onboardingViewportTrackFrame = requestAnimationFrame(tick);
    }
  };

  onboardingViewportTrackFrame = requestAnimationFrame(tick);
}

export function finishOnboarding(status = "completed") {
  ensureOnboardingState();
  onboarding.status = status === "dismissed" ? "dismissed" : "completed";
  onboarding.hasCompletedOnboarding = onboarding.status === "completed";
  onboarding.hasDismissedOnboarding = onboarding.status === "dismissed";
  saveOnboarding();
  clearOnboardingShowTimer();
  hideOnboardingOverlay();
}

export function advanceOnboardingStep(currentStep, nextStep) {
  if (!isOnboardingActive() || onboarding.step !== currentStep) return;
  if (!ONBOARDING_STEPS.includes(nextStep)) {
    finishOnboarding("completed");
    return;
  }
  onboarding.step = nextStep;
  saveOnboarding();
  queueOnboardingRefresh();
}

function isElementVisible(el) {
  if (!(el instanceof Element)) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function getOnboardingTargetNodes() {
  const config = ONBOARDING_CONFIG[onboarding?.step];
  if (!config) return [];
  const targets = config.getTargets?.();
  return (Array.isArray(targets) ? targets : [targets]).filter(isElementVisible);
}

function getOnboardingTargetRect(nodes) {
  const rects = nodes.map((node) => node.getBoundingClientRect());
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    top: Math.min(...rects.map((rect) => rect.top)),
    right: Math.max(...rects.map((rect) => rect.right)),
    bottom: Math.max(...rects.map((rect) => rect.bottom)),
  };
}

function getOnboardingAnchorRect(targetRect) {
  const config = ONBOARDING_CONFIG[onboarding?.step];
  const anchor = config?.getTooltipAnchor?.();
  return isElementVisible(anchor) ? anchor.getBoundingClientRect() : targetRect;
}

function getViewportBounds() {
  const viewport = window.visualViewport;
  if (!viewport) {
    return {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  return {
    left: viewport.offsetLeft,
    top: viewport.offsetTop,
    width: viewport.width,
    height: viewport.height,
  };
}

function syncExerciseOnboardingState() {
  if (!isOnboardingActive()) return;
  if (
    onboarding.step !== ONBOARDING_STEP_EXERCISE_LOG &&
    onboarding.step !== ONBOARDING_STEP_EXERCISE_BUTTON
  ) {
    return;
  }

  const session = runtime.getSession();
  const activeIdx = session?.currentSets?.findIndex((set) => !set.done) ?? -1;
  if (activeIdx !== 0) {
    finishOnboarding("completed");
    return;
  }

  const ready = runtime.isSetReady(activeIdx);
  if (ready && onboarding.step === ONBOARDING_STEP_EXERCISE_LOG) {
    onboarding.step = ONBOARDING_STEP_EXERCISE_BUTTON;
    saveOnboarding();
  } else if (!ready && onboarding.step === ONBOARDING_STEP_EXERCISE_BUTTON) {
    onboarding.step = ONBOARDING_STEP_EXERCISE_LOG;
    saveOnboarding();
  }
}

function isOverlayBlocked() {
  return (
    document.getElementById("exit-session-modal")?.classList.contains("show") ||
    document.getElementById("update-app-modal")?.classList.contains("show") ||
    document.getElementById("pr-overlay")?.classList.contains("show")
  );
}

function getActiveScreenId() {
  return document.querySelector(".screen.active")?.id ?? "";
}

function getOnboardingDisplayKey() {
  const screenId = getActiveScreenId();
  const step = onboarding?.step ?? "";
  return screenId && step ? `${screenId}:${step}` : "";
}

function scheduleOnboardingDisplay(displayKey) {
  if (
    !displayKey ||
    onboardingScheduledKey === displayKey ||
    onboardingShowTimer
  ) {
    return;
  }

  onboardingScheduledKey = displayKey;
  onboardingShowTimer = setTimeout(() => {
    onboardingShowTimer = null;
    onboardingScheduledKey = "";

    if (!isOnboardingActive()) return;
    if (getOnboardingDisplayKey() !== displayKey) return;

    onboardingShownKey = displayKey;
    queueOnboardingRefresh();
  }, ONBOARDING_SHOW_DELAY_MS);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function positionOnboardingOverlay(rect) {
  const overlay = document.getElementById("coachmark-overlay");
  const spotlight = document.getElementById("coachmark-spotlight");
  const tooltip = document.getElementById("coachmark-tooltip");
  if (!overlay || !spotlight || !tooltip) return;
  const config = ONBOARDING_CONFIG[onboarding?.step];
  const anchorRect = getOnboardingAnchorRect(rect);
  const viewport = getViewportBounds();

  const padding = 10;
  overlay.style.left = `${viewport.left}px`;
  overlay.style.top = `${viewport.top}px`;
  overlay.style.width = `${viewport.width}px`;
  overlay.style.height = `${viewport.height}px`;

  const left = Math.max(8, rect.left - padding);
  const top = Math.max(8, rect.top - padding);
  const width = Math.min(
    viewport.width - left - 8,
    rect.right - rect.left + padding * 2,
  );
  const height = Math.min(
    viewport.height - top - 8,
    rect.bottom - rect.top + padding * 2,
  );

  spotlight.style.left = `${left}px`;
  spotlight.style.top = `${top}px`;
  spotlight.style.width = `${Math.max(0, width)}px`;
  spotlight.style.height = `${Math.max(0, height)}px`;
  spotlight.style.borderRadius =
    onboarding?.step === ONBOARDING_STEP_PULL ? "999px" : "20px";

  const tooltipWidth = Math.min(280, viewport.width - 32);
  const tooltipHeight = tooltip.getBoundingClientRect().height;
  const targetCenter =
    anchorRect.left + (anchorRect.right - anchorRect.left) / 2;
  const tooltipLeft = clamp(
    targetCenter - tooltipWidth / 2,
    16,
    viewport.width - tooltipWidth - 16,
  );
  const preferredBelow = anchorRect.bottom + 16;
  const preferredAbove = anchorRect.top - tooltipHeight - 12;
  const tooltipTop =
    config?.tooltipPlacement === "above"
      ? preferredAbove >= 16
        ? preferredAbove
        : Math.min(preferredBelow, viewport.height - tooltipHeight - 16)
      : preferredBelow + tooltipHeight <= viewport.height - 16
        ? preferredBelow
        : Math.max(16, preferredAbove);

  tooltip.style.width = `${tooltipWidth}px`;
  tooltip.style.left = `${tooltipLeft}px`;
  tooltip.style.top = `${tooltipTop}px`;
  tooltip.style.visibility = "";
}

function refreshOnboarding() {
  if (!isOnboardingActive() || isOverlayBlocked()) {
    clearOnboardingShowTimer();
    hideOnboardingOverlay();
    return;
  }

  syncExerciseOnboardingState();
  if (!isOnboardingActive()) {
    hideOnboardingOverlay();
    return;
  }

  const config = ONBOARDING_CONFIG[onboarding.step];
  const overlay = document.getElementById("coachmark-overlay");
  const tooltip = document.getElementById("coachmark-tooltip");
  if (!config || !overlay || !tooltip) {
    clearOnboardingShowTimer();
    hideOnboardingOverlay();
    return;
  }

  const nodes = getOnboardingTargetNodes();
  if (nodes.length === 0) {
    clearOnboardingShowTimer();
    hideOnboardingOverlay();
    return;
  }

  const displayKey = getOnboardingDisplayKey();
  if (displayKey && onboardingShownKey !== displayKey) {
    hideOnboardingOverlay();
    scheduleOnboardingDisplay(displayKey);
    return;
  }

  clearOnboardingShowTimer();
  clearOnboardingTargets();
  onboardingTargetNodes = nodes;
  onboardingTargetNodes.forEach((node) =>
    node.classList.add("coachmark-target-active"),
  );

  document.getElementById("coachmark-step").textContent = config.label;
  document.getElementById("coachmark-copy").textContent = config.copy;
  overlay.classList.add("show");
  overlay.setAttribute("aria-hidden", "false");
  tooltip.style.visibility = "hidden";
  positionOnboardingOverlay(getOnboardingTargetRect(nodes));
}

export function queueOnboardingRefresh() {
  if (onboardingRefreshFrame) cancelAnimationFrame(onboardingRefreshFrame);
  onboardingRefreshFrame = requestAnimationFrame(() => {
    onboardingRefreshFrame = 0;
    refreshOnboarding();
  });
}
