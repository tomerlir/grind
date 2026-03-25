import { Howl, Howler } from "howler";

import cardTapUrl from "./assets/sounds/card-tap.mp3";
import finalLockUrl from "./assets/sounds/final-lock.mp3";
import levelUpUrl from "./assets/sounds/level-up.mp3";
import navigateBackUrl from "./assets/sounds/navigate-back.mp3";
import pullStartUrl from "./assets/sounds/pull-start.mp3";
import reelLockUrl from "./assets/sounds/reel-lock.mp3";
import restTimerEndUrl from "./assets/sounds/rest-timer-end.mp3";
import setLoggedUrl from "./assets/sounds/set-logged.mp3";
import spinningLoopUrl from "./assets/sounds/spinning-loop.mp3";
import workoutCompleteUrl from "./assets/sounds/workout-complete.mp3";

const SOUND_URLS = {
  "pull-start": pullStartUrl,
  "spinning-loop": spinningLoopUrl,
  "reel-lock": reelLockUrl,
  "final-lock": finalLockUrl,
  "set-logged": setLoggedUrl,
  "level-up": levelUpUrl,
  "workout-complete": workoutCompleteUrl,
  "card-tap": cardTapUrl,
  "navigate-back": navigateBackUrl,
  "rest-timer-end": restTimerEndUrl,
};

const PRELOAD_ORDER = [
  "card-tap",
  "navigate-back",
  "pull-start",
  "spinning-loop",
  "reel-lock",
  "final-lock",
  "set-logged",
  "level-up",
  "workout-complete",
  "rest-timer-end",
];

const DEBUG_ENABLED =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("audio-debug");

const isSafari =
  typeof navigator !== "undefined" &&
  /Safari/i.test(navigator.userAgent) &&
  !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

const isIOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const useHtml5Audio = isSafari || isIOS;

const MAX_DEBUG_ENTRIES = 40;
const howls = Object.create(null);
const loadPromises = Object.create(null);
const debugEntries = [];

let preloadPromise = null;
let unlockPromise = null;
let spinningHandle = null;
let userActivated = false;
let contextObserverAttached = false;
let iosBridgeUnlocked = false;
let iosBridgePromise = null;
let silenceUrl = null;
let debugPanel = null;

if (typeof Howler !== "undefined") {
  Howler.autoUnlock = true;
  Howler.autoSuspend = false;
  Howler.html5PoolSize = 12;
  Howler.mute(false);
  Howler.volume(1);
}

function serializeError(err) {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  return String(err);
}

function pushDebug(type, details = {}) {
  const entry = {
    time: new Date().toISOString().slice(11, 19),
    type,
    details,
  };

  debugEntries.push(entry);
  if (debugEntries.length > MAX_DEBUG_ENTRIES) {
    debugEntries.shift();
  }

  if (DEBUG_ENABLED) {
    console.info("[AudioEngine]", type, details);
    renderDebugPanel();
  }
}

