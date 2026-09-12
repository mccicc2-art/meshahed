import React from "react";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { Icon } from "../icons";
import { posterUrl } from "@/core/media";
import { num } from "@/core/i18n";

/**
 * ====== بطاقةُ القائمة — نسخةُ `ListCardShell` (الويب، D-677) بالبكسل ======
 * (D-947 — تبويبُ «قوائم» أصليّاً)
 *
 * 🔑 **تشريحُ البطاقة كما رسمه أحمد** (D-677): الملصقاتُ الثلاثة (أو الغلافُ
 * المختار) **أرضيّةُ البطاقة كلِّها من جهة النهاية**، حجابٌ بلون السطح من جهة
 * البداية يذوب إلى الصفر عند ٦٠٪ (D-686 — «خلّه ذكيّ حول الكلام»)، الاسمُ
 * عريضاً بسطرين، وجهُ الصاحب واسمُه، سطرُ العدّ، **وشريطُ الحال في القاع**:
 * ♥ الحفظ · 💬 الآراء · ★ التقييم — **والصفرُ يُطبع** (نقضٌ محصورٌ لـD-219
 * بتصميمه) — **ورقاقةُ التشغيل في طرفه** (D-674).
 *
 * 📐 المقاسات بأسماء الويب: `rounded-2xl` ١٤ (`--radius-card`) · `min-h-[10.5rem]` ١٦٨ · حشوة
 * `p-3.5` ١٤ · الاسم `text-15 font-bold` · السطور `text-12` · الملصقاتُ `w-[72%]`
 * · الرقاقة `h-7 ps-3 pe-1.5 text-12 font-bold` · هالةُ العنقود `rounded-full
 * bg-surface/70 px-2 py-1`.
 *
 * 🔑 **والحجابُ صورةٌ ألفا تُلوَّن بلون السطح** (`tintColor`) — **فيصحّ في
 * `daylight` من الرمز لا من رقمٍ أصمّ**، ويُقلب في RTL لأنّ اتّجاهَه اتّجاهُ
 * القراءة (القاعدة ١٧). لا حزمةَ تدرّجٍ جديدة (وصفةُ `poster-veil` نفسُها).
 */
const VEIL = require("../../assets/list-veil.png");
const MIN_H = 168;
const PAD = 14;

export type ListCardData = {
  id: string;
  name: string;
  icon?: "bookmark" | "sparkle-star";
  owner: string | null;
  owner_avatar: string | null;
  countText: string;
  posters: string[];
  cover: string | null;
  /** شريطُ الحال — يغيب كلُّه لبطاقة «للمشاهدة» (لا حفظَ لها ولا رأيَ ولا تقييم) */
  stats: { saves: number; reviews: number; rating: number | null } | null;
  /** `null` = لا مفتاحَ (لا نعرف الراية أو القائمةُ فارغة — D-217) */
  playlist: boolean | null;
  /** القلبُ فعلٌ (قائمةُ غيري) — وإلّا رقمٌ ساكن */
  canSave?: boolean;
  savedByMe?: boolean;
  dashed?: boolean;
};

