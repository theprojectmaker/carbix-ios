import { File } from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useIsFocused } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/screen';

import { Image } from 'expo-image';
import { IdentifyReveal } from '@/components/identify-reveal';
import { Plate } from '@/components/plate';
import { ScanSweep } from '@/components/scan-sweep';
import { Btn, PText } from '@/components/ui';
import { identify, research } from '@/engine/api';
import { stampCatchContext } from '@/engine/context';
import type { Car } from '@/engine/types';
import { catalogMatch, fixStats } from '@/engine/data';
import { postCatch } from '@/lib/feed';
import { play, playCaught } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { useRace } from '@/state/race';
import { fonts, useTheme } from '@/theme/theme';

type Phase = 'idle' | 'reading' | 'error';

/** Cool mode shrinks the frame we ship to the server (the phone-heat fix from the web app). */
const MAX_W = { cool: 1024, full: 1280 }; // what the website sends; the AI needs the grille and badges, not a thumbnail
const FIELD_TIPS = ['READY TO SCAN', 'HOLD STILL A BEAT', 'PARKED CARS = EASY', 'FILL THE FRAME WITH THE CAR'];
const CALL_BRANDS = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'BMW', 'Mercedes', 'Nissan', 'Hyundai', 'Jeep', 'Subaru', 'Audi', 'Kia', 'Lexus', 'Dodge', 'Volkswagen'];
const newPicks = () => [...CALL_BRANDS].sort(() => Math.random() - 0.5).slice(0, 5);

/** Rotating field tip. Its 4 s timer re-renders only this Text, not the whole camera screen. */
function Tip() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % FIELD_TIPS.length), 4000);
    return () => clearInterval(id);
  }, []);
  return <>{FIELD_TIPS[i]}</>;
}

