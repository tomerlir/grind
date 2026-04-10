/**
 * GRIND — Mock History Seed Script
 *
 * Paste this into the browser DevTools console while the app is open.
 * It writes 12 weeks of realistic training history (3 sessions/week, A/B/C rotation)
 * with progressive overload so the exercise progress graphs have data to render.
 *
 * WARNING: This REPLACES any existing grind:history data.
 *
 * To clear mock data afterwards:
 *   localStorage.removeItem('grind:history'); location.reload();
 */

(function seedGrindHistory() {
  const DAYS_ORDER = ['A', 'B', 'C'];

  const DAY_EXERCISES = {
    A: [
      { name: 'Bulgarian Split Squat', category: 'LOWER · QUAD', bodyweight: false, baseWeight: 20 },
      { name: 'Dumbbell Floor Press', category: 'PUSH · HORIZONTAL', bodyweight: false, baseWeight: 24 },
      { name: 'Pull-Up', category: 'PULL · VERTICAL', bodyweight: true, baseReps: 6 },
      { name: 'Dumbbell Romanian Deadlift', category: 'LOWER · HINGE', bodyweight: false, baseWeight: 30 },
      { name: 'Single-Arm Dumbbell Row', category: 'PULL · HORIZONTAL', bodyweight: false, baseWeight: 22 },
      { name: 'Hanging Knee Raise', category: 'CORE', bodyweight: true, baseReps: 12 },
      { name: 'Single-Leg Calf Raise', category: 'CALVES', bodyweight: true, baseReps: 12 },
    ],
    B: [
      { name: 'Dumbbell Goblet Squat', category: 'LOWER · QUAD', bodyweight: false, baseWeight: 24 },
      { name: 'Dumbbell Overhead Press', category: 'PUSH · VERTICAL', bodyweight: false, baseWeight: 16 },
      { name: 'Dumbbell Incline Row', category: 'PULL · HORIZONTAL', bodyweight: false, baseWeight: 20 },
      { name: 'Single-Leg Romanian Deadlift', category: 'LOWER · HINGE', bodyweight: false, baseWeight: 18 },
      { name: 'Dumbbell Floor Fly', category: 'PUSH · HORIZONTAL', bodyweight: false, baseWeight: 14 },
      { name: 'Dumbbell High Pull', category: 'ACCESSORY', bodyweight: false, baseWeight: 16 },
      { name: 'Dumbbell Hip Thrust', category: 'LOWER · GLUTE', bodyweight: false, baseWeight: 32 },
      { name: 'Plank Hold', category: 'CORE', bodyweight: true, baseReps: 30 },
    ],
    C: [
      { name: 'Dumbbell Alternating Lunges', category: 'LOWER · QUAD', bodyweight: false, baseWeight: 16 },
      { name: 'Chin-Up', category: 'PULL · VERTICAL', bodyweight: true, baseReps: 5 },
      { name: 'Deficit Push-Up', category: 'PUSH · HORIZONTAL', bodyweight: true, baseReps: 8 },
      { name: 'Single-Leg Hip Thrust', category: 'LOWER · GLUTE', bodyweight: false, baseWeight: 20 },
      { name: 'Arnold Press', category: 'PUSH · VERTICAL', bodyweight: false, baseWeight: 14 },
      { name: 'Diamond Push-Up', category: 'ARMS · TRICEP', bodyweight: true, baseReps: 10 },
      { name: 'Supinating Dumbbell Curl', category: 'ARMS · BICEP', bodyweight: false, baseWeight: 12 },
      { name: 'Single-Leg Calf Raise', category: 'CALVES', bodyweight: true, baseReps: 14 },
    ],
  };

  const WEEKS = 12;
  const SESSIONS_PER_WEEK = 3;

  // Monday of each past week, starting WEEKS ago
  function getMondayOf(weeksAgo) {
    const now = new Date();
    const dow = now.getDay();
    const offsetToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(now);
    mon.setDate(now.getDate() + offsetToMon - weeksAgo * 7);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  function weekKey(monday) {
    return monday.toISOString().slice(0, 10);
  }

  // Training days within a week: Mon, Wed, Fri (indices 0, 2, 4 from Monday)
  const SESSION_OFFSETS = [0, 2, 4];

  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatDate(d) {
    return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  }

  // Slight progression: weight increases ~2.5kg every 2 weeks, reps drift ±1
  function progressedWeight(base, sessionIndex) {
    const bump = Math.floor(sessionIndex / 6) * 2.5;
    return base + bump;
  }

  function progressedReps(base, sessionIndex) {
    return base + Math.floor(sessionIndex / 4);
  }

  const history = [];
  let globalSessionIndex = 0;

  for (let w = WEEKS - 1; w >= 0; w--) {
    const monday = getMondayOf(w);
    const wk = weekKey(monday);

    for (let s = 0; s < SESSIONS_PER_WEEK; s++) {
      const dayTemplate = DAYS_ORDER[globalSessionIndex % 3];
      const sessionDate = new Date(monday);
      sessionDate.setDate(monday.getDate() + SESSION_OFFSETS[s]);

      const exercises = DAY_EXERCISES[dayTemplate];
      const entries = exercises.map((ex) => {
        const numSets = 3;
        const sets = [];

        for (let i = 0; i < numSets; i++) {
          if (ex.bodyweight) {
            const reps = progressedReps(ex.baseReps, globalSessionIndex);
            sets.push({ weight: 'BW', reps: String(reps + (i === 1 ? 1 : 0)) });
          } else {
            const weight = progressedWeight(ex.baseWeight, globalSessionIndex);
            const repsBase = 8 + (i === 0 ? 2 : 0); // first set slightly higher reps
            sets.push({ weight: String(weight), reps: String(repsBase) });
          }
        }

        return {
          exerciseName: ex.name,
          categoryLabel: ex.category,
          sets,
          prs: {},
        };
      });

      const totalSets = entries.reduce((sum, e) => sum + e.sets.length, 0);
      const timestamp = new Date(sessionDate);
      timestamp.setHours(7 + Math.floor(Math.random() * 4), 0, 0, 0);

      history.push({
        templateId: dayTemplate,
        weekKey: wk,
        date: formatDate(sessionDate),
        timestamp: timestamp.toISOString(),
        durationMinutes: 45 + Math.floor(Math.random() * 20),
        totalSets,
        entries,
      });

      globalSessionIndex++;
    }
  }

  // Build grind:pr from history (mirrors rebuildPRStateFromHistory)
  const pr = {};
  history.forEach((session) => {
    (session.entries || []).forEach((entry) => {
      const numericWeights = entry.sets
        .map((s) => parseFloat(s.weight))
        .filter((w) => Number.isFinite(w));
      if (numericWeights.length === 0) return;

      const maxSetWeight = Math.max(...numericWeights);
      const sessionVolume = entry.sets.reduce(
        (sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0
      );
      const name = entry.exerciseName;
      if (!pr[name]) pr[name] = { maxWeight: 0, maxVolume: 0, sessions: [] };
      pr[name].maxWeight = Math.max(pr[name].maxWeight, maxSetWeight);
      pr[name].maxVolume = Math.max(pr[name].maxVolume, sessionVolume);
      pr[name].lastWeight = String(maxSetWeight);
      pr[name].sessions.push({ date: session.date, weekKey: session.weekKey, maxSetWeight, sessionVolume });
    });
  });
  // Trim sessions to last 52 (matches app logic)
  Object.values(pr).forEach((data) => { data.sessions = data.sessions.slice(-52); });

  // Arm the nudge: set last 3 sessions of Dumbbell Floor Press to same weight
  const NUDGE_EXERCISE = 'Dumbbell Floor Press';
  if (pr[NUDGE_EXERCISE]) {
    const w = pr[NUDGE_EXERCISE].maxWeight;
    pr[NUDGE_EXERCISE].sessions.slice(-3).forEach((s) => { s.maxSetWeight = w; });
    delete pr[NUDGE_EXERCISE].lastNudgeDate;
    console.log(`[GRIND] Nudge armed for "${NUDGE_EXERCISE}" at ${w}kg`);
  }

  localStorage.setItem('grind:history', JSON.stringify(history));
  localStorage.setItem('grind:pr', JSON.stringify(pr));
  console.log(`[GRIND] Seeded ${history.length} sessions across ${WEEKS} weeks. Reloading...`);
  location.reload();
})();
