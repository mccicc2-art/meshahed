import React, { useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { GOLD_FRAME, IdentityBadges } from "../IdentityBadges";
import { Avatar } from "../community/CommunityCards";
import { Segmented } from "../library/ToolsSheet";
import { openProfile } from "../member/open";
import { profileKey } from "../member/profileData";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, RowsSkeleton, SwitchPill } from "./ui";
import { useSettings } from "./api";
import type { SupportersPayload } from "@/core/contracts/supporters";

/**
 * ====== 🆕 D-gold-perks — «داعمو لوبز»: لوحةُ أعضاء Gold (أحمد ١٠ نوفمبر: «١ أ · ٣ ب»، بتصميمها الأوّل «مثل هنا») ======
 *
 * كلُّ عضو Gold يظهر هنا تلقائياً، الأقدمُ أوّلاً، ويخفي نفسه بزرٍّ في بطاقته أعلى الصفحة — والإخفاءُ يُسقط معه سطرَ «داعم لوبز منذ»
 * من ملفّه (`supporter_since`، الهجرة ٢٤٤). الصفحةُ للجميع: يفتحها غيرُ المشترك من زرّ «اللوحة» في صفحة الاشتراك.
 * كلُّ خانةٍ تفتح ملفَّ صاحبها. الترتيبُ «الأقدم | الأحدث» في العميل — بالمقسّم الواحد (`Segmented`)، لا شكلٌ ثانٍ.
 */
export const SUPPORTERS_KEY = ["supporters"] as const;

const WORDS = {
  ar: {
    title: "داعمو لوبز",
    /* العددُ يحكم صيغةَ التمييز: ١–٢ بلا رقم، ٣–١٠ جمعٌ، ١١ فما فوق مفردٌ منصوب */
    thanks: (n: number, s: string) => (n <= 2 ? "شكراً لداعمي لوبز ♡" : n <= 10 ? `شكراً لـ${s} داعمين ♡` : `شكراً لـ${s} داعماً ♡`),
    sub: "هؤلاء يُبقون لوبز بلا إعلانات",
    since: (d: string) => `داعم منذ ${d}`,
    shown: "ظاهر في اللوحة",
    hidden: "اسمك مخفيّ من اللوحة",
    showA11y: "إظهار اسمي في اللوحة",
    oldest: "الأقدم",
    newest: "الأحدث",
    empty: "لا داعمين ظاهرين بعد",
    note: "كل اسم يفتح ملفّه",
    failed: "تعذّر التحميل",
  },
  en: {
    title: "Loopz supporters",
    thanks: (n: number, s: string) => (n === 1 ? "Thank you, our supporter ♡" : `Thank you, ${s} supporters ♡`),
    sub: "They keep Loopz ad-free",
    since: (d: string) => `Supporter since ${d}`,
    shown: "Shown on the board",
    hidden: "Your name is hidden",
    showA11y: "Show my name on the board",
    oldest: "Oldest",
    newest: "Newest",
    empty: "No supporters shown yet",
    note: "Each name opens their profile",
    failed: "Couldn't load",
  },
} as const;


