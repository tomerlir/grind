import { DEFAULT_CONFIG } from "../config.js";
import { storageGet, storageSet } from "../lib/storage.js";
import { formatWeightLabel, parseWeight } from "./prs.js";

let runtime = {
  getSession: () => null,
};

export function initSync(deps = {}) {
  runtime = {
    ...runtime,
    ...deps,
  };
}

export function showSyncBar(msg, type = "") {
  const bar = document.getElementById("sync-bar");
  if (!bar) return;
  bar.textContent = msg;
  bar.className = `sync-bar show ${type}`;
  clearTimeout(showSyncBar._timer);
  showSyncBar._timer = setTimeout(() => bar.classList.remove("show"), 3000);
}

export function buildSyncPayload(duration, totalSets) {
  const session = runtime.getSession();
  return {
    date: new Date().toLocaleDateString("en-GB"),
    day: session.templateId,
    duration_minutes: duration,
    total_sets: totalSets,
    exercises: session.entries.map((entry) => ({
      exercise: entry.exerciseName,
      category: entry.categoryLabel,
      sets: entry.sets
        .map(
          (set, index) =>
            `Set ${index + 1}: ${formatWeightLabel(set.weight)} × ${set.reps}`,
        )
        .join(" | "),
      session_volume_kg: entry.sets.reduce(
        (sum, set) =>
          sum + (parseWeight(set.weight) ?? 0) * (parseInt(set.reps) || 0),
        0,
      ),
      pr_weight: !!entry.prs?.weight,
      pr_volume: !!entry.prs?.volume,
      timestamp: entry.timestamp,
    })),
  };
}

export async function syncToSheets(payload) {
  const syncEl = document.getElementById("done-sync");

  if (
    DEFAULT_CONFIG.dryRun ||
    !DEFAULT_CONFIG.webhookUrl ||
    DEFAULT_CONFIG.webhookUrl.includes("YOUR_N8N")
  ) {
    if (syncEl) {
      syncEl.textContent = "DRY RUN — set webhookUrl in DEFAULT_CONFIG";
      syncEl.className = "done-sync success";
    }
    return;
  }

  if (syncEl) {
    syncEl.textContent = "SYNCING...";
    syncEl.className = "done-sync syncing";
  }

  try {
    const res = await fetch(DEFAULT_CONFIG.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (syncEl) {
      syncEl.textContent = "SYNCED ✓";
      syncEl.className = "done-sync success";
    }
  } catch (error) {
    console.warn("[GRIND] sync failed:", error.message);
    if (syncEl) {
      syncEl.textContent = "SYNC FAILED — tap to retry";
      syncEl.className = "done-sync error";
      syncEl.onclick = () => syncToSheets(payload);
    }
    enqueueSyncPayload(payload);
  }
}

export function enqueueSyncPayload(payload) {
  const queue = storageGet("grind:sync-queue", []);
  queue.push({ payload, failedAt: new Date().toISOString() });
  storageSet("grind:sync-queue", queue);
}

export async function flushSyncQueue() {
  const queue = storageGet("grind:sync-queue", []);
  if (queue.length === 0) return;
  if (!navigator.onLine) return;
  if (
    DEFAULT_CONFIG.dryRun ||
    !DEFAULT_CONFIG.webhookUrl ||
    DEFAULT_CONFIG.webhookUrl.includes("YOUR_N8N")
  ) {
    return;
  }

  const remaining = [];
  for (const item of queue) {
    try {
      const res = await fetch(DEFAULT_CONFIG.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showSyncBar(
        `Flushed queued session from ${item.failedAt.slice(0, 10)}`,
        "success",
      );
    } catch {
      remaining.push(item);
    }
  }

  storageSet("grind:sync-queue", remaining);
}