function getHowlerContext() {
  return typeof Howler !== "undefined" ? Howler.ctx ?? null : null;
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function buildSilenceUrl() {
  if (silenceUrl) {
    return silenceUrl;
  }

  const sampleRate = 8000;
  const durationSeconds = 0.15;
  const channelCount = 1;
  const bytesPerSample = 2;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  silenceUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return silenceUrl;
}

function ensureContextObserver() {
  const ctx = getHowlerContext();
  if (!ctx || contextObserverAttached) {
    return;
  }

  contextObserverAttached = true;
  ctx.onstatechange = () => {
    pushDebug("context-state", { state: ctx.state });
  };
}

function ensureHowl(name) {
  if (howls[name]) {
    return howls[name];
  }

  const soundUrl = SOUND_URLS[name];
  if (!soundUrl) {
    throw new Error(`Unknown sound "${name}"`);
  }

  const howl = new Howl({
    src: [soundUrl],
    format: ["mp3"],
    preload: false,
    html5: useHtml5Audio,
    onload: () => {
      pushDebug("load", { name });
    },
    onloaderror: (_id, err) => {
      pushDebug("load-error", { name, error: serializeError(err) });
    },
    onplay: (id) => {
      pushDebug("play", { name, id });
    },
    onplayerror: (id, err) => {
      pushDebug("play-error", { name, id, error: serializeError(err) });
    },
    onend: (id) => {
      pushDebug("end", { name, id });
    },
    onstop: (id) => {
      pushDebug("stop", { name, id });
    },
  });

  howls[name] = howl;
  ensureContextObserver();
  return howl;
}

function getSoundUrl(name) {
  const soundUrl = SOUND_URLS[name];
  if (!soundUrl) {
    throw new Error(`Unknown sound "${name}"`);
  }

  return soundUrl;
}

function waitForLoad(howl, name) {
  return new Promise((resolve, reject) => {
    if (howl.state() === "loaded") {
      resolve(howl);
      return;
    }

    const cleanup = () => {
      howl.off("load", onLoad);
      howl.off("loaderror", onLoadError);
    };

    const onLoad = () => {
      cleanup();
      resolve(howl);
    };

    const onLoadError = (_id, err) => {
      cleanup();
      reject(new Error(`Failed to load "${name}": ${serializeError(err)}`));
    };

    howl.once("load", onLoad);
    howl.once("loaderror", onLoadError);
  });
}

function loadOne(name) {
  const howl = ensureHowl(name);
  const state = howl.state();

  if (state === "loaded") {
    return Promise.resolve(howl);
  }

  if (loadPromises[name]) {
    return loadPromises[name];
  }

  const waitPromise = waitForLoad(howl, name)
    .catch((err) => {
      pushDebug("load-wait-error", { name, error: serializeError(err) });
      throw err;
    })
    .finally(() => {
      delete loadPromises[name];
      renderDebugPanel();
    });

  loadPromises[name] = waitPromise;

  if (state === "unloaded") {
    pushDebug("load-start", { name });
    howl.load();
  }

  return waitPromise;
}

async function playHtmlDebug(name, volume = 1) {
  try {
    const audio = new Audio(getSoundUrl(name));
    audio.preload = "auto";
    audio.playsInline = true;
    audio.volume = volume;
    pushDebug("html-play-request", { name, volume });

    audio.addEventListener(
      "playing",
      () => {
        pushDebug("html-playing", { name });
      },
      { once: true },
    );

    audio.addEventListener(
      "ended",
      () => {
        pushDebug("html-ended", { name });
      },
      { once: true },
    );

    await audio.play();
    return audio;
  } catch (err) {
    pushDebug("html-play-error", { name, error: serializeError(err) });
    return null;
  }
}

async function bridgeIOSAudio(reason) {
  if (!isIOS || iosBridgeUnlocked) {
    return;
  }

  if (iosBridgePromise) {
    return iosBridgePromise;
  }

  iosBridgePromise = (async () => {
    const el = new Audio(buildSilenceUrl());
    el.preload = "auto";
    el.playsInline = true;

    try {
      await el.play();
      iosBridgeUnlocked = true;
      pushDebug("ios-bridge-ok", { reason });
    } catch (err) {
      pushDebug("ios-bridge-failed", {
        reason,
        error: serializeError(err),
      });
      return;
    }

    try {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load();
    } catch (err) {
      pushDebug("ios-bridge-reset-failed", {
        reason,
        error: serializeError(err),
      });
    }
  })().finally(() => {
    iosBridgePromise = null;
    renderDebugPanel();
  });

  return iosBridgePromise;
}

async function resumeContext(reason = "resume") {
  if (useHtml5Audio) {
    pushDebug("resume-skip", { reason, state: "html5-mode" });
    return null;
  }

  const ctx = getHowlerContext();
  if (!ctx) {
    pushDebug("resume-skip", { reason, state: "no-context" });
    return null;
  }

  ensureContextObserver();

  if (ctx.state === "running") {
    return ctx;
  }

  try {
    await bridgeIOSAudio(reason);
    await ctx.resume();
    pushDebug("resume-ok", { reason, state: ctx.state });
  } catch (err) {
    pushDebug("resume-failed", { reason, error: serializeError(err) });
  }

  renderDebugPanel();
  return ctx;
}

async function unlock(reason = "unlock") {
  if (unlockPromise) {
    return unlockPromise;
  }

  unlockPromise = (async () => {
    userActivated = true;
    pushDebug("unlock", { reason });
    if (useHtml5Audio) {
      if (isIOS) {
        await bridgeIOSAudio(reason);
      }
    } else {
      await bridgeIOSAudio(reason);
      await resumeContext(reason);
    }
    void preload().catch((err) => {
      pushDebug("preload-error", { error: serializeError(err) });
    });
    renderDebugPanel();
    return getHowlerContext();
  })().finally(() => {
    unlockPromise = null;
  });

  return unlockPromise;
}

async function preload() {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    pushDebug("preload-start", { count: PRELOAD_ORDER.length });
    for (const name of PRELOAD_ORDER) {
      await loadOne(name);
    }
    pushDebug("preload-complete", { count: PRELOAD_ORDER.length });
    renderDebugPanel();
  })().catch((err) => {
    preloadPromise = null;
    throw err;
  });

  return preloadPromise;
}

