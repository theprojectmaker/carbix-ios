import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { catalogMatch, dexRank } from '@/engine/data';
import type { Catch, Rarity } from '@/engine/types';
import { catchXP, RTIER, TIERS, trimTier } from '@/engine/xp';
import { fonts } from '@/theme/theme';
import { Sprite } from './ui';

const INK = '#141C27';

/** Frame metal per rarity: [frame, light bevel, dark bevel] — exactly the web app's --fr/--frl/--frd. */
const FRAME: Record<Rarity, [string, string, string]> = {
  Common: ['#B3A98D', '#D6CDB4', '#8A8168'],
  Uncommon: ['#7FA05C', '#A6C285', '#5B7A3F'],
  Rare: ['#5FA89B', '#8FC9BE', '#3F7A70'],
  Epic: ['#8C6FB5', '#B49AD6', '#654A8C'],
  Legendary: ['#C9A227', '#E2C55B', '#8F7318'],
  Mythic: ['#D8402F', '#E8705F', '#98261A'],
};

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
};

const pad = (n: number) => String(n).padStart(4, '0');
const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const caughtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}  ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const serial = (g: Catch) =>
  `${String(g.car.model).replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase()}${String(g.id).slice(-1)}-${String(g.id).slice(-5, -1)}`;

/** One line of the spec list: label left, value right, nothing else. */
function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rk}>{k}</Text>
      <Text style={styles.rv} numberOfLines={1}>{v}</Text>
    </View>
  );
}

const Sec = ({ children }: { children: string }) => (
  <Text style={styles.sec}>{children}</Text>
);

/** A slow diagonal glint across epic, legendary and mythic cards, like the web's holo sheen. */
function Sheen() {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.delay(2200), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -40, bottom: -40, width: 70, backgroundColor: 'rgba(255,255,255,.20)', transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { rotate: '18deg' }] }} />
  );
}

/**
 * The catch card: metal frame in the rarity colour, name plate, your photo, three headline numbers, then two short
 * lists (the car, the catch). Only real facts are shown; nothing is estimated or padded.
 */
