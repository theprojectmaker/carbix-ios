import { useSyncExternalStore } from 'react';

/**
 * Pop-ups: the small cards that slide in at the top of the screen when something happens (a quest finishes, you level
 * up, a friend request arrives). A queue, shown one at a time for a few seconds; tap one to go where it points.
 */
export type ToastKind = 'quest' | 'level' | 'trophy' | 'daily' | 'friend' | 'race' | 'feed' | 'bonus' | 'info' | 'error' | 'progress';
export type Toast = { id: number; kind: ToastKind; title: string; body?: string; route?: string; ms: number };

let queue: Toast[] = [];
let seq = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showToast(t: { kind?: ToastKind; title: string; body?: string; route?: string; ms?: number }) {
  const id = seq++;
  // the same title twice in a row is one pop-up, not two
  if (queue.some((q) => q.title === t.title && q.body === t.body)) return id;
  queue = [...queue, { id, kind: t.kind || 'info', title: t.title, body: t.body, route: t.route, ms: t.ms ?? (t.body ? 4200 : 3000) }].slice(-6);
  emit();
  return id;
}

export function dismissToast(id: number) {
  if (!queue.some((q) => q.id === id)) return;
  queue = queue.filter((q) => q.id !== id);
  emit();
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => { subs.delete(f); };
};
const snapshot = () => queue;

/** The pop-up at the front of the queue, if any. */
export function useToastQueue(): Toast[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
