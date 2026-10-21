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

const CLASS_EST: Record<string, { rl: number; tq: number; wt: number }> = {
  SEDAN: { rl: 6200, tq: 190, wt: 3300 }, SUV: { rl: 6000, tq: 260, wt: 4300 },
};

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
};

const pad = (n: number) => String(n).padStart(4, '0');
const money = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const caughtDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const serial = (g: Catch) =>
  `${String(g.car.model).replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase()}${String(g.id).slice(-1)}-${String(g.id).slice(-5, -1)}`;

/** 20 discrete slots, like the web's segmented stat track. */
function Gauge({ label, value, max, text }: { label: string; value: number; max: number; text: string | number }) {
  const filled = value > 0 ? Math.max(1, Math.round(Math.min(1, value / max) * 20)) : 0;
  return (
    <View style={styles.gRow}>
      <Text style={styles.gLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', gap: 1, height: 11, marginHorizontal: 8 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i < filled ? '#CFC6A8' : '#262E42' }} />
        ))}
      </View>
      <Text style={styles.gVal}>{text}</Text>
    </View>
  );
}

function Spec({ k, v, est, wide }: { k: string; v: string; est?: boolean; wide?: boolean }) {
  return (
    <View style={[styles.spec, wide ? { width: '100%' } : { width: '50%' }]}>
      <Text style={styles.sk}>{k}</Text>
      <Text style={styles.sv} numberOfLines={1}>
        {v}
        {est ? <Text style={styles.est}> EST</Text> : null}
      </Text>
    </View>
  );
}

const Sec = ({ children }: { children: string }) => (
  <View style={{ marginTop: 10, marginBottom: 4 }}>
    <Text style={styles.sec}>{children}</Text>
    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,.12)', marginTop: 3 }} />
  </View>
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

