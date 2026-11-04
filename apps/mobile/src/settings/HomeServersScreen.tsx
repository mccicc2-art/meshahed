import React, { useRef, useState } from "react";
import { Clipboard, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { haptic } from "../haptics";
import { api, write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { Segmented } from "../library/ToolsSheet";
import { timeAgo } from "@/core/when";
import { JELLYFIN_TEMPLATE, type HomeServer } from "@/core/homeServer";
import type { HomeServerLinkResult, HomeServerState } from "@/core/contracts/homeServer";
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
 * ⚖️ **والمقسّمُ هو العائلةُ الواحدة** (`Segmented` بخطّها السفليّ) — لا حبّةٌ ثانية. وKodi غائبٌ لا «قريباً»: لا وعدَ بما لم يُبنَ.
 * ⚖️ **«استورد تاريخك من Plex»** يفتح ورقةَ الرمز (`PlexImportSheet`) — دخولُ Plex لا يصل خادمَنا («٣ أ»).
 * 📌 التصميمُ مؤقّتٌ حتى بناء الاشتراك (أحمد: «راح يتغير التصميم مع الدفع»).
 */
export function HomeServersScreen() {
  const { t, tokens } = useApp();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useQuery({
    queryKey: HOME_SERVER_KEY,
    queryFn: async () => (await api<HomeServerState>("/api/v1/me/home-server")).data,
    staleTime: 60_000,
  });
  const d = q.data;
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);
  const [server, setServer] = useState<HomeServer>("plex");
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
        {d.linked ? (
          <Group>
            <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => void revoke()} />
          </Group>
        ) : null}
      </SettingsScreen>
    );
  }

  const linked = d.linked || !!fresh;
  const steps = server === "plex" ? t.homeServerStepsPlex : server === "jellyfin" ? t.homeServerStepsJellyfin : t.homeServerStepsEmby;
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
        ]}
        value={server}
        onChange={(v) => setServer(v as HomeServer)}
      />
      <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
        {steps.map((line, i) => (
          <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Text size={13} weight="700" color={tokens.accent} style={{ lineHeight: 21, minWidth: 16 }}>{`${i + 1}.`}</Text>
            <Text size={13} style={{ flex: 1, lineHeight: 21 }}>{line}</Text>
          </View>
        ))}
      </View>
      {server === "jellyfin" ? (
        <Group>
          <Row icon="copy" title={t.homeServerCopyTemplate} subtitle={t.homeServerTemplateSub} onPress={() => copy(JELLYFIN_TEMPLATE, t.homeServerTemplateCopied)} />
        </Group>
      ) : null}

      {/* ───── تاريخُ Plex القديم ───── */}
      <Group>
        <Row icon="download" title={t.plexImportRow} subtitle={t.plexImportRowSub} onPress={() => setPlexOpen(true)} />
      </Group>
      {plexOpen ? <PlexImportSheet onClose={() => setPlexOpen(false)} /> : null}
    </SettingsScreen>
  );
}
