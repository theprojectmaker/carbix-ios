import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Location from 'expo-location';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { PinArt } from '@/components/map-pin';
import { Screen } from '@/components/screen';
import { Btn, PText, Sprite } from '@/components/ui';
import { catalogMatch } from '@/engine/data';
import { equippedTier } from '@/engine/shop';
import type { Catch, Rarity } from '@/engine/types';
import { TIER_COLOR } from '@/engine/xp';
import { play } from '@/lib/sfx';
import { useGame } from '@/state/game';
import { fonts, palette, useTheme } from '@/theme/theme';

const INK = '#141C27';
const MIN_Z = 3;
const MAX_Z = 18;
const TRACK = 220;
/** drag bookkeeping lives outside React so the pan handlers stay plain functions */
const drag = (() => {
  let on = false;
  let step = -1;
  let sent = 0;
  let view: MapView | null = null;
  return {
    setView: (v: MapView | null) => { view = v; },
    getView: () => view,
    isOn: () => on,
    set: (v: boolean) => { on = v; },
    /** true when the whole-number zoom step changed */
    stepChanged: (n: number) => { const c = n !== step; step = n; return c; },
    /** true at most every 60 ms */
    due: (now: number) => { if (now - sent <= 60) return false; sent = now; return true; },
  };
})();
const zoomOf = (lonDelta: number) => Math.min(MAX_Z, Math.max(MIN_Z, Math.log2(360 / Math.max(lonDelta, 0.0005))));

