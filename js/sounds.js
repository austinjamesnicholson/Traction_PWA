let audio;
export function prepareSaveSound() {
  try {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return null;
    if (!audio || audio.state === "closed") audio = new Audio();
    // Called inside the Save gesture so iOS can unlock audio playback.
    const ready =
      audio.state === "suspended" ? audio.resume() : Promise.resolve();
    ready.catch(() => {});
    return { context: audio, ready };
  } catch {
    return null;
  }
}
export function playSaveChime(prepared) {
  if (!prepared) return;
  void prepared.ready
    .then(() => {
      const context = prepared.context;
      if (context.state !== "running") return;
      for (const [frequency, offset] of [
        [659.25, 0],
        [880, 0.09],
      ]) {
        const oscillator = context.createOscillator(),
          gain = context.createGain(),
          start = context.currentTime + offset;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.19);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.21);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    })
    .catch(() => {});
}
