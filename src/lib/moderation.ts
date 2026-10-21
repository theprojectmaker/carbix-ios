import { Linking } from 'react-native';

import type { Profile } from '@/engine/types';

/** Where reports go. Change this if reports should reach a different inbox. */
export const SUPPORT_EMAIL = 'solomonsasson031@gmail.com';

const clean = (s?: string) => String(s ?? '').replace(/^@+/, '').trim().toLowerCase();

export const blockedList = (p: Profile): string[] => ((p.blocked as string[] | undefined) ?? []);
export const isBlocked = (p: Profile, name?: string) => !!name && clean(name) !== clean(p.username) && blockedList(p).includes(clean(name));
export const isSelf = (p: Profile, name?: string) => !!name && clean(name) === clean(p.username);
/** You cannot block yourself. */
export const withBlocked = (p: Profile, name: string): Profile =>
  isSelf(p, name) ? p : { ...p, blocked: [...new Set([...blockedList(p), clean(name)])] };
export const withUnblocked = (p: Profile, name: string): Profile => ({ ...p, blocked: blockedList(p).filter((n) => n !== clean(name)) });

/** Opens a pre-filled email so a spotter can report a name or a post. */
export function reportUser(name: string, what: string) {
  const subject = encodeURIComponent(`Carbix report: ${name}`);
  const body = encodeURIComponent(`I want to report ${name}.\nWhat it is: ${what}\n\nWhy:\n`);
  return Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
}
