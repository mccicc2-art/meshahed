import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BackHandler, I18nManager, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { haptic } from "../haptics";
import { notePress } from "../perfMarks";
import { Chevron } from "../settings/ui";
import { useAppearanceActs } from "../settings/appearanceActs";
import { HOME_KEY, fetchHome } from "../home/useHome";
import { openProfile } from "../member/open";
import { FollowsSheet } from "../home/FollowsSheet";
import type { NativeRoot } from "../shell";
import { num } from "@/core/i18n";
import { drawerP, drawerStore, drawerWidth } from "./store";

/**
 * ====== 🆕 D-1505 — القائمةُ الجانبيّة (تصميمُ أحمد، ٢٢–٢٧ أكتوبر · «نفذ» ٢٧ أكتوبر) ======
 *
 * بابُ ما لا مكانَ له في الشريط السفليّ، وبابُ الاشتراك. **كلُّ وجهةٍ فيها شاشةٌ أصليّةٌ قائمة** — القائمةُ لا تبني شيئاً،
 * تختصر الطريق: الملفُّ · سجلُّ المشاهدة (`/activity?scope=watch`، D-1504) · التقويمُ و«تقريرك» (D-1573) · ربطُ المنصّات (`settings/stremio`) ·
 * التخصيص (`settings/home`) · الدعوات · الإعدادات · المساعدة · Plus.
 *
 * - **من صورة الحساب** (الرئيسيّة وطرفُ ترويسات التبويبات) كقائمة X التي أرسلها أحمد — والملفُّ أوّلُ ما فيها. وخطوةُ
 *   «ملفك» في الجولة تُبقي الصورةَ بابَ الملفّ (جملتُها «اضغط صورتك لتفتح ملفك») — `HomeScreen`.
 * - **تنزلق من طرف البداية** (يمينٌ في العربيّة، يسارٌ في الإنجليزيّة) وتُغلق بالحجاب أو بسحبها نحو طرفها أو بزرّ الرجوع.
 * - **المظهرُ زرٌّ واحدٌ رمزُه الحالُ** (قمرٌ للداكن، شمسٌ للفاتح) — وصفةُ مبدّل العرض في الرئيسيّة (D-1321) لا مبدّلٌ ثالث:
 *   التصميمُ رسم كبسولةً بزرّين، وهي عائلةُ تحكّمٍ ثالثةٌ تخالف القاعدة ٣. الداكنُ يعود إلى آخر ثيمٍ داكنٍ لبسه في الجلسة.
 * - **اللغةُ زرٌّ يبدّل إلى الأخرى** بفعل شاشة «المظهر» نفسِه (`useAppearanceActs`): الاتّجاهُ ينقلب فيُعاد تحميلُ JS.
 *
 * 🔴 **D-1506 — طبقةٌ مركَّبةٌ مسبقاً لا `Modal` يُبنى عند الضغط** (تسجيلُ خالد ٢٧ أكتوبر، أندرويد): من لمس الصورة إلى أوّل إطارٍ
 * للقائمة ~٣٧٠ms، والانزلاقُ لا يُرى (ينتهي قبل أن تُعرض نافذةُ `Modal`)، والأيقوناتُ والصورةُ تلحق بعد ٧٠–١٠٠ms. الآن اللوحُ
 * يُركَّب مرّةً بعد أن تهدأ الرئيسيّة، خارجَ الشاشة، **لا يأخذ لمساً ولا يُقرأ للقارئ الآليّ وهو مغلق** — والفتحُ تحريكُ
 * `drawerP` على خيط الواجهة فقط؛ وهي القيمةُ نفسُها التي يحرّكها الإصبعُ في سحبة الرئيسيّة (`HomeScreen`).
 */
/** المهلةُ قبل التركيب المسبق — بعد أن تستقرّ الرئيسيّةُ وصورُها، لا في أوّل رسمها. ضغطةٌ قبلها تركّب فوراً */
const PREMOUNT_MS = 2500;
/** آخرُ ثيمٍ داكنٍ قبل «الفاتح» — يُعاد إليه بـ«الداكن» (ثيمُ بلس الملوّن لا يضيع بضغطتين) */
let lastDark: string | null = null;

