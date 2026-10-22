import { API_ORIGIN, fetchFeed, friendsGet } from '@/engine/api';
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
export async function loadFeed(token: string, force = false): Promise<FeedState> {
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
  return { posts, friends, failed: false };
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
export async function postCatch(name: string, car: Car, photo: string | null, ts: number, shiny: boolean): Promise<boolean> {
  if (!photo || photo.length > 190_000) return false;
  try {
    const r = await fetch(API_ORIGIN + '/api/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, make: car.make, model: car.model, rarity: car.rarity, photo, ts, shiny }),
    });
    const j = await r.json();
    at = 0; // the feed changed; the next load is a fresh one
    return !!j?.ok;
  } catch {
    return false;
  }
}
