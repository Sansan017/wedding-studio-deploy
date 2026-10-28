/**
 * Soft Romantic Web Audio Synthesizer
 * Plays a gentle, warm acoustic piano-like arpeggio loop for wedding invitations.
 * Works 100% offline, zero external streaming dependencies.
 */

class RomanticSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private intervalId: any = null;
  private gainNode: GainNode | null = null;

  private notes = [
    // Canon in D / Romantic chords arpeggio frequencies (Hz)
    293.66, 369.99, 440.0, 587.33, // D major
    220.0, 277.18, 329.63, 440.0,  // A major
    246.94, 293.66, 369.99, 493.88, // B minor
    185.0, 220.0, 277.18, 369.99,  // F# minor
    196.0, 246.94, 293.66, 392.0,  // G major
    146.83, 220.0, 293.66, 369.99, // D major
    196.0, 246.94, 293.66, 392.0,  // G major
    220.0, 277.18, 329.63, 440.0,  // A major
  ];

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0.15, this.ctx.currentTime);
        this.gainNode.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, duration: number) {
    if (!this.ctx || !this.gainNode) return;

    try {
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      // Soft triangle + sine wave for gentle music box / acoustic tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(noteGain);
      noteGain.connect(this.gainNode);

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio context might be restricted
    }
  }

  public play() {
    this.init();
    if (this.isPlaying) return;
    this.isPlaying = true;

    let index = 0;
    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;
      const freq = this.notes[index % this.notes.length];
      this.playTone(freq, 1.2);
      index++;
    }, 450);
  }

  public pause() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      this.play();
      return true;
    }
  }

  public getStatus(): boolean {
    return this.isPlaying;
  }
}

export const romanticSynth = new RomanticSynthesizer();
