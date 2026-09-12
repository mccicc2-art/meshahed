import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "./Sheet";
import { Chip } from "./Chip";
import { write, ApiError } from "../api";
import { num } from "@/core/i18n";
import type { ListReviewBody, ListReviewDeleteBody } from "../contracts";

/**
 * ====== رأيي في قائمةٍ — نسخةُ `ListRateStar` + `ListReviewForm` (الويب) ======
 * (D-948 — البندُ الأوّل من الثلاثة: «تقييم القائمة»)
 *
 * الورقةُ نفسُها (`Sheet`) بعنوان القائمة، ثمّ: سطرُ «رأيي» `text-12
 * font-semibold text-muted` · **عشرُ نجومٍ** (`StarRatingRow`: كلٌّ `w-7 h-8`،
 * نجمةٌ ٢٠، ممتلئةٌ بلون التمييز حتى المختارة، وإلّا `--disabled`) والرقمُ في
 * الطرف `text-14 font-bold text-accent` · حقلُ الرأي (`rows=7`، `rounded-control
 * bg-surface-2 border p-3 text-15`، ٢٠٠٠ حرفاً) · رقاقةُ «يحرق» بعينٍ
 * مفتوحة/مغلقة · «حفظ» أساسيٌّ معطَّلٌ بلا نجمة أو بلا تغيير · «حذف» شبحيٌّ
 * لمن له رأيٌ قائم.
 *
 * 🔑 **الكتابةُ `saveListReview`/`deleteListReview` نفسُهما** عبر
 * `/api/v1/lists/review*` — الحدُّ (٢٠/دقيقة) والتعقيمُ (١–١٠ · ٢٠٠٠ حرفاً)
 * في الفعل. **والتفاؤلُ بيد المستدعي** (`onSaved` يعدّل الكاش).
 */
export type MyReview = { rating: number; body: string | null; has_spoiler: boolean };

export function ListReviewSheet({
  listId,
  listName,
  mine,
  onClose,
  onSaved,
  onError,
}: {
  listId: string;
  listName: string;
  mine: MyReview | null;
  onClose: () => void;
  onSaved: (next: MyReview | null) => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [spoiler, setSpoiler] = useState(mine?.has_spoiler ?? false);
  const [dirty, setDirty] = useState(!mine);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    try {
      await write<{ done: true }>("/api/v1/lists/review", { listId, rating, body: body.trim() || null, hasSpoiler: spoiler } satisfies ListReviewBody);
      onSaved({ rating, body: body.trim() || null, has_spoiler: spoiler });
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await write<{ done: true }>("/api/v1/lists/review-delete", { listId } satisfies ListReviewDeleteBody);
      onSaved(null);
    } catch (e) {
      onError(e instanceof ApiError ? e : new Error("apiInternal"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={listName} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Text size={12} weight="600" muted>{t.listReviewMine}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }} accessibilityRole="radiogroup" accessibilityLabel={t.listReviewMine}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ selected: rating === n }}
              accessibilityLabel={String(n)}
              onPress={() => {
                setRating(n);
                setDirty(true);
              }}
              style={{ width: 28, height: 32, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name={n <= rating ? "star-filled" : "star"} size={20} color={n <= rating ? tokens.accent : tokens.disabled} />
            </Pressable>
          ))}
          {rating > 0 ? (
            <Text size={14} weight="700" color={tokens.accent} style={{ marginStart: "auto", fontVariant: ["tabular-nums"] }}>
              {num(rating, locale)}
            </Text>
          ) : null}
        </View>

        <TextInput
          value={body}
          onChangeText={(v) => {
            setBody(v);
            setDirty(true);
          }}
          multiline
          numberOfLines={7}
          maxLength={2000}
          placeholder={t.reviewPlaceholder}
          placeholderTextColor={tokens.muted}
          textAlignVertical="top"
          style={{
            minHeight: 7 * 22 + 24,
            borderRadius: radius.control,
            backgroundColor: tokens.surface2,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: 12,
            fontSize: 15,
            lineHeight: 22,
            color: tokens.fg,
            textAlign: "left",
          }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <Chip
            label={t.spoilerMark}
            active={spoiler}
            onPress={() => {
              setSpoiler((v) => !v);
              setDirty(true);
            }}
            leading={<Icon name={spoiler ? "eye-off" : "eye"} size={14} color={spoiler ? tokens.onAccent : tokens.muted} />}
          />
          <View style={{ marginStart: "auto", flexDirection: "row", gap: 8 }}>
            <Button label={t.listReviewSave} busy={busy} disabled={!rating || !dirty} onPress={() => void submit()} />
            {mine ? <Button label={t.listReviewDelete} variant="ghost" disabled={busy} onPress={() => void remove()} /> : null}
          </View>
        </View>
      </View>
    </Sheet>
  );
}
