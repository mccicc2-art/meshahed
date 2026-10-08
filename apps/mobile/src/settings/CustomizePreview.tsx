import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, iconOr } from "../icons";
import { radius } from "../theme";
import { Chevron } from "./ui";
import { CAP, type CardCount } from "@/core/cardCount";
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
 * 📏 **والارتفاعُ محكومٌ بالبناء**: أوّلُ `RICH` أقسامٍ بجسدها، والباقي أسماءٌ بترتيبها — فملفٌّ بستّة أقسامٍ ورئيسيّةٌ
 * بأحدَ عشر لا يدفعان الخياراتِ خارج الشاشة (المعاينةُ مثبّتةٌ فوق التمرير). وتُطوى بضغطةٍ على رأسها.
 */
const RICH_HOME = 3;
const RICH_PROFILE = 2;
const POSTER_W: Record<Density, number> = { compact: 18, comfortable: 22, large: 28 };

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
}: {
  kind: "home" | "profile";
  who: PreviewWho;
  home: HomePrefs;
  profile: ProfilePrefs;
  open: boolean;
  onToggle: () => void;
}) {
  const { t, tokens } = useApp();
  return (
    <View style={{ borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, overflow: "hidden" }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t.custPreview} hitSlop={4} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 12 }}>
        <Icon name="grid" size={13} color={tokens.muted} />
        <Text size={12} weight="600" muted numberOfLines={1} style={{ flex: 1 }}>
          {kind === "profile" ? `${t.custPreview} · ${t.custPreviewVisitor}` : t.custPreview}
        </Text>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginHorizontal: 8, marginBottom: 8, borderRadius: radius.md, backgroundColor: tokens.bg, borderWidth: 1, borderColor: tokens.divider, overflow: "hidden" }}>
          {kind === "home" ? <HomeMini who={who} prefs={home} /> : <ProfileMini who={who} prefs={profile} />}
        </View>
      ) : null}
    </View>
  );
}

/* ——————————————— الرئيسيّة ——————————————— */

