import React, { useRef, useState } from "react";
import { Clipboard, Pressable, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { IdentityBadges } from "../IdentityBadges";
import { openProfile } from "../member/open";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, RowsSkeleton } from "./ui";
import { useOpenWeb } from "./api";
import { displayNameOf } from "@/core/people";
import { timeAgo } from "@/core/when";
import type { MyInvite, MyInvitesPayload } from "@/core/contracts/profile";

/**
 * ====== «الدعوات والمكافآت» أصليّاً — تبويبُ الأصدقاء (🆕 D-1360 · Phase 11-V · V-C · C4 — ١١ أكتوبر ٢٠٢٦) ======
 *
 * **قرارُ أحمد بعد صورةٍ للشاشة: «نفذ وارفع»**. الأقسامُ أقسامُ `/profile/settings/invites` بترتيبها (نموذجُه، D-770b):
 * «N من ٥» بخمس درجات · الرابطُ بزرَّي نسخٍ ومشاركة · العدّاداتُ الأربعة · آخرُ الدعوات · «كيف تعمل المكافآت» ·
 * «الشروط والأهلية» مطويّةً · بابُ الشركاء.
 *  - ⚖️ **بلا الحبّتين** («1 أ»): تبويبُ الشركاء موقوف (قرار ٨)، وحبّتان إحداهما تخرج إلى الويب تجعل الانتقالَ بينهما يبدو عطلاً.
 *    بابُه البطاقةُ السفليّة «اعرف أكثر» — تفتح تبويبَه في الويب.
 *  - **«عرض الكل» يمدّ القائمةَ في مكانها** (الويبُ يعيد تحميلَ الصفحة بـ`?all=1`)، و«الشروط» تنفتح وتنطوي في مكانها.
 *  - **النسخُ والمشاركةُ فعلان** (حجّةُ `InviteLinkCard`): المشاركةُ ورقةُ النظام، والنسخُ حافظة.
 *  - الأرقامُ لاتينيّةٌ كالويب (`num` → `en-US`)؛ والنصوصُ كما في القاموس.
 */
const STEPS = 5;
const FIRST = 6;
export const myInvitesKey = ["me:invites"] as const;

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { tokens } = useApp();
  return <View style={[{ borderRadius: radius.card, backgroundColor: tokens.surface, overflow: "hidden" }, style]}>{children}</View>;
}