function MinLeft({ endTs }: { endTs: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  return <>{Math.max(0, Math.round(((endTs ?? now) - now) / 60000))}</>;
}

export default function Scan() {
  const t = useTheme();
  const g = useGame();
  const race = useRace();
  const focused = useIsFocused();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [torch, setTorch] = useState(false);
  const [grid, setGrid] = useState(false);
  const [front, setFront] = useState(false);
  const [tools, setTools] = useState(false);
  const [auto, setAuto] = useState(false);
  const [hold, setHold] = useState(0);
  const [shot, setShot] = useState<string | null>(null);
  const [flash] = useState(() => new Animated.Value(0));
  const [reveal, setReveal] = useState<{ car: Car; thumb: string } | null>(null);
  const [zoomF, setZoomF] = useState(1);
  const pinch = useRef({ d: 0, z: 1 });
  const [callPicks, setCallPicks] = useState<string[]>(() => newPicks());
  const [callPick, setCallPick] = useState<string | null>(null);
  const busy = phase === 'reading';

  async function geoOnce() {
    try {
      const p = await Location.getForegroundPermissionsAsync();
      if (!p.granted) return null;
      const pos = await Location.getLastKnownPositionAsync();
      return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
    } catch {
      return null;
    }
  }

  /** The one and only decode of a camera/library original: a small JPEG file everything else is derived from. */
  async function shrink(rawUri: string): Promise<string> {
    try {
      const small = await ImageManipulator.manipulateAsync(rawUri, [{ resize: { width: g.settings.cool ? MAX_W.cool : MAX_W.full } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG });
      return small.uri;
    } catch {
      return rawUri;
    }
  }

  /** Sends one photo for identification. Nothing is saved yet. */
  async function analyse(uri: string): Promise<{ car?: Car; thumb?: string; error?: string }> {
    try {
      // `uri` is already the small copy from shrink(); read it as a file, never re-decode the original
      const b64 = await new File(uri).base64();
      const thumb = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 400 } }], {
        compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true,
      });
      const res = await identify(b64);
      if (!res.ok) return { error: res.error.toUpperCase() };
      const car = res.car;
      if (car.isCar === false) return { error: 'NO CAR FOUND IN THAT SHOT. TRY GETTING CLOSER' };
      if (car.screenCapture) return { error: 'THAT LOOKS LIKE A SCREEN. SCAN A REAL CAR' };
      fixStats(car);
      stampCatchContext(car);
      if (!catalogMatch(car)) {
        const r = await research(car.make, car.model, car.yearRange);
        const st = (r?.stats ?? {}) as Record<string, any>;
        if (!car.horsepower && st.horsepower) car.horsepower = st.horsepower;
        if (!car.topSpeedMph && st.topSpeedMph) car.topSpeedMph = st.topSpeedMph;
        if (!car.engine && st.engine) car.engine = st.engine;
        if (!car.yearRange && st.yearRange) car.yearRange = st.yearRange;
      }
      return { car, thumb: 'data:image/jpeg;base64,' + (thumb.base64 ?? '') };
    } catch {
      return { error: 'SOMETHING WENT WRONG. TRY AGAIN' };
    }
  }

  /** Saves the identified car as a catch, scores it into a race / live session, and returns its id. */
  async function commit(car: Car, thumb: string): Promise<number> {
    const geo = await geoOnce();
    const entry = g.addCatch(car, thumb, geo);
    const scanId = (car as { scanId?: string }).scanId;
    if (scanId) g.secondLook(entry.id, String(scanId));
    race.shareCatch(car, thumb);
    if (g.settings.feedShare !== false) postCatch(g.profile.name, car, thumb, entry.ts, !!entry.shiny).catch(() => {});
    if (race.live) race.scoreCatch(car, geo).then((m) => { if (m) g.notify(m); });
    if (g.settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return entry.id;
  }

  async function scanOne(uri: string): Promise<{ id?: number; error?: string }> {
    const r = await analyse(await shrink(uri));
    if (!r.car || !r.thumb) return { error: r.error };
    playCaught(r.car.rarity);
    return { id: await commit(r.car, r.thumb) };
  }

  async function single(rawUri: string) {
    // a 12-megapixel photo decoded several times is what makes iOS kill the app; work from a small copy
    const uri = await shrink(rawUri);
    setShot(uri);
    play('scan');
    setPhase('reading');
    setStatus('READING THE CAR...');
    const r = await analyse(uri);
    if (r.car && r.thumb) {
      // the real app's identify sequence plays on the frozen shot, then the catch is saved
      setReveal({ car: r.car, thumb: r.thumb });
      return;
    }
    setShot(null);
    play('error');
    setPhase('error');
    setStatus(r.error ?? '');
  }

  /** CALL YOUR SHOT: no XP, just a streak for guessing the brand before the scan. */
  function judgeCall(car: Car) {
    if (!g.settings.callshot || !callPick) {
      setCallPick(null);
      return;
    }
    const make = String(car.make || '').toUpperCase();
    const hitListed = callPicks.some((o) => make.includes(o.toUpperCase()) || o.toUpperCase().includes(make));
    const right = callPick === 'OTHER' ? !hitListed : make.includes(callPick.toUpperCase()) || callPick.toUpperCase().includes(make);
    const streak = ((g.profile.callStreak as number) || 0);
    if (right) {
      g.patchProfile((p) => ({ ...p, callStreak: streak + 1, callBest: Math.max((p.callBest as number) || 0, streak + 1) }));
      g.notify(`CALLED IT. STREAK ${streak + 1}`);
    } else {
      g.patchProfile((p) => ({ ...p, callStreak: 0 }));
      if (streak) g.notify(`MISSED CALL. STREAK OVER AT ${streak}`);
    }
    setCallPick(null);
    setCallPicks(newPicks());
  }

  async function finishReveal() {
    if (!reveal) return;
    const { car, thumb } = reveal;
    judgeCall(car);
    const id = await commit(car, thumb);
    setReveal(null);
    setShot(null);
    setPhase('idle');
    setStatus('');
    router.push({ pathname: '/caught/[id]', params: { id: String(id) } });
  }

  async function capture() {
    if (busy || !cam.current) return;
    play('shutter');
    flash.setValue(0.9);
    Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    if (g.settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Location.requestForegroundPermissionsAsync().catch(() => {});
    const pic = await cam.current.takePictureAsync({ quality: 0.35, skipProcessing: true, shutterSound: false });
    if (pic?.uri) single(pic.uri);
  }

  async function upload() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!r.canceled && r.assets[0]) single(r.assets[0].uri);
  }

  async function burst() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, allowsMultipleSelection: true, selectionLimit: 8 });
    if (r.canceled || !r.assets.length) return;
    setPhase('reading');
    let kept = 0;
    let skipped = 0;
    let last = 0;
    for (let i = 0; i < r.assets.length; i++) {
      setStatus(`BURST ${i + 1} / ${r.assets.length}…`);
      const x = await scanOne(r.assets[i].uri);
      if (x.id) {
        kept++;
        last = x.id;
      } else skipped++;
    }
    setPhase('idle');
    setStatus(`${kept} CAR${kept === 1 ? '' : 'S'} CAUGHT${skipped ? `, ${skipped} SKIPPED` : ''}`);
    if (last) router.push({ pathname: '/card/[id]', params: { id: String(last) } });
  }

  // AUTO-SNAP: a 3-second hold, then one shot (the web app waits for a steady car; here you frame it).
  useEffect(() => {
    if (!auto) return;
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      setHold(n);
      if (n <= 0) {
        clearInterval(id);
        setAuto(false);
        capture();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 10 }}>
      <PText style={{ fontSize: 48, lineHeight: 50 }}>SCAN</PText>
      <Plate color={t.navy} depth={0} style={{ paddingHorizontal: 9, paddingVertical: 5 }}>
        <Text style={{ fontFamily: fonts.utility, fontSize: 11.4, color: t.wht, letterSpacing: 1 }} numberOfLines={1}>
          {busy ? 'WORKING…' : <Tip />}
        </Text>
      </Plate>
    </View>
  );

  let viewport: React.ReactNode;
  if (!perm) viewport = null;
  else if (!perm.granted) {
    viewport = (
      <View style={styles.hint}>
        <PText style={{ color: '#fff', fontSize: 24, textAlign: 'center' }}>CAMERA IS OFF</PText>
        <PText style={{ color: '#c9d2e6', fontSize: 16, textAlign: 'center', marginVertical: 8 }}>
          Scanning needs the camera. A photo is sent to our server only when you tap capture. Or use UPLOAD to scan an existing photo.
        </PText>
        <Btn label="TURN ON THE CAMERA" onPress={() => (perm.canAskAgain ? requestPerm() : Linking.openSettings())} />
      </View>
    );
  } else {
    viewport = (
      <>
        {focused ? <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={front ? 'front' : 'back'} enableTorch={torch} animateShutter={false} zoom={Math.max(0, Math.min(1, (zoomF - 1) / 9))} /> : null}
        {shot ? (
          <>
            <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {reveal ? <IdentifyReveal shot={shot} car={reveal.car} onDone={finishReveal} haptics={g.settings.haptics} /> : <ScanSweep haptics={g.settings.haptics} />}
          </>
        ) : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff', opacity: flash, zIndex: 20 }]} />
        {!shot ? (
          <View
            style={StyleSheet.absoluteFill}
            onTouchStart={(e) => {
              const t2 = e.nativeEvent.touches;
              if (t2.length === 2) pinch.current = { d: Math.hypot(t2[0].pageX - t2[1].pageX, t2[0].pageY - t2[1].pageY), z: zoomF };
            }}
            onTouchMove={(e) => {
              const t2 = e.nativeEvent.touches;
              if (t2.length === 2 && pinch.current.d > 0) {
                const d = Math.hypot(t2[0].pageX - t2[1].pageX, t2[0].pageY - t2[1].pageY);
                setZoomF(Math.max(1, Math.min(10, pinch.current.z * (d / pinch.current.d))));
              }
            }}
            onTouchEnd={() => { pinch.current.d = 0; }}
          />
        ) : null}
        {!shot ? (
          <View style={{ position: 'absolute', left: 10, top: 10 }} pointerEvents="none">
            <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: '#fff', backgroundColor: 'rgba(15,19,30,.82)', borderWidth: 2, borderColor: 'rgba(230,226,214,.55)', paddingHorizontal: 7, paddingVertical: 4 }}>{zoomF.toFixed(1)}x</Text>
          </View>
        ) : null}
        {!shot && g.settings.callshot ? (
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 50, flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
            <Text style={{ flexBasis: '100%', textAlign: 'center', fontFamily: fonts.utility, fontSize: 9.5, color: '#cfd6e4', letterSpacing: 1 }}>{callPick ? `CALLED: ${callPick.toUpperCase()}` : 'CALL YOUR SHOT. WHAT IS IT?'}</Text>
            {!callPick ? [...callPicks, 'OTHER'].map((b) => <Stog key={b} label={b.toUpperCase()} on={false} onPress={() => { play('click'); setCallPick(b); }} />) : null}
          </View>
        ) : null}
        {!shot ? (
          <View style={{ position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', gap: 5 }}>
            {[1, 2, 3, 5].map((f) => (
              <Pressable key={f} onPress={() => { play('click'); setZoomF(f); }} accessibilityRole="button" accessibilityLabel={`Zoom ${f}x`}>
                <View style={{ backgroundColor: Math.abs(zoomF - f) < 0.25 ? '#D8402F' : 'rgba(15,19,30,.82)', borderWidth: 2, borderColor: 'rgba(230,226,214,.55)', paddingHorizontal: 8, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: fonts.utilityBold, fontSize: 10, color: '#fff' }}>{f}x</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {grid && !shot ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {[1 / 3, 2 / 3].map((p) => (
              <View key={'h' + p} style={{ position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 1, backgroundColor: 'rgba(255,255,255,.45)' }} />
            ))}
            {[1 / 3, 2 / 3].map((p) => (
              <View key={'v' + p} style={{ position: 'absolute', top: 0, bottom: 0, left: `${p * 100}%`, width: 1, backgroundColor: 'rgba(255,255,255,.45)' }} />
            ))}
          </View>
        ) : null}
        {auto ? (
          <View style={styles.autoRing}>
            <Text style={{ fontFamily: fonts.utility, fontSize: 10.2, color: '#fff', letterSpacing: 1 }}>HOLD… {hold || 3}</Text>
          </View>
        ) : null}
        <View style={styles.toggles}>
          <Stog label="AUTO-SNAP" on={auto} onPress={() => { setHold(3); setAuto(!auto); }} />
          <Stog label="TOOLS" on={tools} onPress={() => setTools(!tools)} />
        </View>
        {tools ? (
          <View style={styles.camopts}>
            <Copt label="TORCH" val={torch ? 'ON' : 'OFF'} onPress={() => setTorch(!torch)} />
            <Copt label="FRAMING GRID" val={grid ? 'ON' : 'OFF'} onPress={() => setGrid(!grid)} />
            <Copt label="SWITCH CAMERA" val="FLIP" onPress={() => setFront(!front)} />
            <Copt label="CALL YOUR SHOT" val={g.settings.callshot ? 'ON' : 'OFF'} onPress={() => { g.setSettings({ callshot: !g.settings.callshot }); setCallPick(null); }} />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <Screen edges={[]}>
      <View style={{ flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 }}>
        {header}
        {race.live && race.race ? (
          <Pressable onPress={() => router.push('/race')}>
            <View style={{ backgroundColor: t.red, borderWidth: 3, borderColor: '#141C27', paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: '#fff' }}>RACE {race.code}</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: '#fff' }}><MinLeft endTs={race.race.endTs} /> MIN LEFT</Text>
              <Text style={{ fontFamily: fonts.utilityBold, fontSize: 11, color: '#fff' }}>{race.race.players.find((p) => p.you)?.xp ?? 0} XP</Text>
            </View>
          </Pressable>
        ) : null}
        <View style={{ borderWidth: 3, borderColor: '#141C27', width: '100%', flex: 1 }}>
          <View style={{ borderWidth: 4, borderColor: t.red, width: '100%', flex: 1, backgroundColor: '#0d1017', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {viewport}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
          <Btn small tone="navy" style={{ width: 84 }} label="UPLOAD" onPress={upload} disabled={busy} />
          <Btn tone="red" style={{ minWidth: 150 }} label={busy ? 'READING…' : 'CAPTURE'} onPress={capture} disabled={busy || !perm?.granted} />
          <Btn small tone="navy" style={{ width: 84 }} label="BURST" onPress={burst} disabled={busy} />
        </View>
        <Text style={{ textAlign: 'center', marginTop: 12, fontFamily: fonts.utility, fontSize: 12.6, color: phase === 'error' ? t.red : t.navy, minHeight: 18 }}>{status}</Text>
      </View>
    </Screen>
  );
}

function Stog({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { play('click'); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <View
        style={{
          backgroundColor: on ? '#D8402F' : 'rgba(15,19,30,.82)', borderWidth: 2,
          borderColor: on ? '#ff9a8c' : 'rgba(230,226,214,.55)', borderRadius: 3, paddingHorizontal: 7, paddingVertical: 6,
        }}>
        <Text style={{ fontFamily: fonts.utility, fontSize: 10.2, letterSpacing: 1, color: on ? '#fff' : '#c9d2e6' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function Copt({ label, val, onPress }: { label: string; val: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { play('click'); onPress(); }} accessibilityRole="button" style={styles.copt}>
      <Text style={{ fontFamily: fonts.utility, fontSize: 10.2, color: '#c9d2e6', letterSpacing: 1 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.utility, fontSize: 10.2, color: '#C9A227' }}>{val}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { padding: 18, alignItems: 'center', gap: 6 },
  toggles: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 5 },
  camopts: {
    position: 'absolute', top: 48, right: 10, width: 190, backgroundColor: 'rgba(15,19,30,.9)',
    borderWidth: 2, borderColor: 'rgba(230,226,214,.55)', borderRadius: 3,
  },
  copt: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(230,226,214,.2)' },
  autoRing: {
    position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(15,19,30,.85)',
    borderWidth: 2, borderColor: '#D8402F', borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5,
  },
});