function HomeMini({ who, prefs }: { who: PreviewWho; prefs: HomePrefs }) {
  const { t, tokens } = useApp();
  const meta = homeSectionMeta(t);
  const statMeta = headerStatMeta(t);
  const rich = prefs.order.slice(0, RICH_HOME);
  const rest = prefs.order.slice(RICH_HOME);
  return (
    <View style={{ padding: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Face url={who.avatarUrl} pos={who.avatarPos} size={20} />
        <Text size={12} weight="700" numberOfLines={1} style={{ flex: 1 }}>{who.name}</Text>
        {/* الرمزُ رمزُ مبدّل الترويسة نفسُه — يصف الحال (D-1321) */}
        <Icon name={prefs.view === "compact" ? "list" : prefs.view === "mixed" ? "view-mixed" : "grid"} size={13} color={tokens.accent} />
      </View>
      {prefs.stats ? (
        <StatsStrip items={prefs.statsPick.map((k) => ({ key: k, icon: statMeta[k].icon, label: statMeta[k].label }))} />
      ) : null}
      {rich.map((k) => (
        <View key={k} style={{ gap: 4 }}>
          <Head icon={meta[k].icon} label={meta[k].label} note={k === "week" || k === "continue" ? null : capNote(prefs.cards, t)} />
          <HomeBody section={k} prefs={prefs} />
        </View>
      ))}
      <Names items={rest.map((k) => ({ key: k, icon: meta[k].icon, label: meta[k].label }))} />
    </View>
  );
}

function HomeBody({ section, prefs }: { section: HomeSection; prefs: HomePrefs }) {
  const { tokens } = useApp();
  if (section === "week") {
    return (
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
          <View key={n} style={{ flex: 1, height: 12, borderRadius: 3, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: n === 2 ? tokens.accent : tokens.border }} />
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
          <View key={n} style={{ width: 62, height: 26, borderRadius: 5, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
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
  const rich = prefs.order.slice(0, RICH_PROFILE);
  const rest = prefs.order.slice(RICH_PROFILE);
  return (
    <View>
      <View style={{ height: 28, backgroundColor: tokens.surface2 }}>
        {who.coverUrl ? <Image source={{ uri: who.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${who.coverPos ?? 30}%`, left: "50%" }} cachePolicy="memory-disk" /> : null}
      </View>
      <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: -10 }}>
          <View style={{ borderRadius: 15, borderWidth: 2, borderColor: tokens.bg }}>
            <Face url={who.avatarUrl} pos={who.avatarPos} size={26} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={12} weight="700" numberOfLines={1}>{who.name}</Text>
            {who.username ? <Text size={9} muted numberOfLines={1}>@{who.username}</Text> : null}
          </View>
          {who.followers != null && who.following != null ? (
            <Text size={9} muted numberOfLines={1}>
              {who.followers} {t.followersLabel} · {who.following} {t.followingLabel}
            </Text>
          ) : null}
        </View>
        {prefs.stats ? (
          <StatsStrip
            items={(["shows", "movies", "time"] as const).map((k) => ({ key: k, icon: statMeta[k].icon, label: statMeta[k].label }))}
            link={prefs.statsLink ? t.custStatsLink : null}
          />
        ) : null}
        {tabs.length > 0 ? (
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: tokens.divider, overflow: "hidden" }}>
            {tabs.map((k, i) => (
              /* الصفحةُ تفتح على أوّل تبويبٍ ظاهر (`custTabsHint`) — فهو المضاء هنا.
                 D-1324 (بلاغُ أحمد بلقطة: «جاي كله في زاوية وحدة عكس الواقع»): التبويباتُ تتقاسم العرضَ كشريط الملفّ
                 نفسِه (`flexGrow: 1` · النصُّ في الوسط) — كانت متلاصقةً من البداية بفجوةٍ ثابتة. */
              <View key={k} style={{ flexGrow: 1, alignItems: "center", paddingHorizontal: 4, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: i === 0 ? tokens.accent : "transparent" }}>
                <Text size={9} weight={i === 0 ? "700" : "500"} color={i === 0 ? tokens.fg : tokens.muted} numberOfLines={1}>{tabMeta[k].label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {overview ? (
          <View style={{ gap: 6 }}>
            <Text size={9} muted numberOfLines={1}>{t.custOverviewTab}</Text>
            {prefs.order.length === 0 ? (
              <View style={{ height: 30, borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: tokens.border }} />
            ) : (
              <>
                {rich.map((k) => (
                  <View key={k} style={{ gap: 4 }}>
                    <Head icon={secMeta[k].icon} label={secMeta[k].label} note={capNote(prefs.cards, t)} />
                    <Posters density={prefs.density} />
                  </View>
                ))}
                <Names items={rest.map((k) => ({ key: k, icon: secMeta[k].icon, label: secMeta[k].label }))} />
              </>
            )}
          </View>
        ) : null}
        {/* «قوائم محفوظة» داخل تبويب القوائم — سطرٌ واحدٌ يُري المفتاحَ أثرَه دون تبديل المعاينة إلى تبويبٍ آخر */}
        {tabs.includes("lists") && prefs.savedLists ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text size={9} muted numberOfLines={1} style={{ flexShrink: 1 }}>{t.custListsTab}</Text>
            <Names items={[{ key: "saved", icon: "bookmark", label: t.savedListsSection }]} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ——————————————— القطعُ المشتركة ——————————————— */

type Dictish = { allWord: string; custPerRow: (n: number) => string };
function capNote(cards: CardCount, t: Dictish): string {
  const cap = CAP[cards];
  return Number.isFinite(cap) ? t.custPerRow(cap) : t.allWord;
}

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
      <Icon name={iconOr(icon, "list")} size={10} color={tokens.accent} />
      <Text size={10} weight="700" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      {note ? <Text size={9} weight="600" color={tokens.accent} numberOfLines={1}>{note}</Text> : null}
    </View>
  );
}

function StatsStrip({ items, link }: { items: { key: string; icon: string; label: string }[]; link?: string | null }) {
  const { tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface }}>
      {items.map((s, i) => (
        <View key={s.key} style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 5, paddingHorizontal: 2, borderStartWidth: i > 0 ? 1 : 0, borderStartColor: tokens.divider }}>
          <Icon name={iconOr(s.icon, "chart")} size={10} color={tokens.accent} />
          <Text size={9} muted numberOfLines={1} style={{ flexShrink: 1 }}>{s.label}</Text>
        </View>
      ))}
      {link ? (
        <View style={{ flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: 5, paddingHorizontal: 2, borderStartWidth: 1, borderStartColor: tokens.divider }}>
          <Text size={9} weight="600" color={tokens.accent} numberOfLines={1}>{link}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** صفُّ ملصقاتٍ مصغّرة — العرضُ خُمسُ الحقيقيّ تقريباً (٩٦ · ١١٨ · ١٤٨)، فالفرقُ بين المقاسات يُرى لا يُقرأ */
function Posters({ density }: { density: Density }) {
  const { tokens } = useApp();
  const w = POSTER_W[density];
  return (
    <View style={{ flexDirection: "row", gap: 4, overflow: "hidden" }}>
      {Array.from({ length: 12 }, (_, n) => (
        <View key={n} style={{ width: w, height: Math.round(w * 1.5), borderRadius: 4, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
      ))}
    </View>
  );
}

/** سطران مضغوطان — صدرُهما ملصقٌ صغير أو مربّعُ موعد */
function Lines({ lead }: { lead: "poster" | "chip" }) {
  const { tokens } = useApp();
  return (
    <View style={{ gap: 3 }}>
      {[0, 1].map((n) => (
        <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 5, borderWidth: 1, borderColor: tokens.border, paddingVertical: 2, paddingHorizontal: 4 }}>
          {lead === "poster" ? (
            <View style={{ width: 10, height: 15, borderRadius: 2, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border }} />
          ) : (
            <View style={{ width: 15, height: 15, borderRadius: 3, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.accent }} />
          )}
          <View style={{ width: n === 0 ? 80 : 60, height: 4, borderRadius: 2, backgroundColor: tokens.surface2 }} />
        </View>
      ))}
    </View>
  );
}

/** ما بعد الأقسام المرسومة: أسماءٌ بترتيبها — الترتيبُ والإخفاءُ يبقيان مرئيَّين بلا ارتفاع */
function Names({ items }: { items: { key: string; icon: string; label: string }[] }) {
  const { tokens } = useApp();
  if (items.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
      {items.map((x) => (
        <View key={x.key} style={{ flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 5, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, paddingVertical: 2, paddingHorizontal: 5 }}>
          <Icon name={iconOr(x.icon, "list")} size={9} color={tokens.muted} />
          <Text size={9} weight="600" numberOfLines={1}>{x.label}</Text>
        </View>
      ))}
    </View>
  );
}
