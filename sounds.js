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

const SOUND_NAMES = Object.keys(SOUND_URLS);
const HOWLER_BACKEND = "html5";
const howls = Object.create(null);
let preloadPromise = null;
let spinningHandle = null;
let userActivated = false;

Howler.autoUnlock = true;
Howler.autoSuspend = false;
Howler.html5PoolSize = 12;
Howler.mute(false);
Howler.volume(1);

function serializeError(err) {
  if (!err) return "unknown";
  if (typeof err === "string") return err;
  if (typeof err.message === "string") return err.message;
  return String(err);
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
    html5: true,
    preload: false,
    onloaderror: (_id, err) => {
      console.error(`[AudioEngine] Failed to load "${name}":`, err);
    },
    onplayerror: (_id, err) => {
      console.error(`[AudioEngine] Failed to play "${name}":`, err);
    },
  });

  howls[name] = howl;
  return howl;
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

  if (howl.state() === "loaded") {
    return Promise.resolve(howl);
  }

  const wait = waitForLoad(howl, name);
  if (howl.state() === "unloaded") {
    howl.load();
  }

  return wait;
}

async function preload() {
  if (!preloadPromise) {
    preloadPromise = Promise.all(SOUND_NAMES.map((name) => loadOne(name))).catch(
      (err) => {
        preloadPromise = null;
        throw err;
      },
    );
  }

  return preloadPromise;
}

async function unlock() {
  userActivated = true;
  return null;
}

function createHandle(howl, id) {
  return {
    howl,
    id,
    stop() {
      try {
        howl.stop(id);
      } catch (err) {
        console.error("[AudioEngine] stop failed:", err);
      }
    },
  };
}

async function play(name, { loop = false, volume = 1 } = {}) {
  try {
    userActivated = true;

    const howl = ensureHowl(name);
    if (howl.state() === "unloaded") {
      howl.load();
    }

    const id = howl.play();
    if (id === null || id === undefined) {
      return null;
    }

    howl.loop(loop, id);
    howl.volume(volume, id);

    return createHandle(howl, id);
  } catch (err) {
    console.error(`[AudioEngine] play("${name}") failed:`, err);
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
}

async function refresh() {
  return null;
}

function getState() {
  const loadedSounds = SOUND_NAMES.filter(
    (name) => howls[name] && howls[name].state() === "loaded",
  );

  return {
    backend: HOWLER_BACKEND,
    usingHowler: true,
    usingWebAudio: false,
    contextState: "html5",
    userActivated,
    muted: Howler._muted,
    globalVolume: Howler.volume(),
    loadedSounds,
    pendingSounds: SOUND_NAMES.filter((name) => !loadedSounds.includes(name)),
  };
}

export const AudioEngine = {
  preload,
  unlock,
  play,
  startSpinning,
  stopSpinning,
  refresh,
  getState,
};

window.AudioEngine = AudioEngine;
