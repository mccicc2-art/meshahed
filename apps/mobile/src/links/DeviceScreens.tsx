import React, { useEffect, useRef, useState } from "react";
import { Clipboard, Linking, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { haptic } from "../haptics";
import { write } from "../api";
import { radius } from "../theme";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, RowsSkeleton, StatusPill, Toggle } from "../settings/ui";
import { messageOf } from "../settings/api";
import { PlexImportSheet } from "../settings/PlexImport";
import { StremioScreen } from "../settings/StremioScreen";
import { HomeServersScreen } from "../settings/HomeServersScreen";
import { timeAgo } from "@/core/when";
import { JELLYFIN_TEMPLATE, KODI_SOURCE_URL } from "@/core/homeServer";
import type { HomeServerLinkResult, KodiResult } from "@/core/contracts/homeServer";
import type { StremioLinkResult } from "@/core/contracts/stremio";
import type { DeviceKind, DeviceLinksState, HomeKind } from "@/core/contracts/deviceLinks";
import { DeviceMark } from "./DeviceMark";
import { episodeLabel } from "../stremio/api";
import { UnlinkSheet } from "./UnlinkSheet";
import { canLinkNow, deviceName, linkedNames, linksWrite, useLinks } from "./api";

/**
 * ====== 🆕 صفحاتُ الأجهزة — Stremio · Plex · Jellyfin · Emby · Kodi (خطّةُ Loopz+ v2، المرحلة ٠؛ التصاميمُ المعتمدة) ======
 *
 * 🔑 **صفحةٌ لكلِّ جهاز برابطه** (أحمد ٥ نوفمبر: «رابطٌ لكلِّ نوع»): الرأسُ (الشارةُ والاسمُ و«مجاناً» والحالُ وآخرُ ما وصل)،
 * ثمّ «مع Loopz+»، ثمّ الخطواتُ والرابطُ داخلها، ثمّ «رابط جديد» و«ألغِ الربط». والرابطُ يظهر **مرّةً واحدة** كما كان.
 * - **الإصدارُ بخانة**: لا خانةَ للمجانيّ ⇐ بطاقةُ «خانتك ممتلئة» تسمّي جهازَه المربوط، و«اعرف أكثر» يفتح «اربط أجهزتك».
 * - **الرابطُ القديمُ المشترك** (قبل ٢٣٧): السيرفرُ الذي يمرّ فيه يقول ذلك، و«ألغِ الربط» يفكّه كلَّه.
 * - Stremio يسأل دائماً — «سجّل بلا سؤال» لا يظهر في صفحته (سطرُها يقول لماذا).
 * ⚠️ قبل الهجرة (`ready: false`) تُعرض الشاشتان القديمتان كما كانتا.
 */

function useDevice(kind: DeviceKind) {
  const q = useLinks();
  const d = q.data;
  return { q, d, info: d?.devices.find((x) => x.kind === kind) ?? null };
}

/** الرأس: الشارةُ والاسمُ و«مجاناً» والحالُ وآخرُ ما وصل وسطرا الشرح */
function DeviceHead({ kind, d, intro, needs }: { kind: DeviceKind; d: DeviceLinksState; intro: string; needs?: string }) {
  const { t, tokens } = useApp();
  const info = d.devices.find((x) => x.kind === kind);
  const on = !!info?.linked && !info.stopped;
  const status = info?.stopped ? t.linksStopped : on ? t.stremioLinked : t.stremioNotLinked;
  return (
    <View style={{ alignItems: "center", gap: 10, paddingTop: 8 }}>
      <DeviceMark kind={kind} size={72} state={on ? "on" : info?.stopped ? "paused" : "idle"} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text size={24} weight="800" style={{ writingDirection: "ltr" }}>{deviceName(kind)}</Text>
        <StatusPill label={t.linksFreeTag} color={tokens.muted} />
      </View>
      <StatusPill label={status} color={on ? tokens.success : tokens.muted} />
      {/* «آخر ما وصل قبل ساعتين · The Bear S3 E4» — والاسمُ يغيب إن لم يُعرف بعد */}
      {on && info?.used_at ? (
        <Text size={13} muted numberOfLines={2} style={{ textAlign: "center" }}>
          {info.last ? `${t.homeServerLastSeen(timeAgo(info.used_at, t))} · ${info.last.title}${info.last.season != null && info.last.episode != null ? ` ${episodeLabel(info.last, "")}` : ""}` : t.homeServerLastSeen(timeAgo(info.used_at, t))}
        </Text>
      ) : null}
      <Text size={14} style={{ textAlign: "center", lineHeight: 22 }}>{intro}</Text>
      {needs ? <Text size={12} muted style={{ textAlign: "center", lineHeight: 18 }}>{needs}</Text> : null}
    </View>
  );
}

