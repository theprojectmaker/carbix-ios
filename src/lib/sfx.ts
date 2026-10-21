import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Rarity } from '@/engine/types';

/* Sound effects are rendered by scripts/make-sfx.mjs from the web app's own synth recipes. */
const FILES = {
  click: require('../../assets/sfx/click.wav'),
  tab: require('../../assets/sfx/tab.wav'),
  scan: require('../../assets/sfx/scan.wav'),
  shutter: require('../../assets/sfx/shutter.wav'),
  shiny: require('../../assets/sfx/shiny.wav'),
  rev: require('../../assets/sfx/rev.wav'),
  error: require('../../assets/sfx/error.wav'),
  levelup: require('../../assets/sfx/levelup.wav'),
  streak: require('../../assets/sfx/streak.wav'),
  swipe: require('../../assets/sfx/swipe.wav'),
  trash: require('../../assets/sfx/trash.wav'),
  dup: require('../../assets/sfx/dup.wav'),
  'star-on': require('../../assets/sfx/star-on.wav'),
  'star-off': require('../../assets/sfx/star-off.wav'),
  ping0: require('../../assets/sfx/ping0.wav'),
  ping1: require('../../assets/sfx/ping1.wav'),
  ping2: require('../../assets/sfx/ping2.wav'),
  'caught-common': require('../../assets/sfx/caught-common.wav'),
  'caught-uncommon': require('../../assets/sfx/caught-uncommon.wav'),
  'caught-rare': require('../../assets/sfx/caught-rare.wav'),
  'caught-epic': require('../../assets/sfx/caught-epic.wav'),
  'caught-legendary': require('../../assets/sfx/caught-legendary.wav'),
  'caught-mythic': require('../../assets/sfx/caught-mythic.wav'),
} as const;

export type SfxName = keyof typeof FILES;

/* A small FIXED pool of players shared by every sound, used in turn. Making one player per sound (dozens of native
   audio objects) used up iOS audio resources: sounds silently stopped playing and the app could crash. Six players
   is enough for overlapping effects and never grows. */
const POOL = 6;
let players: AudioPlayer[] | null = null;
let next = 0;
let volume = 1;
let ready = false;

function init() {
  if (ready) return;
  ready = true;
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
}

export function setSfxVolume(v: number) {
  volume = v;
}

function pool(): AudioPlayer[] {
  if (!players) players = Array.from({ length: POOL }, () => createAudioPlayer(FILES.click));
  return players;
}

/** Warm the pool so the first tap is not silent. */
export function preloadSfx() {
  init();
  pool();
}

export function play(name: SfxName) {
  if (volume <= 0) return;
  try {
    init();
    const ps = pool();
    const p = ps[next % POOL];
    next++;
    p.volume = Math.min(1, volume);
    p.replace(FILES[name]);
    p.play();
  } catch {
    /* sound is never worth a crash */
  }
}

export const playCaught = (r: Rarity) => play(`caught-${r.toLowerCase()}` as SfxName);
