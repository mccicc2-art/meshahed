import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Button, Text } from "../../ui";
import { Icon, type IconName } from "../../icons";
import { haptic } from "../../haptics";
import { mark } from "../../perfMarks";
import { radius } from "../../theme";
import type { ToastHostRef } from "../../HoldHost";
import { Sheet } from "../../library/Sheet";
import { SettingsScreen, Group, Row, RowsSkeleton, StatusPill } from "../../settings/ui";
import { messageOf } from "../../settings/api";
import { timeAgo } from "@/core/when";
import { PlatformMark } from "../DeviceMark";
import { UnlinkSheet } from "../UnlinkSheet";
import { useLinks } from "../api";
import { Orbit } from "../Orbit";
import type { DeviceLinksState, NetflixAddedList, PlatformKind } from "@/core/contracts/deviceLinks";
import { NETFLIX_GATE, NETFLIX_LOGIN, NETFLIX_VIEWED, NetflixWeb, type NetflixWebRef, type NfxReady } from "./bridge";
import { clearLocal, linkNetflix, readHistory, readLocal, unlinkNetflix, useNetflixAdded, writeLocal, type NfxLocal } from "./sync";
import { requestNetflixSignOut, requestNetflixSync, useNetflixSync, type NfxSyncState } from "./NetflixSyncHost";

/**
 * ====== 🆕 صفحةُ نتفليكس — الفكرةُ «ب»، لوحةُ الملخّص (التصاميمُ المعتمدة ٢٥ نوفمبر: «اعتمد») ======
 *
 * - **غيرُ مربوطة**: ورقةُ الموافقة بنقاطها الأربع (بلا تحذير — أحمد «شيل التحذير»)، ثمّ صفحةُ دخول نتفليكس نفسُها كاملةَ الشاشة،
 *   ثمّ اختيارُ الملفّ (بلا «تم») تحت مدار الربط ⇐ يُقرأ السجلُّ ليُعدّ، ثمّ سؤالُ الاستيراد («استيراد الكل» · «من الآن فقط» بشرح كلٍّ منهما).
 * - **مربوطة**: رأسٌ في سطر، والأرقامُ الثلاثة، وبطاقةُ المزامنة (زرٌّ صغير · شريطٌ أثناءها · «توقّفت المزامنة» بعد انتهاء الجلسة)،
 *   ثمّ «السجلّ» (ما دخل · لم نطابقه · بدأته ولم تكمله) و«الربط» (غيّر الملفّ الشخصي · فك الربط).
 * - **للمجانيّ**: الربطُ لـLoopz+ (أحمد «٣ب») — بابُ الاشتراك.
 */
type Overlay = null | "consent" | "login" | "ask" | "unlink" | "added" | "unmatched" | "partial";
export type LoginWhy = "link" | "relogin" | "profile";

/**
 * 🆕 المهمّة ٥٥٧ — **ما يختلف بين منصّةٍ وأخرى**: صفحةُ نتفليكس صارت صفحةَ كلِّ منصّة (`PlatformScreen`) حين جاءت OSN+ — نسختان
 * منها كانتا ستتباعدان. هنا الاسمُ، ومضيفُ المزامنة، وملفُّ الجهاز، والربطُ والفكّ، وصفحةُ الدخول، والجملُ التي تسمّي المنصّة.
 */
export type PlatformLoginProps = {
  why: LoginWhy;
  d: DeviceLinksState | undefined;
  onClose: () => void;
  /** اختار ملفَّه: اسمُه، وما يعدّ ما فيه للسؤال */
  onFound: (name: string, count: () => Promise<{ episodes: number; movies: number }>) => void;
};
export type PlatformDriver = {
  platform: PlatformKind;
  name: string;
  useSync: () => NfxSyncState;
  requestSync: (kind: "auto" | "manual" | "import") => boolean;
  requestSignOut: () => Promise<void>;
  readLocal: (uid: string) => NfxLocal;
  writeLocal: (uid: string, patch: Partial<NfxLocal>) => NfxLocal;
  clearLocal: (uid: string) => void;
  link: (profileLabel: string, importAll: boolean) => Promise<void>;
  unlink: () => Promise<void>;
  useAdded: (enabled: boolean) => { data?: NetflixAddedList };
  Login: (p: PlatformLoginProps) => React.ReactElement;
  str: { consentLead: string; consent1Title: string; consent1Sub: string; continue_: string; importLaterNote: string; stoppedSub: string; profileSub: string };
};