/** لا خانة: «خانتك ممتلئة» باسم المربوط، و«اعرف أكثر» */
function FullCard({ d }: { d: DeviceLinksState }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const names = linkedNames(d);
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: tokens.accent + "59", backgroundColor: tokens.accent + "14", padding: 16, gap: 8 }}>
      <Text size={15} weight="700">{t.linksSlotFull}</Text>
      <Text size={13} muted style={{ lineHeight: 20 }}>{t.deviceFullSub(names[0] ?? "")}</Text>
      <Button label={t.linksLearnMore} onPress={() => router.push({ pathname: "/settings/[section]", params: { section: "link-intro" } })} style={{ marginTop: 6 }} />
    </View>
  );
}

/** «مع Loopz+»: «سجّل بلا سؤال» (واستيرادُ Plex لصفحته) — للمجانيّ مقفلان يفتحان «اربط أجهزتك» */
function PlusGroup({ d, plex, onError }: { d: DeviceLinksState; plex?: boolean; onError: (e: unknown) => void }) {
  const { t, tokens } = useApp();
  const router = useRouter();
  const [plexOpen, setPlexOpen] = useState(false);
  const free = d.tier === "free";
  const intro = () => router.push({ pathname: "/settings/[section]", params: { section: "link-intro" } });
  const lock = <StatusPill label="PLUS" color={tokens.accent} />;
  return (
    <>
      <Group label={t.linksWithPlus}>
        {free ? (
          <Row icon="repeat" title={t.autoMarkTitle} subtitle={t.autoMarkDeviceSub} onPress={intro} trailing={lock} />
        ) : (
          <Toggle
            icon="repeat"
            label={t.autoMarkTitle}
            hint={t.autoMarkDeviceSub}
            checked={d.auto_mark}
            onChange={() => {
              haptic.pick();
              linksWrite({ action: "auto_mark", value: !d.auto_mark }).catch(onError);
            }}
          />
        )}
        {plex ? <Row icon="history" title={t.plexImportRow} subtitle={t.plexImportRowSub} onPress={free ? intro : () => setPlexOpen(true)} trailing={free ? lock : undefined} /> : null}
      </Group>
      {plexOpen ? <PlexImportSheet onClose={() => setPlexOpen(false)} /> : null}
    </>
  );
}

/** خطوةٌ مرقّمة — والمحتوى الإضافيُّ (الرابطُ، العنوانُ، الرمزُ) تحتها داخل البطاقة نفسِها */
function Step({ n, text, children }: { n: number; text: string; children?: React.ReactNode }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: tokens.accent + "26", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        <Text size={12} weight="800" color={tokens.accent}>{String(n)}</Text>
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <Text size={13} style={{ lineHeight: 21 }}>{text}</Text>
        {children}
      </View>
    </View>
  );
}

/** صندوقُ الرابط أو العنوان أو الرمز — إطارٌ متقطّعٌ بلون التمييز */
function Slab({ children }: { children: React.ReactNode }) {
  const { tokens } = useApp();
  return <View style={{ borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.accent + "80", backgroundColor: tokens.accent + "0D", padding: 12, gap: 6 }}>{children}</View>;
}

/* ============================================================
 * Plex · Jellyfin · Emby — رابطٌ لكلِّ نوع
 * ============================================================ */
