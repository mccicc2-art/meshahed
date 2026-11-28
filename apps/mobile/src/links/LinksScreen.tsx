import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector, ScrollView as GHScrollView } from "react-native-gesture-handler";
import Reanimated, { measure, useAnimatedRef, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
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
import { DeviceLabel, DeviceMark, PlatformMark } from "./DeviceMark";
import { UnlinkSheet } from "./UnlinkSheet";
import { Orbit, OrbitCounter, physLeft, slotPoints, slotsOf, type Slot } from "./Orbit";
import { canLinkNetflix, canLinkNow, deviceName, linksWrite, platformName, useLinks } from "./api";
import { requestNetflixSync } from "./netflix/NetflixSyncHost";
import { requestOsnSync } from "./osn/OsnSyncHost";
import { requestShahidSync } from "./shahid/ShahidSyncHost";
import { requestPrimeSync } from "./prime/PrimeSyncHost";
import { PLATFORM_KINDS } from "@/core/deviceLinks";
import { DEVICE_KINDS } from "@/core/deviceLinks";
import type { DeviceKind, DeviceLinksState, PlatformKind } from "@/core/contracts/deviceLinks";

/**
 * ====== 🆕 «الربط» — مدارُ الأجهزة (خطّةُ Loopz+ v2، المرحلة ٠؛ أحمد ٥ نوفمبر «اعتمدها» ثمّ «نفذ») ======
 *
 * 🔑 **مدارٌ واحدٌ يُعدّ**: المجانيُّ جهازٌ واحدٌ من «من أجهزتك»، وبلس خمسة. المربوطُ في المدار بخطٍّ إلى القلب، وما لم يُربط
 * في الصفّ تحته — **يُسحب إلى المدار** (أو يُضغط) فتُفتح صفحتُه وخطواتُه. والضغطُ المطوَّل على مربوط: «افتح صفحته · فك الربط».
 * - المجانيُّ وخانتُه ممتلئة: الصفُّ يخفت بـ«خانتك ممتلئة»، والسحبُ أو الخانةُ المقفلةُ يفتحان «اربط أجهزتك».
 * - **لا منصّاتِ بثٍّ هنا** (أحمد ١٥ نوفمبر: «ما راح نسوي ربط مع يونفاي»): الصفحةُ تعِد بما يُربط فعلاً فقط — وعدٌ بميزةٍ لن تأتي
 *   يضلّل العضوَ وتردّه مراجعةُ Apple.
 * - «مع Loopz+»: «سجّل بلا سؤال» (مفعّلٌ للمشترك من البداية) واستيرادُ Plex.
 * - **النزولُ لا يحذف**: ما زاد موقوف، وبطاقةُ «اختر ما يبقى» تفتح ورقتَها.
 * ⚠️ قبل الهجرة (`ready: false`) تُعرض الشاشتان القديمتان كما كانتا — لا مدارَ بلا عدّ.
 */
const LIST_TILE = 56;
/** 🆕 الشبحُ أكبرُ من شارته بربع، ويطفو فوق الإصبع بمقدار ما يُرى (أحمد ٦ نوفمبر «خل التطبيق يطلع معي بشكل واضح») */
const GHOST = 70;
const LIFT = 46;

type Rect = { x: number; y: number; w: number; h: number };

export function LinksScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const toast = useRef<ToastHostRef>(null);
  const q = useLinks();
  const d = q.data;
  const [hold, setHold] = useState<DeviceKind | null>(null);
  /* 🆕 هجرة ٢٦٥ — الضغطُ المطوَّل على منصّةٍ في المدار */
  const [holdP, setHoldP] = useState<PlatformKind | null>(null);
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
  /* 🆕 الشبحُ مرسومٌ من البداية لكلِّ جهاز، وما يُسحب يظهر بقيمةٍ على خيط الواجهة — لا ينتظر رسمَ React (كان يتأخّر لحظة) */
  const dragK = useSharedValue(-1);
  const lift = useSharedValue(0.8);
  /* مراكزُ الخانات الفارغة (فيزيائيّةً داخل المدار) — أقربُها إلى الإصبع يضيء «أفلت هنا» */
  const empties = useSharedValue<{ i: number; x: number; y: number }[]>([]);
  const hotS = useSharedValue(-1);
  const [ghost, setGhost] = useState<DeviceKind | null>(null);
  const [hot, setHot] = useState(false);
  const [hotSlot, setHotSlot] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const orbitW = width - 32;
  useEffect(() => {
    if (!d?.ready) return;
    const slots = slotsOf(d);
    const pts = slotPoints(slots.length, orbitW);
    empties.value = slots.flatMap((s, i) => (s.type === "empty" ? [{ i, x: pts[i].x, y: pts[i].y }] : []));
  }, [d, orbitW, empties]);
  /* الإيماءاتُ تُبنى مرّةً لكلِّ جهاز، والإفلاتُ يقرأ أحدثَ حالٍ من المرجع — لا الحالَ يومَ بُنيت */
  const linkRef = useRef(link);
  linkRef.current = link;
  const drop = useCallback((kind: DeviceKind, inside: boolean) => {
    setGhost(null);
    setHot(false);
    setHotSlot(null);
    if (inside) linkRef.current(kind);
  }, []);
  const lifted = useCallback((kind: DeviceKind) => {
    haptic.pick();
    setGhost(kind);
  }, []);
  const pans = useRef(new Map<DeviceKind, ReturnType<typeof Gesture.Pan>>()).current;
  const panFor = (kind: DeviceKind) => {
    const hit = pans.get(kind);
    if (hit) return hit;
    /*
     * 🆕 **اضغط مطوّلاً ثمّ اسحب** (أحمد ٦ نوفمبر بتسجيل: «مره يسحب ومره لا»): كان السحبُ يبدأ بأوّل ١٢ نقطةً عموديّة — وهي
     * حركةُ تمرير الصفحة نفسُها، فأيُّهما التقطها أوّلاً فاز. الآن لا يبدأ إلا بعد ربع ثانيةٍ ثابتة (اهتزازٌ يؤكّد الالتقاط)، وأيُّ
     * حركةٍ قبلها تُفشله فيأخذها التمرير — كترتيب تطبيقات الشاشة الرئيسيّة. والضغطةُ القصيرة تبقى تفتح صفحةَ الجهاز.
     */
    const idx = DEVICE_KINDS.indexOf(kind);
    const inOrbit = (x: number, y: number) => {
      "worklet";
      const r = orbitRect.value;
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };
    const g = Gesture.Pan()
      .activateAfterLongPress(250)
      .onStart((e) => {
        const m = measure(orbitRef);
        if (m) orbitRect.value = { x: m.pageX, y: m.pageY, w: m.width, h: m.height };
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
        dragK.value = idx;
        lift.value = 0.8;
        lift.value = withSpring(1, { damping: 14, stiffness: 260 });
        hotS.value = -2;
        scheduleOnRN(lifted, kind);
      })
      .onUpdate((e) => {
        gx.value = e.absoluteX;
        gy.value = e.absoluteY;
        const inside = inOrbit(e.absoluteX, e.absoluteY);
        /* أقربُ خانةٍ فارغةٍ إلى الشبح (لا الإصبع — الشبحُ فوقه) داخل المدار */
        let best = -1;
        if (inside) {
          const r = orbitRect.value;
          const px = e.absoluteX - r.x;
          const py = e.absoluteY - LIFT - r.y;
          let bd = Infinity;
          for (const p of empties.value) {
            const dd = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
            if (dd < bd) {
              bd = dd;
              best = p.i;
            }
          }
        }
        /* يُرسل إلى React حين يتبدّل الحالُ وحده — لا في كلِّ إطار */
        const code = inside ? best + 1 : -1;
        if (code !== hotS.value) {
          hotS.value = code;
          scheduleOnRN(setHotSlot, best < 0 ? null : best);
          scheduleOnRN(setHot, inside);
        }
      })
      .onFinalize((e, ok) => {
        const inside = ok && dragK.value === idx && inOrbit(e.absoluteX, e.absoluteY);
        dragK.value = -1;
        hotS.value = -1;
        scheduleOnRN(drop, kind, inside);
      });
    pans.set(kind, g);
    return g;
  };

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
  /* 🆕 المهمّة ٥٥٧ — منصّاتُ البثّ غيرُ المربوطة (نتفليكس · OSN+)، والموقوفةُ معها بعلامتها */
  const platformsOff = PLATFORM_KINDS.filter((k) => {
    const p = d.platforms?.find((x) => x.platform === k);
    return !p || p.stopped;
  });
  const platformStopped = (k: PlatformKind) => !!d.platforms?.find((x) => x.platform === k)?.stopped;
  const unlinked = DEVICE_KINDS.filter((k) => !d.devices.find((x) => x.kind === k)?.linked || d.devices.find((x) => x.kind === k)?.stopped);
  /* الرابطُ القديمُ قبل أوّل إرسالٍ لا يُختار في الورقة (لا جهازَ معروفاً له) — صفُّه تحت «من أجهزتك» يفكّه */
  const stopped = d.devices.filter((x) => x.stopped).length;
  /* 🆕 الخانةُ الفارغةُ تفتح «أضف جهازاً» فيختار العضو (أحمد ٦ نوفمبر: «لا تقترح بلكس») — كانت تفتح أوّلَ ما لم يُربط */
  const onSlot = (s: Slot) => {
    if (s.type === "device") return open(s.kind);
    if (s.type === "platform") return open(s.platform);
    if (s.type === "locked") return intro();
    haptic.pick();
    setAddOpen(true);
  };
  const pickDevice = (k: DeviceKind) => {
    setAddOpen(false);
    if (d.devices.find((x) => x.kind === k)?.stopped) setKeepOpen(true);
    else link(k);
  };

  return (
    <SettingsScreen
      title={t.linksTitle}
      toast={toast}
      gestures={{ locked: !!ghost }}
      overlay={
        <>
          {unlinked.map((k) => (
            <Ghost key={k} kind={k} idx={DEVICE_KINDS.indexOf(k)} dragK={dragK} gx={gx} gy={gy} lift={lift} />
          ))}
          {addOpen ? <AddSheet kinds={unlinked} d={d} onClose={() => setAddOpen(false)} onPick={pickDevice} /> : null}
          {holdP ? (
            <PlatformHoldSheet
              platform={holdP}
              onClose={() => setHoldP(null)}
              onSync={() => {
                setHoldP(null);
                if ((holdP === "osn" ? requestOsnSync : holdP === "shahid" ? requestShahidSync : holdP === "prime" ? requestPrimeSync : requestNetflixSync)("manual")) toast.current?.say(t.nfxSyncing);
              }}
              onOpen={() => {
                setHoldP(null);
                open(holdP);
              }}
            />
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
        <Orbit d={d} width={orbitW} onSlot={onSlot} onHold={(k) => { haptic.pick(); setHold(k); }} onHoldPlatform={(p) => { haptic.pick(); setHoldP(p); }} hot={hot} hotSlot={hotSlot} />
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
              /* ما يُسحب الآن يبقى مكانُه إطاراً باهتاً — الشبحُ في يدك */
              const away = ghost === k;
              return (
                <GestureDetector key={k} gesture={panFor(k)}>
                  <Pressable
                    onPress={() => (paused ? setKeepOpen(true) : link(k))}
                    accessibilityRole="button"
                    accessibilityLabel={paused ? `${deviceName(k)}، ${t.linksStopped}` : t.linksLinkAction(deviceName(k))}
                    style={{ width: LIST_TILE + 8, alignItems: "center", opacity: away ? 0.3 : dim ? 0.45 : 1 }}
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

      {/* ───── 🆕 منصّاتُ البثّ (هجرة ٢٦٥) — المربوطةُ في المدار، وغيرُها هنا. 🆕 T551 — للجميع في خاناتهم: بلا قفلٍ ولا بهتان ───── */}
      {platformsOff.length ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
            <Text size={16} weight="800">{t.nfxSection}</Text>
            <View style={{ flex: 1 }} />
          </View>
          <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
            {platformsOff.map((k) => (
              <Pressable
                key={k}
                onPress={() => {
                  haptic.pick();
                  if (platformStopped(k)) setKeepOpen(true);
                  else if (canLinkNetflix(d, k)) open(k);
                  else intro();
                }}
                accessibilityRole="button"
                accessibilityLabel={t.linksLinkAction(platformName(k, t))}
                style={{ width: LIST_TILE + 8, alignItems: "center" }}
              >
                <View>
                  <PlatformMark platform={k} size={LIST_TILE} state={platformStopped(k) ? "paused" : "idle"} />
                </View>
                <DeviceLabel name={platformName(k, t)} />
                {platformStopped(k) ? <Text size={10} muted>{t.linksStopped}</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

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

/** 🆕 شبحُ الشارة المسحوبة: أكبرُ بربعٍ بحدٍّ ذهبيٍّ وظلّ، فوق الإصبع لا تحته، ومائلٌ قليلاً — يُرى أنّه في يدك */
function Ghost({ kind, idx, dragK, gx, gy, lift }: { kind: DeviceKind; idx: number; dragK: SharedValue<number>; gx: SharedValue<number>; gy: SharedValue<number>; lift: SharedValue<number> }) {
  const { tokens } = useApp();
  const st = useAnimatedStyle(() => {
    const on = dragK.value === idx;
    return {
      opacity: on ? 1 : 0,
      transform: [{ translateX: gx.value - GHOST / 2 }, { translateY: gy.value - GHOST / 2 - LIFT }, { scale: on ? lift.value : 0.8 }, { rotate: "-4deg" }],
    };
  });
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        { position: "absolute", top: 0, ...physLeft(0), borderRadius: radius.md + 2, borderWidth: 2, borderColor: tokens.accent, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
        st,
      ]}
    >
      <DeviceMark kind={kind} size={GHOST} state="idle" />
    </Reanimated.View>
  );
}

/**
 * 🆕 **«أضف جهازاً»** — ورقةٌ من الخانة الفارغة (أحمد ٦ نوفمبر: «اظهر التطبيقات والشخص يختار منها»، ثمّ «شعارات بدون كلام
 * جنبها · الخلفية سوداء»): شعاراتُ ما لم يُربط بأسمائها تحتها (Jellyfin وKodi بلا شعارٍ رسميٍّ بعد، فالاسمُ يعرّفهما)،
 * بلا منصّاتِ بثّ (أُلغي Younify، ١٥ نوفمبر). الضغطُ يسلك باب الربط الواحد (`link`): لا خانة ⇐ «اربط أجهزتك»، وموقوفٌ ⇐ «اختر ما يبقى».
 */
function AddSheet({ kinds, d, onClose, onPick }: { kinds: DeviceKind[]; d: DeviceLinksState; onClose: () => void; onPick: (k: DeviceKind) => void }) {
  const { t, tokens } = useApp();
  const full = d.tier === "free" && d.limit != null && d.used >= d.limit;
  return (
    <Sheet title={t.linksAddTitle} onClose={onClose}>
      {kinds.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
          {kinds.map((k) => {
            const paused = !!d.devices.find((x) => x.kind === k)?.stopped;
            const dim = full && !paused;
            return (
              <Pressable key={k} onPress={() => onPick(k)} accessibilityRole="button" accessibilityLabel={t.linksLinkAction(deviceName(k))} style={{ width: 64, alignItems: "center", opacity: dim ? 0.45 : 1 }}>
                <View>
                  <DeviceMark kind={k} size={64} state={paused ? "paused" : "idle"} />
                  {dim ? (
                    <View style={{ position: "absolute", top: -4, end: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="lock" size={11} color={tokens.muted} />
                    </View>
                  ) : null}
                </View>
                <DeviceLabel name={deviceName(k)} muted={dim} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Sheet>
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

/** 🆕 الضغطُ المطوَّل على منصّةٍ في المدار: «زامن الآن · افتح صفحتها» (خطّةُ Loopz+ v2 §5: «حدّث الآن» للمنصّة) */
function PlatformHoldSheet({ platform, onClose, onSync, onOpen }: { platform: PlatformKind; onClose: () => void; onSync: () => void; onOpen: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={platformName(platform, t)} onClose={onClose}>
      <Group>
        <Row icon="repeat" title={t.nfxSyncNow} onPress={onSync} />
        <Row icon="link" title={t.linksOpenPage} onPress={onOpen} />
      </Group>
    </Sheet>
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
  /* 🆕 هجرة ٢٦٥ — المنصّاتُ تُختار مع الأجهزة وتُعدّ معها */
  const plats = d.platforms ?? [];
  const limit = d.limit ?? linked.length + plats.length;
  const [pick, setPick] = useState<DeviceKind[]>(linked.filter((x) => !x.stopped).map((x) => x.kind));
  const [pickP, setPickP] = useState<PlatformKind[]>(plats.filter((p) => !p.stopped).map((p) => p.platform));
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
      while (next.length + pickP.length > limit && next.length > g.length) next = next.filter((x) => !group(next[0]).includes(x));
      return next;
    });
  const toggleP = (p: PlatformKind) => setPickP((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : pick.length + cur.length + 1 <= limit ? [...cur, p] : cur));
  const save = async () => {
    setBusy(true);
    try {
      await linksWrite({ action: "keep", kinds: pick, ...(plats.length ? { platforms: pickP } : {}) });
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
          {d.tier !== "free"
            ? plats.map((p) => (
                <OptionRow key={p.platform} selected={pickP.includes(p.platform)} title={platformName(p.platform, t)} subtitle={p.stopped ? t.linksStopped : t.stremioLinked} onSelect={() => toggleP(p.platform)} />
              ))
            : null}
        </OptionList>
        <Button label={t.keepSave} busy={busy} disabled={!pick.length && !pickP.length} onPress={() => void save()} />
      </View>
    </Sheet>
  );
}
