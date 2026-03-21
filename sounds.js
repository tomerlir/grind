const AudioEngine = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const buffers = {};
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

  // Preload all sounds on first user interaction
  async function preload() {
    await Promise.all(
      SOUNDS.map(async (name) => {
        const res = await fetch(`/sounds/${name}.mp3`);
        const arrayBuffer = await res.arrayBuffer();
        buffers[name] = await ctx.decodeAudioData(arrayBuffer);
      }),
    );
  }

  function play(name, { loop = false, volume = 1 } = {}) {
    if (!buffers[name]) return;
    if (ctx.state === "suspended") ctx.resume();
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    source.buffer = buffers[name];
    source.loop = loop;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
    return source;
  }

  function startSpinning() {
    spinningSource = play("spinning-loop", { loop: true, volume: 0.6 });
  }

  function stopSpinning() {
    if (spinningSource) {
      spinningSource.stop();
      spinningSource = null;
    }
  }

  return { preload, play, startSpinning, stopSpinning };
})();
