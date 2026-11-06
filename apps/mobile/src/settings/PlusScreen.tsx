import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { Icon, type IconName } from "../icons";
import { IdentityBadges } from "../IdentityBadges";
import { Segmented } from "../library/ToolsSheet";
import { ToastHost, type ToastHostRef } from "../HoldHost";
import { haptic } from "../haptics";
import { useSettings } from "./api";
import { buy, load, manage, reached, restore, type ActiveSub, type Loaded, type Plan } from "../billing/purchases";
import type { Dict } from "@/core/i18n";

/**
 * ====== 🆕 شاشةُ الاشتراك — Loopz+ بلس وذهبي (بناء 1.14.0، خطّةُ Loopz+ v2 §٣–§٦، لوحُ «المعمل» `Main`) ======
 *
 * **بابٌ واحدٌ لكلِّ أبواب البلس** كما كانت (`shell.nativeDoor` في `_layout`: `/plus` بأقفالها و`/profile/settings/billing`) —
 * فلا يتغيّر أيُّ مستدعٍ. والذي تغيّر أنّها صارت تبيع: **العرضُ** (بلس سنويٌّ وشهريّ · ذهبيّ)، **المشترك** (كلُّ ميزةٍ بـ✓ وبطاقةُ
 * «نشط» وموعدُ التجديد و«إدارة الاشتراك»)، **الترقية** (بلس ⇢ ذهبيّ بجملةٍ لكلِّ منصّة)، و«استرجاع المشتريات · الشروط · الخصوصية».
 *
 * 🔑 **ما يُعرض من المتجر وما يُفتح من الخادم**: السعرُ والأهليّةُ للسنة الأولى ونوعُ الاشتراك النشط من RevenueCat
 * (`billing/purchases.ts`)؛ وفتحُ المزايا وشارةُ GOLD من خطّة الخادم بعد الويبهوك (`syncServer`) — لا مصدران للحقيقة.
 *
 * ⚖️ **الألوانُ من الثيم** (لوحُ `Main` يعرض الشاشةَ بالثيم الداكن والنهاريّ والمحيط)، والبطاقاتُ والأزرارُ من المصنع الواحد:
 * الزرُّ `Button`، والمقسّمُ `Segmented` (العائلةُ الواحدة — اللوحُ رسمه حبّتين، والقاعدةُ ٣ تمنع شكلاً ثانياً)، والإشعارُ `ToastHost`.
 *
 * 🔴 **لا شيءَ يُقال لم يُشحن يومَ المراجعة** (الخطّة §١): البندُ الأوّلُ «حتى ٥ أجهزة» لا «منصات»، والذهبيُّ قبل Younify ثلاثةُ أسطر.
 */

type Tier = "plus" | "gold";

/** مزايا بلس بترتيب الخطّة §٣ — `tvLine` و`badge` لا يتكرّران تحت الذهبيّ (لوحُ `Supporter`) */
const FEATURES: { icon: IconName; key: keyof Dict; skipForGold?: boolean }[] = [
  { icon: "tv", key: "pwFLink", skipForGold: true },
  { icon: "search", key: "pwFStory" },
  { icon: "grid", key: "pwFHome" },
  { icon: "palette", key: "pwFThemes" },
  { icon: "image", key: "pwFArt" },
  { icon: "widget", key: "pwFWidget" },
  { icon: "chart", key: "pwFStats" },
  { icon: "list", key: "pwFLists" },
  { icon: "star", key: "pwFBadge", skipForGold: true },
  { icon: "people", key: "pwFGroups" },
];

const TOP_ICONS: IconName[] = ["tv", "palette", "grid", "widget"];

