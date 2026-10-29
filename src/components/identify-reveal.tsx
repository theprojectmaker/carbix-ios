import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, interpolate, interpolateColor, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue,
} from 'react-native-reanimated';

import type { Car, Rarity } from '@/engine/types';
import type { Box } from '@/lib/car-finder';
import { play, playCaught } from '@/lib/sfx';
import { fonts } from '@/theme/theme';

/** [colour, shadow, ink readable on it] - the whole readout is drawn in the tier's colour. */
const RARC: Record<Rarity, [string, string, string]> = {
  Common: ['#B3A98D', '#8A8168', '#141C27'], Uncommon: ['#7FA05C', '#5B7A3F', '#0E1A08'],
  Rare: ['#5FA89B', '#3F7A70', '#ffffff'], Epic: ['#8C6FB5', '#654A8C', '#ffffff'],
  Legendary: ['#C9A227', '#8F7318', '#241a02'], Mythic: ['#D8402F', '#98261A', '#ffffff'],
};

function checklist(car: Car): string[] {
  const l: string[] = [];
  if (car.class) l.push(`${car.class} BODY PROFILE`);
  if (car.drive) l.push(`${car.drive} DRIVETRAIN SIGNATURE`);
  if (car.engine) l.push(String(car.engine).toUpperCase());
  if (car.color) l.push(`${String(car.color).toUpperCase()} PAINT MATCH`);
  if (car.country) l.push(`${String(car.country).toUpperCase()} MARQUE CUES`);
  return l.slice(0, 4).map((t) => t + '  OK');
}

const RT: Record<string, number> = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };

/* ---- worklet helpers: everything below runs on the UI thread, driven by ONE timeline value (ms) ---- */
const seg = (t: number, a: number, b: number) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / Math.max(1, b - a)));
};
const ease = (x: number) => {
  'worklet';
  return 1 - Math.pow(1 - x, 4);
};
/** eases out with a small overshoot, for things that land on a target */
const settle = (x: number) => {
  'worklet';
  const c = 1.3;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
/** 1 between a and b, ramping in and out over `f` ms. */
const win = (t: number, a: number, b: number, f = 120) => {
  'worklet';
  return Math.min(1, Math.max(0, (t - a) / f)) * Math.min(1, Math.max(0, (b - t) / f));
};

function Fade({ t, a, b, style, children }: { t: SharedValue<number>; a: number; b: number; style?: object; children?: React.ReactNode }) {
  const s = useAnimatedStyle(() => ({ opacity: win(t.get(), a, b) }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

/** A number that counts up: the timeline drives it on the UI thread and only this small Text re-renders (about 20 times). */
function Count({ t, from, dur, value, unit, style, color }: { t: SharedValue<number>; from: number; dur: number; value: string; unit: string; style: object; color: string }) {
  const num = parseFloat(value);
  const tail = value.replace(/^[d.,-]+/, '');
  const dec = (value.match(/.(d+)/)?.[1] ?? '').length;
  const [txt, setTxt] = useState('0' + unit);
  useAnimatedReaction(
    () => Math.round(ease(seg(t.get(), from, from + dur)) * 12),
    (step, prev) => {
      if (step === prev) return;
      const p = step / 12;
      const out = p >= 1 || !Number.isFinite(num) ? value + unit : (num * p).toFixed(dec) + tail + unit;
      runOnJS(setTxt)(out);
    },
  );
  return <Text style={[style, { color }]}>{txt}</Text>;
}

function Pct({ t, conf, style }: { t: SharedValue<number>; conf: number; style: object }) {
  const [n, setN] = useState(0);
  useAnimatedReaction(
    () => Math.round(conf * ease(seg(t.get(), 50, 700))),
    (v, prev) => {
      if (v !== prev) runOnJS(setN)(v);
    },
  );
  return <Text style={style}>{n}%</Text>;
}

function StatBar({ t, from, color }: { t: SharedValue<number>; from: number; color: string }) {
  // scaleX on a full-width bar: a transform, so no layout pass per frame
  const s = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.001, ease(seg(t.get(), from, from + 420))) }], transformOrigin: 'left center' } as never));
  return <Animated.View style={[{ height: 8, width: '100%', backgroundColor: color }, s]} />;
}

