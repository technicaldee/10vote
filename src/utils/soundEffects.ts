// Sound effects utility using Web Audio API
class SoundEffects {
  private audioContext: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Play a correct answer sound (ascending chime)
  playCorrect() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.1); // G5

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }

  // Play a wrong answer sound (descending buzz)
  playWrong() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  }

  // Play a victory sound (triumphant fanfare)
  playVictory() {
    const ctx = this.getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C chord
    
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.5);

      oscillator.start(ctx.currentTime + i * 0.1);
      oscillator.stop(ctx.currentTime + i * 0.1 + 0.5);
    });
  }

  // Play a defeat sound (sad trombone)
  playDefeat() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(220, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }

  // Play a tick sound (for countdown)
  playTick() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.05);
  }

  // Play a button click sound
  playClick() {
    const ctx = this.getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  }

  // Play a coin sound (for winnings)
  playCoin() {
    const ctx = this.getAudioContext();
    
    [880, 1174.66].forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.05);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.05 + 0.15);

      oscillator.start(ctx.currentTime + i * 0.05);
      oscillator.stop(ctx.currentTime + i * 0.05 + 0.15);
    });
  }
}

export const soundEffects = new SoundEffects();
