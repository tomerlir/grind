import { Howl, Howler } from "howler";

// sounds.js
export const AudioEngine = (() => {
  const SOUNDS = [
    "pull-start",
    "spinning-loop",
    "reel-lock",
    "final-lock",
    "set-logged",
    "level-up",
    "workout-complete",
    "card-tap",
    "navigate-back",
    "rest-timer-end",
  ];

  const howls = Object.create(null);
  let preloadPromise = null;
  let unlockPromise = null;
  let spinningHandle = null;
  let userActivated = false;

  function getHowler() {
    return typeof Howler !== "undefined" ? Howler : null;
  }

  function getHowlerContext() {
    const howler = getHowler();
    return howler?.ctx ?? null;
  }

  if (typeof Howler !== "undefined") {
    Howler.autoUnlock = true;
    Howler.autoSuspend = false;
  }

  function ensureHowl(name) {
    if (typeof Howl === "undefined") {
      throw new Error("Howler failed to load before sounds.js");
    }

    if (howls[name]) {
      return howls[name];
    }

    const howl = new Howl({
      src: [`sounds/${name}.mp3`],
      format: ["mp3"],
      preload: true,
      html5: false,
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
        reject(new Error(`Failed to load "${name}": ${err}`));
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

    const wait = waitForLoad(howl, name);

    if (state === "unloaded") {
      howl.load();
    }

    return wait;
  }

  function preload() {
    if (!preloadPromise) {
      SOUNDS.forEach(ensureHowl);
      preloadPromise = Promise.all(SOUNDS.map((name) => loadOne(name))).catch(
        (err) => {
          preloadPromise = null;
          throw err;
        },
      );
    }

    return preloadPromise;
  }

  async function resumeContext(reason = "resume") {
    const howler = getHowler();

    if (
      !howler ||
      !howler.usingWebAudio ||
      !howler.ctx ||
      howler.ctx.state === "running"
    ) {
      return howler?.ctx ?? null;
    }

    try {
      await howler.ctx.resume();
    } catch (err) {
      console.warn(`[AudioEngine] resume failed during ${reason}:`, err);
    }

    return howler.ctx;
  }

  async function unlock(reason = "unlock") {
    if (unlockPromise) {
      return unlockPromise;
    }

    unlockPromise = (async () => {
      userActivated = true;
      await resumeContext(reason);
      void preload().catch((err) => {
        console.warn("[AudioEngine] preload failed:", err);
      });
      return getHowlerContext();
    })().finally(() => {
      unlockPromise = null;
    });

    return unlockPromise;
  }

  function createHandle(howl, id) {
    return {
      howl,
      id,
      stop() {
        try {
          howl.stop(id);
        } catch (err) {
          console.warn("[AudioEngine] stop failed:", err);
        }
      },
    };
  }

  async function play(name, { loop = false, volume = 1 } = {}) {
    try {
      if (!userActivated) {
        await unlock(`play:${name}`);
      } else {
        await resumeContext(`play:${name}`);
      }

      const howl = await loadOne(name);
      const id = howl.play();

      if (id === null || id === undefined) {
        console.warn("[AudioEngine] play returned no sound id:", name);
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
    if (!spinningHandle) return;
    spinningHandle.stop();
    spinningHandle = null;
  }

  async function refresh({ interactive = false, reason = "refresh" } = {}) {
    if (interactive) {
      userActivated = true;
    }

    return resumeContext(reason);
  }

  function getState() {
    const loadedSounds = SOUNDS.filter(
      (name) => howls[name] && howls[name].state() === "loaded",
    );
    const howler = getHowler();

    return {
      usingHowler: !!howler,
      noAudio: howler ? howler.noAudio : true,
      usingWebAudio: howler ? howler.usingWebAudio : false,
      contextState: getHowlerContext()?.state ?? "uninitialized",
      autoUnlock: howler ? howler.autoUnlock : false,
      autoSuspend: howler ? howler.autoSuspend : false,
      userActivated,
      loadedSounds,
      pendingSounds: SOUNDS.filter((name) => !loadedSounds.includes(name)),
    };
  }

  function handleUserActivation(event) {
    void unlock(event.type);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    void refresh({ reason: "visibilitychange" });
  });

  window.addEventListener("pageshow", () => {
    void refresh({ reason: "pageshow" });
  });

  window.addEventListener("focus", () => {
    void refresh({ reason: "focus" });
  });

  document.addEventListener("pointerdown", handleUserActivation, {
    capture: true,
    passive: true,
  });
  document.addEventListener("touchstart", handleUserActivation, {
    capture: true,
    passive: true,
  });
  document.addEventListener("click", handleUserActivation, {
    capture: true,
  });
  document.addEventListener("keydown", handleUserActivation, {
    capture: true,
  });

  return {
    preload,
    unlock,
    play,
    startSpinning,
    stopSpinning,
    refresh,
    getState,
  };
})();

window.AudioEngine = AudioEngine;
