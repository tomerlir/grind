import { registerSW } from "virtual:pwa-register";

import { DEFAULT_CONFIG } from "../config.js";
import { DAYS } from "../data/workouts.js";
import {
  ONBOARDING_STEP_EXERCISE_LOG,
  ONBOARDING_STEP_START,
} from "./onboarding.js";
import { fmtKg, markNudgeShown } from "./prs.js";
import { getLatestCompletedTemplateEntry, loadHistory } from "./history.js";
import { SPIN_STATE_READY } from "./spin.js";

let runtime = {
  queueOnboardingRefresh: () => {},
  cancelPullGesture: () => {},
  stopRest: () => {},
  closeExitSessionModal: () => {},
  clearSession: () => {},
  loadSession: () => null,
  setSession: () => {},
  pickAllExercises: () => {},
  getWeekKey: () => "",
  loadWeek: () => ({ completed: [], completedByTemplate: {} }),
  getOrCreateDayAssignment: () => [],
  formatWeekdayLabel: () => "",
  getSessionSpinState: () => SPIN_STATE_READY,
  getSession: () => null,
  renderSlotMachine: () => {},
  resumeCurrentExercise: () => {},
};

let applyAppUpdateFn = null;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function initAppShell(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => screen.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  window.scrollTo(0, 0);
  runtime.queueOnboardingRefresh();
}

export function renderAppVersionBadge() {
  const badge = document.getElementById("app-version-badge");
  if (!badge) return;
  badge.textContent = String(DEFAULT_CONFIG.versionLabel).trim().toUpperCase();
}

function openUpdateAppModal(applyUpdateFn) {
  applyAppUpdateFn = applyUpdateFn;
  const modal = document.getElementById("update-app-modal");
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  runtime.queueOnboardingRefresh();
}

export function closeUpdateAppModal() {
  applyAppUpdateFn = null;
  const modal = document.getElementById("update-app-modal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  runtime.queueOnboardingRefresh();
}

export function applyAppUpdate() {
  if (!applyAppUpdateFn) {
    closeUpdateAppModal();
    return;
  }

  void Promise.resolve(applyAppUpdateFn())
    .catch((error) => {
      console.warn("[GRIND] app update failed:", error);
    })
    .finally(() => {
      closeUpdateAppModal();
    });
}

export function registerAppUpdatePrompt() {
  if (!("serviceWorker" in navigator)) return;

  let updateSW = () => Promise.resolve();
  updateSW = registerSW({
    onNeedRefresh() {
      openUpdateAppModal(() => updateSW(true));
    },
    onOfflineReady() {
      console.log("[GRIND] App ready to work offline.");
    },
    onRegisteredSW(swUrl, registration) {
      console.log("[GRIND] SW registered:", swUrl);
      if (!registration) return;

      window.setInterval(
        () => {
          if (!navigator.onLine) return;
          void registration.update();
        },
        60 * 60 * 1000,
      );
    },
    onRegisterError(error) {
      console.warn("[GRIND] SW registration failed:", error);
    },
  });
}

export function showPROverlay(prs, onDone) {
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
  runtime.queueOnboardingRefresh();

  const handler = () => {
    overlay.classList.remove("show");
    runtime.queueOnboardingRefresh();
    onDone();
  };

  btn.replaceWith(btn.cloneNode(true));
  document
    .getElementById("pr-overlay-continue")
    .addEventListener("click", handler, { once: true });
}

export function goHome() {
  runtime.cancelPullGesture();
  runtime.stopRest();
  runtime.closeExitSessionModal();
  renderDayPicker();
  showScreen("screen-day-picker");
}

export function discardSessionAndGoHome() {
  runtime.cancelPullGesture();
  runtime.stopRest();
  runtime.clearSession();
  runtime.closeExitSessionModal();
  renderDayPicker();
  showScreen("screen-day-picker");
}

export function renderDayPicker() {
  renderDayPickerCards();
  runtime.queueOnboardingRefresh();
}

function getHistoryEntryDate(entry) {
  if (entry?.timestamp) {
    const timestampDate = new Date(entry.timestamp);
    if (!Number.isNaN(timestampDate.getTime())) return timestampDate;
  }

  if (typeof entry?.date === "string") {
    const match = entry.date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      const parsedDate = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    }
  }

  return null;
}

function formatDaysAgoLabel(entry) {
  const completedAt = getHistoryEntryDate(entry);
  if (!completedAt) return "-";

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfCompletedDay = new Date(
    completedAt.getFullYear(),
    completedAt.getMonth(),
    completedAt.getDate(),
  );
  const dayDiff = Math.max(
    0,
    Math.floor(
      (startOfToday.getTime() - startOfCompletedDay.getTime()) / DAY_IN_MS,
    ),
  );

  if (dayDiff === 0) return "today";
  if (dayDiff === 1) return "yesterday";
  return `${dayDiff}d ago`;
}

function getActiveHomeSession() {
  const saved = runtime.loadSession();
  return saved?.status === "in_progress" ? saved : null;
}

