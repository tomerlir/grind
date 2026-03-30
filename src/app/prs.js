import { storageGet, storageSet } from "../lib/storage.js";
import { getWeekKey } from "./week-store.js";

export function parseWeight(w) {
  if (!w || w === "—" || (typeof w === "string" && w.toLowerCase() === "bw")) {
    return null;
  }
  const n = parseFloat(w);
  return Number.isNaN(n) ? null : n;
}

export function fmtKg(n) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export function formatWeightLabel(value) {
  return parseWeight(value) !== null ? `${value}kg` : "BW";
}

function todayFormatted() {
  return new Date().toLocaleDateString("en-GB");
}

export function loadPR(exerciseName) {
  return storageGet("grind:pr", {})[exerciseName] ?? {};
}

export function savePR(exerciseName, data) {
  const all = storageGet("grind:pr", {});
  all[exerciseName] = data;
  storageSet("grind:pr", all);
}

export function saveLastWeight(exerciseName, sets) {
  const numericWeights = sets
    .map((set) => parseWeight(set.weight))
    .filter((weight) => weight !== null);
  if (numericWeights.length === 0) return;
  const max = Math.max(...numericWeights);
  const all = storageGet("grind:pr", {});
  if (!all[exerciseName]) all[exerciseName] = {};
  all[exerciseName].lastWeight = String(max);
  storageSet("grind:pr", all);
}

export function checkAndUpdatePR(exerciseName, sets) {
  const numericWeights = sets
    .map((set) => parseWeight(set.weight))
    .filter((weight) => weight !== null);
  if (numericWeights.length === 0) return {};

  const maxSetWeight = Math.max(...numericWeights);
  const sessionVolume = sets.reduce(
    (sum, set) => sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
    0,
  );

  const history = loadPR(exerciseName);
  const prs = {};

  if (maxSetWeight > (history.maxWeight || 0)) {
    prs.weight = { prev: history.maxWeight || 0, new: maxSetWeight };
    history.maxWeight = maxSetWeight;
  }
  if (sessionVolume > (history.maxVolume || 0)) {
    prs.volume = { prev: history.maxVolume || 0, new: sessionVolume };
    history.maxVolume = sessionVolume;
  }

  history.lastWeight = String(maxSetWeight);
  history.sessions = [
    ...(history.sessions || []),
    {
      date: todayFormatted(),
      weekKey: getWeekKey(),
      maxSetWeight,
      sessionVolume,
    },
  ].slice(-52);

  savePR(exerciseName, history);
  return prs;
}

export function getOverloadNudge(exerciseName) {
  const history = loadPR(exerciseName);
  const recent = (history.sessions || []).slice(-3);
  if (recent.length < 3) return null;

  if (history.lastNudgeDate) {
    const daysSince = (Date.now() - new Date(history.lastNudgeDate)) / 86400000;
    if (daysSince < 21) return null;
  }

  const weights = recent.map((session) => session.maxSetWeight).filter(Boolean);
  if (weights.length < 3) return null;
  if (!weights.every((weight) => weight === weights[0])) return null;

  return { currentWeight: weights[0], suggestedWeight: weights[0] + 2.5 };
}

export function markNudgeShown(exerciseName) {
  const history = loadPR(exerciseName);
  history.lastNudgeDate = new Date().toISOString();
  savePR(exerciseName, history);
}

export function getLastWeight(exerciseName) {
  return loadPR(exerciseName).lastWeight ?? null;
}
