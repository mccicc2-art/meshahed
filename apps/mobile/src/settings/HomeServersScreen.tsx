import React, { useEffect, useRef, useState } from "react";
import { Clipboard, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { haptic } from "../haptics";
import { api, write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { Segmented } from "../library/ToolsSheet";
import { timeAgo } from "@/core/when";
import { JELLYFIN_TEMPLATE, KODI_SOURCE_URL, type HomeServer } from "@/core/homeServer";
import type { HomeServerLinkResult, HomeServerState, KodiResult } from "@/core/contracts/homeServer";
import { SettingsScreen, Group, Row, RowsSkeleton, StatusPill } from "./ui";
import { messageOf, useOpenWeb } from "./api";
import { PlexImportSheet } from "./PlexImport";

export const HOME_SERVER_KEY = ["me:home-server"] as const;

/**
 * ====== 🆕 «سيرفرات البيت» — Plex · Jellyfin · Emby (هجرة ٢٣٥؛ أحمد ٤ نوفمبر: الشاشة «ب»، ولـLoopz+ وحده) ======
 *
 * 🔑 **رابطٌ واحدٌ فوق، وخطواتُ السيرفر المختار تحته**: الرابطُ نفسُه يقبله الثلاثة (`/api/v1/home-server/<token>`)، فثلاثةُ صفوفٍ
 * كانت ستوحي بثلاثة روابط. ويظهر **مرّةً واحدة** كرابط Stremio (الخادمُ يحفظ بصمتَه لا هو)، ومن رجع لاحقاً يجد «مربوط»
 * و«آخرُ ما وصل» و«رابط جديد» و«ألغِ الربط».
 * ⚖️ **والمقسّمُ هو العائلةُ الواحدة** (`Segmented` بخطّها السفليّ) — لا حبّةٌ ثانية.
 * 🆕 **Kodi تبويبٌ رابع برابطه الخاصّ** (هجرة ٢٣٦؛ أحمد ٥ نوفمبر «أ»): لا Webhook يُلصق هناك — إضافتُنا تُثبَّت، والربطُ **ستّةُ
 * أرقامٍ تحت الخطوات** يطلبها التبويبُ وحده حين يُفتح، ويسأل الخادمَ كلَّ ثلاث ثوانٍ حتى تصل الإضافة. ورابطُه مستقلٌّ عن رابط
 * الثلاثة: إلغاؤه لا يمسّ Plex، و«رابطٌ جديد» هناك لا يقطع Kodi.
 * ⚖️ **«استورد تاريخك من Plex»** يفتح ورقةَ الرمز (`PlexImportSheet`) — دخولُ Plex لا يصل خادمَنا («٣ أ»).
 * 📌 التصميمُ مؤقّتٌ حتى بناء الاشتراك (أحمد: «راح يتغير التصميم مع الدفع»).
 */
export function HomeServersScreen() {
  const { t, tokens } = useApp();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const [server, setServer] = useState<HomeServer>("plex");
  /* 🆕 رمزُ Kodi الحيّ — في الشاشة وحدها (يظهر مرّةً كالرابط) */
  /* `base`: ربطُ Kodi كما كان حين صدر الرمز — ربطٌ جديدٌ (جهازٌ ثانٍ وهو مربوط) يُعرف بتغيُّره لا بـ«مربوط» وحدها */
  const [kodiCode, setKodiCode] = useState<{ code: string; expires_at: string; base: string | null } | null>(null);
  const [kodiExpired, setKodiExpired] = useState(false);
  const waitingKodi = server === "kodi" && !!kodiCode && !kodiExpired;
  const q = useQuery({
    queryKey: HOME_SERVER_KEY,
    queryFn: async () => (await api<HomeServerState>("/api/v1/me/home-server")).data,
    staleTime: 60_000,
    /* ننتظر الإضافةَ وهي تبدّل الرمز: «مربوط» يظهر وحده بلا سحبٍ للتحديث */
    refetchInterval: waitingKodi ? 3000 : false,
  });
  const d = q.data;
  const kodi = d?.kodi;
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | "kodi-code" | "kodi-revoke" | null>(null);
  const [plexOpen, setPlexOpen] = useState(false);
  const say = (e: unknown) => toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));

  const issue = async () => {
    setBusy("issue");
    try {
      const r = await write<HomeServerLinkResult>("/api/v1/me/home-server/link", { action: "issue" });
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
      await write<HomeServerLinkResult>("/api/v1/me/home-server/link", { action: "revoke" });
      setFresh(null);
      toast.current?.say(t.stremioRevoked, undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const kodiNewCode = async () => {
    setBusy("kodi-code");
    try {
      const r = await write<KodiResult>("/api/v1/me/home-server/kodi", { action: "code" });
      if (r.code && r.expires_at) {
        setKodiCode({ code: r.code, expires_at: r.expires_at, base: kodi?.linked ? kodi.linked_at : null });
        setKodiExpired(false);
      }
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  const kodiRevoke = async () => {
    setBusy("kodi-revoke");
    try {
      await write<KodiResult>("/api/v1/me/home-server/kodi", { action: "revoke" });
      setKodiCode(null);
      toast.current?.say(t.kodiRevoked, undefined, undefined, "success");
    } catch (e) {
      say(e);
    } finally {
      setBusy(null);
    }
  };
  /* التبويبُ يطلب رمزَه حين يُفتح لمشتركٍ لم يربط — لا زرَّ «ابدأ» قبل الرمز («أ»). ومرّةً لكلِّ فتح: الفشلُ لا يُعاد وحده */
  const askKodi = server === "kodi" && !!d?.plus && !!kodi && !kodi.linked && !kodiCode;
  const askedKodi = useRef(false);
  useEffect(() => {
    if (server !== "kodi") askedKodi.current = false;
    if (!askKodi || askedKodi.current) return;
    askedKodi.current = true;
    void kodiNewCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- مرّةً لكلِّ فتح، والدالّةُ تتغيّر مع كلِّ رسم
  }, [askKodi, server]);
  /* الرمزُ ينتهي في وقته: «انتهى» بدل «ننتظر»، ويقف السؤال */
  useEffect(() => {
    if (!kodiCode) return;
    const left = Date.parse(kodiCode.expires_at) - Date.now();
    if (left <= 0) {
      setKodiExpired(true);
      return;
    }
    const id = setTimeout(() => setKodiExpired(true), left);
    return () => clearTimeout(id);
  }, [kodiCode]);
  /* وصلت الإضافة: ربطٌ غيرُ الذي كان حين صدر الرمز — الرمزُ استُعمل فيختفي، ونقول «انربط» مرّةً */
  const kodiLinkedAt = kodi?.linked ? kodi.linked_at : null;
  useEffect(() => {
    if (kodiCode && kodiLinkedAt && kodiLinkedAt !== kodiCode.base) {
      setKodiCode(null);
      haptic.pick();
      toast.current?.say(t.kodiLinkedToast, undefined, undefined, "success");
    }
  }, [kodiLinkedAt, kodiCode, t.kodiLinkedToast]);

  const copy = (text: string, done: string) => {
    haptic.pick();
    Clipboard.setString(text);
    toast.current?.say(done, undefined, undefined, "success");
  };

  const how = (
    <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 10 }}>
      <Text size={14} style={{ lineHeight: 22 }}>{t.homeServersIntro}</Text>
      {[t.stremioHow1, t.homeServersHow2, t.homeServersNeeds].map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tokens.accent, marginTop: 9 }} />
          <Text size={13} muted style={{ flex: 1, lineHeight: 21 }}>{line}</Text>
        </View>
      ))}
    </View>
  );

  if (!d) {
    return (
      <SettingsScreen title={t.homeServersTitle} toast={toast}>
        <RowsSkeleton rows={3} />
      </SettingsScreen>
    );
  }

  /* ───────── غيرُ المشترك: ما تفعله الميزة وبابُ الاشتراك — ومن بقي له رابطٌ يقدر على إلغائه ───────── */
  if (!d.plus) {
    return (
      <SettingsScreen title={t.homeServersTitle} toast={toast}>
        {how}
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
          <Text size={15} weight="700">{t.stremioPlusTitle}</Text>
          <Text size={13} muted style={{ lineHeight: 20 }}>{t.homeServersPlusSub}</Text>
          <Button label={t.widgetSubscribe} onPress={() => openWeb("/plus")} style={{ marginTop: 6 }} />
        </View>
        {d.linked || kodi?.linked ? (
          <Group>
            {d.linked ? <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => void revoke()} /> : null}
            {kodi?.linked ? <Row icon="trash" title={t.kodiRevoke} danger busy={busy === "kodi-revoke"} onPress={() => void kodiRevoke()} /> : null}
          </Group>
        ) : null}
      </SettingsScreen>
    );
  }

  const linked = d.linked || !!fresh;
  const steps =
    server === "plex" ? t.homeServerStepsPlex : server === "jellyfin" ? t.homeServerStepsJellyfin : server === "emby" ? t.homeServerStepsEmby : t.homeServerStepsKodi;
  return (
    <SettingsScreen title={t.homeServersTitle} toast={toast}>
      {how}

      {/* ───── الرابطُ الواحد ───── */}
      <Group>
        <Row
          icon="link"
          title={t.homeServerLink}
          subtitle={d.used_at ? t.homeServerLastSeen(timeAgo(d.used_at, t)) : t.homeServerOneLink}
          badge={<StatusPill label={linked ? t.stremioLinked : t.stremioNotLinked} color={linked ? tokens.success : tokens.muted} />}
        />
      </Group>
      {fresh ? (
        <>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: tokens.border, padding: 12 }}>
            <Text size={12} muted selectable style={{ writingDirection: "ltr", textAlign: "left", lineHeight: 18 }}>{fresh}</Text>
          </View>
          <Button label={t.homeServerCopy} onPress={() => copy(fresh, t.stremioCopied)} />
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioLinkOnce}</Text>
        </>
      ) : linked ? (
        <Group>
          <Row icon="repeat" title={t.stremioNewLink} subtitle={t.stremioNewLinkSub} busy={busy === "issue"} onPress={() => void issue()} />
          <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => void revoke()} />
        </Group>
      ) : (
        <Button label={t.homeServerCreate} busy={busy === "issue"} onPress={() => void issue()} />
      )}

      {/* ───── خطواتُ السيرفر المختار ───── */}
      <Segmented
        items={[
          { id: "plex", label: "Plex" },
          { id: "jellyfin", label: "Jellyfin" },
          { id: "emby", label: "Emby" },
          { id: "kodi", label: "Kodi" },
        ]}
        value={server}
        onChange={(v) => setServer(v as HomeServer)}
      />
      <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
        {steps.map((line, i) => (
          <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Text size={13} weight="700" color={tokens.accent} style={{ lineHeight: 21, minWidth: 16 }}>{`${i + 1}.`}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text size={13} style={{ lineHeight: 21 }}>{line}</Text>
              {/* عنوانُ المصدر سطرٌ وحده: يُقرأ حرفاً حرفاً وهو يُكتب بالريموت */}
              {server === "kodi" && i === 1 ? (
                <Text size={14} weight="700" color={tokens.accent} selectable style={{ writingDirection: "ltr", textAlign: "left", lineHeight: 21 }}>
                  {KODI_SOURCE_URL}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {server === "jellyfin" ? (
        <Group>
          <Row icon="copy" title={t.homeServerCopyTemplate} subtitle={t.homeServerTemplateSub} onPress={() => copy(JELLYFIN_TEMPLATE, t.homeServerTemplateCopied)} />
        </Group>
      ) : null}
      {server === "kodi" ? (
        <>
          {kodi?.linked ? (
            /* ───── Kodi مربوط: الجهازُ وآخرُ ما وصل، ورمزٌ جديدٌ لجهازٍ آخر، والإلغاء ───── */
            <Group>
              <Row
                icon="tv"
                title="Kodi"
                subtitle={t.kodiLinkedFrom(kodi.device, kodi.used_at ? timeAgo(kodi.used_at, t) : null)}
                badge={<StatusPill label={t.stremioLinked} color={tokens.success} />}
              />
              {kodiCode ? null : (
                <Row icon="repeat" title={t.kodiNewCode} subtitle={t.kodiNewCodeSub} busy={busy === "kodi-code"} onPress={() => void kodiNewCode()} />
              )}
              <Row icon="trash" title={t.kodiRevoke} danger busy={busy === "kodi-revoke"} onPress={() => void kodiRevoke()} />
            </Group>
          ) : null}
          {kodiCode || !kodi?.linked ? (
            /* ───── الرمزُ تحت الخطوات مباشرةً («أ») ───── */
            <>
              <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 12, alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", justifyContent: "space-between", gap: 8 }}>
                  <Text size={15} weight="700">{t.kodiCodeTitle}</Text>
                  {kodi?.linked ? null : <StatusPill label={t.stremioNotLinked} color={tokens.muted} />}
                </View>
                <Text
                  size={40}
                  weight="800"
                  color={kodiCode && !kodiExpired ? tokens.accent : tokens.muted}
                  selectable
                  accessibilityLabel={kodiCode?.code.split("").join(" ")}
                  style={{ writingDirection: "ltr", letterSpacing: 6, fontVariant: ["tabular-nums"], minHeight: 52 }}
                >
                  {kodiCode ? `${kodiCode.code.slice(0, 3)} ${kodiCode.code.slice(3)}` : "––– –––"}
                </Text>
                <Text size={12} muted>{kodiExpired ? t.kodiCodeExpired : t.kodiCodeWait}</Text>
              </View>
              <Group>
                <Row icon="repeat" title={t.kodiNewCode} busy={busy === "kodi-code"} onPress={() => void kodiNewCode()} />
              </Group>
            </>
          ) : null}
        </>
      ) : null}

      {/* ───── تاريخُ Plex القديم ───── */}
      <Group>
        <Row icon="download" title={t.plexImportRow} subtitle={t.plexImportRowSub} onPress={() => setPlexOpen(true)} />
      </Group>
      {plexOpen ? <PlexImportSheet onClose={() => setPlexOpen(false)} /> : null}
    </SettingsScreen>
  );
}