/** صفحةُ دخول نتفليكس بشكل المنصّات: تختار الملفَّ، ثمّ يُعدّ السجلُّ للسؤال */
function NetflixLogin({ why, d, onClose, onFound }: PlatformLoginProps) {
  return (
    <LoginOverlay
      start={why === "profile" ? NETFLIX_GATE : NETFLIX_LOGIN}
      d={d}
      onClose={onClose}
      onReady={async (web, ready) =>
        onFound(ready.name, async () => {
          const items = (await readHistory(web, ready, null)) ?? [];
          return { episodes: items.filter((i) => i.kind === "episode").length, movies: items.filter((i) => i.kind === "movie").length };
        })
      }
    />
  );
}

export function NetflixScreen() {
  const { t } = useApp();
  const drv = useMemo<PlatformDriver>(
    () => ({
      platform: "netflix",
      name: "Netflix",
      useSync: useNetflixSync,
      requestSync: requestNetflixSync,
      requestSignOut: requestNetflixSignOut,
      readLocal,
      writeLocal,
      clearLocal,
      link: linkNetflix,
      unlink: unlinkNetflix,
      useAdded: useNetflixAdded,
      Login: NetflixLogin,
      str: {
        consentLead: t.nfxConsentLead,
        consent1Title: t.nfxConsent1Title,
        consent1Sub: t.nfxConsent1Sub,
        continue_: t.nfxContinue,
        importLaterNote: t.nfxImportLaterNote,
        stoppedSub: t.nfxStoppedSub,
        profileSub: t.nfxProfileSub,
      },
    }),
    [t],
  );
  return <PlatformScreen drv={drv} />;
}