const Shot = memo(function Shot({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory" />;
});

/**
 * The identify sequence from the real app, on one UI-thread timeline: frozen shot and lock-on frame, IDENTIFYING with a
 * confidence count-up and checklist, IDENTIFIED with a push-in and the car's silhouette, stat read-outs that count up,
 * then the card skeleton "minting" with your photo flying into its picture slot.
 */
export function IdentifyReveal({ shot, car, onDone, haptics = true, startBox = null }: { shot: string; car: Car; onDone: () => void; haptics?: boolean; startBox?: Box | null }) {
  const rc = RARC[car.rarity] ?? RARC.Common;
  const [size, setSize] = useState({ W: 0, H: 0 });
  const t = useSharedValue(0);
  const conf = Math.max(50, Math.min(99, car.confidence || 90));
  const checks = useMemo(() => checklist(car), [car]);

  const stats = useMemo(
    () =>
      [
        car.topSpeedMph ? { lbl: 'TOP SPEED', val: String(car.topSpeedMph), unit: ' MPH' } : null,
        car.horsepower ? { lbl: 'POWER', val: String(car.horsepower), unit: ' HP' } : null,
        car.zeroToSixty ? { lbl: '0-60', val: String(car.zeroToSixty), unit: '' } : null,
      ].filter(Boolean) as { lbl: string; val: string; unit: string }[],
    [car],
  );

  // timeline (ms)
  const T = useMemo(() => {
    const found = Math.max(1000, 260 + 170 * checks.length + 380);
    const foundEnd = found + 1000;
    const mint = foundEnd + stats.length * 780;
    const fly = mint + 980;
    return { found, foundEnd, mint, fly, total: fly + 520 + 240 };
  }, [checks.length, stats.length]);

  const statAt = (i: number) => T.foundEnd + i * 780;
  const { W, H } = size;
  const onLayout = (e: LayoutChangeEvent) => setSize({ W: e.nativeEvent.layout.width, H: e.nativeEvent.layout.height });

  const box = useMemo(() => {
    const b = car.box;
    if (W && b && b.w > 0.08 && b.h > 0.08 && b.x >= 0 && b.y >= 0) {
      return { left: b.x * W, top: b.y * H, w: Math.min(b.w, 1 - b.x) * W, h: Math.min(b.h, 1 - b.y) * H };
    }
    if (W && startBox) return { left: startBox.x * W, top: startBox.y * H, w: startBox.w * W, h: startBox.h * H };
    return { left: W * 0.19, top: H * 0.3, w: W * 0.62, h: H * 0.4 };
  }, [W, H, car.box, startBox]);


  // start once measured
  useEffect(() => {
    if (!W || !H) return;
    t.set(0);
    t.set(withTiming(T.total, { duration: T.total, easing: Easing.linear }));
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    checks.forEach((_, i) => at(260 + 170 * i, () => play('click')));
    if (conf >= 96) at(700, () => play('ping2'));
    const tap = (style: Haptics.ImpactFeedbackStyle) => { if (haptics) Haptics.impactAsync(style).catch(() => {}); };
    at(600, () => tap(Haptics.ImpactFeedbackStyle.Light));
    at(T.found, () => { playCaught(car.rarity); tap(Haptics.ImpactFeedbackStyle.Heavy); });
    stats.forEach((_, i) => at(statAt(i), () => { play('click'); play('ping0'); if (haptics) Haptics.selectionAsync().catch(() => {}); }));
    if ((RT[car.rarity] ?? 0) >= 3) at(T.found + 150, () => play('rev'));
    at(T.mint, () => { play('tab'); tap(Haptics.ImpactFeedbackStyle.Light); });
    at(T.fly - 20, () => play('swipe'));
    at(T.fly + 520, () => { play('click'); tap(Haptics.ImpactFeedbackStyle.Medium); });
    at(T.total, onDone);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H]);

  // ----- animated styles -----
  const zoomStyle = useAnimatedStyle(() => {
    // a gentle push-in from the centre: scaling about a moving origin every frame is what looked jittery
    const s = 1 + 0.045 * ease(seg(t.get(), T.found, T.found + 700));
    return { transform: [{ scale: s }] };
  });
  // the lock-on frame starts as the generic frame the scan was showing, then its corners MORPH onto the car's own box
  // the frame starts exactly where the scan's lock frame was (on the car when the phone found it)
  const pad = 0.06;
  const gl = startBox ? Math.max(0, startBox.x - startBox.w * pad) * W : W * 0.11;
  const gt = startBox ? Math.max(0, startBox.y - startBox.h * pad) * H : (H - Math.min(H * 0.46, W * 0.78 * 0.62)) / 2;
  const gw = startBox ? Math.max(90, Math.min(W - gl, startBox.w * (1 + 2 * pad) * W)) : W * 0.78;
  const gh = startBox ? Math.max(70, Math.min(H - gt, startBox.h * (1 + 2 * pad) * H)) : Math.min(H * 0.46, W * 0.78 * 0.62);
  const frameStyle = useAnimatedStyle(() => {
    const p = settle(seg(t.get(), 0, 650));
    return {
      left: gl + (box.left - gl) * p, top: gt + (box.top - gt) * p,
      width: gw + (box.w - gw) * p, height: gh + (box.h - gh) * p,
      opacity: 1 - seg(t.get(), T.mint, T.mint + 150),
    };
  });
  const cornerColor = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.get(), [0, 500, T.found - 1, T.found, T.found + 260], ['#5dff9b', rc[0], rc[0], '#ffffff', rc[0]]),
  }));
  const mintStyle = useAnimatedStyle(() => ({ opacity: seg(t.get(), T.mint, T.mint + 160) }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: 0.2 * win(t.get(), T.found, T.found + 600, 60) }));
  const confBar = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.001, (conf / 100) * ease(seg(t.get(), 50, 700))) }], transformOrigin: 'left center' } as never));

  // skeleton card geometry
  const cardW = Math.min(W * 0.78, 300);
  const cardLeft = (W - cardW) / 2;
  const cardTop = H * 0.12;
  const slotH = cardW * (7 / 16);
  const slotTop = cardTop + 6 + 36 + 6;
  const flyStyle = useAnimatedStyle(() => {
    const p = settle(seg(t.get(), T.fly, T.fly + 520));
    return {
      left: interpolate(p, [0, 1], [0, cardLeft + 6]), top: interpolate(p, [0, 1], [0, slotTop]),
      width: interpolate(p, [0, 1], [W, cardW - 12]), height: interpolate(p, [0, 1], [H, slotH]), opacity: seg(t.get(), T.fly - 1, T.fly),
    };
  });
  const skelA = (i: number) => T.mint + 160 + i * 110;

  const chip = (children: React.ReactNode, bg: string) => <View style={{ backgroundColor: bg, paddingHorizontal: 12, paddingVertical: 5 }}>{children}</View>;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {W ? (
        <>
          {/* shot + frame + silhouette, pushed in together */}
          <Animated.View style={[StyleSheet.absoluteFill, zoomStyle]}>
            <Shot uri={shot} />
            <Animated.View style={[{ position: 'absolute' }, frameStyle]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                <Animated.View
                  key={c}
                  style={[
                    {
                      position: 'absolute', width: 22, height: 22,
                      top: c[0] === 't' ? 0 : undefined, bottom: c[0] === 'b' ? 0 : undefined,
                      left: c[1] === 'l' ? 0 : undefined, right: c[1] === 'r' ? 0 : undefined,
                      borderTopWidth: c[0] === 't' ? 3 : 0, borderBottomWidth: c[0] === 'b' ? 3 : 0,
                      borderLeftWidth: c[1] === 'l' ? 3 : 0, borderRightWidth: c[1] === 'r' ? 3 : 0,
                    },
                    cornerColor,
                  ]}
                />
              ))}
              <Fade t={t} a={T.found} b={T.mint - 100} style={{ position: 'absolute', left: 0, top: -20 }}>
                {chip(<Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: rc[2], letterSpacing: 1 }}>{String(car.model).toUpperCase()}</Text>, rc[0])}
              </Fade>
            </Animated.View>
          </Animated.View>

          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }, flashStyle]} />

          {/* phase 1: identifying */}
          <Fade t={t} a={0} b={T.found} style={{ position: 'absolute', left: 10, top: 10, right: 10 }}>
            <View style={{ backgroundColor: 'rgba(8,10,16,.72)', borderWidth: 2, borderColor: rc[0], paddingHorizontal: 10, paddingVertical: 7, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, backgroundColor: rc[0] }} />
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: rc[0], letterSpacing: 1.5 }}>IDENTIFYING...</Text>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: '#fff' }} numberOfLines={1}>{String(car.make).toUpperCase()}</Text>
            </View>
          </Fade>
          <Fade t={t} a={0} b={T.found} style={{ position: 'absolute', left: 10, right: 10, bottom: 10, gap: 6 }}>
            <View style={{ gap: 3 }}>
              {checks.map((c, i) => (
                <Fade key={i} t={t} a={260 + 170 * i} b={T.found + 60} style={{ alignSelf: 'flex-start' }}>
                  <Text style={{ fontFamily: fonts.utility, fontSize: 9.5, color: rc[0], backgroundColor: 'rgba(8,10,16,.7)', paddingHorizontal: 6, paddingVertical: 2 }}>{c}</Text>
                </Fade>
              ))}
            </View>
            <View style={{ backgroundColor: 'rgba(8,10,16,.78)', borderWidth: 2, borderColor: rc[0], padding: 8, gap: 5 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: '#C9D2E6' }}>MATCH CONFIDENCE</Text>
                <Pct t={t} conf={conf} style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: rc[0], padding: 0, minWidth: 34, textAlign: 'right' }} />
              </View>
              <View style={{ height: 8, backgroundColor: '#222c3d' }}>
                <Animated.View style={[{ height: 8, width: '100%', backgroundColor: rc[0] }, confBar]} />
              </View>
              {conf >= 96 ? (
                <Fade t={t} a={700} b={T.found} style={{ alignSelf: 'flex-start' }}>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 9, color: '#5dff9b' }}>CLEAN SCAN</Text>
                </Fade>
              ) : null}
            </View>
          </Fade>

          {/* phase 2: identified */}
          <Fade t={t} a={T.found} b={T.foundEnd} style={{ position: 'absolute', left: 10, top: 10, right: 10 }}>
            <View style={{ backgroundColor: 'rgba(8,10,16,.72)', borderWidth: 2, borderColor: rc[0], paddingHorizontal: 10, paddingVertical: 7, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, backgroundColor: rc[0] }} />
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: rc[0], letterSpacing: 1.5 }}>{conf < 65 ? 'UNCERTAIN' : 'IDENTIFIED'}</Text>
              </View>
              <Text style={{ fontFamily: fonts.display, fontSize: 24, color: rc[0] }} numberOfLines={1}>{`${String(car.make).toUpperCase()} ${String(car.model).toUpperCase()}`}</Text>
            </View>
          </Fade>
          <Fade t={t} a={T.found} b={T.foundEnd} style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
            {chip(<Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: rc[2], letterSpacing: 2 }}>{conf < 65 ? 'LOW CONFIDENCE - VERIFY?' : 'MATCH FOUND'}</Text>, rc[0])}
          </Fade>

          {/* phase 3: stat read-outs */}
          {stats.map((s, i) => (
            <Fade key={s.lbl} t={t} a={statAt(i)} b={statAt(i) + 780} style={{ position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center' }}>
              <View style={{ backgroundColor: 'rgba(8,10,16,.82)', borderWidth: 3, borderColor: rc[0], paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center', minWidth: 230, gap: 4 }}>
                <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#C9D2E6', letterSpacing: 2 }}>{s.lbl}</Text>
                <Count t={t} from={statAt(i)} dur={380} value={s.val} unit={s.unit} color={rc[0]} style={{ fontFamily: fonts.display, fontSize: 54, lineHeight: 58, textAlign: 'center', minWidth: 200 }} />
                <View style={{ height: 8, width: '100%', backgroundColor: '#222c3d' }}>
                  <StatBar t={t} from={statAt(i)} color={rc[0]} />
                </View>
                <Text style={{ fontFamily: fonts.utility, fontSize: 8.5, color: '#8e98b8', letterSpacing: 1.5 }}>EXTRACTING DATA</Text>
              </View>
            </Fade>
          ))}

          {/* phase 4: minting the card */}
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,10,16,.84)' }, mintStyle]}>
            <View style={{ position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: rc[0], letterSpacing: 2 }}>MINTING CATCH CARD</Text>
            </View>
            <View style={{ position: 'absolute', left: cardLeft, top: cardTop, width: cardW, backgroundColor: rc[0], borderWidth: 3, borderColor: '#141C27', padding: 6, gap: 6 }}>
              <Fade t={t} a={skelA(0)} b={99999} style={{ height: 36, backgroundColor: 'rgba(0,0,0,.28)' }} />
              <Fade t={t} a={skelA(1)} b={99999} style={{ height: slotH, backgroundColor: '#0a0d14' }} />
              {[0.7, 0.45, 0.85, 0.6].map((w, i) => (
                <Fade key={i} t={t} a={skelA(2 + i)} b={99999} style={{ height: 10, width: `${w * 100}%`, backgroundColor: 'rgba(0,0,0,.3)' }} />
              ))}
            </View>
            <Animated.View style={[{ position: 'absolute', overflow: 'hidden' }, flyStyle]}>
              <Shot uri={shot} />
            </Animated.View>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}
