/** Switches the real iOS home-screen icon. Needs a build that contains the alternate icons; in Expo Go it quietly does nothing. */
type Mod = {
  setAlternateAppIcon: (n: string | null) => Promise<string | null>;
  getAppIconName?: () => string | null;
  supportsAlternateIcons: boolean;
};

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

/** Asks iOS for the icon, then asks iOS which icon it now has, and says exactly what happened. */
export async function wearIcon(id: string | null): Promise<{ ok: boolean; detail: string }> {
  const m = mod();
  if (!m) return { ok: false, detail: 'THE ICON PART IS NOT IN THIS BUILD' };
  if (!m.supportsAlternateIcons) return { ok: false, detail: 'THIS BUILD HAS NO ALTERNATE ICONS INSTALLED' };
  const name = id ? id.charAt(0).toUpperCase() + id.slice(1) : null;
  try {
    await m.setAlternateAppIcon(name);
    const now = m.getAppIconName ? m.getAppIconName() : name;
    if ((now ?? null) === name) return { ok: true, detail: name ? name.toUpperCase() : 'DEFAULT ICON' };
    return { ok: false, detail: `IOS KEPT ${now ? String(now).toUpperCase() : 'THE DEFAULT ICON'}` };
  } catch (e) {
    return { ok: false, detail: String((e as { message?: string })?.message ?? e).replace(/\s+/g, ' ').slice(0, 90).toUpperCase() };
  }
}
