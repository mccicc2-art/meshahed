import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../../state";
import { Button, Text } from "../../ui";
import { Icon, type IconName } from "../../icons";
import { haptic } from "../../haptics";
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
import type { DeviceLinksState } from "@/core/contracts/deviceLinks";
import { NETFLIX_GATE, NETFLIX_LOGIN, NETFLIX_VIEWED, NetflixWeb, type NetflixWebRef, type NfxReady } from "./bridge";
import { clearLocal, linkNetflix, netflixOf, readHistory, readLocal, unlinkNetflix, writeLocal, type NfxLocal } from "./sync";
import { requestNetflixSignOut, requestNetflixSync, useNetflixSync } from "./NetflixSyncHost";

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
type LoginWhy = "link" | "relogin" | "profile";

export function NetflixScreen() {
  const { t, tokens, me } = useApp();
  const router = useRouter();
  const toast = useRef<ToastHostRef>(null);
  const q = useLinks();
  const d = q.data;
  const nfx = netflixOf(d);
  const sync = useNetflixSync();
  const uid = me?.id ?? "";
  const [local, setLocal] = useState<NfxLocal>(() => (uid ? readLocal(uid) : {}));
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
    if (uid) setLocal(readLocal(uid));
    if (sync.last.kind === "auto") return;
    const o = sync.last.outcome;
    if (o.ok) toast.current?.say(o.episodes + o.movies > 0 ? t.nfxAdded(o.episodes, o.movies) : t.nfxNothingNew, undefined, undefined, o.episodes + o.movies > 0 ? "success" : undefined);
    else if (o.reason !== "signed-out" && o.reason !== "stopped") toast.current?.say(t.nfxSyncFailed);
  }, [sync.last, uid, t]);

  /* غيرُ مربوطة ⇐ ورقةُ الموافقة أوّلَ ما تُفتح الصفحة (للمشترك) */
  const asked = useRef(false);
  useEffect(() => {
    if (!d || asked.current) return;
    asked.current = true;
    if (!nfx && d.tier !== "free") setOverlay("consent");
  }, [d, nfx]);

  const openLogin = (w: LoginWhy) => {
    setWhy(w);
    setOverlay("login");
  };

  /* «تم» في صفحة الدخول ⇐ السجلُّ يُقرأ ليُعدّ (إعادةُ الدخول للملفّ نفسِه لا تسأل) */
  const onLoggedIn = useCallback(
    async (web: NetflixWebRef, ready: NfxReady) => {
      if (uid) setLocal(writeLocal(uid, { expired: false }));
      if (why === "relogin" && nfx?.profile_label && nfx.profile_label === ready.name) {
        setOverlay(null);
        requestNetflixSync("manual");
        return;
      }
      const items = (await readHistory(web, ready, null)) ?? [];
      setFound({ name: ready.name, episodes: items.filter((i) => i.kind === "episode").length, movies: items.filter((i) => i.kind === "movie").length });
      setOverlay("ask");
    },
    [uid, why, nfx?.profile_label],
  );

  const choose = async (importAll: boolean) => {
    if (!found) return;
    setBusy(true);
    try {
      await linkNetflix(found.name, importAll);
      haptic.pick();
      setOverlay(null);
      if (uid) setLocal(writeLocal(uid, { added: [], unmatched: [], partial: [] }));
      if (importAll) requestNetflixSync("import");
    } catch (e) {
      say(e);
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    try {
      await requestNetflixSignOut();
      await unlinkNetflix();
      if (uid) clearLocal(uid);
      setOverlay(null);
      router.back();
    } catch (e) {
      say(e);
    }
  };

  const sheets = (
    <>
      {overlay === "consent" ? <ConsentSheet onClose={() => (nfx ? setOverlay(null) : router.back())} onContinue={() => openLogin("link")} /> : null}
      {overlay === "login" ? <LoginOverlay start={why === "profile" ? NETFLIX_GATE : NETFLIX_LOGIN} d={d} onClose={() => setOverlay(null)} onReady={onLoggedIn} /> : null}
      {/* 🆕 السؤالُ يطلع فوق مدار الربط نفسِه — لا تعود صفحةُ نتفليكس بينهما (التصميمُ المعتمد «و١») */}
      {overlay === "ask" && found ? <LinkingCover d={d} reading={false} /> : null}
      {overlay === "ask" && found ? <AskSheet found={found} busy={busy} onClose={() => setOverlay(null)} onChoose={(a) => void choose(a)} /> : null}
      {overlay === "unlink" ? <UnlinkSheet name="Netflix" works={nfx?.works ?? 0} onClose={() => setOverlay(null)} onConfirm={unlink} /> : null}
      {overlay === "added" ? (
        <ListSheet
          title={t.nfxShowImported}
          rows={(local.added ?? []).map((a) => ({ title: a.title, sub: a.season != null && a.episode != null ? `S${a.season} E${a.episode}` : undefined }))}
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
      <SettingsScreen title="Netflix" toast={toast}>
        <RowsSkeleton rows={3} />
      </SettingsScreen>
    );
  }
  if (!d || !d.ready) {
    return (
      <SettingsScreen title="Netflix" toast={toast}>
        <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
      </SettingsScreen>
    );
  }

  /* المجانيّ: بابُ الاشتراك */
  if (d.tier === "free") {
    return (
      <SettingsScreen title="Netflix" toast={toast}>
        <View style={{ alignItems: "center", gap: 12, paddingTop: 12 }}>
          <PlatformMark size={64} />
          <Text size={15} weight="700" style={{ textAlign: "center", lineHeight: 22 }}>{t.nfxPlusOnly}</Text>
          <Button label={t.introCta} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "plus" } })} />
        </View>
      </SettingsScreen>
    );
  }

  /* غيرُ مربوطة: الموافقةُ فوق صفحةٍ فارغةٍ هادئة */
  if (!nfx) {
    return (
      <SettingsScreen title="Netflix" toast={toast} overlay={sheets}>
        <View style={{ alignItems: "center", gap: 12, paddingTop: 12 }}>
          <PlatformMark size={64} />
          <Text size={14} muted style={{ textAlign: "center", lineHeight: 22 }}>{t.nfxConsentLead}</Text>
          <Button label={t.nfxContinue} onPress={() => setOverlay("consent")} />
        </View>
      </SettingsScreen>
    );
  }

  const expired = !!local.expired;
  const running = !!sync.job && sync.job.kind !== "signout";
  const pill = nfx.stopped
    ? { label: t.linksStopped, color: tokens.muted }
    : expired
      ? { label: t.nfxExpiredPill, color: tokens.accent2 }
      : { label: t.stremioLinked, color: tokens.success };
  const counts = nfx.counts ?? { shows: 0, episodes: 0, movies: 0 };

  return (
    <SettingsScreen title="Netflix" toast={toast} overlay={sheets}>
      {/* ───── الرأس في سطر ───── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <PlatformMark size={52} state={nfx.stopped || expired ? "idle" : "on"} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={20} weight="800" style={{ writingDirection: "ltr", textAlign: "left" }}>Netflix</Text>
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
        ) : expired ? (
          <>
            <Text size={15} weight="700">{t.nfxStoppedTitle}</Text>
            <Text size={13} muted style={{ lineHeight: 20 }}>{t.nfxStoppedSub}</Text>
            <Button label={t.nfxRelogin} onPress={() => openLogin("relogin")} />
          </>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">{nfx.synced_at ? t.nfxLastSync(timeAgo(nfx.synced_at, t)) : t.nfxNeverSynced}</Text>
              <Text size={13} muted style={{ marginTop: 3 }}>{t.nfxNextSync}</Text>
            </View>
            <Button size="sm" variant="ghost" label={t.nfxSyncNow} disabled={nfx.stopped} onPress={() => requestNetflixSync("manual")} />
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
function ConsentSheet({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  const { t, tokens } = useApp();
  const points: [IconName, string, string][] = [
    ["lock", t.nfxConsent1Title, t.nfxConsent1Sub],
    ["shield", t.nfxConsent2Title, t.nfxConsent2Sub],
    ["check", t.nfxConsent3Title, t.nfxConsent3Sub],
    ["repeat", t.nfxConsent4Title, t.nfxConsent4Sub],
  ];
  return (
    <Sheet title={`${t.linksLinkAction("Netflix")}`} onClose={onClose}>
      <View style={{ gap: 4 }}>
        <Text size={14} muted style={{ lineHeight: 21, marginBottom: 6 }}>{t.nfxConsentLead}</Text>
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
        <Button label={t.nfxContinue} onPress={onContinue} />
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
 */
function LoginOverlay({ start, d, onClose, onReady }: { start: string; d: DeviceLinksState | undefined; onClose: () => void; onReady: (web: NetflixWebRef, r: NfxReady) => Promise<void> }) {
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
          onReady={(r) => {
            if (!waiting) return;
            void onReady(web.current as NetflixWebRef, r);
          }}
          onPageState={(s) => {
            if (s === "gate") {
              gateSeen.current = true;
              /* أرسلناه إلى السجلّ فسألت نتفليكس «مَن يشاهد؟»، أو ظهرت خاناتُ الرمز: لا ملفَّ مختاراً بعد — ترتفع التغطية
                 وينتظر اختيارَه من جديد */
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
        {cover ? <LinkingCover d={d} reading /> : null}
      </View>
    </View>
  );
}

/**
 * 🆕 **شاشةُ التحميل — مدارُ الربط** (التصميمُ «و١»، أحمد ٢٥ نوفمبر «١أ نفذ»): مدارُ المشترك كما في صفحة الربط، أجهزتُه باهتة،
 * ونتفليكس تتوهّج في خانتها بخطٍّ متقطّعٍ تجري عليه النقاط، وتحته حبّةُ «نقرأ سجلّك…». وخلف سؤال الاستيراد تبقى بلا الحبّة.
 */
function LinkingCover({ d, reading }: { d: DeviceLinksState | undefined; reading: boolean }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  return (
    <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: tokens.bg, alignItems: "center", justifyContent: "center", gap: 22 }}>
      {d ? <Orbit d={d} width={width} linking="netflix" onSlot={() => undefined} onHold={() => undefined} /> : null}
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
function AskSheet({ found, busy, onClose, onChoose }: { found: { name: string; episodes: number; movies: number }; busy: boolean; onClose: () => void; onChoose: (importAll: boolean) => void }) {
  const { t, tokens } = useApp();
  return (
    <Sheet
      title={t.nfxAskTitle}
      onClose={onClose}
      header={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PlatformMark size={40} state="on" />
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
        <Text size={12} muted style={{ textAlign: "center" }}>{t.nfxImportLaterNote}</Text>
      </View>
    </Sheet>
  );
}

/** قائمةٌ بسيطةٌ في ورقة — ما دخل · لم نطابقه · بدأته ولم تكمله */
function ListSheet({ title, note, rows, onClose }: { title: string; note?: string; rows: { title: string; sub?: string }[]; onClose: () => void }) {
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