export function DrawerHost() {
  const { me } = useApp();
  const from = useSyncExternalStore(drawerStore.subscribe, drawerStore.get, drawerStore.get);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!me || ready) return;
    const id = setTimeout(() => setReady(true), PREMOUNT_MS);
    return () => clearTimeout(id);
  }, [me, ready]);
  /* 🆕 D-1508 — ورقةُ المتابعين تعيش هنا لا في اللوح: اللوحُ يُغلق أوّلاً ثمّ تظهر فوق الشاشة التي كان فوقها */
  const router = useRouter();
  const [follows, setFollows] = useState<{ dir: "followers" | "following"; count: number; root: NativeRoot } | null>(null);
  if (!me || !(ready || from || follows)) return null;
  return (
    <>
      {ready || from ? <SideDrawer from={from} onFollows={setFollows} /> : null}
      {follows ? (
        <FollowsSheet
          dir={follows.dir}
          count={follows.count}
          onClose={() => setFollows(null)}
          onOpen={(u) => openProfile(router, u, follows.root)}
        />
      ) : null}
    </>
  );
}

function SideDrawer({
  from,
  onFollows,
}: {
  from: ReturnType<typeof drawerStore.get>;
  onFollows: (f: { dir: "followers" | "following"; count: number; root: NativeRoot }) => void;
}) {
  const { t, tokens, locale, me, themeId } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = drawerWidth(width);
  const rtl = I18nManager.isRTL;
  /* الإزاحةُ نحو طرف البداية: موجبةٌ في العربيّة (اليمين)، سالبةٌ في الإنجليزيّة */
  const sign = rtl ? 1 : -1;
  const open = from !== null;

  const home = useQuery({ queryKey: HOME_KEY, queryFn: fetchHome, staleTime: 60_000 });
  const h = home.data?.header ?? null;
  const plus = me?.plus ?? false;
  const toastFail = useCallback(() => undefined, []);
  const { settings, busy, pickLocale, pickTheme } = useAppearanceActs(toastFail);

  const close = useCallback((then?: () => void) => drawerStore.close(then), []);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  /* السحبُ نحو طرف البداية يُغلق، والإصبعُ يحرّك القيمةَ نفسَها — أفقيٌّ وحده، فالتمريرُ العموديُّ لا يُسرق */
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const d = Math.max(0, Math.min(W, e.translationX * sign));
      drawerP.value = 1 - d / W;
    })
    .onEnd((e) => {
      const d = e.translationX * sign;
      const v = e.velocityX * sign;
      if (d > W / 3 || v > 500) scheduleOnRN(close);
      else drawerP.value = withTiming(1, { duration: 160 });
    });

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sign * W * (1 - drawerP.value) }] }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: drawerP.value }));

  const go = (href: Href) => close(() => router.push(href));
  const openMe = () => close(() => (me?.username ? openProfile(router, me.username, from ?? "home") : router.push("/settings/profile")));

  const name = h?.display_name ?? me?.nickname ?? me?.username ?? "";
  const username = h?.username ?? me?.username ?? null;
  const avatar = h?.avatar_url ?? me?.avatar_url ?? null;
  /* 🔴 D-1507 — **التاريخُ يُقرأ كاملاً** (تسجيلُ خالد ٢٧ أكتوبر: «Active until Decem…»): الشهرُ مختصرٌ بالإنجليزيّة («Dec 20»)
     وكاملٌ بالعربيّة («٢٠ نوفمبر» يتّسع) — والسطرُ يصغر قليلاً قبل أن يُقصّ إن ضاق العرضُ على هاتفٍ أصغر */
  const until = h?.plus_until ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { day: "numeric", month: locale === "ar" ? "long" : "short" }).format(new Date(h.plus_until)) : null;
  /* 🔴 D-1507 — **النصُّ على خطِّ الأيقونة** (تسجيلُ خالد ٢٧ أكتوبر: «الأسطر مهي على نفس الخط مع الأيقونات»). مقيسٌ من التسجيل
     (أندرويد، الإنجليزيّة): وسطُ الكلمة فوق وسط الأيقونة بـ٦–٧px في كلِّ صفّ ≈ ٠٫١٤ من مقاس الخطّ — صندوقُ سطر Poppins أطولُ من جسم
     حروفه في أسفله. الحرفُ ينزل بالإزاحة والصفُّ لا يتغيّر ارتفاعُه. العربيُّ على الآيفون مصحَّحٌ في `Text` (D-1498)، وأندرويد العربيُّ
     لم يُقَس — لا يُمسّ */
  const lift = (size: number) => (Platform.OS === "android" && locale !== "ar" ? { transform: [{ translateY: Math.round(size * 1.4) / 10 }] } : null);

  const isLight = (themeId ?? settings?.appearance.theme) === "daylight";
  const toggleTheme = () => {
    if (busy) return;
    if (isLight) void pickTheme(lastDark ?? "loopz");
    else {
      lastDark = themeId ?? settings?.appearance.theme ?? null;
      void pickTheme("daylight");
    }
  };
  const langNow = locale === "ar" ? t.arabicLang : t.englishLang;
  const toggleLang = () => {
    if (busy || !settings) return;
    haptic.pick();
    void pickLocale(locale === "ar" ? "en" : "ar");
  };

  const row = (icon: IconName, label: string, onPress: () => void, opts?: { small?: boolean; tag?: boolean }) => (
    <Pressable
      key={label}
      onPress={onPress}
      onPressIn={notePress}
      accessibilityRole="link"
      /* 🆕 D-1509 — **مسافاتُ «ب»** (أحمد ٢٧ أكتوبر بلقطة X: «تحسها ملمومة القوائم»؛ قيس من اللقطة: صفُّ X ~٥٦، وصفُّنا كان ٤٦):
         الصفُّ الرئيس ٥٤ بخطٍّ أخفّ (٦٠٠ لا ٧٠٠)، والثانويّ ٤٨ للمشترك و٤٤ لغيره — بطاقةُ الدعوة بمزاياها الخمس تأخذ مكانَ الفرق */
      style={({ pressed }) => ({ height: opts?.small ? (plus ? 48 : 44) : 54, flexDirection: "row", alignItems: "center", gap: 18, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={opts?.small ? 22 : 24} color={tokens.fg} />
      <Text size={opts?.small ? 16 : 18} weight={opts?.small ? "500" : "600"} numberOfLines={1} style={[{ flex: 1 }, lift(opts?.small ? 16 : 18)]}>{label}</Text>
      {opts?.tag ? (
        <View style={{ borderWidth: 1.5, borderColor: tokens.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text size={10} weight="700" color={tokens.accent}>PLUS</Text>
        </View>
      ) : null}
    </Pressable>
  );
  /* Plus: غيرُ المشترك يرى الدعوةَ ومزاياها تحت حسابه، والمشتركُ سطراً واحداً (أحمد: «سطر واحد يكفي ومختصر جداً») */
  const plusCard = (
            <Pressable
              onPress={() => go("/settings/plus")}
              onPressIn={notePress}
              accessibilityRole="link"
              style={({ pressed }) => ({ marginTop: plus ? 0 : 24, marginBottom: plus ? 14 : 0, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16, gap: 12, opacity: pressed ? 0.85 : 1 })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ backgroundColor: tokens.accent, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text size={11} weight="700" color={tokens.onAccent}>PLUS</Text>
                </View>
                <Text size={plus ? 16 : 17} weight="800" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ flex: 1 }}>
                  {plus ? (until ? t.drawerPlusUntil(until) : t.drawerPlusActive) : t.drawerPlusCta}
                </Text>
                <Chevron />
              </View>
              {plus ? null : (
                <View style={{ gap: 4 }}>
                  {t.drawerPlusFeats.map((f) => (
                    <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Icon name="check" size={16} color={tokens.accent} />
                      <Text size={14} muted numberOfLines={1} style={{ flex: 1 }}>{f}</Text>
                    </View>
                  ))}
                  <Text size={13} weight="700" color={tokens.accent} style={{ paddingStart: 26 }}>{t.drawerPlusMore}</Text>
                </View>
              )}
            </Pressable>
  );
  const divider = <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 8 }} />;

  return (
    /* مغلقةً: لا لمسَ (`none`) ولا قارئَ آليّ — اللوحُ خارجَ الشاشة والحجابُ شفّاف */
    <View
      pointerEvents={open ? "auto" : "none"}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!open}
      style={StyleSheet.absoluteFill}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.62)" }, veilStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityRole="button" accessibilityLabel={t.closeLabel} />
        </Reanimated.View>
        <GestureDetector gesture={pan}>
          <Reanimated.View
            accessibilityViewIsModal={open}
            accessibilityLabel={t.drawerLabel}
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                start: 0,
                width: W,
                backgroundColor: tokens.bg,
                borderEndWidth: StyleSheet.hairlineWidth,
                borderEndColor: tokens.border,
              },
              panelStyle,
            ]}
          >
            {/* 🆕 D-1509 — **يتمرّر إن طال عن الشاشة** (هاتفٌ قصير، أو غيرُ مشتركٍ بالإنجليزيّة: يملأ ٨٤٤ نقطة كلَّها) — وإلّا يبقى
                ساكناً والفاصلُ المرن يدفع الإعداداتِ إلى الأسفل كما كان. العموديُّ لا ينازع سحبةَ الإغلاق الأفقيّة (`failOffsetY`) */}
            <ScrollView
              bounces={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12, paddingHorizontal: 22 }}
            >
            {/* الحساب: الصورةُ بجوار الاسم (أحمد: «الصورة تكون كذا ماتكون فوق الاسم») ثمّ الرقمان */}
            <Pressable onPress={openMe} onPressIn={notePress} accessibilityRole="link" accessibilityLabel={`${t.drawerProfile} — ${name}`} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  {avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${h?.avatar_pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="person" size={26} color={tokens.muted} />}
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text size={20} weight="800" numberOfLines={1}>{name}</Text>
                  {/* 🔴 D-1572 — **المعرّفُ تحت الاسم في جهته** (لقطةُ أحمد ٢٩ أكتوبر، آيفون: «@ahmed» في أقصى اليسار بعيداً عن الاسم): كان
                      `textAlign: "right"` في العربيّة، وiOS يقلب يمين/يسار مع اتّجاه التطبيق فيرميه للطرف الآخر. الآن يأخذ عرضَ نصّه
                      ويقف في البداية (`alignSelf`) — والتخطيطُ يقلب البداية صحيحاً في الاتّجاهين، والنصُّ اللاتينيُّ يبقى `ltr` */}
                  {username ? <Text size={13} muted numberOfLines={1} style={{ writingDirection: "ltr", alignSelf: "flex-start", maxWidth: "100%" }}>@{username}</Text> : null}
                </View>
              </View>
            </Pressable>
            {/* 🆕 D-1508 — **كلُّ رقمٍ بابُ قائمته** (أحمد ٢٧ أكتوبر: «إذا ضغطت على المتابعين يروح لهم مباشرة، سواء اللي أتابعهم أو
                يتابعوني»). كانا داخل ضغطة الملفّ. ورقةُ `FollowsSheet` نفسُها التي يفتحها عدّادا الملفّ — لا قائمةَ ثانية؛ واللمسُ أوسعُ من
                الرقم (`hitSlop`) فلا يُخطئه الإصبع */}
            {h ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
                {(
                  [
                    { dir: "following", n: h.following, label: t.drawerFollowing },
                    { dir: "followers", n: h.followers, label: t.drawerFollowers },
                  ] as const
                ).map((c, i) => (
                  <React.Fragment key={c.dir}>
                    {i > 0 ? <View style={{ width: 1, height: 14, backgroundColor: tokens.divider }} /> : null}
                    <Pressable
                      onPress={() => close(() => onFollows({ dir: c.dir, count: c.n, root: from ?? "home" }))}
                      onPressIn={notePress}
                      accessibilityRole="button"
                      accessibilityLabel={`${num(c.n, locale)} ${c.label}`}
                      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                    >
                      <Text size={14} muted>
                        <Text size={14} weight="700" style={{ fontVariant: ["tabular-nums"] }}>{num(c.n, locale)}</Text> {c.label}
                      </Text>
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            ) : null}

            {/* 🆕 D-1510 — **المشتركُ لا يحتاج دعوة** (أحمد ٢٧ أكتوبر، بعد تصميمَي «الاشتراك تحت»): بطاقتُه تنزل فوق خطِّ الإعدادات،
                فأوّلُ ما يراه تحت حسابه ما يستعمله كلَّ يوم؛ وغيرُ المشترك تبقى الدعوةُ تحت حسابه كما هي */}
            {plus ? null : plusCard}

            <View style={{ marginTop: plus ? 26 : 16 }}>
              {row("person", t.drawerProfile, openMe)}
              {row("history", t.drawerHistory, () => go({ pathname: "/activity", params: { from, scope: "watch" } }))}
              {/* 🆕 D-1573 — **شاشتان قائمتان بلا بابٍ يُرى** (أحمد ٢٩ أكتوبر: «شي أستفيد منه» للفراغ — «١أ»): التقويمُ بابُه عنوانُ
                  «أسبوعك ›» وحدَه ويضيع إن أُخفي القسم، و«تقريرك» خلف الإحصائيات ثمّ «تقاريرك». بعد السجلّ لأنّ ثلاثتها عن مشاهدتك.
                  وسمُ PLUS لغير المشترك كربط المنصّات: كلتاهما تُقفل جزءاً له (`locked` في التقويم، `PlusLock` في التقرير) */}
              {/* 🆕 D-1606 — **التقويمُ ليس في القائمة** (أحمد ٣٠ أكتوبر بلقطة: «التقويم كالندر شيله من هنا ما نبيه يكون موجود»): صفحتُه باقيةٌ
                  وبابُها عنوانُ «أسبوعك ›» في الرئيسية؛ والقائمةُ لغير المشترك تقصر صفّاً فلا يختفي سطرُ اللغة كلُّه تحت الشاشة */}
              {row("chart", t.drawerReport, () => go({ pathname: "/reports", params: { from } }), { tag: !plus })}
              {row("link", t.drawerConnections, () => go("/settings/stremio"), { tag: !plus })}
              {row("sliders", t.drawerCustomize, () => go("/settings/home"))}
              {row("gift", t.drawerInvite, () => go("/settings/invites"))}
            </View>

            <View style={{ flex: 1 }} />
            {plus ? plusCard : null}
            {divider}
            {row("settings", t.drawerSettings, () => go("/settings"), { small: true })}
            {row("help", t.drawerHelp, () => go("/settings/help"), { small: true })}
            {divider}
            <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={toggleLang} onPressIn={notePress} disabled={busy} accessibilityRole="button" accessibilityLabel={t.drawerLangAria(langNow)} hitSlop={4} style={({ pressed }) => ({ height: 44, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed || busy ? 0.6 : 1 })}>
                <Icon name="globe" size={24} color={tokens.fg} />
                <Text size={16} weight="500" style={lift(16)}>{langNow}</Text>
              </Pressable>
              <Pressable onPress={toggleTheme} onPressIn={notePress} disabled={busy} accessibilityRole="button" accessibilityLabel={isLight ? t.drawerToDark : t.drawerToLight} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, alignItems: "center", justifyContent: "center", opacity: pressed || busy ? 0.6 : 1 })}>
                <Icon name={isLight ? "sun" : "moon"} size={20} color={tokens.fg} />
              </Pressable>
            </View>
            </ScrollView>
          </Reanimated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}
