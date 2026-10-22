/** Switches the real iOS home-screen icon. Needs a build that contains the alternate icons; in Expo Go it quietly does nothing. */
type Mod = { setAlternateAppIcon: (n: string | null) => Promise<string | null>; supportsAlternateIcons: boolean };

function mod(): Mod | null {
  try {
    // required lazily so a build without the native module (Expo Go) cannot crash at import time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-alternate-app-icons') as Mod;
  } catch {
    return null;
  }
}

export const canSwitchIcon = () => !!mod()?.supportsAlternateIcons;

export async function wearIcon(id: string | null): Promise<boolean> {
  const m = mod();
  if (!m || !m.supportsAlternateIcons) return false;
  try {
    await m.setAlternateAppIcon(id ? id.charAt(0).toUpperCase() + id.slice(1) : null);
    return true;
  } catch {
    return false;
  }
}
