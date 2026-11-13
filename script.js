const $ = (id) => document.getElementById(id);
const scenes = [...document.querySelectorAll(".scene")];
const audio = $("birthdayAudio");
const musicToggle = $("musicToggle");
let audioContext,
  analyser,
  micStream,
  micSource,
  micFrame,
  blowLevel = 0,
  lastBlow = 0;
let extinguished = 0,
  micActive = false,
  audioStarted = false;

function showScene(id) {
  scenes.forEach((s) => s.classList.toggle("active", s.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document
  .querySelectorAll(".next-scene")
  .forEach((btn) =>
    btn.addEventListener("click", () => showScene(btn.dataset.next)),
  );

$("openEnvelope").addEventListener("click", () => {
  $("openEnvelope").classList.add("open");
  setTimeout(() => showScene("intro"), 1050);
});
$("beginBtn").addEventListener("click", async () => {
  $("openEnvelope").classList.add("open");
  await startMusic();
  setTimeout(() => showScene("intro"), 850);
});

async function startMusic() {
  try {
    await audio.play();
    audioStarted = true;
    musicToggle.classList.add("playing");
    musicToggle.querySelector(".music-label").textContent = "Music on";
    musicToggle.setAttribute("aria-label", "Pause birthday music");
  } catch (e) {
    toast("Music couldn't start — tap the ♫ button to try again.");
  }
}
musicToggle.addEventListener("click", async () => {
  if (audio.paused) await startMusic();
  else {
    audio.pause();
    musicToggle.classList.remove("playing");
    musicToggle.querySelector(".music-label").textContent = "Music off";
    musicToggle.setAttribute("aria-label", "Play birthday music");
  }
});

// Background lyrics — cue times are aligned to the structure of hbd.mpeg
// (intro 0–10s, main 20.5–51.6s, break, section B 56–74s, finale 74–84s).
// Position and opacity are driven directly by audio.currentTime so the text
// stays in sync when the music is paused, resumed, or looped.
const LYRIC_CUES = [
  { text: "Happy birthday to you", start: 0.8, end: 9.6 },
  { text: "Happy birthday to you", start: 20.5, end: 31.4 },
  { text: "Happy birthday dear Ashu", start: 31.4, end: 42.4 },
  { text: "Happy birthday to you", start: 42.4, end: 51.6 },
  { text: "Happy birthday to you", start: 56.0, end: 61.6 },
  { text: "Happy birthday to you", start: 61.6, end: 67.4 },
  { text: "Happy birthday dear Ashu", start: 67.4, end: 73.8 },
  { text: "Happy birthday to you", start: 74.4, end: 83.6 },
];
const LYRIC_PEAK_OPACITY = 0.13;
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let lastLyricCue = -1;
const lyricWrap = $("bgLyrics");
const lyricLine = $("lyricLine");

function tickLyrics() {
  const t = audio.currentTime;
  const idx = LYRIC_CUES.findIndex((c) => t >= c.start && t < c.end);
  if (idx !== lastLyricCue) {
    lastLyricCue = idx;
    if (idx === -1) {
      lyricWrap.classList.remove("visible");
      lyricLine.style.opacity = "0";
    } else {
      lyricLine.textContent = LYRIC_CUES[idx].text;
      lyricWrap.classList.add("visible");
    }
  }
  if (idx !== -1) {
    const cue = LYRIC_CUES[idx];
    const p = Math.min(1, Math.max(0, (t - cue.start) / (cue.end - cue.start)));
    let opacity;
    if (p < 0.09) opacity = (p / 0.09) * LYRIC_PEAK_OPACITY;
    else if (p > 0.84) opacity = ((1 - p) / 0.16) * LYRIC_PEAK_OPACITY;
    else opacity = LYRIC_PEAK_OPACITY;
    lyricLine.style.opacity = opacity.toFixed(3);
    if (!reduceMotion) {
      lyricLine.style.transform = `translate3d(${(-14 + p * 28).toFixed(2)}vw, ${(6 - p * 12).toFixed(1)}px, 0)`;
    }
  }
  requestAnimationFrame(tickLyrics);
}
requestAnimationFrame(tickLyrics);

function buildCandles() {
  const container = $("candles");
  for (let i = 0; i < 19; i++) {
    const candle = document.createElement("span");
    candle.className = "candle";
    candle.innerHTML = '<i class="flame"></i>';
    candle.setAttribute("aria-hidden", "true");
    container.appendChild(candle);
  }
}
buildCandles();

function extinguishOne() {
  const candles = [...document.querySelectorAll(".candle:not(.out)")];
  if (!candles.length) return;
  const candle = candles[Math.floor(Math.random() * candles.length)];
  candle.classList.add("out");
  extinguished++;
  $("remainingCount").textContent = String(19 - extinguished);
  if (extinguished >= 19) finishBirthday();
}
function blowOutAll() {
  if (micFrame) cancelAnimationFrame(micFrame);
  stopMicrophone();
  const candles = [...document.querySelectorAll(".candle:not(.out)")];
  candles.forEach((c, i) =>
    setTimeout(() => {
      c.classList.add("out");
      extinguished++;
      $("remainingCount").textContent = String(19 - extinguished);
      if (extinguished >= 19) finishBirthday();
    }, i * 95),
  );
}
$("blowBtn").addEventListener("click", blowOutAll);

async function enableMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("micStatus").textContent =
      "Microphone sensing isn't supported here. Use the tap option instead.";
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(analyser);
    micActive = true;
    $("micBtn").textContent = "Microphone enabled";
    $("micBtn").disabled = true;
    $("micStatus").textContent = "Ready! Blow gently towards your microphone.";
    detectBreath();
  } catch (err) {
    $("micStatus").textContent =
      err.name === "NotAllowedError"
        ? "Microphone permission was declined. You can still tap the button to blow out the candles."
        : "Couldn't start the microphone. The tap option is ready.";
  }
}
$("micBtn").addEventListener("click", enableMicrophone);

function detectBreath() {
  if (!micActive || !analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  const rms = Math.sqrt(sum / data.length);
  const now = performance.now();
  // A sustained, relatively loud burst is treated as a breath. The threshold is intentionally
  // forgiving; the manual button remains available for quiet microphones and noisy rooms.
  if (rms > 0.105) {
    blowLevel++;
    lastBlow = now;
    document.querySelectorAll(".flame:not(.out)").forEach((f, i) => {
      f.style.transform = `translateX(-50%) rotate(${(i % 2 ? 1 : -1) * Math.min(32, rms * 170)}deg) scale(${1 + Math.min(0.5, rms)})`;
    });
    if (blowLevel >= 9) {
      extinguishOne();
      blowLevel = 0;
    }
  } else {
    if (now - lastBlow > 180) {
      blowLevel = Math.max(0, blowLevel - 2);
      document
        .querySelectorAll(".flame")
        .forEach((f) => (f.style.transform = ""));
    }
  }
  micFrame = requestAnimationFrame(detectBreath);
}
function stopMicrophone() {
  micActive = false;
  if (micStream) micStream.getTracks().forEach((track) => track.stop());
  micStream = null;
  if (audioContext && audioContext.state !== "closed") audioContext.close();
  audioContext = analyser = micSource = null;
}
function finishBirthday() {
  stopMicrophone();
  $("cakeInstruction").textContent =
    "You did it. Here's to every beautiful thing waiting for you.";
  $("blowControls").classList.add("hidden");
  $("celebration").classList.remove("hidden");
  $("remainingCount").textContent = "0";
  confetti();
}
function confetti() {
  const colors = ["#e7c99e", "#d88e9e", "#f8eee3", "#a95f71"];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("span");
    p.style.cssText = `position:fixed;z-index:30;top:-12px;left:${Math.random() * 100}vw;width:${4 + Math.random() * 5}px;height:${7 + Math.random() * 8}px;background:${colors[i % colors.length]};opacity:.9;pointer-events:none;border-radius:2px;`;
    document.body.appendChild(p);
    const duration = 2200 + Math.random() * 2200;
    p.animate(
      [
        { transform: `translate3d(0,0,0) rotate(0deg)`, opacity: 1 },
        {
          transform: `translate3d(${(Math.random() - 0.5) * 180}px,${window.innerHeight + 40}px,0) rotate(${Math.random() * 900}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    setTimeout(() => p.remove(), duration);
  }
}
$("replayBtn").addEventListener("click", () => {
  stopMicrophone();
  extinguished = 0;
  document
    .querySelectorAll(".candle")
    .forEach((c) => c.classList.remove("out"));
  $("remainingCount").textContent = "19";
  $("blowControls").classList.remove("hidden");
  $("celebration").classList.add("hidden");
  $("cakeInstruction").textContent =
    "Take a breath, make a wish, and blow out your candles.";
  $("micBtn").disabled = false;
  $("micBtn").innerHTML = '<span class="mic-symbol">◖</span> Enable microphone';
  $("micStatus").textContent =
    "Your microphone is only used to sense your breath. Nothing is recorded or saved.";
  showScene("welcome");
  $("openEnvelope").classList.remove("open");
});
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

// Decorative stars are generated locally and do not use external imagery.
const stars = $("stars");
for (let i = 0; i < 34; i++) {
  const s = document.createElement("span");
  s.className = "star";
  s.textContent = i % 3 === 0 ? "✦" : "·";
  s.style.left = `${Math.random() * 100}%`;
  s.style.top = `${Math.random() * 100}%`;
  s.style.animationDelay = `${Math.random() * 4}s`;
  s.style.fontSize = `${6 + Math.random() * 9}px`;
  stars.appendChild(s);
}
window.addEventListener("pagehide", stopMicrophone);