export function PlusScreen() {
  const { t, tokens, locale } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useRef<ToastHostRef>(null);
  const q = useSettings();
  const a = q.data?.account;

  /* `undefined` = يُحمَّل · `null` = لا متجر على هذا الجهاز */
  const [store, setStore] = useState<Loaded | null | undefined>(undefined);
  const refresh = useCallback(() => {
    void load().then(setStore);
  }, []);
  useEffect(refresh, [refresh]);

  const active = store?.active ?? null;
  const offer = store?.offer ?? null;
  /* اشتراكٌ من متجرٍ آخر (آيفون ⇄ أندرويد) يُعرض ويُدار ولا يُرقّى من هنا — `ActiveSub.here` */
  const subscriber = !!active && (active.tier === "gold" || !offer?.goldYearly || !active.here);
  const upgrade = !!active && active.here && active.tier === "plus" && !!offer?.goldYearly;

  const [tier, setTier] = useState<Tier>("plus");
  const [plusPlan, setPlusPlan] = useState<"yearly" | "monthly">("yearly");
  /* الترقيةُ تفتح على الذهبيّ (لوحُ `UpgradeIOS`) — مرّةً حين يُعرف الاشتراك، ثمّ يختار هو */
  const settledTier = useRef(false);
  useEffect(() => {
    if (settledTier.current || store === undefined) return;
    settledTier.current = true;
    if (upgrade) setTier("gold");
  }, [store, upgrade]);

  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);

  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/web");
  }, [router]);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const fmtDate = useCallback(
    (iso: string | null | undefined) => {
      const ms = iso ? Date.parse(iso) : NaN;
      return Number.isNaN(ms) ? null : new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", { day: "numeric", month: "long", year: "numeric" }).format(new Date(ms));
    },
    [locale],
  );

  const goldTab = tier === "gold";
  const ownsPlusView = subscriber || (upgrade && !goldTab);
  const selected: Plan | null = !offer ? null : goldTab ? offer.goldYearly : plusPlan === "yearly" ? offer.plusYearly : offer.plusMonthly;

  const headline = ownsPlusView ? t.pwHeadSub : goldTab ? t.pwHeadGold : t.pwHeadOffer;
  const items = FEATURES.filter((f) => !(goldTab && !ownsPlusView && f.skipForGold));

  const onBuy = useCallback(async () => {
    if (!selected || busy) return;
    setBusy("buy");
    haptic.pick();
    const out = await buy(selected, active);
    setBusy(null);
    if (out.kind === "cancelled") return;
    if (out.kind === "pending") return toast.current?.say(t.pwPending);
    if (out.kind === "failed") return toast.current?.say(t.pwFailed, undefined, undefined, "error");
    const got = reached(out.server, goldTab ? "gold" : "plus");
    if (got) haptic.success();
    toast.current?.say(got ? t.pwDone : t.pwSlow, undefined, undefined, "success");
    refresh();
  }, [selected, busy, active, t, refresh, goldTab]);

  const onRestore = useCallback(async () => {
    if (busy) return;
    setBusy("restore");
    const r = await restore();
    setBusy(null);
    if (!r.ok) return toast.current?.say(t.pwFailed, undefined, undefined, "error");
    toast.current?.say(r.active ? t.pwRestored : t.pwNothingToRestore, undefined, undefined, r.active ? "success" : undefined);
    refresh();
  }, [busy, t, refresh]);

  /* بلسٌ من غير المتجر (مؤسِّسٌ حتى ٣٠ نوفمبر · شريك · منحة): يُقال له ما عنده، ويبقى العرضُ مفتوحاً له ليشتري */
  const serverPlusLine = useMemo(() => {
    if (active || !a?.plus) return null;
    const until = fmtDate(a.plus_until);
    return until ? t.pwYouHave(until) : t.pwYouHaveNoEnd;
  }, [active, a, fmtDate, t]);

  const legal = !selected ? null : goldTab ? t.pwLegalYear(selected.price) : plusPlan === "yearly" ? (selected.intro ? t.pwLegalYearIntro(selected.price) : t.pwLegalYear(selected.price)) : t.pwLegalMonth(selected.price);
  const cta = goldTab ? (upgrade ? t.pwCtaUpgrade : t.pwCtaGold) : plusPlan === "yearly" ? t.pwCtaYearly : t.pwCtaMonthly;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg, paddingTop: insets.top }}>
      {/* الشريطُ: الإغلاقُ في البداية والرموزُ الأربعةُ في الوسط على السطر نفسِه (الخطّة §٤، «Loopz+» يبقى للذهبيّ — ٥أ) */}
      <View style={{ height: 52, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t.closeLabel} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1, zIndex: 1 })}>
          <View style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={16} color={tokens.fg} />
          </View>
        </Pressable>
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }}>
          {TOP_ICONS.map((n) => (
            <Icon key={n} name={n} size={20} color={tokens.fg} />
          ))}
        </View>
      </View>

      <Text size={24} weight="800" style={{ textAlign: "center", lineHeight: 34, marginTop: -6, marginBottom: 14, marginHorizontal: 24 }} accessibilityRole="header">
        {headline}
      </Text>

      {/* بطاقةُ المزايا تتمرّر وحدَها، والشريطُ السفليُّ ثابت (لوحُ `Main`) */}
      <View style={{ flex: 1, minHeight: 0, marginHorizontal: 16, borderRadius: radius.sheet, backgroundColor: tokens.surface, overflow: "hidden" }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 }}>
          {!subscriber && offer?.goldYearly ? (
            <View style={{ marginBottom: 12 }}>
              <Segmented
                items={[
                  { id: "plus", label: upgrade ? t.pwTierPlusMine : t.pwTierPlus },
                  { id: "gold", label: t.pwTierGold },
                ]}
                value={tier}
                onChange={(v) => setTier(v === "gold" ? "gold" : "plus")}
              />
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text size={13} weight="700" muted>{goldTab && !ownsPlusView ? t.pwCardGold : t.pwCardPlus}</Text>
            <Text size={15} weight="800" style={{ writingDirection: "ltr" }}>
              Loopz<Text size={15} weight="800" color={tokens.accent}>+</Text>
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: tokens.divider, marginTop: 12, marginBottom: 4 }} />
          {goldTab && !ownsPlusView ? (
            <>
              <FeatureRow icon="star" title={t.pwGoldBadgeLine} accent trailing={<IdentityBadges flags={{ partner: false, plus: true, founder: false, verified: false, gold: true }} nameSize={20} />} />
              <FeatureRow icon="heart" title={t.pwGoldSupport} accent />
              <Text size={12} weight="700" muted style={{ paddingTop: 6, paddingBottom: 2 }}>{t.pwGoldAllPlus}</Text>
            </>
          ) : null}
          {items.map((f) => (
            <FeatureRow key={f.key} icon={f.icon} title={t[f.key] as string} check={ownsPlusView} checkLabel={t.pwIncluded} />
          ))}
          <View style={{ height: 1, backgroundColor: tokens.divider, marginTop: 8, marginBottom: 12 }} />
          <Text size={12} muted style={{ lineHeight: 19 }}>{t.pwFreeNote}</Text>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
        {store === undefined ? (
          <View style={{ height: 52 }} />
        ) : ownsPlusView && active ? (
          <>
            <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                  <Text size={18} weight="800" style={{ writingDirection: "ltr" }}>
                    Loopz<Text size={18} weight="800" color={tokens.accent}>+</Text>
                  </Text>
                  <Text size={14} weight="700" muted>{active.tier === "gold" ? t.pwTierGold : active.monthly ? t.pwMonthly : t.pwYearly}</Text>
                </View>
                {fmtDate(active.expires) ? (
                  <Text size={13} muted style={{ marginTop: 4, lineHeight: 19 }}>{active.willRenew ? t.pwRenews(fmtDate(active.expires) as string) : t.pwEnds(fmtDate(active.expires) as string)}</Text>
                ) : null}
              </View>
              <View style={{ paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.success + "24" }}>
                <Text size={12} weight="800" color={tokens.success} style={{ lineHeight: 24 }}>{t.pwActive}</Text>
              </View>
            </View>
            <Button label={t.pwManage} variant="ghost" onPress={() => void manage(active as ActiveSub)} />
            <Text size={11} muted style={{ textAlign: "center", lineHeight: 17 }}>{t.pwManageNote}</Text>
          </>
        ) : !offer || !selected ? (
          <Text size={13} muted style={{ textAlign: "center", lineHeight: 20, paddingVertical: 8 }}>{t.pwUnavailable}</Text>
        ) : (
          <>
            {upgrade && active ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, paddingHorizontal: 4 }}>
                <Text size={12} weight="700" muted>{t.pwUpCurrent}</Text>
                <Text size={12}>{`${t.pwTierPlus} · ${active.monthly ? t.pwMonthly : t.pwYearly}${fmtDate(active.expires) ? ` · ${fmtDate(active.expires)}` : ""}`}</Text>
              </View>
            ) : null}
            {serverPlusLine ? <Text size={12} weight="700" color={tokens.accent} style={{ textAlign: "center" }}>{serverPlusLine}</Text> : null}
            {goldTab ? (
              <PlanCard selected title={t.pwGoldName} sub={t.pwGoldSub} price={selected.price} per={t.pwPerYear} />
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                {offer.plusYearly ? (
                  <PlanCard
                    selected={plusPlan === "yearly"}
                    onPress={() => setPlusPlan("yearly")}
                    title={t.pwYearly}
                    flag={t.pwBest}
                    price={offer.plusYearly.intro ?? offer.plusYearly.price}
                    per={offer.plusYearly.intro ? t.pwFirstYear : t.pwPerYear}
                    then={offer.plusYearly.intro ? t.pwThenYear(offer.plusYearly.price) : null}
                    sub={offer.plusYearly.intro ? (offer.plusYearly.introPerMonth ? t.pwAboutMonth(offer.plusYearly.introPerMonth) : null) : offer.plusYearly.perMonth ? t.pwAboutMonth(offer.plusYearly.perMonth) : null}
                  />
                ) : null}
                {offer.plusMonthly ? (
                  <PlanCard selected={plusPlan === "monthly"} onPress={() => setPlusPlan("monthly")} title={t.pwMonthly} price={offer.plusMonthly.price} per={t.pwPerMonth} sub={t.pwCancelAny} />
                ) : null}
              </View>
            )}
            <Button label={cta} busy={busy === "buy"} disabled={!!busy} onPress={() => void onBuy()} style={{ minHeight: 52, borderRadius: radius.md }} />
            {upgrade && goldTab ? <Text size={12} weight="700" style={{ textAlign: "center", lineHeight: 18, paddingHorizontal: 4 }}>{Platform.OS === "android" ? t.pwUpNoteAndroid : t.pwUpNoteIos}</Text> : null}
            {legal ? <Text size={11} muted style={{ textAlign: "center", lineHeight: 17, paddingHorizontal: 4 }}>{legal}</Text> : null}
          </>
        )}
      </View>

      {/* الروابطُ الثلاثة تحت كلِّ حال — Apple تشترط الاسترجاعَ والشروطَ والخصوصيّة في شاشة الشراء */}
      <View style={{ flexDirection: "row", justifyContent: "center", columnGap: 18, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 10) }}>
        <LinkText label={t.pwRestore} strong busy={busy === "restore"} onPress={() => void onRestore()} />
        <LinkText label={t.pwTerms} onPress={() => router.push("/legal/terms")} />
        <LinkText label={t.pwPrivacy} onPress={() => router.push("/legal/privacy")} />
      </View>
      <ToastHost hostRef={toast} bottom={insets.bottom + 72} />
    </View>
  );
}

