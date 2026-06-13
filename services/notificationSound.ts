const SOUND_PREF_KEY = 'partner_sound_enabled';

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const getPartnerSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(SOUND_PREF_KEY);
  if (stored === null) return true;
  return stored === 'true';
};

export const setPartnerSoundEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
};

/** Short two-tone chime for new lead alerts (no external audio file). */
export const playLeadAlertSound = async () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => undefined);
  }

  const now = ctx.currentTime;
  const tones = [
    { freq: 880, start: 0, duration: 0.12 },
    { freq: 1174.66, start: 0.14, duration: 0.18 },
  ];

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(tone.freq, now + tone.start);
    gain.gain.setValueAtTime(0.0001, now + tone.start);
    gain.gain.exponentialRampToValueAtTime(0.22, now + tone.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.duration + 0.05);
  }
};
