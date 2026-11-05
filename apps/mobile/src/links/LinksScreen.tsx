import React, { useCallback, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Reanimated, { measure, useAnimatedRef, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { radius } from "../theme";
import type { ToastHostRef } from "../HoldHost";
import { Sheet } from "../library/Sheet";
import { SettingsScreen, Group, Row, RowsSkeleton, StatusPill, Toggle, OptionRow, OptionList } from "../settings/ui";
import { messageOf } from "../settings/api";
import { PlexImportSheet } from "../settings/PlexImport";
import { DeviceLabel, DeviceMark } from "./DeviceMark";
import { UnlinkSheet } from "./UnlinkSheet";
import { Orbit, OrbitCounter, type Slot } from "./Orbit";
import { canLinkNow, deviceName, linksWrite, useLinks } from "./api";
import { DEVICE_KINDS } from "@/core/deviceLinks";
import type { DeviceKind, DeviceLinksState } from "@/core/contracts/deviceLinks";

/**
 * ====== 🆕 «الربط» — مدارُ الأجهزة (خطّةُ Loopz+ v2، المرحلة ٠؛ أحمد ٥ نوفمبر «اعتمدها» ثمّ «نفذ») ======
 *
 * 🔑 **مدارٌ واحدٌ يُعدّ**: المجانيُّ جهازٌ واحدٌ من «من أجهزتك»، وبلس خمسة. المربوطُ في المدار بخطٍّ إلى القلب، وما لم يُربط
 * في الصفّ تحته — **يُسحب إلى المدار** (أو يُضغط) فتُفتح صفحتُه وخطواتُه. والضغطُ المطوَّل على مربوط: «افتح صفحته · فك الربط».
 * - المجانيُّ وخانتُه ممتلئة: الصفُّ يخفت بـ«خانتك ممتلئة»، والسحبُ أو الخانةُ المقفلةُ يفتحان «اربط أجهزتك».
 * - **قبل يونيفاي**: «منصات البث · قريباً» أسماءٌ بلا شعارات ولا سحب، وسطرُ «نشتغل على ربط منصات البث».
 * - «مع Loopz+»: «سجّل بلا سؤال» (مفعّلٌ للمشترك من البداية) واستيرادُ Plex.
 * - **النزولُ لا يحذف**: ما زاد موقوف، وبطاقةُ «اختر ما يبقى» تفتح ورقتَها.
 * ⚠️ قبل الهجرة (`ready: false`) تُعرض الشاشتان القديمتان كما كانتا — لا مدارَ بلا عدّ.
 */
const PLATFORMS = ["Netflix", "Prime Video", "Disney+", "Apple TV", "HBO Max", "Hulu", "Paramount+", "Peacock", "Discovery+"] as const;
const LIST_TILE = 56;

type Rect = { x: number; y: number; w: number; h: number };

export function LinksScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const toast = useRef<ToastHostRef>(null);
  const q = useLinks();
  const d = q.data;
  const [hold, setHold] = useState<DeviceKind | null>(null);
  const [confirm, setConfirm] = useState<DeviceKind | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [plexOpen, setPlexOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));

  const open = useCallback((section: string) => router.push({ pathname: "/settings/[section]", params: { section } }), [router]);
  const intro = useCallback(() => open("link-intro"), [open]);
  /* البابُ الواحدُ للربط: خانةٌ أو استبدال ⇐ صفحةُ الجهاز وخطواتُه · لا خانة ⇐ «اربط أجهزتك» */
  const link = useCallback(
    (kind: DeviceKind) => {
      if (!d) return;
      haptic.pick();
      if (canLinkNow(d, kind)) open(kind);
      else intro();
    },
    [d, open, intro],
  );

  /* ───── السحب إلى المدار: شبحُ الشارة يتبع الإصبع فوق الصفحة، والإفلاتُ داخل المدار يربط ───── */
  /* المدارُ يُقاس لحظةَ يبدأ السحب (على خيط الواجهة) لا عند الرسم: الصفحةُ تتمرّر فيتبدّل مكانُه */
  const orbitRef = useAnimatedRef<Reanimated.View>();
  const orbitRect = useSharedValue<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const [ghost, setGhost] = useState<DeviceKind | null>(null);
  const [hot, setHot] = useState(false);
  /* الإيماءاتُ تُبنى مرّةً لكلِّ جهاز، والإفلاتُ يقرأ أحدثَ حالٍ من المرجع — لا الحالَ يومَ بُنيت */
  const linkRef = useRef(link);
  linkRef.current = link;
  const drop = useCallback((kind: DeviceKind, inside: boolean) => {
    setGhost(null);
    setHot(false);
    if (inside) linkRef.current(kind);
  }, []);
  const pans = useRef(new Map<DeviceKind, ReturnType<typeof Gesture.Pan>>()).current;
  const panFor = (kind: DeviceKind) => {
    const hit = pans.get(kind);
    if (hit) return hit;
    /* عموديٌّ يمسك، وأفقيٌّ يترك للتمرير: الصفُّ يتمرّر جانباً والمدارُ فوقه */
    const g = Gesture.Pan()
      .activeOffsetY([-12, 12])
      .failOffsetX([-14, 14])
      .onStart((e) => {
        const m = measure(orbitRef);
        if (m) orbitRect.value = { x: m.pageX, y: m.pageY, w: m.width, h: m.height };
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
        scheduleOnRN(setGhost, kind);
      })
      .onUpdate((e) => {
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
        const r = orbitRect.value;
        const inside = e.absoluteX >= r.x && e.absoluteX <= r.x + r.w && e.absoluteY >= r.y && e.absoluteY <= r.y + r.h;
        scheduleOnRN(setHot, inside);
      })
      .onFinalize((e, ok) => {
        const r = orbitRect.value;
        const inside = ok && e.absoluteX >= r.x && e.absoluteX <= r.x + r.w && e.absoluteY >= r.y && e.absoluteY <= r.y + r.h;
        scheduleOnRN(drop, kind, inside);
      });
    pans.set(kind, g);
    return g;
  };
  const ghostStyle = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value - LIST_TILE / 2 }, { translateY: gy.value - LIST_TILE / 2 }] }));

  const revoke = async (kind: DeviceKind) => {
    try {
      await linksWrite({ action: "revoke", kind });
      setConfirm(null);
      toast.current?.say(t.linksUnlinked(deviceName(kind)), undefined, undefined, "success");
    } catch (e) {
      say(e);
    }
  };
  const revokeLegacy = async () => {
    setBusy(true);
    try {
      await linksWrite({ action: "revoke_legacy" });
      toast.current?.say(t.stremioRevoked, undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(false);
    }
  };
  const setAuto = async (value: boolean) => {
    try {
      haptic.pick();
      await linksWrite({ action: "auto_mark", value });
    } catch (e) {
      say(e);
    }
  };

  if (!d && !q.isError) {
    return (
      <SettingsScreen title={t.linksTitle} toast={toast}>
        <RowsSkeleton rows={4} />
      </SettingsScreen>
    );
  }
  /* قبل الهجرة، أو الخادمُ لم يصله هذا الباب بعد (تحديثُ الهواء قبل نشر الويب) أو فشل: الشاشتان كما كانتا، و«حاول مجدداً» */
  if (!d || !d.ready) {
    return (
      <SettingsScreen title={t.linksTitle} toast={toast}>
        <Group>
          <Row icon="link" title={t.stremioScreenTitle} onPress={() => open("stremio")} />
          <Row icon="tv" title={t.homeServersTitle} subtitle="Plex · Jellyfin · Emby · Kodi" onPress={() => open("home-servers")} />
        </Group>
        {q.isError ? <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} /> : null}
      </SettingsScreen>
    );
  }

  const free = d.tier === "free";
  const full = d.limit != null && d.used >= d.limit;
  const unlinked = DEVICE_KINDS.filter((k) => !d.devices.find((x) => x.kind === k)?.linked || d.devices.find((x) => x.kind === k)?.stopped);
  /* الرابطُ القديمُ قبل أوّل إرسالٍ لا يُختار في الورقة (لا جهازَ معروفاً له) — صفُّه تحت «من أجهزتك» يفكّه */
  const stopped = d.devices.filter((x) => x.stopped).length;
  const onSlot = (s: Slot) => {
    if (s.type === "device") return open(s.kind);
    if (s.type === "locked") return intro();
    const next = unlinked.find((k) => !d.devices.find((x) => x.kind === k)?.stopped);
    if (next) link(next);
  };

  return (
    <SettingsScreen
      title={t.linksTitle}
      toast={toast}
      gestures={{ locked: !!ghost }}
      overlay={
        <>
          {ghost ? (
            <Reanimated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, opacity: 0.92 }, ghostStyle]}>
              <DeviceMark kind={ghost} size={LIST_TILE} state="idle" />
            </Reanimated.View>
          ) : null}
          {hold ? <HoldSheet kind={hold} onClose={() => setHold(null)} onOpen={() => { setHold(null); open(hold); }} onUnlink={() => { setHold(null); setConfirm(hold); }} /> : null}
          {confirm ? <UnlinkSheet kind={confirm} works={d.devices.find((x) => x.kind === confirm)?.works ?? 0} onClose={() => setConfirm(null)} onConfirm={() => revoke(confirm)} /> : null}
          {keepOpen ? <KeepSheet d={d} onClose={() => setKeepOpen(false)} onError={say} /> : null}
          {plexOpen ? <PlexImportSheet onClose={() => setPlexOpen(false)} /> : null}
        </>
      }
    >
      {/* ───── المدار والعدّاد ───── */}
      <Reanimated.View ref={orbitRef} collapsable={false}>
        <Orbit d={d} width={width - 32} onSlot={onSlot} onHold={(k) => { haptic.pick(); setHold(k); }} hot={hot} />
      </Reanimated.View>
      <OrbitCounter d={d} />
      {stopped > 0 ? (
        <Group>
          <Row icon="pause" title={t.keepCard(stopped)} subtitle={d.limit != null ? t.keepSub(d.limit) : undefined} onPress={() => setKeepOpen(true)} />
        </Group>
      ) : null}

      {/* ───── من أجهزتك ───── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
          <Text size={16} weight="800">{t.linksDevices}</Text>
          <StatusPill label={t.linksFreeTag} color={tokens.muted} />
          <View style={{ flex: 1 }} />
          {unlinked.length ? <Text size={12} muted>{free && full ? t.linksSlotFull : t.linksDragHint}</Text> : null}
        </View>
        {unlinked.length ? (
          <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 4, paddingVertical: 4 }}>
            {unlinked.map((k) => {
              const info = d.devices.find((x) => x.kind === k);
              const paused = !!info?.stopped;
              const dim = free && full && !paused;
              return (
                <GestureDetector key={k} gesture={panFor(k)}>
                  <Pressable
                    onPress={() => (paused ? setKeepOpen(true) : link(k))}
                    accessibilityRole="button"
                    accessibilityLabel={paused ? `${deviceName(k)}، ${t.linksStopped}` : t.linksLinkAction(deviceName(k))}
                    style={{ width: LIST_TILE + 8, alignItems: "center", opacity: dim ? 0.45 : 1 }}
                  >
                    <View>
                      <DeviceMark kind={k} size={LIST_TILE} state={paused ? "paused" : "idle"} />
                      {dim ? (
                        <View style={{ position: "absolute", top: -4, end: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                          <Icon name="lock" size={11} color={tokens.muted} />
                        </View>
                      ) : null}
                    </View>
                    <DeviceLabel name={deviceName(k)} muted={dim} />
                    {paused ? <Text size={10} muted>{t.linksStopped}</Text> : null}
                  </Pressable>
                </GestureDetector>
              );
            })}
          </GHScrollView>
        ) : null}
        {d.pending_legacy ? (
          <Group>
            <Row icon="tv" title={t.linksPendingLegacy} subtitle={t.linksPendingLegacySub} />
            <Row icon="trash" title={t.linksUnlink} danger busy={busy} onPress={() => void revokeLegacy()} />
          </Group>
        ) : null}
        {free ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radius.card, borderWidth: 1, borderColor: tokens.accent + "59", backgroundColor: tokens.accent + "14", padding: 14 }}>
            <Text size={13} weight="600" style={{ flex: 1, lineHeight: 20 }}>{t.linksFreeCard}</Text>
            <Button size="sm" label={t.linksLearnMore} onPress={intro} />
          </View>
        ) : null}
      </View>

      {/* ───── منصات البث · قريباً — أسماءٌ بلا شعارات ولا سحب ───── */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
          <Text size={16} weight="800">{t.linksPlatforms}</Text>
          <StatusPill label={t.linksSoon} />
        </View>
        <GHScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}>
          {PLATFORMS.map((p) => (
            <View key={p} accessible accessibilityLabel={`${p}، ${t.linksSoon}`} style={{ alignItems: "center", gap: 6, opacity: 0.6 }}>
              <View style={{ width: LIST_TILE, height: LIST_TILE, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center", padding: 4 }}>
                <Text size={10} weight="700" muted numberOfLines={2} style={{ textAlign: "center", writingDirection: "ltr" }}>{p}</Text>
              </View>
            </View>
          ))}
        </GHScrollView>
        <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.linksPlatformsNote}</Text>
      </View>

      {/* ───── مع Loopz+ ───── */}
      <Group label={t.linksWithPlus}>
        {free ? (
          <Row icon="repeat" title={t.autoMarkTitle} subtitle={t.autoMarkSub} onPress={intro} trailing={<PlusLock />} />
        ) : (
          <Toggle icon="repeat" label={t.autoMarkTitle} hint={t.autoMarkSub} checked={d.auto_mark} onChange={() => void setAuto(!d.auto_mark)} />
        )}
        <Row icon="history" title={t.plexImportRow} subtitle={t.plexImportRowSub} onPress={free ? intro : () => setPlexOpen(true)} trailing={free ? <PlusLock /> : undefined} />
      </Group>
    </SettingsScreen>
  );
}

