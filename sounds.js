// sounds.js
const AudioEngine = (() => {
  let ctx = null;
  const buffers = {};
  let preloadPromise = null;
  let spinningSource = null;

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

  function createCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    return new AudioCtx();
  }

  function getCtx() {
    if (!ctx || ctx.state === "closed") {
      ctx = createCtx();
    }
    return ctx;
  }

  async function warmup(audioCtx) {
    try {
      const silentBuffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
      const source = audioCtx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (err) {
      console.warn("[AudioEngine] warmup failed:", err);
    }
  }

  async function recoverContextIfNeeded() {
    let audioCtx = getCtx();

    if (audioCtx.state === "running") {
      return audioCtx;
    }

    try {
      await audioCtx.resume();
    } catch (err) {
      console.warn("[AudioEngine] resume failed:", err);
    }

    if (audioCtx.state === "running") {
      await warmup(audioCtx);
      return audioCtx;
    }

    // Last-resort recovery for stale/bad contexts after inactivity/backgrounding
    try {
      ctx = createCtx();
      audioCtx = ctx;
      await audioCtx.resume();
      if (audioCtx.state === "running") {
        await warmup(audioCtx);
      }
    } catch (err) {
      console.error("[AudioEngine] context recreation failed:", err);
    }

    return audioCtx;
  }

  async function loadOne(name) {
    const audioCtx = getCtx();

    if (buffers[name]) {
      return buffers[name];
    }

    const res = await fetch(`/sounds/${name}.mp3`, { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Failed to fetch /sounds/${name}.mp3 (${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    buffers[name] = decoded;
    return decoded;
  }

  async function preload() {
    if (!preloadPromise) {
      preloadPromise = Promise.all(SOUNDS.map((name) => loadOne(name)));
    }
    return preloadPromise;
  }

  async function ensureReady(name) {
    const audioCtx = await recoverContextIfNeeded();

    // Always ensure the specific sound exists, even if full preload failed earlier.
    if (name && !buffers[name]) {
      await loadOne(name);
    }

    // Kick full preload in the background after first interaction.
    void preload().catch((err) => {
      console.warn("[AudioEngine] preload failed:", err);
      preloadPromise = null;
    });

    return audioCtx;
  }

  async function play(name, { loop = false, volume = 1 } = {}) {
    try {
      const audioCtx = await ensureReady(name);

      if (audioCtx.state !== "running") {
        console.warn("[AudioEngine] play aborted, context not running:", {
          name,
          state: audioCtx.state,
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
      gainNode.connect(audioCtx.destination);

      source.start(0);
      return source;
    } catch (err) {
      console.error(`[AudioEngine] play("${name}") failed:`, err);
      return null;
    }
  }

  async function startSpinning() {
    await stopSpinning();
    spinningSource = await play("spinning-loop", { loop: true, volume: 0.6 });
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

  async function refresh() {
    try {
      await recoverContextIfNeeded();
    } catch (err) {
      console.warn("[AudioEngine] refresh failed:", err);
    }
  }

  // Re-arm audio after returning to the app/tab.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refresh();
    }
  });

  // Re-arm on fresh user interaction after idle/background.
  document.addEventListener(
    "pointerdown",
    () => {
      void refresh();
    },
    { passive: true },
  );

  document.addEventListener(
    "touchstart",
    () => {
      void refresh();
    },
    { passive: true },
  );

  return {
    preload,
    play,
    startSpinning,
    stopSpinning,
    refresh,
  };
})();
