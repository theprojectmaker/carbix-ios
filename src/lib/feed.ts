import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_ORIGIN, fetchFeed, friendsGet } from '@/engine/api';
import { addNotice } from '@/lib/inbox';
import type { Car, Rarity } from '@/engine/types';

/** One feed post as the server stores it, minus the photo (kept separately so lists never hold megabytes of images). */
export type FeedPost = {
  id: string;
  name?: string;
  make?: string;
  model?: string;
  rarity?: Rarity;
  ts?: number;
  shiny?: boolean;
  heart?: number;
  fire?: number;
  star?: number;
  lol?: number;
  type?: string;
};

export type ReactKind = 'heart' | 'fire' | 'star' | 'lol';
export const REACTIONS: { kind: ReactKind; label: string }[] = [
  { kind: 'heart', label: 'LOVE' },
  { kind: 'fire', label: 'FIRE' },
  { kind: 'star', label: 'STAR' },
  { kind: 'lol', label: 'LOL' },
];

const norm = (s?: string) => String(s ?? '').replace(/^@+/, '').toLowerCase();

let posts: FeedPost[] = [];
const photos = new Map<string, string>();
let friends: string[] = [];
let at = 0;

export type FeedState = { posts: FeedPost[]; friends: string[]; failed: boolean };

/** Loads the shared feed and your friend list. Photos are split out into a side map. */
export async function loadFeed(token: string, force = false, me?: string): Promise<FeedState> {
  if (!force && Date.now() - at < 20000 && posts.length) return { posts, friends, failed: false };
  const [j, fr] = await Promise.all([fetchFeed(), friendsGet(token)]);
  if (fr) friends = fr.friends.map(norm);
  if (!j?.ok || !Array.isArray(j.posts)) return { posts, friends, failed: true };
  const next: FeedPost[] = [];
  for (const p of j.posts as (FeedPost & { photo?: string })[]) {
    if (!p || !p.id || !p.make || !p.model || p.type) continue;
    if (typeof p.photo === 'string' && p.photo) photos.set(p.id, p.photo);
    const { photo: _drop, ...rest } = p;
    void _drop;
    next.push(rest);
  }
  posts = next;
  at = Date.now();
  if (me) noteReactions(next, me).catch(() => {});
  return { posts, friends, failed: false };
}

const REACT_KEY = 'motordex.native.reacts';
/** New reactions on your own catches become inbox notices. Compares against the counts seen last time. */
async function noteReactions(all: FeedPost[], me: string) {
  const mine = all.filter((p) => norm(p.name) === norm(me));
  if (!mine.length) return;
  let seen: Record<string, number> = {};
  try {
    seen = JSON.parse((await AsyncStorage.getItem(REACT_KEY)) || '{}') as Record<string, number>;
  } catch {
    seen = {};
  }
  const first = Object.keys(seen).length === 0;
  const next: Record<string, number> = {};
  for (const p of mine) {
    const n = (p.heart ?? 0) + (p.fire ?? 0) + (p.star ?? 0) + (p.lol ?? 0);
    next[p.id] = n;
    const before = seen[p.id] ?? 0;
    if (!first && n > before) {
      const d = n - before;
      addNotice({ key: 'react:' + p.id + ':' + n, kind: 'feed', title: `${d} NEW REACTION${d === 1 ? '' : 'S'} ON YOUR ${String(p.make).toUpperCase()} ${String(p.model).toUpperCase()}`, route: '/post/' + p.id });
    }
  }
  await AsyncStorage.setItem(REACT_KEY, JSON.stringify(next));
}

export const cachedPost = (id: string) => posts.find((p) => p.id === id) ?? null;
export const postPhoto = (id: string) => photos.get(id) ?? null;

/** Your catches and your friends' catches only. */
export const visiblePosts = (all: FeedPost[], friendNames: string[], me: string, isBlocked: (n?: string) => boolean) =>
  all.filter((p) => !isBlocked(p.name) && (norm(p.name) === norm(me) || friendNames.includes(norm(p.name))));

export async function reactTo(id: string, kind: ReactKind): Promise<FeedPost | null> {
  try {
    const r = await fetch(API_ORIGIN + '/api/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'react', id, kind }),
    });
    const j = await r.json();
    if (!j?.ok || !j.post) return null;
    const { photo: _drop, ...rest } = j.post as FeedPost & { photo?: string };
    void _drop;
    posts = posts.map((p) => (p.id === rest.id ? rest : p));
    return rest;
  } catch {
    return null;
  }
}

/** Shares a new catch (the small photo included) to the feed, the same way the website does. */
export async function postCatch(name: string, car: Car, photo: string | null, ts: number, shiny: boolean, token?: string): Promise<boolean> {
  if (!photo || photo.length > 190_000) return false;
  try {
    const r = await fetch(API_ORIGIN + '/api/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, make: car.make, model: car.model, rarity: car.rarity, photo, ts, shiny, token }),
    });
    const j = await r.json();
    at = 0; // the feed changed; the next load is a fresh one
    return !!j?.ok;
  } catch {
    return false;
  }
}