/** The catch card — same construction as the web's tcardHTML(): metal frame, chrome plate, photo, spec sheet, serial plate. */
export function CarCard({ g }: { g: Catch }) {
  const car = g.car;
  const entry = catalogMatch(car);
  const [fr, frl, frd] = FRAME[car.rarity] ?? FRAME.Common;
  const plate = mix(fr, '#666a72', 0.7);
  const spd = car.topSpeedMph || 0;
  const hp = car.horsepower || 0;
  const zts = parseFloat(String(car.zeroToSixty)) || 0;
  const ex = CLASS_EST[(car.class || 'SEDAN').toUpperCase()] ?? CLASS_EST.SEDAN;
  const tt = trimTier(car);
  const has = (v: unknown) => Boolean(v);
  const e = (v: unknown, fb: number) => (has(v) ? String(v) : String(fb));

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

      {/* chrome name plate */}
      <View style={[styles.plate, { backgroundColor: plate, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6 }]}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: 'rgba(255,255,255,.45)' }} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: '#F4F6FA', flexShrink: 1, textShadowColor: 'rgba(16,20,31,.95)', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>
          {String(car.model).toUpperCase()}
        </Text>
        <Text style={{ fontFamily: fonts.utility, fontSize: 10.2, color: '#3c3f47', marginBottom: 3 }}>{String(car.make).toUpperCase()}</Text>
        <View style={{ flex: 1 }} />
        {g.shiny ? <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: '#7A5A10', backgroundColor: '#FFD84D', borderWidth: 2, borderColor: INK, paddingHorizontal: 4, paddingVertical: 1, marginBottom: 2 }}>SHINY</Text> : null}
        <Text style={{ fontFamily: fonts.utility, fontSize: 11.4, color: '#3c3f47', marginBottom: 3 }}>{entry ? '#' + pad(dexRank(entry.n)) : '—'}</Text>
      </View>

      {/* photo plate with corner brackets */}
      <View style={[styles.photo, g.shiny && { borderColor: '#C9A227' }]}>
        {g.photo ? <Image source={{ uri: g.photo }} style={StyleSheet.absoluteFill} contentFit="cover" /> : entry ? <Sprite entry={entry} size={230} /> : null}
        {g.photo && entry ? (
          <View pointerEvents="none" style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(10,13,20,.78)', borderWidth: 2, borderColor: fr, padding: 2 }}>
            <Sprite entry={entry} size={60} crisp shadow />
          </View>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, width: 14, height: 14, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#E4E7EC' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#E4E7EC' }} />
      </View>

      {!entry ? (
        <View style={[styles.body, { alignItems: 'center', paddingVertical: 18 }]}>
          <Text style={{ fontFamily: fonts.display, fontSize: 22, color: '#E4E7EC' }}>NOT ADDED YET</Text>
          <Text style={[styles.sk, { textAlign: 'center', marginTop: 4 }]}>THIS ONE ISN&apos;T IN THE BIX — THE CATCH IS SAVED</Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {[['POWER', hp ? String(hp) : '-', 'HP'], ['TOP', spd ? String(spd) : '-', 'MPH'], ['0-60', car.zeroToSixty ? String(car.zeroToSixty).replace(/s$/i, '') : '-', 'SEC']].map(([k, v, u]) => (
              <View key={k} style={{ flex: 1, backgroundColor: '#1a2133', borderWidth: 2, borderColor: INK, alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: '#F4F6FA' }}>{v}</Text>
                <Text style={{ fontFamily: fonts.utility, fontSize: 8, color: '#8e98b8', letterSpacing: 1 }}>{k}  {u}</Text>
              </View>
            ))}
          </View>
          <View style={styles.trim}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10.5, color: '#C9D2E6', letterSpacing: 1 }}>
              {(car.trim || 'BASE').toUpperCase()}
              {tt ? <Text style={{ color: '#C9A227' }}>  +{tt.xp} XP</Text> : null}
            </Text>
          </View>
          <View style={styles.body}>
            <Text style={[styles.sk, { marginBottom: 8, letterSpacing: 1 }]}>
              {[car.class, (car.country || '').toUpperCase(), car.yearRange].filter(Boolean).join(' · ') || '- -'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <View style={{ backgroundColor: fr, borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: ['Common', 'Legendary'].includes(car.rarity) ? INK : '#fff' }}>{car.rarity.toUpperCase()}</Text>
              </View>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: '#C9A227' }}>+{catchXP(car)} XP</Text>
              {car.colorHex && /^#[0-9a-f]{6}$/i.test(String(car.colorHex)) ? <View style={{ width: 14, height: 14, backgroundColor: String(car.colorHex), borderWidth: 2, borderColor: '#E4E7EC', marginLeft: 'auto' }} /> : null}
            </View>
            <Gauge label="SPD" value={spd} max={220} text={spd || '—'} />
            <Gauge label="HP" value={hp} max={750} text={hp || '—'} />
            <Gauge label="0-60" value={zts ? Math.max(1, 13 - zts) : 0} max={11} text={car.zeroToSixty || '—'} />
            <Sec>SPEC SHEET</Sec>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Spec wide k="ENGINE" v={car.engine || '—'} />
              <Spec k="REDLINE" v={e(car.redlineRpm, ex.rl)} est={!has(car.redlineRpm)} />
              <Spec k="TORQUE" v={e(car.torqueLbFt, ex.tq)} est={!has(car.torqueLbFt)} />
              <Spec k="WEIGHT" v={e(car.weightLbs, ex.wt)} est={!has(car.weightLbs)} />
              <Spec k="DRIVE" v={car.drive || '—'} />
              <Spec k="PWR/WT" v={car.powerToWeight || (car.horsepower ? (car.horsepower / (car.weightLbs || ex.wt)).toFixed(3) : '—')} est={!car.powerToWeight} />
              <Spec k="MSRP" v={car.msrpNew || '—'} />
              {car.color ? <Spec k="COLOR" v={String(car.color)} /> : null}
              <Spec wide k="MARKET" v={entry.low && entry.high ? `${money(entry.low)}-${money(entry.high)}` : car.marketUsed || '—'} />
            </View>
            <Sec>CAUGHT</Sec>
            <Spec wide k="DATE" v={caughtDate(g.ts)} />
            {g.geo ? <Spec wide k="WHERE" v={`${g.geo.lat.toFixed(3)}, ${g.geo.lng.toFixed(3)}`} /> : null}
            <Spec wide k="AI READ" v={`${car.confidence || 90}%`} est />
          </View>
        </>
      )}

      {RTIER[car.rarity] >= 3 ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}><Sheen /></View> : null}

      {/* serial plate */}
      <View style={[styles.plate, { backgroundColor: plate, marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 7 }]}>
        <Text style={{ fontFamily: fonts.utility, fontSize: 10.5, color: '#3c3f47', letterSpacing: 1 }}>{serial(g)}</Text>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {TIERS.map((t, i) => (
            <View key={t} style={{ width: 9, height: 9, borderWidth: 1.5, borderColor: INK, backgroundColor: i <= (RTIER[car.rarity] ?? 0) ? fr : 'transparent' }} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderWidth: 2, borderColor: INK, borderRadius: 2 },
  photo: { borderWidth: 2, borderColor: INK, backgroundColor: '#0a0d14', overflow: 'hidden', aspectRatio: 16 / 7, alignItems: 'center', justifyContent: 'center' },
  trim: { backgroundColor: '#20273a', borderWidth: 2, borderColor: INK, marginTop: 4, paddingHorizontal: 10, paddingVertical: 8 },
  body: { backgroundColor: '#161c2c', borderWidth: 2, borderColor: INK, marginTop: 4, paddingHorizontal: 11, paddingVertical: 10 },
  gRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  gLabel: { fontFamily: fonts.utility, fontSize: 9.5, color: '#8e98b8', width: 32 },
  gVal: { fontFamily: fonts.utilityBold, fontSize: 10, color: '#E4E7EC', width: 44, textAlign: 'right' },
  sec: { fontFamily: fonts.utilityBold, fontSize: 10.5, color: '#C9A227', letterSpacing: 1.5 },
  spec: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingRight: 14 },
  sk: { fontFamily: fonts.utility, fontSize: 9.5, color: '#8e98b8' },
  sv: { fontFamily: fonts.utilityBold, fontSize: 10, color: '#E4E7EC', flexShrink: 1, textAlign: 'right' },
  est: { fontFamily: fonts.utility, fontSize: 9, color: '#8e98b8' },
});
