import { DAYS } from "../data/workouts.js";
import { storageGet, storageSet } from "../lib/storage.js";
import {
  DAY_TEMPLATES,
  getHistoryEntryWeekday,
  getStoredWeekKeys,
  loadWeek,
  saveWeek,
} from "./week-store.js";
import { formatWeightLabel, parseWeight } from "./prs.js";

let runtime = {
  renderDayPicker: () => {},
  showSyncBar: () => {},
};

export function initHistory(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function loadHistory() {
  return storageGet("grind:history", []);
}

export function saveHistory(entries) {
  storageSet("grind:history", entries);
}

export function appendHistory(entry) {
  const history = loadHistory();
  history.push(entry);
  saveHistory(history);
}

export function getLatestCompletedExerciseEntry(
  exerciseName,
  historyEntries = loadHistory(),
) {
  for (
    let historyIndex = historyEntries.length - 1;
    historyIndex >= 0;
    historyIndex -= 1
  ) {
    const sessionEntry = historyEntries[historyIndex];
    const entries = sessionEntry?.entries || [];

    for (let entryIndex = entries.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const exerciseEntry = entries[entryIndex];
      if (exerciseEntry?.exerciseName !== exerciseName) continue;
      return {
        ...exerciseEntry,
        sets: (exerciseEntry.sets || []).map((set) => ({ ...set })),
      };
    }
  }

  return null;
}

export function getLatestCompletedTemplateEntry(
  templateId,
  historyEntries = loadHistory(),
) {
  for (
    let historyIndex = historyEntries.length - 1;
    historyIndex >= 0;
    historyIndex -= 1
  ) {
    const sessionEntry = historyEntries[historyIndex];
    if (sessionEntry?.templateId === templateId) return sessionEntry;
  }

  return null;
}

export function getExerciseProgressSeries(
  exerciseName,
  isBodyweight = false,
  historyEntries = loadHistory(),
) {
  return historyEntries
    .flatMap((sessionEntry) =>
      (sessionEntry?.entries || [])
        .filter((exerciseEntry) => exerciseEntry?.exerciseName === exerciseName)
        .map((exerciseEntry) => {
          const sets = exerciseEntry.sets || [];
          let value;

          if (isBodyweight) {
            // BW exercises: total reps across all sets
            value = sets.reduce(
              (sum, set) => sum + (parseInt(set.reps, 10) || 0),
              0,
            );
          } else {
            // Weighted exercises: best estimated 1RM (Epley: w × (1 + r/30))
            // captures both weight AND rep progression in one number.
            // Falls back to reps when weight is BW/unlogged.
            const e1RMs = sets
              .map((set) => {
                const w = parseWeight(set.weight);
                const r = parseInt(set.reps, 10);
                if (w !== null && Number.isFinite(w)) {
                  return Number.isFinite(r) && r > 0 ? w * (1 + r / 30) : w;
                }
                return Number.isFinite(r) && r > 0 ? r : null;
              })
              .filter((v) => v !== null);

            value = e1RMs.length > 0 ? Math.max(...e1RMs) : NaN;
          }

          return Number.isFinite(value) && value > 0
            ? {
                value,
                date: sessionEntry.date,
                timestamp: sessionEntry.timestamp ?? null,
              }
            : null;
        }),
    )
    .filter(Boolean);
}

let historyOffset = 30;

export function rebuildPRStateFromHistory(historyEntries = loadHistory()) {
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
        (sum, set) => sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
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

export function rebuildWeekCompletionFromHistory(historyEntries = loadHistory()) {
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

export function deleteHistoryEntry(historyIndex) {
  const history = loadHistory();
  if (historyIndex < 0 || historyIndex >= history.length) return;

  history.splice(historyIndex, 1);
  saveHistory(history);
  rebuildPRStateFromHistory(history);
  rebuildWeekCompletionFromHistory(history);
  historyOffset = Math.min(historyOffset, Math.max(30, history.length));
  renderHistory();
  runtime.renderDayPicker();
  runtime.showSyncBar("History entry deleted", "success");
}

export function renderHistory({ resetOffset = false } = {}) {
  if (resetOffset) historyOffset = 30;
  const all = loadHistory();
  const list = document.getElementById("history-list");
  const moreBtn = document.getElementById("history-more-btn");
  if (!list || !moreBtn) return;

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
    .reverse();
  list.innerHTML = visible
    .map(({ session, index }) => renderHistoryCard(session, index))
    .join("");
  moreBtn.style.display = all.length > historyOffset ? "block" : "none";
}

export function showMoreHistory() {
  historyOffset += 30;
  renderHistory();
}

function renderHistoryCard(sessionEntry, historyIndex) {
  const day = DAYS[sessionEntry.templateId];
  const dayName = day?.name ?? `Day ${sessionEntry.templateId}`;
  const entries = sessionEntry.entries ?? [];

  const sessionVolume = entries.reduce(
    (total, entry) =>
      total +
      entry.sets.reduce(
        (sum, set) => sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      ),
    0,
  );

  const prEntries = entries.filter((entry) => Object.keys(entry.prs || {}).length > 0);
  const prLine =
    prEntries.length > 0
      ? `<div class="history-card-prs">✦ PRs: ${prEntries.map((entry) => entry.exerciseName).join(", ")}</div>`
      : "";

  const volStat =
    sessionVolume > 0 ? ` · ${sessionVolume.toLocaleString()}kg vol` : "";

  const detail = entries
    .map((entry) => {
      const exVolume = entry.sets.reduce(
        (sum, set) => sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      );
      const hasPR = Object.keys(entry.prs || {}).length > 0;

      const chips = entry.sets
        .map(
          (set, setIndex) =>
            `<span class="history-set-chip">${setIndex + 1}: ${formatWeightLabel(set.weight)} × ${set.reps}</span>`,
        )
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
          <span class="history-entry-name">${entry.exerciseName}</span>
          <span class="history-entry-cat">${entry.categoryLabel}</span>
        </div>
        <div class="history-entry-sets">${chips}</div>
        ${volLine}
      </div>`;
    })
    .join("");

  return `
    <div class="history-card fadein" data-history-idx="${historyIndex}">
      <div class="history-card-meta">${sessionEntry.date} · ${sessionEntry.durationMinutes} min</div>
      <div class="history-card-day">${dayName}</div>
      <div class="history-card-stats">${entries.length} exercises · ${sessionEntry.totalSets} sets${volStat}</div>
      ${prLine}
      <div class="history-expand-hint">details</div>
      <div class="history-card-detail">
        ${detail}
        <button class="history-delete-btn" type="button" data-history-delete="${historyIndex}">DELETE</button>
      </div>
    </div>`;
}
