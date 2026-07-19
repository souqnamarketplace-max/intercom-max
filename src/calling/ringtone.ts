// Classic two-tone ring pattern (like a phone ring), generated on the fly
// with oscillators rather than shipping an audio file. Started/stopped by
// the caller, loops on its own while active.
export class Ringtone {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start() {
    if (this.timer) return; // already ringing
    this.ctx = new AudioContext();
    const ring = () => this.playPattern();
    ring();
    this.timer = setInterval(ring, 2000);
  }

  private playPattern() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.4].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.frequency.value = 440;
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.35);
      osc.start(now + offset);
      osc.stop(now + offset + 0.35);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