function createHandle(howl, id) {
  return {
    howl,
    id,
    stop() {
      try {
        howl.stop(id);
      } catch (err) {
        pushDebug("stop-failed", { error: serializeError(err) });
      }
    },
  };
}

async function play(name, { loop = false, volume = 1 } = {}) {
  try {
    pushDebug("play-request", { name, loop, volume });

    if (!userActivated) {
      await unlock(`play:${name}`);
    } else {
      if (useHtml5Audio) {
        if (isIOS) {
          await bridgeIOSAudio(`play:${name}`);
        }
      } else {
        await bridgeIOSAudio(`play:${name}`);
        await resumeContext(`play:${name}`);
      }
    }

    const howl = await loadOne(name);
    const id = howl.play();

    if (id === null || id === undefined) {
      pushDebug("play-null-id", { name });
      return null;
    }

    pushDebug("play-issued", { name, id });
    howl.loop(loop, id);
    howl.volume(volume, id);
    renderDebugPanel();

    return createHandle(howl, id);
  } catch (err) {
    pushDebug("play-failed", { name, error: serializeError(err) });
    return null;
  }
}

async function startSpinning() {
  await stopSpinning();
  spinningHandle = await play("spinning-loop", { loop: true, volume: 0.6 });
  return spinningHandle;
}

async function stopSpinning() {
  if (!spinningHandle) {
    return;
  }

  spinningHandle.stop();
  spinningHandle = null;
  renderDebugPanel();
}

async function refresh({ interactive = false, reason = "refresh" } = {}) {
  if (interactive) {
    userActivated = true;
  }

  pushDebug("refresh", { interactive, reason });
  return resumeContext(reason);
}

function getLoadedSounds() {
  return Object.keys(SOUND_URLS).filter(
    (name) => howls[name] && howls[name].state() === "loaded",
  );
}

function getState() {
  const ctx = getHowlerContext();
  const loadedSounds = getLoadedSounds();

  return {
    usingHowler: typeof Howler !== "undefined",
    noAudio: typeof Howler !== "undefined" ? Howler.noAudio : true,
    usingWebAudio: typeof Howler !== "undefined" ? Howler.usingWebAudio : false,
    backend: useHtml5Audio ? "html5" : "webaudio",
    contextState: ctx?.state ?? "uninitialized",
    autoUnlock: typeof Howler !== "undefined" ? Howler.autoUnlock : false,
    autoSuspend: typeof Howler !== "undefined" ? Howler.autoSuspend : false,
    userActivated,
    iosBridgeUnlocked,
    muted: typeof Howler !== "undefined" ? Howler._muted : false,
    globalVolume:
      typeof Howler !== "undefined" && typeof Howler.volume === "function"
        ? Howler.volume()
        : 1,
    loadedSounds,
    pendingSounds: Object.keys(SOUND_URLS).filter(
      (name) => !loadedSounds.includes(name),
    ),
    recentEvents: debugEntries.slice(-10),
  };
}

function getDebugLog() {
  return debugEntries.slice();
}