export function HomeDeviceScreen({ kind }: { kind: HomeKind }) {
  const { t, tokens } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const { q, d, info } = useDevice(kind);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
  const copy = (text: string, done: string) => {
    haptic.pick();
    Clipboard.setString(text);
    toast.current?.say(done, undefined, undefined, "success");
  };
  const name = deviceName(kind);

  if ((d && !d.ready) || (!d && q.isError)) return <HomeServersScreen />;
  if (!d) {
    return (
      <SettingsScreen title={name} toast={toast}>
        <RowsSkeleton rows={4} />
      </SettingsScreen>
    );
  }

  const issue = async () => {
    setBusy("issue");
    try {
      const r = await write<HomeServerLinkResult>("/api/v1/me/home-server/link", { action: "issue", server: kind });
      setFresh(r.webhook_url ?? null);
      haptic.pick();
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    setBusy("revoke");
    try {
      await linksWrite({ action: "revoke", kind });
      setFresh(null);
      setConfirm(false);
      toast.current?.say(t.linksUnlinked(name), undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };

  const linked = !!info?.linked || !!fresh;
  const can = canLinkNow(d, kind);
  const steps = kind === "plex" ? t.homeServerStepsPlex : kind === "jellyfin" ? t.homeServerStepsJellyfin : t.homeServerStepsEmby;
  const needs = kind === "plex" ? t.devicePlexNeeds : kind === "jellyfin" ? t.deviceJellyfinNeeds : t.deviceEmbyNeeds;
  /* الرابطُ داخل خطوة «الصق رابطك» — الثانيةُ في الثلاثة */
  const linkStep = 1;
  const slab = fresh ? (
    <Slab>
      <Text size={13} weight="700" color={tokens.accent} selectable style={{ writingDirection: "ltr", textAlign: "left", lineHeight: 19 }}>{fresh}</Text>
      <Button size="sm" label={t.homeServerCopy} onPress={() => copy(fresh, t.stremioCopied)} />
      <Text size={11} muted style={{ lineHeight: 16 }}>{t.stremioLinkOnce}</Text>
    </Slab>
  ) : linked ? (
    <Slab>
      <Text size={13} weight="700" color={tokens.accent} style={{ writingDirection: "ltr", textAlign: "left" }}>loopztv.com/api/v1/home-server/lh_•••</Text>
      <Text size={11} muted>{t.homeServerLink}</Text>
    </Slab>
  ) : can ? (
    <Button label={t.homeServerCreate} busy={busy === "issue"} onPress={() => void issue()} />
  ) : null;

  return (
    <SettingsScreen title={name} toast={toast}>
      <DeviceHead kind={kind} d={d} intro={t.deviceHomeIntro(name)} needs={needs} />
      {!linked && !can ? <FullCard d={d} /> : null}
      <PlusGroup d={d} plex={kind === "plex"} onError={say} />
      <Group label={t.deviceSteps}>
        {steps.map((line, i) => (
          <Step key={line} n={i + 1} text={line}>
            {i === linkStep ? slab : null}
          </Step>
        ))}
      </Group>
      {kind === "jellyfin" ? (
        <Group>
          <Row icon="copy" title={t.homeServerCopyTemplate} subtitle={t.homeServerTemplateSub} onPress={() => copy(JELLYFIN_TEMPLATE, t.homeServerTemplateCopied)} />
        </Group>
      ) : null}
      {linked ? (
        <>
          <Group label={t.deviceLink}>
            {info?.shared ? null : <Row icon="repeat" title={t.stremioNewLink} subtitle={t.stremioNewLinkSub} busy={busy === "issue"} onPress={() => void issue()} />}
            <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => setConfirm(true)} />
          </Group>
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{info?.shared ? t.deviceSharedNote : t.deviceOwnLink(name)}</Text>
        </>
      ) : null}
      {confirm ? <UnlinkSheet kind={kind} works={info?.works ?? 0} onClose={() => setConfirm(false)} onConfirm={revoke} /> : null}
    </SettingsScreen>
  );
}

/* ============================================================
 * Kodi — الإضافةُ تُثبَّت، والربطُ ستّةُ أرقامٍ تحت الخطوات
 * ============================================================ */
export function KodiDeviceScreen() {
  const { t, tokens } = useApp();
  const toast = useRef<ToastHostRef>(null);
  const { q, d, info } = useDevice("kodi");
  /* `base`: ربطُ Kodi كما كان حين صدر الرمز — ربطٌ جديدٌ يُعرف بتغيُّره لا بـ«مربوط» وحدها (منطقُ الشاشة السابقة بحرفه) */
  const [code, setCode] = useState<{ code: string; expires_at: string; base: string | null } | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState<"code" | "revoke" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
  const waiting = !!code && !expired;
  const { refetch } = q;
  /* ننتظر الإضافةَ وهي تبدّل الرمز: «مربوط» يظهر وحده بلا سحبٍ للتحديث */
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => void refetch(), 3000);
    return () => clearInterval(id);
  }, [waiting, refetch]);
  const newCode = async () => {
    setBusy("code");
    try {
      const r = await write<KodiResult>("/api/v1/me/home-server/kodi", { action: "code" });
      if (r.code && r.expires_at) {
        setCode({ code: r.code, expires_at: r.expires_at, base: info?.linked ? info.linked_at : null });
        setExpired(false);
      }
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    setBusy("revoke");
    try {
      await linksWrite({ action: "revoke", kind: "kodi" });
      setCode(null);
      setConfirm(false);
      toast.current?.say(t.kodiRevoked, undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const can = !!d && canLinkNow(d, "kodi");
  /* الصفحةُ تطلب رمزَها حين تُفتح لمن له خانةٌ ولم يربط — مرّةً لكلِّ فتح، والفشلُ لا يُعاد وحده */
  const ask = !!d?.ready && can && !info?.linked && !code;
  const asked = useRef(false);
  useEffect(() => {
    if (!ask || asked.current) return;
    asked.current = true;
    void newCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرّةً لكلِّ فتح، والدالّةُ تتغيّر مع كلِّ رسم
  }, [ask]);
  useEffect(() => {
    if (!code) return;
    const left = Date.parse(code.expires_at) - Date.now();
    if (left <= 0) {
      setExpired(true);
      return;
    }
    const id = setTimeout(() => setExpired(true), left);
    return () => clearTimeout(id);
  }, [code]);
  const linkedAt = info?.linked ? info.linked_at : null;
  useEffect(() => {
    if (code && linkedAt && linkedAt !== code.base) {
      setCode(null);
      haptic.pick();
      toast.current?.say(t.kodiLinkedToast, undefined, undefined, "success");
    }
  }, [linkedAt, code, t.kodiLinkedToast]);

  if ((d && !d.ready) || (!d && q.isError)) return <HomeServersScreen />;
  if (!d) {
    return (
      <SettingsScreen title="Kodi" toast={toast}>
        <RowsSkeleton rows={4} />
      </SettingsScreen>
    );
  }
  const linked = !!info?.linked;
  const codeBox =
    code || (!linked && can) ? (
      <Slab>
        <Text
          size={36}
          weight="800"
          color={code && !expired ? tokens.accent : tokens.muted}
          selectable
          accessibilityLabel={code?.code.split("").join(" ")}
          style={{ writingDirection: "ltr", textAlign: "center", letterSpacing: 6, fontVariant: ["tabular-nums"], minHeight: 46 }}
        >
          {code ? `${code.code.slice(0, 3)} ${code.code.slice(3)}` : "––– –––"}
        </Text>
        <Text size={11} muted style={{ textAlign: "center" }}>{expired ? t.kodiCodeExpired : t.kodiCodeWait}</Text>
        {expired ? <Button size="sm" label={t.kodiNewCode} busy={busy === "code"} onPress={() => void newCode()} /> : null}
      </Slab>
    ) : null;

  return (
    <SettingsScreen title="Kodi" toast={toast}>
      <DeviceHead kind="kodi" d={d} intro={t.deviceKodiIntro} needs={t.deviceKodiNeeds} />
      {linked && d.kodi_device ? <Text size={13} muted style={{ textAlign: "center" }}>{t.kodiLinkedFrom(d.kodi_device, info?.used_at ? timeAgo(info.used_at, t) : null)}</Text> : null}
      {!linked && !can ? <FullCard d={d} /> : null}
      <PlusGroup d={d} onError={say} />
      <Group label={t.deviceSteps}>
        {t.homeServerStepsKodi.map((line, i) => (
          <Step key={line} n={i + 1} text={line}>
            {i === 1 ? (
              <Slab>
                <Text size={14} weight="700" color={tokens.accent} selectable style={{ writingDirection: "ltr", textAlign: "center" }}>{KODI_SOURCE_URL}</Text>
              </Slab>
            ) : i === 3 ? (
              codeBox
            ) : null}
          </Step>
        ))}
      </Group>
      {!linked && can ? <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.deviceKodiLinkedNote}</Text> : null}
      {linked ? (
        <Group label={t.deviceLink}>
          {code ? null : <Row icon="repeat" title={t.kodiNewCode} subtitle={t.kodiNewCodeSub} busy={busy === "code"} onPress={() => void newCode()} />}
          <Row icon="trash" title={t.kodiRevoke} danger busy={busy === "revoke"} onPress={() => setConfirm(true)} />
        </Group>
      ) : null}
      {confirm ? <UnlinkSheet kind="kodi" works={info?.works ?? 0} onClose={() => setConfirm(false)} onConfirm={revoke} /> : null}
    </SettingsScreen>
  );
}

/* ============================================================
 * Stremio — الإضافةُ تُثبَّت، ويسأل دائماً
 * ============================================================ */
export function StremioDeviceScreen() {
  const { t } = useApp();
  const router = useRouter();
  const toast = useRef<ToastHostRef>(null);
  const { q, d, info } = useDevice("stremio");
  const [fresh, setFresh] = useState<StremioLinkResult | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));

  if ((d && !d.ready) || (!d && q.isError)) return <StremioScreen />;
  if (!d) {
    return (
      <SettingsScreen title="Stremio" toast={toast}>
        <RowsSkeleton rows={4} />
      </SettingsScreen>
    );
  }
  const issue = async (thenOpen: boolean) => {
    setBusy("issue");
    try {
      const r = await write<StremioLinkResult>("/api/v1/me/stremio/link", { action: "issue" });
      setFresh(r);
      haptic.pick();
      if (thenOpen && r.install_url) void Linking.openURL(r.install_url).catch(() => {});
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    setBusy("revoke");
    try {
      await linksWrite({ action: "revoke", kind: "stremio" });
      setFresh(null);
      setConfirm(false);
      toast.current?.say(t.stremioRevoked, undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const copy = (url: string) => {
    haptic.pick();
    Clipboard.setString(url);
    toast.current?.say(t.stremioCopied, undefined, undefined, "success");
  };
  const linked = !!info?.linked || !!fresh?.linked;
  const can = canLinkNow(d, "stremio");

  return (
    <SettingsScreen title="Stremio" toast={toast}>
      <DeviceHead kind="stremio" d={d} intro={t.stremioIntro} needs={t.stremioCoverage} />
      {fresh?.manifest_url ? (
        <>
          {fresh.install_url ? <Button label={t.stremioInstall} onPress={() => void Linking.openURL(fresh.install_url!).catch(() => {})} /> : null}
          <Group>
            <Row icon="copy" title={t.stremioCopy} onPress={() => copy(fresh.manifest_url!)} />
            {fresh.web_install_url ? <Row icon="compass" title={t.stremioInstallWeb} onPress={() => void Linking.openURL(fresh.web_install_url!).catch(() => {})} /> : null}
          </Group>
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioLinkOnce}</Text>
        </>
      ) : !linked && can ? (
        <>
          <Button label={t.stremioInstall} busy={busy === "issue"} onPress={() => void issue(true)} />
          <Button label={t.stremioCopy} variant="ghost" disabled={busy === "issue"} onPress={() => void issue(false)} />
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioLinkOnce}</Text>
        </>
      ) : !linked ? (
        <FullCard d={d} />
      ) : null}
      {linked ? (
        <Group label={t.deviceAfter}>
          <Row icon="list" title={t.stremioPendingRow} subtitle={t.stremioPendingRowSub} onPress={() => router.push("/stremio")} />
          <Row icon="repeat" title={t.stremioNewLink} subtitle={t.stremioNewLinkSub} busy={busy === "issue"} onPress={() => void issue(false)} />
          <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => setConfirm(true)} />
        </Group>
      ) : null}
      <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioAlwaysAsks}</Text>
      {confirm ? <UnlinkSheet kind="stremio" works={info?.works ?? 0} onClose={() => setConfirm(false)} onConfirm={revoke} /> : null}
    </SettingsScreen>
  );
}
