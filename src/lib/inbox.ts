import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * The in-app notification inbox: race invites, friend requests, level-ups, finished quests, trophies, reactions on
 * your catches. Kept on this device (last 60), shown behind the bell in the header. Nothing here is a push notification;
 * it is what happened while you were playing or since you last opened the app.
 */
export type NoticeKind = 'race' | 'friend' | 'level' | 'quest' | 'trophy' | 'feed' | 'daily' | 'info';
export type Notice = { id: string; ts: number; kind: NoticeKind; title: string; body?: string; route?: string; read: boolean };

const KEY = 'motordex.native.inbox';
const MAX = 60;
let items: Notice[] = [];
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

async function save() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* the inbox is a convenience */
  }
}

export async function loadInbox() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Notice[]) : [];
    if (Array.isArray(list)) items = list.filter((n) => n && n.id && n.title).slice(0, MAX);
    emit();
  } catch {
    /* start empty */
  }
}

/** Adds a notice. `key` dedupes: the same key within a day is not added twice (polls repeat). */
export function addNotice(n: { kind: NoticeKind; title: string; body?: string; route?: string; key?: string }) {
  const now = Date.now();
  if (n.key) {
    const id = 'k:' + n.key;
    if (items.some((x) => x.id === id && now - x.ts < 86400000)) return;
    items = items.filter((x) => x.id !== id);
    items = [{ id, ts: now, kind: n.kind, title: n.title, body: n.body, route: n.route, read: false }, ...items].slice(0, MAX);
  } else {
    items = [{ id: now.toString(36) + Math.random().toString(36).slice(2, 6), ts: now, kind: n.kind, title: n.title, body: n.body, route: n.route, read: false }, ...items].slice(0, MAX);
  }
  emit();
  save();
}

export function markAllRead() {
  if (!items.some((n) => !n.read)) return;
  items = items.map((n) => (n.read ? n : { ...n, read: true }));
  emit();
  save();
}

export function clearInbox() {
  items = [];
  emit();
  save();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => { subs.delete(f); };
};
const snapshot = () => items;

/** Live view of the inbox for screens and the header bell. */
export function useInbox(): { items: Notice[]; unread: number } {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { items: list, unread: list.filter((n) => !n.read).length };
}