export function InvitesScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const openWeb = useOpenWeb();
  const toast = useRef<ToastHostRef>(null);
  const [all, setAll] = useState(false);
  const [terms, setTerms] = useState(false);
  const q = useQuery({
    queryKey: myInvitesKey,
    queryFn: async () => (await api<MyInvitesPayload>("/api/v1/me/invites")).data,
    staleTime: 60_000,
  });
  const d = q.data;

  if (!d) {
    return (
      <SettingsScreen title={t.setInvites}>
        {q.isError ? (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 48 }}>
            <Text muted style={{ textAlign: "center" }}>{t.apiInternal}</Text>
            <Button label={t.errorRetry} variant="ghost" onPress={() => void q.refetch()} />
          </View>
        ) : (
          <>
            <View style={{ height: 176, borderRadius: radius.card, backgroundColor: tokens.surface }} />
            <RowsSkeleton rows={2} />
            <RowsSkeleton rows={3} />
          </>
        )}
      </SettingsScreen>
    );
  }

  const toward = d.stats.qualified % STEPS;
  const url = d.url;
  const shown = all ? d.items : d.items.slice(0, FIRST);
  const copy = () => {
    if (!url) return;
    haptic.pick();
    Clipboard.setString(url);
    toast.current?.say(t.linkCopied, undefined, undefined, "success");
  };
  const share = () => {
    if (!url) return;
    haptic.pick();
    /* إغلاقُ ورقة النظام ليس خطأً — لا يُتبع بنسخٍ لم يُطلب (حجّةُ `InviteLinkCard`) */
    void Share.share({ message: url, url }).catch(() => {});
  };
  const statusOf = (s: MyInvite["status"]): { label: string; bg: string; fg: string } =>
    s === "qualified" || s === "subscribed"
      ? { label: s === "qualified" ? t.invStQualified : t.invStSubscribed, bg: `${tokens.success}26`, fg: tokens.success }
      : s === "rejected"
        ? { label: t.invStRejected, bg: `${tokens.error}1A`, fg: tokens.error }
        : s === "in_progress"
          ? { label: t.invStProgress, bg: `${tokens.accent}26`, fg: tokens.accent }
          : { label: t.invStJoined, bg: tokens.surface2, fg: tokens.muted };
  const stats: [number, string, string][] = [
    [d.stats.joined, t.invStatJoined, ""],
    [d.stats.qualified, t.invStatCounted, ""],
    [d.stats.subscribed, t.invStatSubscribed, ""],
    [d.stats.reward_days, t.invStatRewards, t.invDayUnit],
  ];
  const how: [IconName, string][] = [
    ["calendar", t.invHow14],
    ["people", t.invHow7],
    ["star", t.invHowSub],
  ];

  return (
    <SettingsScreen title={t.setInvites} toast={toast}>
      {/* «N من ٥» — الدرجاتُ الخمس تُرسم لا تُشرح (نموذجه حرفاً) */}
      <Card style={{ padding: 16 }}>
        <Text size={12} weight="600" muted>{t.invNextReward}</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
          <Text size={30} weight="800" style={{ fontVariant: ["tabular-nums"] }}>{String(toward)}</Text>
          <Text size={22} weight="700" color={tokens.accent}>{t.invOf}</Text>
          <Text size={30} weight="800" style={{ fontVariant: ["tabular-nums"] }}>{String(STEPS)}</Text>
        </View>
        <Text size={14} muted>{t.invQualified}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 14 }}>
          {Array.from({ length: STEPS }, (_, i) => {
            const on = i < toward;
            return (
              <React.Fragment key={i}>
                {i > 0 ? <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: tokens.divider, marginHorizontal: 4 }} /> : null}
                <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: on ? tokens.accent : tokens.border, backgroundColor: on ? tokens.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                  <Text size={12} weight="700" color={on ? tokens.onAccent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{String(i + 1)}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        {/* نصّان متجاوران لا نصٌّ داخل نصّ: `Text` يختار خطَّ العربيّة واللاتينيّة لنصٍّ صِرف وحدَه، والمتداخلُ يسقط إلى خطّ النظام */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 5, marginTop: 14 }}>
          <Text size={14}>{t.invStepHintPre}</Text>
          <Text size={14} weight="700" color={tokens.accent}>{t.invStepHintReward}</Text>
        </View>
      </Card>

      {/* الرابطُ — تسميةٌ صغيرةٌ فوقه كنموذجه، والبطاقةُ تحمل زرَّيها */}
      <View style={{ gap: 10 }}>
        <Text size={12} weight="600" muted style={{ paddingHorizontal: 4, marginBottom: -4 }}>{t.invYourLink}</Text>
        {url ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radius.md, backgroundColor: tokens.surface, padding: 8 }}>
              {/* الرابطُ لاتينيٌّ يُقرأ من اليسار في اللغتين، وزرُّ النسخ بعده */}
              <Text size={14} numberOfLines={1} style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>{url.replace(/^https?:\/\//, "")}</Text>
              <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={t.invCopy} hitSlop={6} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
                <Icon name="copy" size={16} color={tokens.fg} />
              </Pressable>
            </View>
            <Pressable onPress={share} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md, backgroundColor: tokens.accent, paddingVertical: 14, opacity: pressed ? 0.8 : 1 })}>
              <Icon name="share" size={16} color={tokens.onAccent} />
              <Text size={15} weight="700" color={tokens.onAccent}>{t.invShare}</Text>
            </Pressable>
          </>
        ) : (
          /* بلا كودٍ (عطلُ قاعدةٍ عارض): لا بطاقةَ ميتةً — الزيارةُ التاليةُ تولّده */
          <Card style={{ padding: 14 }}><Text size={12} muted>{t.invEmpty}</Text></Card>
        )}
      </View>

      {/* الأرقامُ الأربعة — انضمّوا · احتُسبوا · اشتركوا · مكافآتك */}
      <Card style={{ flexDirection: "row" }}>
        {stats.map(([n, label, unit], i) => (
          <View key={label} style={{ flex: 1, alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
              <Text size={22} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{n.toLocaleString("en-US")}</Text>
              {unit ? <Text size={12} weight="700" muted>{unit}</Text> : null}
            </View>
            <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </Card>

      {/* آخرُ الدعوات — وحالةٌ فارغةٌ مرسومةٌ كنموذجه */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
          <Text size={15} weight="700">{t.invRecent}</Text>
          {d.items.length > shown.length ? (
            <Pressable onPress={() => setAll(true)} hitSlop={8}><Text size={14} weight="600" color={tokens.accent}>{t.invViewAll}</Text></Pressable>
          ) : null}
        </View>
        {d.items.length === 0 ? (
          <Card style={{ padding: 24, alignItems: "center" }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              <Icon name="people" size={24} color={tokens.accent} />
            </View>
            <Text size={15} weight="700" style={{ marginTop: 12 }}>{t.invEmptyTitle}</Text>
            <Text size={14} muted style={{ marginTop: 4 }}>{t.invEmptyBody}</Text>
          </Card>
        ) : (
          <Card>
            {shown.map((r, i) => {
              const name = displayNameOf(r.person, t.anonymousUser);
              const username = r.person?.username ?? null;
              const st = statusOf(r.status);
              return (
                <Pressable key={r.id} disabled={!username} onPress={() => username && openProfile(router, username, "home")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                    {r.person?.avatar_url ? <Image source={{ uri: r.person.avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="people" size={18} color={tokens.muted} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text size={14} weight="600" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
                      {/* D-1142 — للآخرين التوثيقُ وحدَه في صفوف الناس (عُرفُ `PersonRow` في الخصوصيّة) */}
                      {r.person?.verified ? <IdentityBadges flags={{ partner: false, plus: false, founder: false, verified: true }} nameSize={14} /> : null}
                    </View>
                    <Text size={12} muted numberOfLines={1}>{timeAgo(r.joined_at, t)}</Text>
                  </View>
                  <View style={{ borderRadius: radius.pill, backgroundColor: st.bg, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text size={11} weight="700" color={st.fg}>{st.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        )}
      </View>

      {/* كيف تعمل المكافآت — ثلاثةُ أسطر نموذجه، والتفصيلُ خلف «الشروط» */}
      <View style={{ gap: 10 }}>
        <Text size={15} weight="700" style={{ paddingHorizontal: 4 }}>{t.invHowTitle}</Text>
        <Card>
          {how.map(([icon, line], i) => (
            <View key={icon} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: tokens.divider }}>
              <Icon name={icon} size={18} color={tokens.accent} />
              <Text size={14} style={{ flex: 1, lineHeight: 22 }}>{line}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <Pressable onPress={() => setTerms((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: terms }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 4 }}>
          <Text size={14} weight="600" muted>{t.invTermsLink}</Text>
          <View style={{ transform: [{ rotate: terms ? "180deg" : "0deg" }] }}><Icon name="chevron-down" size={16} color={tokens.muted} /></View>
        </Pressable>
        {terms ? <Card style={{ padding: 14 }}><Text size={14} muted style={{ lineHeight: 22 }}>{t.invFinePrint}</Text></Card> : null}
      </View>

      {/* بابُ الشركاء — تبويبُه في الويب (موقوفٌ عن الأصليّة بقرار ٨): «اعرف أكثر» كنموذجه */}
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
        <Icon name="people" size={22} color={tokens.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={14} weight="700">{t.prtEntryTitle}</Text>
          <Text size={12} muted style={{ marginTop: 2 }}>{t.prtEntryBody}</Text>
        </View>
        <Pressable onPress={() => openWeb("/profile/settings/invites?tab=partners")} disabled={!!openWeb.busy} style={({ pressed }) => ({ borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent, paddingHorizontal: 14, paddingVertical: 6, opacity: pressed || openWeb.busy ? 0.6 : 1 })}>
          <Text size={12} weight="700" color={tokens.accent}>{t.prtLearnMore}</Text>
        </Pressable>
      </Card>
    </SettingsScreen>
  );
}