function FeatureRow({ icon, title, accent, check, checkLabel, trailing }: { icon: IconName; title: string; accent?: boolean; check?: boolean; checkLabel?: string; trailing?: React.ReactNode }) {
  const { tokens } = useApp();
  const color = accent ? tokens.accent : tokens.fg;
  return (
    <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Icon name={icon} size={20} color={color} />
      <Text size={15} weight={accent ? "700" : "500"} color={accent ? tokens.accent : undefined} style={{ flex: 1, minWidth: 0, lineHeight: 21 }}>{title}</Text>
      {trailing}
      {check ? (
        <View accessible accessibilityRole="image" accessibilityLabel={checkLabel}>
          <Icon name="check" size={18} color={tokens.success} />
        </View>
      ) : null}
    </View>
  );
}

function PlanCard({ selected, onPress, title, flag, price, per, then, sub }: { selected: boolean; onPress?: () => void; title: string; flag?: string; price: string; per: string; then?: string | null; sub?: string | null }) {
  const { tokens } = useApp();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, padding: 12, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 2, borderColor: selected ? tokens.accent : tokens.border, gap: 3, opacity: pressed ? 0.85 : 1 })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <Text size={13} weight="700" muted style={{ flexShrink: 1 }}>{title}</Text>
        {flag ? (
          <View style={{ paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: tokens.accent }}>
            <Text size={11} weight="800" color={tokens.onAccent} style={{ lineHeight: 18 }}>{flag}</Text>
          </View>
        ) : null}
      </View>
      <Text size={18} weight="800" style={{ lineHeight: 24 }}>
        {price} <Text size={12} weight="500" muted>{per}</Text>
      </Text>
      {then ? <Text size={12} weight="700" color={tokens.accent} style={{ lineHeight: 17 }}>{then}</Text> : null}
      {sub ? <Text size={12} muted style={{ lineHeight: 17 }}>{sub}</Text> : null}
    </Pressable>
  );
}

function LinkText({ label, onPress, strong, busy }: { label: string; onPress: () => void; strong?: boolean; busy?: boolean }) {
  const { tokens } = useApp();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="link" hitSlop={4} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed || busy ? 0.6 : 1 })}>
      <Text size={12} weight={strong ? "700" : "400"} color={strong ? tokens.fg : tokens.muted}>{label}</Text>
    </Pressable>
  );
}