export function ListCard({
  card,
  onPress,
  onPlaylist,
  onShare,
  onSave,
  busy,
}: {
  card: ListCardData;
  onPress: () => void;
  onPlaylist?: (on: boolean) => void;
  onShare?: () => void;
  onSave?: (save: boolean) => void;
  busy?: boolean;
}) {
  const { t, tokens, locale } = useApp();
  const posters = card.posters.map((p) => posterUrl(p, "w185")).filter(Boolean) as string[];
  const play =
    card.playlist === null ? null : (
      <Pressable
        onPress={() => onPlaylist?.(!card.playlist)}
        disabled={busy || !onPlaylist}
        hitSlop={6}
        accessibilityRole="switch"
        accessibilityState={{ checked: !!card.playlist }}
        accessibilityLabel={t.listPlaylist}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          height: 28,
          paddingStart: 12,
          paddingEnd: 6,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: card.playlist ? tokens.accent + "99" : tokens.border,
          backgroundColor: tokens.surface2,
        }}
      >
        <Text size={12} weight="700" color={card.playlist ? tokens.accent : tokens.muted}>
          {card.playlist ? t.toWatchOn : t.toWatchOff}
        </Text>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: card.playlist ? tokens.accent : tokens.divider }} />
      </Pressable>
    );

  const stats = card.stats;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={card.name}
      style={({ pressed }) => ({
        minHeight: MIN_H,
        borderRadius: radius.card,
        borderWidth: 1,
        borderStyle: card.dashed ? "dashed" : "solid",
        borderColor: tokens.border,
        backgroundColor: tokens.surface,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* الأرضيّة: الغلافُ كاملاً، وإلّا الملصقاتُ الثلاثة من جهة النهاية (`w-[72%]`) */}
      {card.cover ? (
        <Image source={{ uri: card.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : posters.length > 0 ? (
        <View style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: "72%", flexDirection: "row", justifyContent: "flex-end" }}>
          {posters.slice(0, 3).map((uri, i) => (
            <Image key={i} source={{ uri }} style={{ flex: 1, height: "100%" }} contentFit="cover" transition={150} />
          ))}
        </View>
      ) : null}
      {/* الحجابُ بلون السطح، من جهة البداية — يُقلب في RTL */}
      <Image
        source={VEIL}
        tintColor={tokens.surface}
        contentFit="fill"
        style={[StyleSheet.absoluteFill, { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }]}
      />

      <View style={{ flex: 1, minHeight: MIN_H, padding: PAD }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {card.icon ? (
            <View style={{ marginTop: 2 }}>
              <Icon name={card.icon} size={15} color={tokens.accent} />
            </View>
          ) : null}
          <Text size={15} weight="700" numberOfLines={2} style={{ flex: 1, maxWidth: "58%", lineHeight: 20 }}>
            {card.name}
          </Text>
          {onShare ? (
            <Pressable
              onPress={onShare}
              hitSlop={8}
              accessibilityLabel={t.listShare}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: -6, marginEnd: -6 }}
            >
              <Icon name="share" size={16} color={tokens.muted} />
            </Pressable>
          ) : null}
        </View>
        {card.owner ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, maxWidth: "58%" }}>
            {card.owner_avatar ? (
              <Image source={{ uri: card.owner_avatar }} style={{ width: 14, height: 14, borderRadius: 7 }} contentFit="cover" />
            ) : (
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                <Text size={8} weight="700" muted>{card.owner.slice(0, 1)}</Text>
              </View>
            )}
            <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{card.owner}</Text>
          </View>
        ) : null}
        <Text size={12} muted numberOfLines={1} style={{ marginTop: 4, maxWidth: "58%" }}>
          {card.countText}
        </Text>

        {stats || play ? (
          <View style={{ marginTop: "auto", paddingTop: 12, flexDirection: "row", alignItems: "center" }}>
            {stats ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: radius.pill,
                  backgroundColor: tokens.surface + "B3",
                  marginStart: -6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                {/* ♥ — فعلٌ لقائمة غيري، رقمٌ ساكنٌ لقائمتي */}
                <Pressable
                  disabled={!card.canSave || busy || !onSave}
                  onPress={() => onSave?.(!card.savedByMe)}
                  hitSlop={6}
                  accessibilityLabel={card.savedByMe ? t.listUnsaveLabel : t.listSaveBtn}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Icon name={card.canSave && !card.savedByMe ? "heart" : "heart-filled"} size={15} color={tokens.accent} />
                  <Text size={12} muted style={styles.nums}>{num(stats.saves, locale)}</Text>
                </Pressable>
                <Sep />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="comment" size={15} color={tokens.accent} />
                  <Text size={12} muted style={styles.nums}>{num(stats.reviews, locale)}</Text>
                </View>
                <Sep />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="star" size={15} color={tokens.accent} />
                  <Text size={12} weight="700" color={tokens.accent} style={styles.nums}>{num(stats.rating ?? 0, locale)}</Text>
                </View>
              </View>
            ) : null}
            {play ? <View style={{ marginStart: "auto", paddingStart: 8 }}>{play}</View> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function Sep() {
  const { tokens } = useApp();
  return <View style={{ width: 1, height: 16, backgroundColor: tokens.divider, marginHorizontal: 10 }} />;
}

const styles = StyleSheet.create({
  nums: { fontVariant: ["tabular-nums"] },
});
