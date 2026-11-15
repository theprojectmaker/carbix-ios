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
const POOL = 4;
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
  (Object.keys(HOT) as SfxName[]).forEach((n) => hotOf(n));
  if (!loopPlayer) {
    loopPlayer = createAudioPlayer(FILES['scan-loop']);
    loopPlayer.loop = true;
  }
}

/* Sounds used while scanning and revealing get their own pre-loaded players. Pooled players call replace() each time,
   which builds a new audio item and made sounds start late. The rapid ones (tick, click) get TWO players that take
   turns, so a new tap never chops the tail off the previous one. */
const HOT: Partial<Record<SfxName, number>> = { tick: 2, click: 2, lock: 1, ping0: 1, ping2: 1, shutter: 1, tab: 1, swipe: 1, rev: 1 };
type Hot = { ps: AudioPlayer[]; used: boolean[]; i: number };
const hot = new Map<SfxName, Hot>();

function hotOf(name: SfxName): Hot | null {
  const n = HOT[name];
  if (!n) return null;
  let h = hot.get(name);
  if (!h) {
    h = { ps: Array.from({ length: n }, () => createAudioPlayer(FILES[name])), used: Array(n).fill(false), i: 0 };
    hot.set(name, h);
  }
  return h;
}

/** Starts a player from the top. A player that has never played starts at once; a used one rewinds first. */
function fire(p: AudioPlayer, used: boolean) {
  if (!used) {
    p.play();
    return;
  }
  p.seekTo(0).then(() => p.play()).catch(() => { try { p.play(); } catch { /* ignore */ } });
}

/* The catch jingle differs per rarity, so one player is re-pointed at it the moment the result arrives (warmCaught),
   about a second before the jingle is due: the slow load happens early, not on the beat. */
let caughtPlayer: AudioPlayer | null = null;
let caughtName: SfxName | null = null;
let caughtUsed = false;

export function warmCaught(r: Rarity) {
  try {
    init();
    const name = `caught-${r.toLowerCase()}` as SfxName;
    if (!caughtPlayer) caughtPlayer = createAudioPlayer(FILES[name]);
    else if (caughtName !== name) caughtPlayer.replace(FILES[name]);
    if (caughtName !== name) caughtUsed = false;
    caughtName = name;
  } catch {
    /* ignore */
  }
}

export function play(name: SfxName) {
  if (volume <= 0) return;
  try {
    init();
    const h = hotOf(name);
    if (h) {
      const k = h.i % h.ps.length;
      h.i++;
      const p = h.ps[k];
      p.volume = Math.min(1, volume);
      fire(p, h.used[k]);
      h.used[k] = true;
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

export function playCaught(r: Rarity) {
  if (volume <= 0) return;
  try {
    warmCaught(r);
    const p = caughtPlayer!;
    p.volume = Math.min(1, volume);
    fire(p, caughtUsed);
    caughtUsed = true;
  } catch {
    /* ignore */
  }
}
