import React, { useRef, useState } from "react";
import { Clipboard, Linking, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { write } from "../api";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, Group, Row, RowsSkeleton, StatusPill } from "./ui";
import { messageOf, useOpenWeb } from "./api";
import { useStremio } from "../stremio/api";
import type { StremioLinkResult } from "@/core/contracts/stremio";

/**
 * ====== 🆕 «اربط Stremio» — شاشةُ الربط (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * 🔑 **الرابطُ يظهر مرّةً واحدة** (الخادمُ لا يحفظ الرمز، بصمتَه فقط): «ثبّت في Stremio» يصدر رابطاً ويفتح Stremio على
 * شاشة التثبيت (`stremio://`)، ومعه «انسخ الرابط» و«Stremio Web» لمن لا يملك التطبيقَ على هذا الجهاز. ومن رجع لاحقاً
 * يجد «مربوط» و«رابط جديد» (يوقف القديم) و«ألغِ الربط» — لا رابطاً قديماً يُعرض.
 * 📌 **قاعدةُ «وكل ما قبلها» تُقال هنا مرّةً** (قرار ٩)، والبطاقةُ في الرئيسيّة تكتفي بـ«شفتها؟».
 * ⚖️ لـLoopz+ وحده (قرار ١) — غيرُ المشترك يرى ما تفعله الميزةُ وبابَ الاشتراك. والإلغاءُ متاحٌ للجميع.
 */
export function StremioScreen() {
  const { t, tokens } = useApp();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const q = useStremio();
  const d = q.data;
  const [fresh, setFresh] = useState<StremioLinkResult | null>(null);
  const [busy, setBusy] = useState<"issue" | "revoke" | null>(null);

  const issue = async (thenOpen: boolean) => {
    setBusy("issue");
    try {
      const r = await write<StremioLinkResult>("/api/v1/me/stremio/link", { action: "issue" });
      setFresh(r);
      haptic.pick();
      if (thenOpen && r.install_url) void Linking.openURL(r.install_url).catch(() => {});
    } catch (e) {
      toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
    } finally {
      setBusy(null);
    }
  };
  const revoke = async () => {
    setBusy("revoke");
    try {
      await write<StremioLinkResult>("/api/v1/me/stremio/link", { action: "revoke" });
      setFresh(null);
      toast.current?.say(t.stremioRevoked, undefined, undefined, "success");
    } catch (e) {
      toast.current?.say(messageOf(e, t as unknown as Record<string, unknown>, t.apiInternal));
    } finally {
      setBusy(null);
    }
  };
  const copy = (url: string) => {
    haptic.pick();
    Clipboard.setString(url);
    toast.current?.say(t.stremioCopied, undefined, undefined, "success");
  };

  const how = (
    <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 10 }}>
      <Text size={14} style={{ lineHeight: 22 }}>{t.stremioIntro}</Text>
      {[t.stremioHow1, t.stremioHow2, t.stremioHow3].map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tokens.accent, marginTop: 9 }} />
          <Text size={13} muted style={{ flex: 1, lineHeight: 21 }}>{line}</Text>
        </View>
      ))}
    </View>
  );
  const coverage = <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioCoverage}</Text>;

  if (!d) {
    return (
      <SettingsScreen title={t.stremioScreenTitle} toast={toast}>
        <RowsSkeleton rows={3} />
      </SettingsScreen>
    );
  }

  /* ───────── غيرُ المشترك: ما تفعله الميزة وبابُ الاشتراك — ومن بقي له رابطٌ يقدر على إلغائه ───────── */
  if (!d.plus) {
    return (
      <SettingsScreen title={t.stremioScreenTitle} toast={toast}>
        {how}
        <View style={{ borderRadius: 16, backgroundColor: tokens.surface, padding: 16, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="sparkle-star" size={18} color={tokens.accent} />
            <Text size={15} weight="700">{t.stremioPlusTitle}</Text>
          </View>
          <Text size={13} muted style={{ lineHeight: 20 }}>{t.stremioPlusSub}</Text>
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

  const linked = d.linked || !!fresh?.linked;
  return (
    <SettingsScreen title={t.stremioScreenTitle} toast={toast}>
      {how}
      <Group>
        <Row icon="link" title={t.stremioRow} badge={<StatusPill label={linked ? t.stremioLinked : t.stremioNotLinked} color={linked ? tokens.success : tokens.muted} />} />
      </Group>
      {fresh?.manifest_url ? (
        <>
          {fresh.install_url ? <Button label={t.stremioInstall} onPress={() => void Linking.openURL(fresh.install_url!).catch(() => {})} /> : null}
          <Group>
            <Row icon="copy" title={t.stremioCopy} onPress={() => copy(fresh.manifest_url!)} />
            {fresh.web_install_url ? <Row icon="compass" title={t.stremioInstallWeb} onPress={() => void Linking.openURL(fresh.web_install_url!).catch(() => {})} /> : null}
          </Group>
          <Text size={12} muted style={{ paddingHorizontal: 4, lineHeight: 18 }}>{t.stremioLinkOnce}</Text>
        </>
      ) : linked ? (
        <Group>
          <Row icon="repeat" title={t.stremioNewLink} subtitle={t.stremioNewLinkSub} busy={busy === "issue"} onPress={() => void issue(false)} />
          <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => void revoke()} />
        </Group>
      ) : (
        <Button label={t.stremioInstall} busy={busy === "issue"} onPress={() => void issue(true)} />
      )}
      {fresh?.manifest_url ? (
        <Group>
          <Row icon="trash" title={t.stremioRevoke} danger busy={busy === "revoke"} onPress={() => void revoke()} />
        </Group>
      ) : null}
      {coverage}
    </SettingsScreen>
  );
}
