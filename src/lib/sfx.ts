import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Rarity } from '@/engine/types';

/* Sound effects are rendered by scripts/make-sfx.mjs from the web app's own synth recipes. */
const FILES = {
  click: require('../../assets/sfx/click.wav'),
  tab: require('../../assets/sfx/tab.wav'),
  scan: require('../../assets/sfx/scan.wav'),
  'scan-loop': require('../../assets/sfx/scan-loop.wav'),
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
  lock: require('../../assets/sfx/lock.wav'),
  pop: require('../../assets/sfx/pop.wav'),
  coin: require('../../assets/sfx/coin.wav'),
  whoosh: require('../../assets/sfx/whoosh.wav'),
  fanfare: require('../../assets/sfx/fanfare.wav'),
  tick: require('../../assets/sfx/tick.wav'),
  'caught-common': require('../../assets/sfx/caught-common.wav'),
  'caught-uncommon': require('../../assets/sfx/caught-uncommon.wav'),
  'caught-rare': require('../../assets/sfx/caught-rare.wav'),
  'caught-epic': require('../../assets/sfx/caught-epic.wav'),
  'caught-legendary': require('../../assets/sfx/caught-legendary.wav'),
  'caught-mythic': require('../../assets/sfx/caught-mythic.wav'),
  'caught-grail': require('../../assets/sfx/caught-grail.wav'),
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
let silentMute = true;

function init() {
  if (ready) return;
  ready = true;
  setAudioModeAsync({ playsInSilentMode: !silentMute, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
}

export function setSfxVolume(v: number) {
  volume = v;
}

/** true: the phone's silent switch (alerts off) also mutes the game sounds. */
export function setSilentMute(on: boolean) {
  silentMute = on;
  setAudioModeAsync({ playsInSilentMode: !on, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
}

function pool(): AudioPlayer[] {
  if (!players) players = Array.from({ length: POOL }, () => createAudioPlayer(FILES.click));
  return players;
}

/** Warm the pool so the first tap is not silent. */
export function preloadSfx() {
  init();
  pool();
  HOT.forEach((n) => hotPlayer(n));
  if (!loopPlayer) {
    loopPlayer = createAudioPlayer(FILES['scan-loop']);
    loopPlayer.loop = true;
  }
}

/* The sounds that fire many times in a row during a scan each get their OWN player loaded once. replace() on a pooled
   player builds a new audio item every time, which stalls the app for a few frames: that was the stutter while scanning. */
const HOT: SfxName[] = ['tick', 'click', 'lock', 'ping0', 'ping1', 'shutter'];
const hot = new Map<SfxName, AudioPlayer>();

function hotPlayer(name: SfxName): AudioPlayer | null {
  if (!HOT.includes(name)) return null;
  let p = hot.get(name);
  if (!p) {
    p = createAudioPlayer(FILES[name]);
    hot.set(name, p);
  }
  return p;
}

export function play(name: SfxName) {
  if (volume <= 0) return;
  try {
    init();
    const h = hotPlayer(name);
    if (h) {
      h.volume = Math.min(1, volume);
      h.seekTo(0).catch(() => {});
      h.play();
      return;
    }
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

let loopPlayer: AudioPlayer | null = null;
let looping = false;

/** The scanning hum: a seamless loop that runs from the moment the photo freezes until the result (or an error) arrives. */
export function startScanLoop() {
  if (volume <= 0 || looping) return;
  try {
    init();
    if (!loopPlayer) {
      loopPlayer = createAudioPlayer(FILES['scan-loop']);
      loopPlayer.loop = true;
    }
    looping = true;
    loopPlayer.volume = Math.min(1, volume) * 0.9;
    loopPlayer.seekTo(0).catch(() => {});
    loopPlayer.play();
  } catch {
    looping = false;
  }
}

export function stopScanLoop() {
  if (!looping) return;
  looping = false;
  try {
    loopPlayer?.pause();
  } catch {
    /* ignore */
  }
}

export const playCaught = (r: Rarity) => play(`caught-${r.toLowerCase()}` as SfxName);
