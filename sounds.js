// sounds.js
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let preloadPromise = null;
  let unlockPromise = null;
  let priorityDecodePromise = null;
  let backgroundDecodePromise = null;
  let spinningSource = null;
  let userActivated = false;
  let requiresInteractionRefresh = false;
  let iosUnmutePromise = null;
  let silenceUrl = null;

  const buffers = Object.create(null);
  const decodePromises = Object.create(null);
  const rawAudio = Object.create(null);
  const rawFetchPromises = Object.create(null);

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

  const PRIORITY_DECODE_SOUNDS = [
    "card-tap",
    "navigate-back",
    "pull-start",
    "spinning-loop",
    "reel-lock",
    "set-logged",
    "level-up",
  ];

  const BACKGROUND_DECODE_SOUNDS = SOUNDS.filter(
    (name) => !PRIORITY_DECODE_SOUNDS.includes(name),
  );

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const supportsWebAudio = typeof AudioCtx === "function";
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function createCtx() {
    if (!supportsWebAudio) {
      return null;
    }

    let nextCtx = null;
    try {
      nextCtx = new AudioCtx({ latencyHint: "interactive" });
    } catch {
      nextCtx = new AudioCtx();
    }

    masterGain = nextCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(nextCtx.destination);
    return nextCtx;
  }

  function getCtx() {
    if (!ctx || ctx.state === "closed") {
      ctx = createCtx();
    }
    return ctx;
  }

  function getOutput(audioCtx) {
    if (!audioCtx) {
      return null;
    }

    if (!masterGain || masterGain.context !== audioCtx) {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(audioCtx.destination);
    }

    return masterGain;
  }

  function writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i++) {
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
    view.setUint32(
      28,
      sampleRate * channelCount * bytesPerSample,
      true,
    );
    view.setUint16(32, channelCount * bytesPerSample, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataSize, true);

    silenceUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
    return silenceUrl;
  }

  async function unmuteIOSIfNeeded() {
    if (!isIOS) {
      return;
    }

    if (iosUnmutePromise) {
      return iosUnmutePromise;
    }

    iosUnmutePromise = (async () => {
      const el = new Audio(buildSilenceUrl());
      el.preload = "auto";
      el.playsInline = true;

      try {
        await el.play();
      } catch (err) {
        console.warn("[AudioEngine] iOS HTMLAudio unmute failed:", err);
        return;
      }

      try {
        el.pause();
        el.currentTime = 0;
      } catch (err) {
        console.warn("[AudioEngine] iOS HTMLAudio reset failed:", err);
      }
    })().finally(() => {
      iosUnmutePromise = null;
    });

    return iosUnmutePromise;
  }

  async function warmup(audioCtx) {
    try {
      const source = audioCtx.createBufferSource();
      const buffer = audioCtx.createBuffer(1, 128, audioCtx.sampleRate);
      const gainNode = audioCtx.createGain();

      source.buffer = buffer;
      gainNode.gain.value = 0.0001;

      source.connect(gainNode);
      gainNode.connect(getOutput(audioCtx));

      source.start(0);
      source.stop(audioCtx.currentTime + 0.01);
    } catch (err) {
      console.warn("[AudioEngine] warmup failed:", err);
    }
  }

  async function ensureRunning({ interactive = false, reason = "resume" } = {}) {
    let audioCtx = getCtx();

    if (!audioCtx) {
      console.warn("[AudioEngine] Web Audio unavailable.");
      return null;
    }

    if (interactive) {
      userActivated = true;
    }

    if (audioCtx.state === "running") {
      requiresInteractionRefresh = false;
      return audioCtx;
    }

    if (userActivated) {
      try {
        await unmuteIOSIfNeeded();
      } catch (err) {
        console.warn("[AudioEngine] iOS unmute bridge failed:", err);
      }

      try {
        await audioCtx.resume();
      } catch (err) {
        console.warn(`[AudioEngine] resume failed during ${reason}:`, err);
      }

      if (audioCtx.state === "running") {
        await warmup(audioCtx);
        requiresInteractionRefresh = false;
        return audioCtx;
      }
    }

    if (userActivated && audioCtx.state !== "running") {
      try {
        ctx = createCtx();
        audioCtx = ctx;

        if (audioCtx && userActivated) {
          await unmuteIOSIfNeeded();
          await audioCtx.resume();
        }

        if (audioCtx?.state === "running") {
          await warmup(audioCtx);
          requiresInteractionRefresh = false;
          return audioCtx;
        }
      } catch (err) {
        console.error(
          `[AudioEngine] context recreation failed during ${reason}:`,
          err,
        );
      }
    }

    requiresInteractionRefresh = true;
    return audioCtx;
  }

  async function fetchRaw(name) {
    if (rawAudio[name]) {
      return rawAudio[name];
    }

    if (!rawFetchPromises[name]) {
      rawFetchPromises[name] = fetch(`/sounds/${name}.mp3`, {
        cache: "force-cache",
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch /sounds/${name}.mp3 (${res.status})`);
          }
          return res.arrayBuffer();
        })
        .then((arrayBuffer) => {
          rawAudio[name] = arrayBuffer;
          return arrayBuffer;
        })
        .catch((err) => {
          delete rawFetchPromises[name];
          throw err;
        });
    }

    return rawFetchPromises[name];
  }

  async function decodeOne(name) {
    if (buffers[name]) {
      return buffers[name];
    }

    if (!decodePromises[name]) {
      decodePromises[name] = (async () => {
        const audioCtx = getCtx();
        if (!audioCtx) {
          return null;
        }

        const raw = await fetchRaw(name);

        // Safari may detach the ArrayBuffer passed to decodeAudioData.
        const decoded = await audioCtx.decodeAudioData(raw.slice(0));
        buffers[name] = decoded;
        return decoded;
      })().catch((err) => {
        delete decodePromises[name];
        throw err;
      });
    }

    return decodePromises[name];
  }

  async function decodeSequentially(names) {
    for (const name of names) {
      try {
        await decodeOne(name);
      } catch (err) {
        console.warn(`[AudioEngine] decode failed for "${name}":`, err);
      }
    }
  }

  function warmPrioritySounds() {
    if (!priorityDecodePromise) {
      priorityDecodePromise = decodeSequentially(PRIORITY_DECODE_SOUNDS);
    }
    return priorityDecodePromise;
  }

  function warmRemainingSounds() {
    if (!backgroundDecodePromise) {
      backgroundDecodePromise = (async () => {
        await warmPrioritySounds();
        await decodeSequentially(BACKGROUND_DECODE_SOUNDS);
      })();
    }
    return backgroundDecodePromise;
  }

  function preload() {
    if (!preloadPromise) {
      preloadPromise = Promise.all(SOUNDS.map((name) => fetchRaw(name))).catch(
        (err) => {
          preloadPromise = null;
          throw err;
        },
      );
    }
    return preloadPromise;
  }

  async function unlock(reason = "unlock") {
    if (unlockPromise) {
      return unlockPromise;
    }

    unlockPromise = (async () => {
      const audioCtx = await ensureRunning({ interactive: true, reason });
      if (!audioCtx) {
        return null;
      }

      void preload().catch((err) => {
        console.warn("[AudioEngine] preload failed:", err);
      });
      void warmPrioritySounds();
      void warmRemainingSounds();

      return audioCtx;
    })().finally(() => {
      unlockPromise = null;
    });

    return unlockPromise;
  }

  async function ensureReady(name) {
    const audioCtx = await ensureRunning({ reason: `play:${name ?? "unknown"}` });

    if (!audioCtx) {
      return null;
    }

    if (name && !buffers[name]) {
      await decodeOne(name);
    }

    void preload().catch((err) => {
      console.warn("[AudioEngine] preload failed:", err);
    });
    void warmPrioritySounds();
    void warmRemainingSounds();

    return audioCtx;
  }

  async function play(name, { loop = false, volume = 1 } = {}) {
    try {
      const audioCtx = await ensureReady(name);

      if (!audioCtx || audioCtx.state !== "running") {
        console.warn("[AudioEngine] play aborted, context not running:", {
          name,
          state: audioCtx?.state ?? "unavailable",
          userActivated,
          requiresInteractionRefresh,
        });
        return null;
      }

      const buffer = buffers[name];
      if (!buffer) {
        console.warn("[AudioEngine] missing buffer:", name);
        return null;
      }

      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();

      source.buffer = buffer;
      source.loop = loop;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(getOutput(audioCtx));

      source.start(0);
      return source;
    } catch (err) {
      console.error(`[AudioEngine] play("${name}") failed:`, err);
      return null;
    }
  }

  async function startSpinning() {
    await stopSpinning();

    void decodeOne("reel-lock").catch((err) => {
      console.warn('[AudioEngine] reel-lock warmup failed:', err);
    });
    void decodeOne("final-lock").catch((err) => {
      console.warn('[AudioEngine] final-lock warmup failed:', err);
    });

    spinningSource = await play("spinning-loop", { loop: true, volume: 0.6 });

    if (spinningSource) {
      const activeSource = spinningSource;
      spinningSource.onended = () => {
        if (spinningSource === activeSource) {
          spinningSource = null;
        }
      };
    }

    return spinningSource;
  }

  async function stopSpinning() {
    if (!spinningSource) return;

    try {
      spinningSource.stop();
    } catch (err) {
      console.warn("[AudioEngine] stopSpinning failed:", err);
    }

    spinningSource = null;
  }

  async function refresh({ interactive = false, reason = "refresh" } = {}) {
    try {
      return await ensureRunning({ interactive, reason });
    } catch (err) {
      console.warn("[AudioEngine] refresh failed:", err);
      return null;
    }
  }

  function getState() {
    return {
      supported: supportsWebAudio,
      contextState: ctx?.state ?? "uninitialized",
      userActivated,
      requiresInteractionRefresh,
      fetchedSounds: Object.keys(rawAudio),
      decodedSounds: Object.keys(buffers),
      isIOS,
    };
  }

  function handleUserActivation(event) {
    userActivated = true;
    void unlock(event.type);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      requiresInteractionRefresh = true;
      return;
    }

    void refresh({ reason: "visibilitychange" });
  });

  window.addEventListener("pageshow", () => {
    requiresInteractionRefresh = true;
    void refresh({ reason: "pageshow" });
  });

  window.addEventListener("pagehide", () => {
    requiresInteractionRefresh = true;
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
