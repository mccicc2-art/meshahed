import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, iconOr } from "../icons";
import { radius } from "../theme";
import { Chevron } from "./ui";
import type { Density } from "@/core/density";
import { headerStatMeta, homeSectionMeta, sectionView, type HomePrefs, type HomeSection } from "@/core/homePrefs";
import { orderedProfileTabs, profileSectionMeta, profileTabMeta, type ProfilePrefs } from "@/core/profilePrefs";

/**
 * 🆕 D-1322 — **المعاينةُ الحيّة في «التخصيص» أصليّةً** — نظيرُ `CustomizePreview` الويب (D-441)، والدَّينُ المعلَن في
 * D-1112 يُسدَّد (طلبُ أحمد ٨ أكتوبر: «نبغى معاينة في التطبيق»، بعد تسجيلٍ بدّل فيه الخيارات وحفظ فلم يرَ أثراً).
 *
 * 🔑 **تقرأ مسودّةَ الشاشة نفسَها** فتتبدّل مع الإصبع قبل الحفظ — وبها يجرّب غيرُ المشترك ما يبيعه بلس ثمّ يُمنع عند
 * «حفظ» (حكمُ أحمد: «التجربة في المعاينة ثم المنع عند الحفظ»).
 *
 * ⚠️ **رسمٌ لا نسخةٌ من الصفحة** (حجّةُ D-441 قائمة): لا ملصقَ يُجلب ولا نداء — مستطيلاتٌ بلون `surface2`.
 * وما يجب أن يَصدُق فيها: **ما يظهر · بأيِّ ترتيب · بأيِّ شكل (وضعُ العرض) · بأيِّ مقاس**.
 *
 * ⚖️ **وزيادتان على الويب، وكلتاهما لأنّ الخيارَ في هذه الشاشة**: (١) وضعُ العرض — «مزدوج» (D-1321) يُرى هنا قبل
 * الرئيسيّة؛ (٢) صفُّ التبويبات في الملفّ — ترتيبُها وإخفاؤها من خيارات اللوح، ومعاينةُ الويب لا ترسمها.
 * **وسقفُ البطاقات رقمٌ في طرف الصفّ** لا رسماً: ستّةَ عشرَ ملصقاً مصغّراً لا تُقرأ.
 *
 * 🆕 D-1640 — **عادت مثبّتةً وتطوى (اختيارُ أحمد «١ب» في المعمل، ٩ نوفمبر)** بعد أن حذفها D-1630: بلا معاينةٍ لم يعد
 * يُرى «كيف صار» قبل الحفظ. والفرقُ عن نسختها الأولى أنّها **الصفحةُ كاملةً لا أوّلُ قسمين**: صندوقٌ بارتفاعٍ ثابت
 * (`PV_H`) يتمرّر داخله، فقسمٌ نُقل إلى آخر القائمة يُرى في آخرها — كان يصير اسماً صغيراً (`Names`) لا يُرى أثرُه.
 * والمقاسُ أكبر (الملصقُ نحو ٤٠٪ من حقيقته لا ٢٠٪) فالفرقُ بين أحجام الملصق يُرى بالعين. والأرقامُ بقيمها حين نعرفها.
 */
/** ارتفاعُ صندوق المعاينة المفتوح — ثلثُ شاشةٍ متوسّطة، والباقي للخيارات */
export const PV_H = 260;
const POSTER_W: Record<Density, number> = { compact: 40, comfortable: 48, large: 58 };
const WORDS = { ar: { fold: "طيّ", show: "إظهار" }, en: { fold: "Hide", show: "Show" } } as const;

export type PreviewWho = {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  avatarPos: number | null;
  coverUrl: string | null;
  coverPos: number | null;
  followers: number | null;
  following: number | null;
};

export function CustomizePreview({
  kind,
  who,
  home,
  profile,
  open,
  onToggle,
  values,
}: {
  kind: "home" | "profile";
  who: PreviewWho;
  home: HomePrefs;
  profile: ProfilePrefs;
  open: boolean;
  onToggle: () => void;
  /** قيمُ أرقام الرئيسيّة من كاشها — ما لم يُجلب بعدُ يُرسم «—» */
  values: Map<string, string>;
}) {
  const { t, tokens, locale } = useApp();
  const w = WORDS[locale === "en" ? "en" : "ar"];
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, overflow: "hidden" }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t.custPreview} hitSlop={4} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12 }}>
        <Icon name="grid" size={13} color={tokens.muted} />
        <Text size={12} weight="600" muted numberOfLines={1} style={{ flex: 1 }}>
          {kind === "profile" ? `${t.custPreview} · ${t.custPreviewVisitor}` : t.custPreview}
        </Text>
        <Text size={12} weight="700" color={tokens.accent}>{open ? w.fold : w.show}</Text>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: PV_H, marginHorizontal: 8, marginBottom: 8, borderRadius: radius.md, backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.divider, overflow: "hidden" }}>
          {/* تمريرٌ داخل الصندوق — `nestedScrollEnabled` لأندرويد: الصندوقُ فوق تمرير الصفحة لا داخله، والخاصّيّةُ احتياطٌ إن نُقل */}
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {kind === "home" ? <HomeMini who={who} prefs={home} values={values} /> : <ProfileMini who={who} prefs={profile} />}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