export default function MapTab() {
  const t = useTheme();
  const g = useGame();
  const map = useRef<MapView>(null);
  const focused = useIsFocused();
  const [sel, setSel] = useState<Catch | null>(null);
  const [me, setMe] = useState(false);
  const [zoomV, setZoomV] = useState(11);

  const pins = useMemo(() => g.garage.filter((c) => c.geo), [g.garage]);
  const pinId = equippedTier(g.profile, 'mappin') ?? 'classic';
  // custom pin views are snapshotted to bitmaps; track them just long enough to draw, then stop to save memory
  const pinKey = `${pins.length}|${pinId}`;
  const [settled, setSettled] = useState('');
  const track = settled !== pinKey;
  useEffect(() => {
    const id = setTimeout(() => setSettled(pinKey), 1500);
    return () => clearTimeout(id);
  }, [pinKey]);

  const initial: Region = useMemo(() => {
    const f = pins[0]?.geo;
    return { latitude: f?.lat ?? 40.8, longitude: f?.lng ?? -73.73, latitudeDelta: f ? 0.05 : 0.4, longitudeDelta: f ? 0.05 : 0.4 };
  }, [pins]);

  function fit() {
    if (pins.length && map.current) {
      map.current.fitToCoordinates(pins.map((p) => ({ latitude: p.geo!.lat, longitude: p.geo!.lng })), {
        edgePadding: { top: 60, right: 80, bottom: 60, left: 60 }, animated: true,
      });
    }
  }

  async function locate() {
    play('click');
    const p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted) return;
    setMe(true);
    const pos = await Location.getCurrentPositionAsync({});
    map.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 500);
  }

  // open centred on you (if allowed) so the map is never an empty ocean
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const p = await Location.getForegroundPermissionsAsync();
        if (!p.granted || !live) return;
        setMe(true);
        if (pins.length === 0) {
          const pos = await Location.getLastKnownPositionAsync();
          if (pos && live) map.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 400);
        }
      })();
      return () => { live = false; };
    }, [pins.length]),
  );

  useEffect(() => {
    drag.setView(map.current);
    return () => drag.setView(null);
  }, [focused]);

  const haptics = g.settings.haptics;
  const setZoomFromY = useCallback((y: number) => {
    const p = 1 - Math.min(1, Math.max(0, y / TRACK)); // top = zoomed in
    const z = MIN_Z + p * (MAX_Z - MIN_Z);
    setZoomV(z);
    if (drag.stepChanged(Math.round(z))) {
      if (haptics) Haptics.selectionAsync().catch(() => {});
    }
    if (drag.due(Date.now())) {
      const v = drag.getView();
      // Apple Maps ignores camera `zoom` (that is Google-only), so zoom by setting the visible span around the current centre
      const lon = 360 / Math.pow(2, z);
      v?.getCamera().then((cam) => cam && v.animateToRegion({ latitude: cam.center.latitude, longitude: cam.center.longitude, latitudeDelta: lon * 1.3, longitudeDelta: lon }, 60)).catch(() => {});
    }
  }, [haptics]);

  const slide = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => { drag.set(true); setZoomFromY(e.y); })
    .onUpdate((e) => setZoomFromY(e.y))
    .onFinalize(() => { drag.set(false); play('click'); });

  const selEntry = sel ? catalogMatch(sel.car) : null;
  const thumbY = (1 - (zoomV - MIN_Z) / (MAX_Z - MIN_Z)) * TRACK;

  return (
    <Screen edges={[]}>
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <PText style={{ fontSize: 48, lineHeight: 50 }}>MAP</PText>
        <Text style={{ fontFamily: fonts.display, fontSize: 18, color: t.muted }}>{pins.length} {pins.length === 1 ? 'PIN' : 'PINS'}</Text>
      </View>

      <View style={{ flex: 1, marginHorizontal: 12, marginBottom: 12, borderWidth: 4, borderColor: INK, backgroundColor: palette.panel }}>
        {focused ? (
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={initial}
          userInterfaceStyle={t.dark ? 'dark' : 'light'}
          showsUserLocation={me}
          showsCompass={false}
          pitchEnabled={false}
          onMapReady={fit}
          onRegionChange={(r) => { if (!drag.isOn()) setZoomV(zoomOf(r.longitudeDelta)); }}
          onPress={() => setSel(null)}>
          {pins.map((c) => (
            <Marker
              key={c.id}
              coordinate={{ latitude: c.geo!.lat, longitude: c.geo!.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={track}
              onPress={(e) => { e.stopPropagation(); play('tab'); setSel(c); }}>
              <PinArt id={pinId} rarity={c.car.rarity} color={TIER_COLOR[c.car.rarity as Rarity]} size={44} />
            </Marker>
          ))}
        </MapView>
        ) : null}

        {/* the one control: a zoom slider */}
        <View style={{ position: 'absolute', right: 10, top: 14, width: 44, height: TRACK + 28 }} accessibilityLabel="Zoom" accessibilityRole="adjustable">
          <GestureDetector gesture={slide}>
          <View collapsable={false} style={{ position: 'absolute', top: 14, width: 56, height: TRACK }}>
            <View pointerEvents="none" style={{ position: 'absolute', left: 19, width: 6, height: TRACK, backgroundColor: 'rgba(20,28,39,.55)', borderWidth: 1, borderColor: INK }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 19, top: thumbY, width: 6, height: TRACK - thumbY, backgroundColor: palette.red }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 6, top: thumbY - 14, width: 32, height: 28, backgroundColor: '#fff', borderWidth: 3, borderColor: INK }} />
          </View>
          </GestureDetector>
        </View>

        {pins.length === 0 ? (
          <View style={{ position: 'absolute', left: 12, right: 70, bottom: 12, backgroundColor: palette.panel, borderWidth: 3, borderColor: INK, padding: 10 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 17, color: palette.wht }}>NO PINS YET</Text>
            <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim, marginTop: 3 }}>
              ALLOW LOCATION WHEN YOU CATCH A CAR AND IT LANDS HERE.
            </Text>
            <View style={{ marginTop: 8 }}>
              <Btn small tone="red" label="ALLOW LOCATION" onPress={locate} />
            </View>
          </View>
        ) : null}

        {sel ? (
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: palette.panel, borderWidth: 3, borderColor: TIER_COLOR[sel.car.rarity as Rarity], padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {selEntry ? <Sprite entry={selEntry} size={78} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 20, color: palette.wht }} numberOfLines={1}>{sel.car.make} {sel.car.model}</Text>
              <Text style={{ fontFamily: fonts.utility, fontSize: 9, color: palette.lcdDim }}>
                <Text style={{ color: TIER_COLOR[sel.car.rarity as Rarity] }}>{sel.car.rarity.toUpperCase()}</Text> · {new Date(sel.ts).toLocaleDateString()}
              </Text>
            </View>
            <Btn small tone="red" label="OPEN" onPress={() => router.push({ pathname: '/card/[id]', params: { id: String(sel.id) } })} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