export function SupportersScreen() {
  const { t, tokens, locale } = useApp();
  const w = WORDS[locale === "en" ? "en" : "ar"];
  const router = useRouter();
  const toast = useRef<ToastHostRef>(null);
  const { width } = useWindowDimensions();
  const settings = useSettings();
  const account = settings.data?.account;
  const q = useQuery({ queryKey: SUPPORTERS_KEY, queryFn: async () => (await api<SupportersPayload>("/api/v1/supporters")).data, staleTime: 60_000 });
  const [order, setOrder] = useState<"oldest" | "newest">("oldest");
  const [busy, setBusy] = useState(false);
  const d = q.data;

  const month = (iso: string | null) => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? null : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { month: "long", year: "numeric" }).format(new Date(ms));
  };
  const monthOnly = (iso: string | null) => {
    const ms = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(ms) ? "" : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { month: "long" }).format(new Date(ms));
  };
  const num = (n: number) => new Intl.NumberFormat(locale === "en" ? "en" : "ar").format(n);

  /* الإخفاءُ متفائل: البطاقةُ والقائمةُ تتبدّلان فوراً، والفشلُ يعيدهما */
  const toggleHidden = async () => {
    if (!d?.me || busy) return;
    const next = !d.me.hidden;
    haptic.pick();
    setBusy(true);
    const before = d;
    queryClient.setQueryData<SupportersPayload>(SUPPORTERS_KEY, (p) => (p && p.me ? { ...p, me: { ...p.me, hidden: next } } : p));
    try {
      await write<{ hidden: boolean }>("/api/v1/me/supporter", { hidden: next });
      void q.refetch();
      if (account?.username) void queryClient.invalidateQueries({ queryKey: profileKey(account.username) });
    } catch {
      queryClient.setQueryData(SUPPORTERS_KEY, before);
      toast.current?.say(t.errSaveShort, undefined, undefined, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <SettingsScreen title={w.title}>
        {q.isError ? <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{w.failed}</Text> : <RowsSkeleton rows={4} />}
      </SettingsScreen>
    );
  }

  const list = order === "oldest" ? d.list : [...d.list].reverse();
  const meGold = !!d.me?.gold;
  /* ثلاثُ خاناتٍ في الصفّ بعرض الشاشة (هامشُ الصفحة ١٦ وفجوتان ١٠) */
  const cell = Math.floor((width - 32 - 20) / 3);

  return (
    <SettingsScreen title={w.title} toast={toast}>
      <View style={{ alignItems: "center", paddingTop: 4, gap: 4 }}>
        <Text size={22} weight="800" style={{ textAlign: "center" }}>
          {w.thanks(d.list.length, num(d.list.length))}
        </Text>
        <Text size={13} muted style={{ textAlign: "center" }}>{w.sub}</Text>
      </View>

      {meGold && d.me ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.card, borderWidth: 1.5, borderColor: GOLD_FRAME, backgroundColor: tokens.surface }}>
          <Avatar uri={account?.avatar_url ?? null} size={48} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text size={15} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{account?.nickname ?? account?.username ?? ""}</Text>
              <IdentityBadges flags={{ partner: false, plus: true, founder: false, verified: false, gold: true }} nameSize={18} />
            </View>
            <Text size={12} muted numberOfLines={1}>
              {[month(d.me.since) ? w.since(month(d.me.since) as string) : null, d.me.hidden ? w.hidden : w.shown].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {/* المفتاحُ رسمُ مفتاح الإعدادات نفسُه (`SwitchPill` — يرسمه `Toggle` أيضاً) — هنا بلا صفّ لأنّه داخل البطاقة */}
          <Pressable onPress={() => void toggleHidden()} disabled={busy} accessibilityRole="switch" accessibilityLabel={w.showA11y} accessibilityState={{ checked: !d.me.hidden, disabled: busy }} hitSlop={10}>
            <SwitchPill checked={!d.me.hidden} />
          </Pressable>
        </View>
      ) : null}

      <Segmented
        items={[
          { id: "oldest", label: w.oldest },
          { id: "newest", label: w.newest },
        ]}
        value={order}
        onChange={(v) => setOrder(v === "newest" ? "newest" : "oldest")}
      />

      {list.length === 0 ? (
        <Text muted style={{ textAlign: "center", paddingVertical: 24 }}>{w.empty}</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {list.map((s) => (
            <Pressable
              key={s.username}
              onPress={() => {
                haptic.pick();
                openProfile(router, s.username, "home");
              }}
              accessibilityRole="button"
              accessibilityLabel={s.name ?? s.username}
              style={({ pressed }) => ({ width: cell, alignItems: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: radius.card, backgroundColor: tokens.surface, opacity: pressed ? 0.8 : 1 })}
            >
              <Avatar uri={s.avatar_url} size={52} />
              <Text size={14} weight="700" numberOfLines={1} style={{ maxWidth: cell - 12 }}>{s.name ?? s.username}</Text>
              {monthOnly(s.since) ? <Text size={12} muted numberOfLines={1}>{monthOnly(s.since)}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Icon name="people" size={12} color={tokens.muted} />
        <Text size={12} muted>{w.note}</Text>
      </View>
    </SettingsScreen>
  );
}
