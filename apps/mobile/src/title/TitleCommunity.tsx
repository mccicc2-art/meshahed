import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { Chip } from "../library/Chip";
import { Sheet } from "../library/Sheet";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import type { TitleCommunityPayload } from "../contracts";

/**
 * ====== تبويبُ المجتمع — نسخةُ `TitleCommunityTab` للقراءة (Phase 11-D · D3 · D-956) ======
 *
 * رأيي (بطاقةٌ بتقييمي ونصّي وزرِّ «عدّل») · الآراءُ (وجهٌ · اسمٌ · ★ · النصُّ خلف
 * «فيها حرق» حتى يُضغط · ♥ والردود عدّاً) · نشراتُ لوبز وأخبارُه سطراً وتاريخاً ·
 * **«النقاش ↗»** بابٌ إلى `/talk/{kind}/{id}` حيث الردودُ والنشرُ (يبقى ويبيّاً بقرار
 * D3: نقاشٌ متشعّبٌ بعمقِ ٣ لا يُنسخ). **الكتابةُ الوحيدةُ هنا رأيي** — عبر
 * `track/rate` بحقل `review` (ورقةُ `ReviewSheet`)، بالحدود نفسِها.
 */
export const communityKey = (kind: "tv" | "movie", id: number) => ["title:community", kind, id] as const;

export function useCommunity(kind: "tv" | "movie", id: number, enabled: boolean) {
  return useQuery({
    queryKey: communityKey(kind, id),
    queryFn: async () => (await api<TitleCommunityPayload>(`/api/v1/title/${kind}/${id}/community`)).data,
    staleTime: 60_000,
    enabled,
  });
}

export function CommunityTab({
  data,
  myRating,
  onEditReview,
  onOpenTalk,
}: {
  data: TitleCommunityPayload | undefined;
  myRating: number | null;
  onEditReview: () => void;
  onOpenTalk: (path: string) => void;
}) {
  const { t, tokens, locale } = useApp();
  const ar = locale !== "en";
  if (!data) {
    return (
      <View style={{ gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ height: 72, borderRadius: radius.card, backgroundColor: tokens.surface2 }} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: 16 }}>
      {/* رأيي — أو دعوةٌ لكتابته إن كان عندي تقييمٌ بلا نصّ */}
      <View style={{ padding: 12, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text size={12} weight="700" muted style={{ flex: 1 }}>{t.listReviewMine}</Text>
          {myRating !== null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Icon name="star-filled" size={13} color={tokens.accent} />
              <Text size={13} weight="700" color={tokens.accent}>{num(myRating, locale)}</Text>
            </View>
          ) : null}
        </View>
        {data.my_review?.review ? <Text size={14} style={{ lineHeight: 21 }}>{data.my_review.review}</Text> : <Text size={13} muted>{t.reviewPlaceholder}</Text>}
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          <Chip label={ar ? (data.my_review?.review ? "عدّل رأيي" : "اكتب رأيي") : data.my_review?.review ? "Edit my review" : "Write my review"} active={false} onPress={onEditReview} />
        </View>
      </View>

      {data.reviews.map((r) => (
        <ReviewRow key={r.user_id} r={r} />
      ))}

      {data.bulletins.length ? (
        <View style={{ gap: 8 }}>
          {data.bulletins.slice(0, 8).map((b, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <Icon name="sparkle-star" size={13} color={tokens.accent} />
              <View style={{ flex: 1 }}>
                <Text size={13} style={{ lineHeight: 19 }}>{b.line}</Text>
                <Text size={11} muted>{b.at.slice(0, 10)}{b.replies ? ` · ${num(b.replies, locale)}` : ""}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {data.reviews.length === 0 && data.bulletins.length === 0 ? (
        <Text size={13} muted style={{ textAlign: "center", paddingVertical: 12 }}>{ar ? "لا آراءَ بعد — كن أوّلَ من يكتب." : "No reviews yet — be the first."}</Text>
      ) : null}

      <Button label={`${t.tabCommunity} ↗`} variant="ghost" onPress={() => onOpenTalk(data.talk_path)} />
    </View>
  );
}

function ReviewRow({ r }: { r: TitleCommunityPayload["reviews"][number] }) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(!r.has_spoiler);
  return (
    <View style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          {r.avatar_url ? <Image source={{ uri: r.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
        </View>
        <Text size={13} weight="700" style={{ flex: 1 }} numberOfLines={1}>{r.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Icon name="star-filled" size={12} color={tokens.accent} />
          <Text size={12} weight="700" color={tokens.accent}>{num(r.rating, locale)}</Text>
        </View>
      </View>
      {r.review ? (
        reveal ? (
          <Text size={14} style={{ lineHeight: 21 }}>{r.review}</Text>
        ) : (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
            <Icon name="eye-off" size={13} color={tokens.muted} />
            <Text size={13} muted>{t.spoilerMark}</Text>
          </Pressable>
        )
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {r.likes > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="heart" size={12} color={tokens.muted} />
            <Text size={11} muted>{num(r.likes, locale)}</Text>
          </View>
        ) : null}
        {r.replies > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="comment" size={12} color={tokens.muted} />
            <Text size={11} muted>{num(r.replies, locale)}</Text>
          </View>
        ) : null}
        <Text size={11} muted>{r.updated_at.slice(0, 10)}</Text>
      </View>
    </View>
  );
}

/** ورقةُ رأيي — التقييمُ ١–١٠ والنصُّ و«فيها حرق»؛ الحفظُ عبر `track/rate` (بيد المستدعي) */
export function ReviewSheet({
  initial,
  busy,
  onClose,
  onSave,
}: {
  initial: { rating: number | null; review: string | null; has_spoiler: boolean };
  busy: boolean;
  onClose: () => void;
  onSave: (v: { rating: number; review: string | null; has_spoiler: boolean }) => void;
}) {
  const { t, tokens } = useApp();
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [body, setBody] = useState(initial.review ?? "");
  const [spoiler, setSpoiler] = useState(initial.has_spoiler);
  return (
    <Sheet title={t.rateTitle} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Chip key={n} label={String(n)} active={rating === n} onPress={() => setRating(n)} />
          ))}
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={6}
          maxLength={2000}
          placeholder={t.reviewPlaceholder}
          placeholderTextColor={tokens.muted}
          textAlignVertical="top"
          style={{ minHeight: 6 * 22 + 24, borderRadius: radius.control, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, padding: 12, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left" }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Chip label={t.spoilerMark} active={spoiler} onPress={() => setSpoiler((v) => !v)} leading={<Icon name={spoiler ? "eye-off" : "eye"} size={14} color={spoiler ? tokens.onAccent : tokens.muted} />} />
          <View style={{ flex: 1 }} />
          <Button label={t.doneLabel} busy={busy} disabled={!rating} onPress={() => onSave({ rating, review: body.trim() || null, has_spoiler: spoiler })} />
        </View>
      </View>
    </Sheet>
  );
}
