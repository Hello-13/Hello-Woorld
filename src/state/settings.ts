import { setMasterVolume } from '../audio/engine';
import { getTuning, type Tuning } from '../theory/tunings';
import { createStore, useStore } from './store';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type LabelMode = 'notes' | 'intervals' | 'none';

export interface Settings {
  theme: ThemeChoice;
  leftHanded: boolean;
  tuningId: string;
  a4: number;
  volume: number;
  frets: number;
  /** Prefer flats when naming notes outside a key. */
  flats: boolean;
}

export const settingsStore = createStore<Settings>('string-theory:settings', {
  theme: 'system',
  leftHanded: false,
  tuningId: 'standard',
  a4: 440,
  volume: 0.8,
  frets: 15,
  flats: false,
});

export function useSettings(): Settings {
  return useStore(settingsStore);
}

export function useTuning(): Tuning {
  return getTuning(useSettings().tuningId);
}

export function applyTheme(theme: ThemeChoice) {
  const root = document.documentElement;
  if (theme === 'system') {
    // Leave whatever the host page decided (an artifact viewer sets its own data-theme).
    if (root.dataset.themeOwner === 'app') {
      delete root.dataset.theme;
      delete root.dataset.themeOwner;
    }
  } else {
    root.dataset.theme = theme;
    root.dataset.themeOwner = 'app';
  }
}

export function initSettings() {
  const s = settingsStore.get();
  applyTheme(s.theme);
  setMasterVolume(s.volume);
  settingsStore.subscribe((v) => {
    applyTheme(v.theme);
    setMasterVolume(v.volume);
  });
}