/* ——————————————— الرئيسيّة ——————————————— */

function HomeMini({ who, prefs, values }: { who: PreviewWho; prefs: HomePrefs; values: Map<string, string> }) {
  const { t, tokens } = useApp();
  const meta = homeSectionMeta(t);
  const statMeta = headerStatMeta(t);
  return (
    <View style={{ padding: 10, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Face url={who.avatarUrl} pos={who.avatarPos} size={26} />
        <Text size={13} weight="700" numberOfLines={1} style={{ flex: 1 }}>{who.name}</Text>
        {/* الرمزُ رمزُ مبدّل الترويسة نفسُه — يصف الحال (D-1321) */}
        <Icon name={prefs.view === "mixed" ? "view-mixed" : "grid"} size={13} color={tokens.accent} />
      </View>
      {prefs.stats ? (
        <StatsStrip items={prefs.statsPick.map((k) => ({ key: k, label: statMeta[k].label, value: values.get(k) ?? "—" }))} />
      ) : null}
      {prefs.order.map((k) => (
        <View key={k} style={{ gap: 5 }}>
          <Head icon={meta[k].icon} label={meta[k].label} note={k === "week" ? null : t.allWord} />
          <HomeBody section={k} prefs={prefs} />
        </View>
      ))}
    </View>
  );
}

function HomeBody({ section, prefs }: { section: HomeSection; prefs: HomePrefs }) {
  const { tokens } = useApp();
  if (section === "week") {
    return (
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <View key={n} style={{ flex: 1, height: 22, borderRadius: 5, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: n === 2 ? tokens.accent : tokens.border }} />
        ))}
      </View>
    );
  }
  if (section === "continue") {
    return sectionView(prefs.view, "continue") === "compact" ? (
      <Lines lead="poster" />
    ) : (
      <View style={{ flexDirection: "row", gap: 4, overflow: "hidden" }}>
        {[0, 1, 2].map((n) => (
          <View key={n} style={{ width: 100, height: 56, borderRadius: 8, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
        ))}
      </View>
    );
  }
  if (section === "towatch") return sectionView(prefs.view, "towatch") === "compact" ? <Lines lead="poster" /> : <Posters density={prefs.density} />;
  /* «القادم» سطورٌ في الوضعين — والفرقُ صدرُ السطر: ملصقٌ في البصريّ ومربّعُ الموعد في المختصر */
  if (section === "upcoming") return <Lines lead={sectionView(prefs.view, "upcoming") === "compact" ? "chip" : "poster"} />;
  return <Posters density={prefs.density} />;
}

/* ——————————————— الملفّ ——————————————— */

function ProfileMini({ who, prefs }: { who: PreviewWho; prefs: ProfilePrefs }) {
  const { t, tokens } = useApp();
  const tabMeta = profileTabMeta(t);
  const secMeta = profileSectionMeta(t);
  const statMeta = headerStatMeta(t);
  const tabs = orderedProfileTabs(prefs).filter((k) => !prefs.hiddenTabs.includes(k));
  const overview = tabs.includes("overview");
  /* «٣ب» — خلايا البطاقة كما اختارها بترتيبه (D-1630)؛ «الإحصائيات» خليّةُ باب */
  const cell: Record<string, string> = { shows: statMeta.shows.label, movies: statMeta.movies.label, anime: secMeta.anime.label, stats: t.custStatsShort };
  return (
    <View>
      <View style={{ height: 56, backgroundColor: tokens.surface2 }}>
        {who.coverUrl ? <Image source={{ uri: who.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${who.coverPos ?? 30}%`, left: "50%" }} cachePolicy="memory-disk" /> : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: -16 }}>
          <View style={{ borderRadius: 22, borderWidth: 2, borderColor: tokens.bg }}>
            <Face url={who.avatarUrl} pos={who.avatarPos} size={40} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={13} weight="700" numberOfLines={1}>{who.name}</Text>
            {who.username ? <Text size={10} muted numberOfLines={1}>@{who.username}</Text> : null}
          </View>
          {who.followers != null && who.following != null ? (
            <Text size={10} muted numberOfLines={1}>
              {who.followers} {t.followersLabel} · {who.following} {t.followingLabel}
            </Text>
          ) : null}
        </View>
        {prefs.stats ? (
          <StatsStrip items={prefs.statsPick.map((k) => ({ key: k, label: cell[k] ?? k, value: null }))} />
        ) : null}
        {tabs.length > 0 ? (
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, overflow: "hidden" }}>
            {tabs.map((k, i) => (
              /* الصفحةُ تفتح على أوّل تبويبٍ ظاهر (`custTabsHint`) — فهو المضاء هنا.
                 D-1324 (بلاغُ أحمد بلقطة: «جاي كله في زاوية وحدة عكس الواقع»): التبويباتُ تتقاسم العرضَ كشريط الملفّ
                 نفسِه (`flexGrow: 1` · النصُّ في الوسط) — كانت متلاصقةً من البداية بفجوةٍ ثابتة. */
              <View key={k} style={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 4, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: i === 0 ? tokens.accent : "transparent" }}>
                <Text size={11} weight={i === 0 ? "700" : "500"} color={i === 0 ? tokens.fg : tokens.muted} numberOfLines={1}>{tabMeta[k].label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {overview ? (
          <View style={{ gap: 6 }}>
            <Text size={10} muted numberOfLines={1}>{t.custOverviewTab}</Text>
            {prefs.order.length === 0 ? (
              <View style={{ height: 30, borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border }} />
            ) : (
              prefs.order.map((k) => (
                <View key={k} style={{ gap: 5 }}>
                  <Head icon={secMeta[k].icon} label={secMeta[k].label} note={t.allWord} />
                  <Posters density={prefs.density} />
                </View>
              ))
            )}
          </View>
        ) : null}
        {/* «قوائم محفوظة» داخل تبويب القوائم — سطرٌ واحدٌ يُري المفتاحَ أثرَه دون تبديل المعاينة إلى تبويبٍ آخر */}
        {tabs.includes("lists") && prefs.savedLists ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={10} muted numberOfLines={1} style={{ flexShrink: 1 }}>{t.custListsTab}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 3, paddingHorizontal: 6 }}>
              <Icon name="bookmark" size={11} color={tokens.muted} />
              <Text size={10} weight="600" numberOfLines={1}>{t.savedListsSection}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ——————————————— القطعُ المشتركة ——————————————— */

function Face({ url, pos, size }: { url: string | null; pos: number | null; size: number }) {
  const { tokens } = useApp();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${pos ?? 50}%`, left: "50%" }} cachePolicy="memory-disk" /> : <Icon name="people" size={size * 0.6} color={tokens.muted} />}
    </View>
  );
}

function Head({ icon, label, note }: { icon: string; label: string; note: string | null }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Icon name={iconOr(icon, "list")} size={12} color={tokens.accent} />
      <Text size={12} weight="700" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      {note ? <Text size={10} weight="600" color={tokens.accent} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

/** شريطُ الأرقام كما في الرئيسيّة: القيمةُ فوق والاسمُ تحت — والملفُّ بلا قيمٍ (أسماءُ خلاياه وحدها) */
function StatsStrip({ items }: { items: { key: string; label: string; value: string | null }[] }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", borderRadius: 10, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
      {items.map((s, i) => (
        <View key={s.key} style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 1, paddingVertical: 7, paddingHorizontal: 2, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
          {s.value != null ? <Text size={13} weight="800" numberOfLines={1}>{s.value}</Text> : null}
          <Text size={10} muted numberOfLines={1}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** صفُّ ملصقاتٍ مصغّرة — نحو ٤٠٪ من الحقيقيّ (١٠٠ · ١١٨ · ١٤٠)، فالفرقُ بين المقاسات يُرى لا يُقرأ */
function Posters({ density }: { density: Density }) {
  const { tokens } = useApp();
  const w = POSTER_W[density];
  return (
    <View style={{ flexDirection: "row", gap: 4, overflow: "hidden" }}>
      {Array.from({ length: 8 }, (_, n) => (
        <View key={n} style={{ width: w, height: Math.round(w * 1.5), borderRadius: 6, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
      ))}
    </View>
  );
}

/** سطران مضغوطان — صدرُهما ملصقٌ صغير أو مربّعُ موعد */
function Lines({ lead }: { lead: "poster" | "chip" }) {
  const { tokens } = useApp();
  return (
    <View style={{ gap: 4 }}>
      {[0, 1].map((n) => (
        <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, borderColor: tokens.border, paddingVertical: 4, paddingHorizontal: 6 }}>
          {lead === "poster" ? (
            <View style={{ width: 20, height: 30, borderRadius: 4, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
          ) : (
            <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.accent }} />
          )}
          <View style={{ width: n === 0 ? 140 : 100, height: 6, borderRadius: 3, backgroundColor: tokens.surface2 }} />
        </View>
      ))}
    </View>
  );
}