function renderDebugPanel() {
  if (!DEBUG_ENABLED || !document.body) {
    return;
  }

  if (!debugPanel) {
    debugPanel = document.createElement("aside");
    debugPanel.id = "audio-debug-panel";
    debugPanel.style.position = "fixed";
    debugPanel.style.right = "12px";
    debugPanel.style.bottom = "12px";
    debugPanel.style.zIndex = "10000";
    debugPanel.style.width = "min(92vw, 360px)";
    debugPanel.style.maxHeight = "50vh";
    debugPanel.style.padding = "10px";
    debugPanel.style.overflow = "auto";
    debugPanel.style.border = "1px solid rgba(255,255,255,0.18)";
    debugPanel.style.borderRadius = "12px";
    debugPanel.style.background = "rgba(4, 9, 26, 0.94)";
    debugPanel.style.color = "#f4f7ff";
    debugPanel.style.font = "12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace";
    debugPanel.style.boxShadow = "0 18px 40px rgba(0, 0, 0, 0.35)";
    debugPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <strong>Audio Debug</strong>
        <button type="button" data-audio-debug-close style="border:0;background:none;color:inherit;font:inherit;padding:0;cursor:pointer;">hide</button>
      </div>
      <div data-audio-debug-state style="margin-top:8px;white-space:pre-wrap;"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
        <button type="button" data-audio-debug-action="unlock">unlock</button>
        <button type="button" data-audio-debug-action="tap">tap</button>
        <button type="button" data-audio-debug-action="html">html</button>
        <button type="button" data-audio-debug-action="loop">loop</button>
        <button type="button" data-audio-debug-action="stop">stop</button>
      </div>
      <pre data-audio-debug-log style="margin:8px 0 0;white-space:pre-wrap;"></pre>
    `;

    debugPanel.addEventListener("pointerdown", (event) => {
      const button = event.target.closest("[data-audio-debug-action]");
      if (button) {
        const action = button.dataset.audioDebugAction;
        pushDebug("debug-action", { action });
        event.preventDefault();
        if (action === "unlock") {
          void unlock("debug-button");
        } else if (action === "tap") {
          void play("card-tap");
        } else if (action === "html") {
          void playHtmlDebug("card-tap");
        } else if (action === "loop") {
          void startSpinning();
        } else if (action === "stop") {
          void stopSpinning();
        }
        return;
      }

      if (event.target.closest("[data-audio-debug-close]")) {
        event.preventDefault();
        debugPanel.remove();
        debugPanel = null;
      }
    });

    document.body.appendChild(debugPanel);
  }

  const stateEl = debugPanel.querySelector("[data-audio-debug-state]");
  const logEl = debugPanel.querySelector("[data-audio-debug-log]");
  const state = getState();

  stateEl.textContent = [
    `backend=${state.backend}`,
    `ctx=${state.contextState}`,
    `webAudio=${state.usingWebAudio}`,
    `activated=${state.userActivated}`,
    `iosBridge=${state.iosBridgeUnlocked}`,
    `muted=${state.muted}`,
    `vol=${state.globalVolume}`,
    `loaded=${state.loadedSounds.length}/${Object.keys(SOUND_URLS).length}`,
  ].join("  ");

  logEl.textContent = debugEntries
    .slice(-12)
    .map((entry) => `${entry.time} ${entry.type} ${JSON.stringify(entry.details)}`)
    .join("\n");
}

function ensureDebugPanelWhenReady() {
  if (!DEBUG_ENABLED) {
    return;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderDebugPanel, {
      once: true,
    });
    return;
  }

  renderDebugPanel();
}

function handleUserGesture(event) {
  if (userActivated) {
    return;
  }

  void unlock(`gesture:${event.type}`);
}

ensureDebugPanelWhenReady();

document.addEventListener("visibilitychange", () => {
  pushDebug("visibilitychange", { hidden: document.hidden });
  if (document.hidden || !userActivated) {
    return;
  }

  void refresh({ reason: "visibilitychange" });
});

window.addEventListener("pageshow", (event) => {
  pushDebug("pageshow", { persisted: !!event.persisted });
  if (!userActivated) {
    return;
  }

  void refresh({ reason: "pageshow" });
});

window.addEventListener("focus", () => {
  pushDebug("focus");
  if (!userActivated) {
    return;
  }

  void refresh({ reason: "focus" });
});

window.addEventListener("pagehide", (event) => {
  pushDebug("pagehide", { persisted: !!event.persisted });
});

document.addEventListener("pointerdown", handleUserGesture, {
  capture: true,
  passive: true,
});

if (!("PointerEvent" in window)) {
  document.addEventListener("touchstart", handleUserGesture, {
    capture: true,
    passive: true,
  });
}

document.addEventListener("keydown", handleUserGesture, {
  capture: true,
});

export const AudioEngine = {
  preload,
  unlock,
  play,
  startSpinning,
  stopSpinning,
  refresh,
  getState,
  getDebugLog,
};

window.AudioEngine = AudioEngine;
