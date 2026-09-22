import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { displayNameOf } from "@/core/people";
import type { PersonLite } from "@/core/people";
import type { SearchArtist, SearchList, SearchTitle } from "../contracts";

/**
 * ====== صفوفُ نتائج البحث — `SearchScreen.tsx` (الويب) بالبكسل (Phase 11-G) ======
 *
 * 🔑 **الشكلُ يقول النوعَ قبل أن يُقرأ السطر** (سابقةُ `ResultRow`): ملصقٌ رأسيٌّ ٤٤×٦٦ للأعمال، دائرةٌ ٤٠
 * للأشخاص (فنّانٌ وعضوٌ سواء)، مربّعٌ ٤٤ للقوائم. الصفُّ `gap-3 py-2.5` وذيلُه chevron مُدارٌ مع الاتّجاه.
 * **مصدَّرةٌ** لأنّ منتقيَ «أضف إلى القائمة» (G4) يرسم صفَّ العمل نفسَه — صفٌّ واحدٌ للنتيجة أينما ظهرت.
 */
const ROW_GAP = 12;
const ROW_PAD_V = 10;

/** ذيلُ الصفّ — سهمٌ يقول «هذا بابٌ يُفتح»: `-rotate-90 rtl:rotate-90` بالـ`I18nManager` ضمناً (`start`/`end`) */
export function Tail({ color }: { color: string }) {
  const { locale } = useApp();
  return (
    <View style={{ transform: [{ rotate: locale === "en" ? "-90deg" : "90deg" }] }}>
      <Icon name="chevron-down" size={16} color={color} />
    </View>
  );
}

export function Thumb({ src, shape, icon }: { src: string | null; shape: "poster" | "circle" | "square"; icon: IconName }) {
  const { tokens } = useApp();
  const box =
    shape === "circle"
      ? { width: 40, height: 40, borderRadius: 20 }
      : shape === "square"
        ? { width: 44, height: 44, borderRadius: 8 }
        : { width: 44, height: 66, borderRadius: 6 };
  return (
    <View style={[box, { overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }]}>
      {src ? <Image source={{ uri: src }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} /> : <Icon name={icon} size={16} color={tokens.muted} />}
    </View>
  );
}

export function Row({ onPress, children, disabled }: { onPress?: () => void; children: React.ReactNode; disabled?: boolean }) {
  const { tokens } = useApp();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: ROW_GAP, paddingVertical: ROW_PAD_V, borderRadius: 8, backgroundColor: pressed ? tokens.surface2 : "transparent" })}
    >
      {children}
      {onPress ? <Tail color={tokens.muted} /> : null}
    </Pressable>
  );
}

/** صفُّ العمل — و`note` (سببُ الترشيح في بحث الوصف) يحلّ محلَّ سطرِ السنة والنوع كما في الويب */
export function TitleRow({ r, note, onPress }: { r: SearchTitle; note?: string | null; onPress: () => void }) {
  const { t } = useApp();
  return (
    <Row onPress={onPress}>
      <Thumb src={r.poster} shape="poster" icon={r.mediaType === "tv" ? "tv" : "film"} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="600" numberOfLines={1}>{r.title}</Text>
        {/* الاسمُ الأصليُّ تحته (D-544) — قبل سطرِ السنة والنوع لأنّه اسمٌ لا وصف */}
        {r.titleSecondary ? <Text size={10} muted numberOfLines={1}>{r.titleSecondary}</Text> : null}
        <Text size={12} muted numberOfLines={1}>{note ?? `${r.year ? `${r.year} · ` : ""}${r.mediaType === "tv" ? t.typeSeries : t.typeMovie}`}</Text>
      </View>
    </Row>
  );
}

export function ArtistRow({ a, onPress }: { a: SearchArtist; onPress: () => void }) {
  return (
    <Row onPress={onPress}>
      <Thumb src={a.photo} shape="circle" icon="people" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="600" numberOfLines={1}>{a.name}</Text>
        <Text size={12} muted numberOfLines={1}>{a.role}</Text>
      </View>
    </Row>
  );
}

/**
 * صفُّ العضو — قاعدةُ `PersonName` نفسُها (D-011/D-193): من أخفى اسمه يُرسم «مستخدم» بلا صورةٍ **ولا يُفتح**؛
 * ومن لم يخفِه يفتح ملفَّه (ويبيّاً بعد — صفحةُ العضو لم تُنقل؛ KNOWN_GAP معلَنٌ في `05`).
 */
export function MemberRow({ m, onPress }: { m: PersonLite; onPress: (() => void) | null }) {
  const { t } = useApp();
  const name = displayNameOf(m, t.anonymousUser);
  return (
    <Row onPress={m.hide_name ? undefined : onPress ?? undefined}>
      <Thumb src={m.hide_name ? null : m.avatar_url} shape="circle" icon="people" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="600" numberOfLines={1}>{name}</Text>
        <Text size={12} muted numberOfLines={1}>{t.searchMemberRole}</Text>
      </View>
    </Row>
  );
}

export function ListRow({ l, onPress }: { l: SearchList; onPress: () => void }) {
  const { t } = useApp();
  return (
    <Row onPress={onPress}>
      <Thumb src={l.poster} shape="square" icon="list" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size={14} weight="600" numberOfLines={1}>{l.name}</Text>
        <Text size={12} muted numberOfLines={1}>{t.listCount(l.count)}</Text>
      </View>
    </Row>
  );
}

/** هيكلُ الانتظار — بإيقاع الصفّ نفسِه فلا تقفز الشاشةُ عند الوصول (D-046) */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  const { tokens } = useApp();
  return (
    <View style={{ gap: 12 }} accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: ROW_GAP }}>
          <View style={{ width: 44, height: 66, borderRadius: 6, backgroundColor: tokens.surface2 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ height: 14, width: "40%", borderRadius: 4, backgroundColor: tokens.surface2 }} />
            <View style={{ height: 12, width: "25%", borderRadius: 4, backgroundColor: tokens.surface2 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** فاصلُ الصفوف — `divide-y divide-[color:var(--divider)]` */
export function Divided({ children }: { children: React.ReactNode[] }) {
  const { tokens } = useApp();
  return (
    <View>
      {children.map((c, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: 1, borderTopColor: tokens.divider } : undefined}>
          {c}
        </View>
      ))}
    </View>
  );
}