/** قفلٌ وشارةُ PLUS بدل السهم — الميزةُ تُرى ولا تعمل للمجانيّ */
function PlusLock() {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name="lock" size={14} color={tokens.muted} />
      <View style={{ borderRadius: 5, backgroundColor: tokens.accent, paddingHorizontal: 6, paddingVertical: 1 }}>
        <Text size={10} weight="800" color={tokens.onAccent}>PLUS</Text>
      </View>
    </View>
  );
}

/** الضغطُ المطوَّل على مربوط: «افتح صفحته · فك الربط» */
function HoldSheet({ kind, onClose, onOpen, onUnlink }: { kind: DeviceKind; onClose: () => void; onOpen: () => void; onUnlink: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={deviceName(kind)} onClose={onClose}>
      <Group>
        <Row icon="link" title={t.linksOpenPage} onPress={onOpen} />
        <Row icon="trash" title={t.linksUnlink} danger onPress={onUnlink} />
      </Group>
    </Sheet>
  );
}

/**
 * «اختر ما يبقى» — المربوطُ كلُّه (شغّالاً أو موقوفاً) باختيارٍ بحدود الخانات؛ المختارُ اليوم الشغّالُ (أحدثُها استعمالاً — حكمُ
 * الخادم عند النزول). اختيارٌ فوق الحدّ يُبدِل الأقدمَ اختياراً، فلا زرَّ معطَّلاً بلا سبب.
 */
