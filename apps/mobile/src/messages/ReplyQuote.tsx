import React from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { gifUrl } from "@/core/media";
import type { MsgEvent, MsgReplyRef } from "../contracts";

/**
 * ====== الاقتباسُ — فوق الردّ في الفقاعة، وفوق خانة الكتابة قبل الإرسال (D-1403) ======
 *
 * 🔑 **رسمٌ واحدٌ للموضعين** (لا نسختين): خطٌّ بلون صاحب الأصل، اسمُه («أنت» أو اسمُ الطرف الآخر)، وأوّلُ سطرٍ أو
 * «📷 صورة»/«GIF»، ومصغّرتُها في الطرف — كالواتس. على فقاعتي الصفراء يُرسم بلون الكتابة عليها (`onAccent`) لا
 * بالأصفر فوق الأصفر.
 */
export function ReplyQuote({
  r,
  onAccent,
  peerName,
  onPress,
  onClear,
}: {
  r: MsgReplyRef;
  /** فوق فقاعتي الصفراء */
  onAccent?: boolean;
  peerName: string;
  onPress?: () => void;
  /** ✕ — خانةُ الكتابة وحدها */
  onClear?: () => void;
}) {
  const { t, tokens } = useApp();
  const ink = onAccent ? tokens.onAccent : tokens.fg;
  const bar = r.kind === "gone" ? tokens.muted : onAccent ? tokens.onAccent : r.mine ? tokens.accent : tokens.muted;
  const who = r.kind === "gone" ? "" : r.mine ? t.convYou : peerName;
  const line =
    r.kind === "gone"
      ? t.msgReplyGone
      : r.kind === "gif"
        ? t.msgGifPreview
        : r.kind === "image"
          ? r.body
            ? `${t.msgImagePreview} · ${r.body}`
            : t.msgImagePreview
          : r.body;
  const thumb = r.kind === "image" ? r.image ?? null : null;
  const gif = r.kind === "gif" && r.gif_id ? gifUrl(r.gif_id, "small") : null;
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={who ? `${who}: ${line}` : line}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "stretch",
        borderRadius: 12,
        overflow: "hidden",
        minHeight: 44,
        backgroundColor: onAccent ? "rgba(0,0,0,0.12)" : tokens.surface,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 4, backgroundColor: bar }} />
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center", paddingVertical: 6, paddingHorizontal: 8, gap: 1 }}>
        {who ? (
          <Text size={12} weight="700" color={onAccent ? tokens.onAccent : r.mine ? tokens.accent : tokens.fg} numberOfLines={1}>
            {who}
          </Text>
        ) : null}
        <Text size={12} content color={ink} numberOfLines={2} style={{ opacity: 0.8, lineHeight: 17 }}>
          {line}
        </Text>
      </View>
      {thumb ? (
        <Image source={{ uri: thumb.url, cacheKey: thumb.key }} style={{ width: 48, alignSelf: "stretch", minHeight: 44 }} contentFit="cover" cachePolicy="memory-disk" />
      ) : gif ? (
        <Image source={{ uri: gif }} style={{ width: 48, alignSelf: "stretch", minHeight: 44 }} contentFit="cover" cachePolicy="memory-disk" />
      ) : null}
      {onClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t.msgReplyCancel}
          style={{ width: 36, alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="close" size={13} color={tokens.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** مختصرُ رسالةٍ أقتبسها الآن (قبل أن يعيدها الخادم): من الفقاعة نفسِها — الشكلُ الذي سيعود به */
export function replyRefOf(e: MsgEvent): MsgReplyRef | null {
  if (e.kind !== "reply") return null;
  const body = e.body.replace(/\s+/g, " ").trim().slice(0, 140);
  if (e.gif_id) return { id: e.id, mine: e.mine, kind: "gif", body: "", gif_id: e.gif_id };
  if (e.image) return { id: e.id, mine: e.mine, kind: "image", body, image: e.image };
  return { id: e.id, mine: e.mine, kind: "text", body };
}

/**
 * 🆕 R57 — **العملُ المختارُ فوق الخانة قبل إرساله** (أحمد ٢١ أكتوبر بتسجيل: «ابغى اقدر اضيف رسالة مع العمل .. الان ينرسل مباشرة»؛
 * «١ أ»: الخاصّ والقروبات وغرف النقاش). إطارُ المقتبَس نفسُه (شريطٌ ملوّنٌ وصورةٌ في الطرف و✕) — عائلةٌ واحدة لا مكوّنٌ ثانٍ للفكرة نفسِها:
 * «هذا سيُرسَل مع كلامك».
 */
export function TitleQuote({ title, kind, poster, onClear }: { title: string; kind: "tv" | "movie"; poster: string | null; onClear: () => void }) {
  const { t, tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", alignItems: "stretch", borderRadius: 12, overflow: "hidden", minHeight: 52, backgroundColor: tokens.surface }}>
      <View style={{ width: 4, backgroundColor: tokens.accent }} />
      {poster ? <Image source={{ uri: poster }} style={{ width: 34, height: 51, borderRadius: 5, margin: 6, marginEnd: 0 }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      <View style={{ flex: 1, minWidth: 0, justifyContent: "center", paddingVertical: 6, paddingHorizontal: 8, gap: 1 }}>
        <Text size={13} weight="700" numberOfLines={1}>{title}</Text>
        <Text size={12} muted numberOfLines={1}>{kind === "tv" ? t.typeSeries : t.typeMovie}</Text>
      </View>
      <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.msgReplyCancel} style={{ width: 36, alignItems: "center", justifyContent: "center" }}>
        <Icon name="close" size={13} color={tokens.muted} />
      </Pressable>
    </View>
  );
}
