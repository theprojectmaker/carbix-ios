import * as WebBrowser from 'expo-web-browser';

import { GOOGLE_SIGNIN_URL } from '@/engine/api';

/**
 * Google sign-in in a pop-up sheet over the app (the system's secure web sign-in session, not a new Safari tab).
 * The website page signs you in and ends on carbix://signed-in?code=XXXXXX, which closes the sheet and hands the
 * one-time code straight back here.
 */
export async function googleSignInCode(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  try {
    const res = await WebBrowser.openAuthSessionAsync(GOOGLE_SIGNIN_URL + '?app=1', 'carbix://signed-in');
    if (res.type === 'success' && res.url) {
      const m = /[?&]code=([A-Za-z0-9]+)/.exec(res.url);
      if (m) return { ok: true, code: m[1].toUpperCase() };
      return { ok: false, error: 'GOOGLE SIGN-IN FINISHED BUT NO CODE CAME BACK. TRY AGAIN.' };
    }
    return { ok: false, error: 'GOOGLE SIGN-IN WAS CLOSED BEFORE IT FINISHED.' };
  } catch {
    return { ok: false, error: 'COULD NOT OPEN GOOGLE SIGN-IN.' };
  }
}