function KeepSheet({ d, onClose, onError }: { d: DeviceLinksState; onClose: () => void; onError: (e: unknown) => void }) {
  const { t } = useApp();
  const linked = d.devices.filter((x) => x.linked);
  const limit = d.limit ?? linked.length;
  const [pick, setPick] = useState<DeviceKind[]>(linked.filter((x) => !x.stopped).map((x) => x.kind));
  const [busy, setBusy] = useState(false);
  /* الأجهزةُ التي تمرّ في الرابط القديم المشترك رابطٌ واحد: تُختار معاً وتُعدّ معاً — كما يعدّها الخادم */
  const shared = linked.filter((x) => x.shared).map((x) => x.kind);
  const group = (k: DeviceKind) => (shared.includes(k) ? shared : [k]);
  const toggle = (k: DeviceKind) =>
    setPick((cur) => {
      const g = group(k);
      if (cur.includes(k)) return cur.filter((x) => !g.includes(x));
      let next = [...cur.filter((x) => !g.includes(x)), ...g];
      /* فوق الحدّ: يسقط الأقدمُ اختياراً (ومجموعتُه معه) حتى يتّسع */
      while (next.length > limit && next.length > g.length) next = next.filter((x) => !group(next[0]).includes(x));
      return next;
    });
  const save = async () => {
    setBusy(true);
    try {
      await linksWrite({ action: "keep", kinds: pick });
      haptic.pick();
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t.keepTitle} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Text size={13} muted style={{ lineHeight: 20 }}>{t.keepSub(limit)}</Text>
        <OptionList>
          {linked.map((x) => (
            <OptionRow key={x.kind} selected={pick.includes(x.kind)} title={deviceName(x.kind)} subtitle={x.stopped ? t.linksStopped : t.stremioLinked} onSelect={() => toggle(x.kind)} />
          ))}
        </OptionList>
        <Button label={t.keepSave} busy={busy} disabled={!pick.length} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}
