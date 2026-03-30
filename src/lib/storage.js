export function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[GRIND] localStorage write failed:", key, e.name);
  }
}

export function storageDel(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