export function PlatformScreen({ drv }: { drv: PlatformDriver }) {
  const { t, tokens, me } = useApp();
  const router = useRouter();
  const toast = useRef<ToastHostRef>(null);
  const q = useLinks();
  const d = q.data;
  const nfx = d?.platforms?.find((p) => p.platform === drv.platform) ?? null;
  const sync = drv.useSync();
  /* 🆕 T552 — «ما دخل» من المكتبة على الخادم، لا من ملفّ الجهاز — يطابق الأرقامَ فوقها ولا يُمسح بإعادة الربط */
  const added = drv.useAdded(!!nfx);
  const uid = me?.id ?? "";
  const [local, setLocal] = useState<NfxLocal>(() => (uid ? drv.readLocal(uid) : {}));
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [why, setWhy] = useState<LoginWhy>("link");
  const [found, setFound] = useState<{ name: string; episodes: number; movies: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));

  /* بعد كلِّ مزامنة: ملفُّ الجهاز يُقرأ من جديد، ونتيجةُ «زامن الآن» تُقال هنا */
  const lastAt = useRef(sync.last?.at ?? 0);
  useEffect(() => {
    if (!sync.last || sync.last.at === lastAt.current) return;
    lastAt.current = sync.last.at;
    if (uid) setLocal(drv.readLocal(uid));
    if (sync.last.kind === "auto") return;
    const o = sync.last.outcome;
    if (o.ok) toast.current?.say(o.episodes + o.movies > 0 ? t.nfxAdded(o.episodes, o.movies) : t.nfxNothingNew, undefined, undefined, o.episodes + o.movies > 0 ? "success" : undefined);
    /* «profile» تقوله بطاقةُ المزامنة بزرّها — لا رسالةَ فوقها */
    else if (o.reason !== "signed-out" && o.reason !== "stopped" && o.reason !== "profile") toast.current?.say(t.nfxSyncFailed);
  }, [sync.last, uid, t]);

  /* غيرُ مربوطة ⇐ ورقةُ الموافقة أوّلَ ما تُفتح الصفحة (🆕 T551 — للجميع) */
  const asked = useRef(false);
  useEffect(() => {
    if (!d || asked.current) return;
    asked.current = true;
    if (!nfx) setOverlay("consent");
  }, [d, nfx]);

  const openLogin = (w: LoginWhy) => {
    setWhy(w);
    setOverlay("login");
  };

  /* الدخولُ واختيارُ الملفّ ⇐ ما فيه يُعدّ للسؤال (إعادةُ الدخول للملفّ نفسِه لا تسأل). القراءةُ للعدّ في صفحة كلِّ منصّة (`count`) */
  const onFound = useCallback(
    async (name: string, count: () => Promise<{ episodes: number; movies: number }>) => {
      if (uid) setLocal(drv.writeLocal(uid, { expired: false, profile: false }));
      if (why === "relogin" && nfx?.profile_label && nfx.profile_label === name) {
        setOverlay(null);
        drv.requestSync("manual");
        return;
      }
      const n = await count();
      setFound({ name, episodes: n.episodes, movies: n.movies });
      setOverlay("ask");
    },
    [uid, why, nfx?.profile_label, drv],
  );

  const choose = async (importAll: boolean) => {
    if (!found) return;
    setBusy(true);
    try {
      await drv.link(found.name, importAll);
      haptic.pick();
      setOverlay(null);
      if (uid) setLocal(drv.writeLocal(uid, { added: [], unmatched: [], partial: [] }));
      if (importAll) drv.requestSync("import");
    } catch (e) {
      say(e);
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    try {
      await drv.requestSignOut();
      await drv.unlink();
      if (uid) drv.clearLocal(uid);
      setOverlay(null);
      router.back();
    } catch (e) {
      say(e);
    }
  };

  const sheets = (
    <>
      {overlay === "consent" ? <ConsentSheet drv={drv} onClose={() => (nfx ? setOverlay(null) : router.back())} onContinue={() => openLogin("link")} /> : null}
      {overlay === "login" ? <drv.Login why={why} d={d} onClose={() => setOverlay(null)} onFound={(n, c) => void onFound(n, c)} /> : null}
      {/* 🆕 السؤالُ يطلع فوق مدار الربط نفسِه — لا تعود صفحةُ نتفليكس بينهما (التصميمُ المعتمد «و١») */}
      {overlay === "ask" && found ? <LinkingCover d={d} platform={drv.platform} reading={false} /> : null}
      {overlay === "ask" && found ? <AskSheet drv={drv} found={found} busy={busy} onClose={() => setOverlay(null)} onChoose={(a) => void choose(a)} /> : null}
      {overlay === "unlink" ? <UnlinkSheet name={drv.name} works={nfx?.works ?? 0} onClose={() => setOverlay(null)} onConfirm={unlink} /> : null}
      {overlay === "added" ? (
        <ListSheet
          title={t.nfxShowImported}
          rows={(added.data?.items ?? []).map((a) => ({ title: a.title, sub: a.season != null && a.episode != null ? `S${a.season} E${a.episode}` : undefined }))}
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay === "unmatched" ? <ListSheet title={t.nfxUnmatched} note={t.nfxUnmatchedNote} rows={(local.unmatched ?? []).map((u) => ({ title: u }))} onClose={() => setOverlay(null)} /> : null}
      {overlay === "partial" ? (
        <ListSheet
          title={t.nfxPartial}
          note={t.nfxPartialNote}
          rows={(local.partial ?? []).map((p) => ({
            title: p.show ?? p.title,
            sub: [p.show && p.season != null && p.episode != null ? `S${p.season} E${p.episode}` : null, p.share != null ? `${Math.round(p.share * 100)}%` : null].filter(Boolean).join(" · ") || undefined,
          }))}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </>
  );

  if (!d && !q.isError) {
    return (
      <SettingsScreen title={drv.name} toast={toast}>
        <RowsSkeleton rows={3} />
      </SettingsScreen>
    );
  }
  if (!d || !d.ready) {
    return (
      <SettingsScreen title={drv.name} toast={toast}>
        <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
      </SettingsScreen>
    );
  }

  /* 🗑️ T551 — بابُ الاشتراك للمجّانيّ خرج: نتفليكس تُربط في خانته الواحدة (أحمد ٢٥ نوفمبر)، والممتلئةُ يردّها الخادم «فك ربط تطبيقك أولاً» */

  /* غيرُ مربوطة: الموافقةُ فوق صفحةٍ فارغةٍ هادئة */
  if (!nfx) {
    return (
      <SettingsScreen title={drv.name} toast={toast} overlay={sheets}>
        <View style={{ alignItems: "center", gap: 12, paddingTop: 12 }}>
          <PlatformMark platform={drv.platform} size={64} />
          <Text size={14} muted style={{ textAlign: "center", lineHeight: 22 }}>{drv.str.consentLead}</Text>
          <Button label={drv.str.continue_} onPress={() => setOverlay("consent")} />
        </View>
      </SettingsScreen>
    );
  }

  const expired = !!local.expired;
  const needProfile = !expired && !!local.profile;
  const running = !!sync.job && sync.job.kind !== "signout";
  const pill = nfx.stopped
    ? { label: t.linksStopped, color: tokens.muted }
    : expired
      ? { label: t.nfxExpiredPill, color: tokens.accent2 }
      : { label: t.stremioLinked, color: tokens.success };
  const counts = nfx.counts ?? { shows: 0, episodes: 0, movies: 0 };

  return (
    <SettingsScreen title={drv.name} toast={toast} overlay={sheets}>
      {/* ───── الرأس في سطر ───── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <PlatformMark platform={drv.platform} size={52} state={nfx.stopped || expired ? "idle" : "on"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={20} weight="800" style={{ writingDirection: "ltr", textAlign: "left" }}>{drv.name}</Text>
          {nfx.profile_label ? <Text size={13} muted numberOfLines={1}>{t.nfxProfile(nfx.profile_label)}</Text> : null}
        </View>
        <StatusPill label={pill.label} color={pill.color} />
      </View>

      {/* ───── الأرقامُ الثلاثة ───── */}
      <View style={{ flexDirection: "row", borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
        {[
          [counts.shows, t.nfxStatShows],
          [counts.episodes, t.nfxStatEpisodes],
          [counts.movies, t.nfxStatMovies],
        ].map(([n, label], i) => (
          <View key={String(label)} style={{ flex: 1, alignItems: "center", paddingVertical: 14, borderStartWidth: i ? 1 : 0, borderStartColor: tokens.border }}>
            <Text size={24} weight="800">{String(n)}</Text>
            <Text size={13} muted>{String(label)}</Text>
          </View>
        ))}
      </View>

      {/* ───── بطاقةُ المزامنة ───── */}
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14, gap: 10 }}>
        {running ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={15} weight="700">{sync.phase === "reading" ? t.nfxReading : t.nfxSyncing}</Text>
              <Text size={13} muted style={{ writingDirection: "ltr" }}>{`${sync.pct}%`}</Text>
            </View>
            <View style={{ height: 4, borderRadius: 4, backgroundColor: tokens.border, overflow: "hidden" }}>
              <View style={{ height: 4, width: `${Math.max(4, sync.pct)}%`, backgroundColor: tokens.accent }} />
            </View>
            <Text size={12} muted>{t.nfxSyncingSub}</Text>
          </>
        ) : needProfile ? (
          <>
            <Text size={15} weight="700">{t.nfxProfileTitle}</Text>
            <Text size={13} muted style={{ lineHeight: 20 }}>{drv.str.profileSub}</Text>
            <Button label={t.nfxPickProfile} onPress={() => openLogin("profile")} />
          </>
        ) : expired ? (
          <>
            <Text size={15} weight="700">{t.nfxStoppedTitle}</Text>
            <Text size={13} muted style={{ lineHeight: 20 }}>{drv.str.stoppedSub}</Text>
            <Button label={t.nfxRelogin} onPress={() => openLogin("relogin")} />
          </>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">{nfx.synced_at ? t.nfxLastSync(timeAgo(nfx.synced_at, t)) : t.nfxNeverSynced}</Text>
              <Text size={13} muted style={{ marginTop: 3 }}>{t.nfxNextSync}</Text>
            </View>
            <Button size="sm" variant="ghost" label={t.nfxSyncNow} disabled={nfx.stopped} onPress={() => drv.requestSync("manual")} />
          </View>
        )}
      </View>

      {/* ───── السجلّ ───── */}
      <Group label={t.nfxHistory}>
        <Row icon="history" title={t.nfxShowImported} onPress={() => setOverlay("added")} />
        <Row icon="search" title={t.nfxUnmatched} value={local.unmatched?.length ? String(local.unmatched.length) : undefined} onPress={() => setOverlay("unmatched")} />
        <Row icon="pause" title={t.nfxPartial} value={local.partial?.length ? String(local.partial.length) : undefined} onPress={() => setOverlay("partial")} />
        {nfx.since_at ? <Row icon="download" title={t.nfxImportPast} onPress={() => openLogin("profile")} /> : null}
      </Group>

      {/* ───── الربط ───── */}
      <Group label={t.nfxLinkGroup}>
        <Row icon="person" title={t.nfxChangeProfile} onPress={() => openLogin("profile")} />
        <Row icon="trash" title={t.linksUnlink} danger onPress={() => setOverlay("unlink")} />
      </Group>
    </SettingsScreen>
  );
}

/** ورقةُ الموافقة — النقاطُ الأربع كما اعتُمدت، بلا تحذير */
function ConsentSheet({ drv, onClose, onContinue }: { drv: PlatformDriver; onClose: () => void; onContinue: () => void }) {
  const { t, tokens } = useApp();
  const points: [IconName, string, string][] = [
    ["lock", drv.str.consent1Title, drv.str.consent1Sub],
    ["shield", t.nfxConsent2Title, t.nfxConsent2Sub],
    ["check", t.nfxConsent3Title, t.nfxConsent3Sub],
    ["repeat", t.nfxConsent4Title, t.nfxConsent4Sub],
  ];
  return (
    <Sheet title={`${t.linksLinkAction(drv.name)}`} onClose={onClose}>
      <View style={{ gap: 4 }}>
        <Text size={14} muted style={{ lineHeight: 21, marginBottom: 6 }}>{drv.str.consentLead}</Text>
        {points.map(([icon, title, sub]) => (
          <View key={title} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 8 }}>
            <View style={{ width: 34, height: 34, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center" }}>
              <Icon name={icon} size={17} color={tokens.fg} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">{title}</Text>
              <Text size={13} muted style={{ lineHeight: 20, marginTop: 2 }}>{sub}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 12 }} />
        <Button label={drv.str.continue_} onPress={onContinue} />
        <Button label={t.introLater} variant="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

/**
 * صفحةُ دخول نتفليكس كاملةَ الشاشة — شريطٌ علويٌّ فيه الإغلاقُ وسطرُ الإرشاد، **بلا زرّ «تم»** (أحمد ٢٥ نوفمبر «٢ب»): اختيارُ الملفّ
 * الشخصيّ هو الانتهاء. السكربتُ يقول حالَ الصفحة («gate»: «مَن يشاهد؟» أو رمزُ القفل · «browse»: الرئيسيّةُ مستقرّة)، وهنا القرار:
 * - رأينا «مَن يشاهد؟» ثمّ الرئيسيّة ⇐ اختار ملفَّه: إلى صفحة السجلّ، فتقرأ الملفَّ المختار.
 * - الرئيسيّةُ بلا «مَن يشاهد؟» (كان مسجّلاً من قبل فدخلت نتفليكس بآخر ملفّ) ⇐ نفتح «مَن يشاهد؟» مرّةً، فلا يُقرأ ملفٌّ لم يختره.
 * - 🆕 T553 **لحظةَ دخول صفحاتها الداخليّة بعد الدخول** (أحمد ٢٥ نوفمبر «ما ابغاها تجي»): نتفليكس بعد الرمز تفتح رئيسيّتَها بآخر ملفّ، وكانت تبقى
 *   أمامه نحو ستّ ثوانٍ (تحميلُها الثقيل + انتظارُ استقرارها + التحويل) — فيغطّيها غطاءٌ قصيرٌ (خلفيّةُ التطبيق ومؤشّرٌ صغير) ونطلب
 *   «مَن يشاهد؟» فوراً، ويرتفع حين تظهر. وله حدٌّ (عشرُ ثوانٍ) يرتفع بعده فلا يعلق أمام شاشةٍ فارغة، ومدّتُه تُقاس.
 */
export function LoginOverlay({ start, d, onClose, onReady }: { start: string; d: DeviceLinksState | undefined; onClose: () => void; onReady: (web: NetflixWebRef, r: NfxReady) => Promise<void> }) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  const web = useRef<NetflixWebRef>(null);
  const [waiting, setWaiting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const gateSeen = useRef(false);
  const sentToGate = useRef(false);
  /* 🆕 شاشةُ التحميل (مدارُ الربط «و١»، أحمد ٢٥ نوفمبر): تغطّي نتفليكس لحظةَ اختفاء «مَن يشاهد؟» وتبقى حتى السؤال —
     فلا يرى المشتركُ رئيسيّةَ نتفليكس ولا صفحةَ السجلّ البيضاء. والصفحةُ تعمل تحتها كما هي */
  const [cover, setCover] = useState(false);
  /* 🆕 T553 — الغطاءُ القصير بين الدخول و«مَن يشاهد؟»: متى بدأ (لقياس مدّته)، وهل كانت آخرُ صفحةٍ داخليّة (لنعرف أنّه دخل لتوّه) */
  const [gap, setGap] = useState(false);
  const gapAt = useRef(0);
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasInner = useRef(false);
  const endGap = useCallback((result: string) => {
    if (!gapAt.current) return;
    if (gapTimer.current) clearTimeout(gapTimer.current);
    gapTimer.current = null;
    /* داخل قياس `nfx.sync` بنوعٍ خاصّ («gate») — لا اسمَ جديدَ في قائمة الخادم، ويُفصل عن المزامنات بنوعه */
    mark("nfx.sync", Date.now() - gapAt.current, { kind: "gate", result });
    gapAt.current = 0;
    setGap(false);
  }, []);
  useEffect(
    () => () => {
      if (gapTimer.current) clearTimeout(gapTimer.current);
    },
    [],
  );
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.border }}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={18} color={tokens.muted} />
        </Pressable>
        <Text size={13} muted style={{ flex: 1, lineHeight: 18 }}>{note ?? (cover || waiting ? "" : t.nfxLoginHint)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <NetflixWeb
          ref={web}
          url={start}
          mode="visible"
          onNav={(u) => {
            /* 🆕 T553 — دخل لتوّه صفحةً داخليّة (الرئيسيّة أو «مَن يشاهد؟»، وقد تسبقها لغةُ البلد `/sa/…`) ولم يرَ «مَن يشاهد؟» بعد:
               غطاءٌ وطلبُها فوراً. الحكمُ بالدخول إلى الداخل لا بمغادرة صفحةٍ بعينها — مسارُ صفحة رمز البريد لم يُقَس. وإن ضاع
               الطلبُ (الصفحةُ تتبدّل) فالفرعُ القديم («browse» بلا «مَن يشاهد؟») يطلبها، والغطاءُ يحجب ما بينهما */
            /* المسارُ بنصٍّ لا بـ`URL` — `pathname` فيه ناقصٌ على بعض نسخ React Native */
            const path = u.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] || "/";
            const inner = /^(\/[a-z]{2}(-[a-z]{2})?)?\/(browse|profilesgate|profiles)(\/|$)/i.test(path);
            const entered = inner && !wasInner.current;
            wasInner.current = inner;
            if (!entered || gateSeen.current || waiting || gapAt.current) return;
            gapAt.current = Date.now();
            setGap(true);
            gapTimer.current = setTimeout(() => endGap("timeout"), 10_000);
            if (!/\/profilesgate(\/|$)/i.test(path)) web.current?.go(NETFLIX_GATE);
          }}
          onReady={(r) => {
            if (!waiting) return;
            void onReady(web.current as NetflixWebRef, r);
          }}
          onPageState={(s) => {
            if (s === "gate") {
              gateSeen.current = true;
              endGap("gate");
              /* أرسلناه إلى السجلّ فسألت نتفليكس «مَن يشاهد؟»، أو ظهرت خاناتُ الرمز: لا ملفَّ مختاراً بعد — ترتفع التغطية
                 وينتظر اختيارَه من جديد */
              if (waiting) setWaiting(false);
              setCover(false);
              return;
            }
            if (s === "pin") {
              /* رمزُ قفل الملفّ: العضوُ يكتبه بنفسه — التغطيةُ ترتفع ولا يُحسب اختيارٌ بعد */
              endGap("pin");
              if (waiting) setWaiting(false);
              setCover(false);
              return;
            }
            if (s === "left") {
              setCover(true);
              return;
            }
            if (s === "browse" && !waiting) {
              if (gateSeen.current || sentToGate.current) {
                /* «مَن يشاهد؟» لم تظهر بعد طلبها (ملفٌّ واحد؟): مدارُ القراءة يحلّ محلَّ الغطاء القصير */
                endGap("browse");
                setCover(true);
                setWaiting(true);
                setNote(null);
                web.current?.go(NETFLIX_VIEWED);
              } else {
                sentToGate.current = true;
                web.current?.go(NETFLIX_GATE);
              }
              return;
            }
            if (s === "signed-out") endGap("out");
            if (!waiting) return;
            if (s === "signed-out" || s === "no-profile") {
              /* عاد إلى الدخول أو لا ملفّ: يبدأ من جديد — والاختيارُ القادم يُرى من أوّله */
              setWaiting(false);
              setCover(false);
              gateSeen.current = false;
              sentToGate.current = false;
              setNote(t.nfxNotSignedIn);
            }
          }}
        />
        {cover ? <LinkingCover d={d} reading /> : gap ? (
          <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="small" color={tokens.accent} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * 🆕 **شاشةُ التحميل — مدارُ الربط** (التصميمُ «و١»، أحمد ٢٥ نوفمبر «١أ نفذ»): مدارُ المشترك كما في صفحة الربط، أجهزتُه باهتة،
 * ونتفليكس تتوهّج في خانتها بخطٍّ متقطّعٍ تجري عليه النقاط، وتحته حبّةُ «نقرأ سجلّك…». وخلف سؤال الاستيراد تبقى بلا الحبّة.
 */
export function LinkingCover({ d, reading, platform = "netflix" }: { d: DeviceLinksState | undefined; reading: boolean; platform?: PlatformKind }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center", gap: 22 }}>
      {d ? <Orbit d={d} width={width} linking={platform} onSlot={() => undefined} onHold={() => undefined} /> : null}
      {reading ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingHorizontal: 14, paddingVertical: 7 }}>
          <ActivityIndicator size="small" color={tokens.accent} />
          <Text size={13} weight="700">{t.nfxReading}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** سؤالُ الاستيراد — كما اعتُمد: العددُ، وشرحُ الزرّين بخطٍّ عريضٍ لاسم كلٍّ منهما، والزرّان، والسطرُ الأخير */
function AskSheet({ drv, found, busy, onClose, onChoose }: { drv: PlatformDriver; found: { name: string; episodes: number; movies: number }; busy: boolean; onClose: () => void; onChoose: (importAll: boolean) => void }) {
  const { t, tokens } = useApp();
  return (
    <Sheet
      title={t.nfxAskTitle}
      onClose={onClose}
      header={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PlatformMark platform={drv.platform} size={40} state="on" />
          <View>
            <Text size={15} weight="700">{t.nfxLinkedHead}</Text>
            {found.name ? <Text size={13} muted>{t.nfxProfile(found.name)}</Text> : null}
          </View>
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <Text size={20} weight="800">{t.nfxAskTitle}</Text>
        <Text size={14} muted style={{ lineHeight: 22 }}>{t.nfxAskFound(found.episodes, found.movies)}</Text>
        <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14, gap: 8 }}>
          <Text size={13} muted style={{ lineHeight: 21 }}>
            <Text size={13} weight="700">{`${t.nfxImportAll}: `}</Text>
            {t.nfxAskAllLine}
          </Text>
          <Text size={13} muted style={{ lineHeight: 21 }}>
            <Text size={13} weight="700">{`${t.nfxFromNow}: `}</Text>
            {t.nfxAskNowLine}
          </Text>
        </View>
        <Button label={t.nfxImportAll} busy={busy} onPress={() => onChoose(true)} />
        <Button label={t.nfxFromNow} variant="ghost" disabled={busy} onPress={() => onChoose(false)} />
        <Text size={12} muted style={{ textAlign: "center" }}>{drv.str.importLaterNote}</Text>
      </View>
    </Sheet>
  );
}

/** قائمةٌ بسيطةٌ في ورقة — ما دخل · لم نطابقه · بدأته ولم تكمله */
export function ListSheet({ title, note, rows, onClose }: { title: string; note?: string; rows: { title: string; sub?: string }[]; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={title} onClose={onClose}>
      <View style={{ gap: 12 }}>
        {note ? <Text size={13} muted style={{ lineHeight: 20 }}>{note}</Text> : null}
        {rows.length ? (
          <Group>
            {rows.slice(0, 100).map((r, i) => (
              <Row key={`${r.title}-${i}`} title={r.title} subtitle={r.sub} />
            ))}
          </Group>
        ) : (
          <Text size={14} muted style={{ textAlign: "center", paddingVertical: 12 }}>{t.nfxEmpty}</Text>
        )}
      </View>
    </Sheet>
  );
}