function renderDayPickerCards() {
  const weekKey = runtime.getWeekKey();
  const week = runtime.loadWeek(weekKey);
  const templateChoices = runtime.getOrCreateDayAssignment(weekKey);
  const historyEntries = loadHistory();
  const completed = week.completed;
  const activeSession = getActiveHomeSession();
  const container = document.getElementById("day-picker-cards");
  let markedOnboardingTarget = false;
  if (!container) return;

  container.innerHTML = templateChoices
    .map((templateId) => {
      const isDone = completed.includes(templateId);
      const isActiveSession = activeSession?.templateId === templateId;
      const isLocked = Boolean(activeSession) && !isDone;
      const completedWeekday = runtime.formatWeekdayLabel(
        week.completedByTemplate?.[templateId],
      );
      const latestCompletedEntry = getLatestCompletedTemplateEntry(
        templateId,
        historyEntries,
      );
      const lastWorkoutLabel = formatDaysAgoLabel(latestCompletedEntry);
      let ctaLabel = "START SESSION ▸";

      if (isDone) {
        ctaLabel = `COMPLETED ON ${(completedWeekday || "THIS WEEK").toUpperCase()}`;
      } else if (isActiveSession) {
        ctaLabel = "CLICK TO RESUME";
      } else if (isLocked) {
        ctaLabel = "FINISH OR DISCARD CURRENT SESSION";
      }

      const stateClass = isDone
        ? "completed card--completed"
        : isActiveSession
          ? "active-session card--active"
          : isLocked
            ? "locked card--muted"
            : "";
      const onboardingTarget =
        !markedOnboardingTarget && !isDone && !isActiveSession && !isLocked
          ? ' data-onboarding-target="home-card"'
          : "";
      if (onboardingTarget) markedOnboardingTarget = true;
      const lastWorkoutMarkup = `<div class="title-block__meta day-card-last-done">${lastWorkoutLabel}</div>`;

      return `
      <div class="day-picker-card card fadein ${stateClass}"
           data-day="${templateId}"${onboardingTarget}>
        <div class="day-card-top">
          <div class="day-card-letter">Full-body ${templateId}</div>
        </div>
        <div class="title-block">
          ${lastWorkoutMarkup}
          <div class="day-card-cta title-block__subtitle">${ctaLabel}</div>
        </div>
      </div>`;
    })
    .join("");

  runtime.queueOnboardingRefresh();
}

export function resumeSession() {
  const session = runtime.loadSession();
  runtime.setSession(session);
  if (!session) return;

  if (!session.pickedExercises?.length) runtime.pickAllExercises();

  if (session.currentExercise) {
    runtime.resumeCurrentExercise();
  } else {
    const spinState = runtime.getSessionSpinState();
    runtime.renderSlotMachine(spinState !== SPIN_STATE_READY);
    showScreen("screen-slot-machine");
  }
}

export async function renderDoneScreen({
  templateId,
  totalSets,
  duration,
  sessionPRs,
  sessionNudges,
}) {
  const day = DAYS[templateId];
  document.getElementById("done-sub").textContent =
    `${day?.name ?? `Day ${templateId}`} complete`;

  const audioPromise = runtime.audioEngine
    ?.play("workout-complete")
    .catch((error) => {
      console.error("Failed to play workout-complete sound:", error);
    });

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

  const prsBlock = document.getElementById("done-prs");
  if (sessionPRs?.length > 0) {
    document.getElementById("done-prs-list").innerHTML = sessionPRs
      .map(
        (pr) =>
          `<div class="done-pr-item">${pr.exerciseName} — ${
            pr.type === "weight"
              ? `+${fmtKg(pr.new - pr.prev)}kg max weight`
              : "volume PR"
          }</div>`,
      )
      .join("");
    prsBlock.style.display = "block";
  } else {
    prsBlock.style.display = "none";
  }

  const nudgesBlock = document.getElementById("done-nudges");
  if (sessionNudges?.length > 0) {
    document.getElementById("done-nudges-list").innerHTML = sessionNudges
      .map(
        (entry) =>
          `<div class="done-pr-item">${entry.exerciseName} — Last 3× at ${entry.nudge.currentWeight}kg → try ${entry.nudge.suggestedWeight}kg?</div>`,
      )
      .join("");
    nudgesBlock.style.display = "block";
    sessionNudges.forEach((entry) => markNudgeShown(entry.exerciseName));
  } else {
    nudgesBlock.style.display = "none";
  }

  document.getElementById("done-sync").textContent = "";
  document.getElementById("done-sync").className = "done-sync";

  await audioPromise;
}

export function fireConfetti() {
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
  const DURATION = 3200;

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
    for (const particle of particles) {
      particle.vy += GRAVITY;
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.rotSpeed;

      const fade =
        elapsed < DURATION * 0.55
          ? 1
          : Math.max(0, 1 - (elapsed - DURATION * 0.55) / (DURATION * 0.45));
      if (particle.y < canvas.height + 30) alive = true;

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      if (particle.circle) {
        ctx.beginPath();
        ctx.arc(0, 0, particle.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-particle.w / 2, -particle.h / 2, particle.w, particle.h);
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