export function CarCard({ g, units = 'mph' }: { g: Catch; units?: 'mph' | 'kmh' }) {
  const car = g.car;
  const entry = catalogMatch(car);
  const [fr, frl, frd] = FRAME[car.rarity] ?? FRAME.Common;
  const plate = mix(fr, '#666a72', 0.7);
  const darkOnFrame = ['Common', 'Legendary'].includes(car.rarity);
  const mph = car.topSpeedMph || entry?.top || 0;
  const spd = units === 'kmh' ? Math.round(mph * 1.609) : mph;
  const hp = car.horsepower || entry?.hp || 0;
  const zts = String(car.zeroToSixty || entry?.zts || '').replace(/s$/i, '');
  const tt = trimTier(car);
  const about: [string, string][] = [];
  if (car.engine || entry?.eng) about.push(['ENGINE', String(car.engine || entry?.eng)]);
  if (car.drive) about.push(['DRIVE', String(car.drive)]);
  if (car.class || entry?.cls) about.push(['BODY', String(car.class || entry?.cls).toUpperCase()]);
  if (car.country) about.push(['FROM', String(car.country).toUpperCase()]);
  if (car.yearRange || entry?.years) about.push(['YEARS', String(car.yearRange || entry?.years)]);
  if (entry?.low && entry?.high) about.push(['VALUE', `${money(entry.low)} - ${money(entry.high)}`]);
  const trim = (car.trim || '').toUpperCase();

  return (
    <View
      style={{
        width: '100%', maxWidth: 320, alignSelf: 'center', backgroundColor: fr, borderWidth: 3, borderColor: INK, padding: 7,
        shadowColor: '#000', shadowOpacity: 0.35, shadowOffset: { width: 3, height: 3 }, shadowRadius: 0,
      }}>
      {/* bevel */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: frl }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: frl }} />
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: frd }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: frd }} />

      {/* name plate */}
      <View style={[styles.plate, { backgroundColor: plate, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 7 }]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: 'rgba(255,255,255,.45)' }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#2b2f38', letterSpacing: 2 }}>{String(car.make).toUpperCase()}</Text>
          <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#2b2f38' }}>{entry ? 'No. ' + pad(dexRank(entry.n)) : 'NEW'}</Text>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: '#F4F6FA', textShadowColor: 'rgba(16,20,31,.95)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>
          {String(car.model).toUpperCase()}
        </Text>
      </View>

      {/* photo with corner brackets */}
      <View style={[styles.photo, g.shiny && { borderColor: '#C9A227' }]}>
        {g.photo ? <Image source={{ uri: g.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : entry ? <Sprite entry={entry} size={230} /> : null}
        {g.photo && entry ? (
          <View pointerEvents="none" style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(10,13,20,.78)', borderWidth: 2, borderColor: fr, padding: 2 }}>
            <Sprite entry={entry} size={60} crisp shadow />
          </View>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, width: 14, height: 14, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#E4E7EC' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#E4E7EC' }} />
        {g.shiny ? <Text style={{ position: 'absolute', top: 8, right: 8, fontFamily: fonts.utilityBold, fontSize: 13, color: '#7A5A10', backgroundColor: '#FFD84D', borderWidth: 2, borderColor: INK, paddingHorizontal: 5, paddingVertical: 1 }}>SHINY</Text> : null}
      </View>

      {/* rarity strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, backgroundColor: fr, borderWidth: 2, borderColor: INK, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: darkOnFrame ? INK : '#fff', letterSpacing: 1.5 }}>{car.rarity.toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {TIERS.map((t, i) => (
            <View key={t} style={{ width: 8, height: 8, borderWidth: 1.5, borderColor: darkOnFrame ? INK : '#fff', backgroundColor: i <= (RTIER[car.rarity] ?? 0) ? (darkOnFrame ? INK : '#fff') : 'transparent' }} />
          ))}
        </View>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: darkOnFrame ? INK : '#fff', marginLeft: 'auto' }}>+{catchXP(car) + (g.shiny ? 100 : 0)} XP</Text>
      </View>

      {!entry ? (
        <View style={[styles.body, { alignItems: 'center', paddingVertical: 18 }]}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#E4E7EC' }}>NOT ADDED YET</Text>
          <Text style={[styles.rk, { textAlign: 'center', marginTop: 4 }]}>THIS ONE IS NOT IN THE BIX. THE CATCH IS SAVED.</Text>
        </View>
      ) : (
        <>
          {/* three big numbers */}
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {[[hp ? String(hp) : '-', 'HORSEPOWER'], [spd ? String(spd) : '-', units === 'kmh' ? 'TOP KM/H' : 'TOP MPH'], [zts || '-', '0-60 SEC']].map(([v, k]) => (
              <View key={k} style={{ flex: 1, backgroundColor: '#1a2133', borderWidth: 2, borderColor: INK, alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: '#F4F6FA' }}>{v}</Text>
                <Text style={{ fontFamily: fonts.utility, fontSize: 12, color: '#8e98b8', letterSpacing: 1 }}>{k}</Text>
              </View>
            ))}
          </View>

          <View style={styles.body}>
            <Sec>THE CAR</Sec>
            {trim && trim !== 'STANDARD' && trim !== 'BASE' ? <Row k="TRIM" v={tt ? `${trim}  +${tt.xp} XP` : trim} /> : null}
            {about.map(([k, v]) => <Row key={k} k={k} v={v} />)}
            {car.color ? (
              <View style={styles.row}>
                <Text style={styles.rk}>COLOUR</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                  {car.colorHex && /^#[0-9a-f]{6}$/i.test(String(car.colorHex)) ? <View style={{ width: 12, height: 12, backgroundColor: String(car.colorHex), borderWidth: 1.5, borderColor: '#E4E7EC' }} /> : null}
                  <Text style={styles.rv} numberOfLines={1}>{String(car.color).toUpperCase()}</Text>
                </View>
              </View>
            ) : null}

            <Sec>THE CATCH</Sec>
            <Row k="WHEN" v={caughtDate(g.ts)} />
            {g.geo ? <Row k="WHERE" v={`${g.geo.lat.toFixed(3)}, ${g.geo.lng.toFixed(3)}`} /> : null}
            <Row k="AI CONFIDENCE" v={`${car.confidence || 90}%`} />
          </View>
        </>
      )}

      {RTIER[car.rarity] >= 3 ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}><Sheen /></View> : null}

      {/* serial plate */}
      <View style={[styles.plate, { backgroundColor: plate, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 6 }]}>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#2b2f38', letterSpacing: 1 }}>{serial(g)}</Text>
        <Text style={{ fontFamily: fonts.utilityBold, fontSize: 14, color: '#2b2f38', letterSpacing: 1 }}>CARBIX</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 2, borderColor: INK, borderRadius: 2 },
  photo: { borderWidth: 2, borderColor: INK, backgroundColor: '#0a0d14', overflow: 'hidden', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  body: { backgroundColor: '#161c2c', borderWidth: 2, borderColor: INK, marginTop: 4, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 10 },
  sec: { fontFamily: fonts.utilityBold, fontSize: 13, color: '#C9A227', letterSpacing: 2, marginTop: 8, marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,.07)' },
  rk: { fontFamily: fonts.utility, fontSize: 13, color: '#8e98b8', letterSpacing: 1 },
  rv: { fontFamily: fonts.display, fontSize: 17, lineHeight: 19, color: '#E4E7EC', flexShrink: 1, textAlign: 'right' },
});
