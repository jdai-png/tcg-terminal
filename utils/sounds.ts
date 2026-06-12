// Sound effects utility for TCG Terminal

import { Platform } from 'react-native';

// Bundle the MP3 asset via Metro
// @ts-ignore - Metro handles require for assets
const ITEM_FOUND_MP3 = require('../assets/item-found.mp3');

let audioElement: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (Platform.OS !== 'web') return null;
  if (audioElement) return audioElement;

  try {
    audioElement = new Audio(ITEM_FOUND_MP3);
    audioElement.preload = 'auto';
    audioElement.volume = 0.6;
    return audioElement;
  } catch {
    return null;
  }
}

/** Play the "item found" sound effect (Pokémon item get) */
export function playItemFoundSound(): void {
  if (Platform.OS !== 'web') return;

  try {
    const audio = getAudio();
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser may block autoplay — handled by user gesture
    });
  } catch {
    // Silent fail
  }
}

/** Preload sounds on app init */
export function preloadSounds(): void {
  if (Platform.OS !== 'web') return;
  getAudio();
}
