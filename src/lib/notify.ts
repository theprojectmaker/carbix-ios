import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { API_ORIGIN } from '@/engine/api';

/**
 * Notifications: a daily nudge to go spotting, a warning when a streak is about to end (both scheduled on the
 * phone), and friends' rare catches (sent by the server through Expo's push service). Everything here is
 * best-effort: in Expo Go or without permission it quietly does nothing.
 */
export type NotifyPrefs = { nudge: boolean; nudgeHour: number; nudgeMinute: number; streak: boolean; friends: boolean };
export const DEFAULT_NOTIFY: NotifyPrefs = { nudge: true, nudgeHour: 16, nudgeMinute: 30, streak: true, friends: true };

const EAS_PROJECT_ID = 'e8205d95-5bed-46b2-bab9-a5e1bcfdee83';
let handlerSet = false;

/** Alerts show even while the app is open (a friend's catch while you are in the garage). */
export function setupNotifications() {
  if (handlerSet) return;
  handlerSet = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  } catch {
    /* not available here */
  }
}

export async function notifyGranted(): Promise<boolean> {
  try {
    const s = await Notifications.getPermissionsAsync();
    return s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/** The system permission prompt. Returns whether notifications are now allowed. */
export async function askNotify(): Promise<boolean> {
  try {
    const s = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Re-plans the phone-side notifications from the current settings: the daily nudge, and tonight's streak warning
 * when a streak is alive and nothing was caught today. Called whenever a catch lands or a setting changes.
 */
export async function planLocalNotifications(prefs: NotifyPrefs, state: { streak: number; caughtToday: boolean; cotd: string }) {
  try {
    if (!(await notifyGranted())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (prefs.nudge) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Time to go spotting', body: `Today's car of the day is the ${state.cotd}. Catch it for double XP.`, sound: 'default', data: { route: '/' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: prefs.nudgeHour, minute: prefs.nudgeMinute },
      });
    }
    if (prefs.streak && state.streak >= 2 && !state.caughtToday) {
      const at = new Date();
      at.setHours(19, 30, 0, 0);
      if (at.getTime() > Date.now() + 60000) {
        await Notifications.scheduleNotificationAsync({
          content: { title: `Your ${state.streak}-day streak ends at midnight`, body: 'One scan keeps it alive.', sound: 'default', data: { route: '/' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    }
  } catch {
    /* scheduling is a convenience */
  }
}

/**
 * Tells the server where to send pushes for this account (friends' rare catches). Expo's push service needs a
 * real build with the push entitlement; in Expo Go this fails quietly.
 */
export async function registerPush(accountToken: string, prefs: NotifyPrefs): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    if (!(await notifyGranted())) return false;
    const t = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    if (!t?.data) return false;
    const r = await fetch(API_ORIGIN + '/api/push-subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: accountToken, action: 'subscribe', expo: t.data, prefs: { friendrare: prefs.friends }, build: 'native' }),
    });
    const j = await r.json();
    return !!j?.ok;
  } catch {
    return false;
  }
}

export async function updatePushPrefs(accountToken: string, prefs: NotifyPrefs) {
  try {
    await fetch(API_ORIGIN + '/api/push-subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: accountToken, action: 'prefs', prefs: { friendrare: prefs.friends } }),
    });
  } catch {
    /* next launch re-registers */
  }
}

/** Opens the screen a tapped notification points at. */
export function onNotificationTap(go: (route: string) => void) {
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((e) => {
      const route = (e.notification.request.content.data as { route?: string } | undefined)?.route;
      if (route) go(route);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
