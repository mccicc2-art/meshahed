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
import { StarRow } from "./StarRow";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import { posterFor } from "../poster";
import type { TitleCommunityPayload } from "../contracts";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { personaOf } from "@/core/personas";

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
  onOpenReview,
  onLikeReview,
}: {
  data: TitleCommunityPayload | undefined;
  myRating: number | null;
  onEditReview: () => void;
  onOpenTalk: (path: string) => void;
  /** 🆕 11-M · M3 — الرأيُ يُضغط فيفتح خيطَه أصليّاً (`/review/…` في الويب) */
  onOpenReview?: (userId: string) => void;
  /** 🆕 D-1567 — قلبُ الرأي (الكتابةُ والكاشُ بيد الشاشة) */
  onLikeReview?: (r: TitleCommunityPayload["reviews"][number]) => void;
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
      {/* 🆕 D-1601 — **رأيي بطاقةٌ تُضغط كلُّها** (أحمد ٣٠ أكتوبر بلقطة: «مكان كتابة الريفيو يحتاج تطوير ومساحة الضغط صغيرة»،
          ثمّ «كبيرة» ثمّ «اكتب رأيك حجمها كبير» على مسودّتين): كان النصُّ الرماديّ يبدو حقلاً ولا يُضغط، والبابُ الوحيد رقاقةٌ صغيرة.
          الآن نجومي صغيرةً بجانب العنوان (عرضٌ لا اختيار — نجمةٌ بـ١٥ نقطة هدفٌ يُخطئه الإصبع فيحفظ رقماً لم يُقصد)، وتحتها
          **حقلٌ بسطرٍ واحد** بشكل حقل الانبثاق يحمل رأيي سطرين أو الدعوةَ بقلم — **والضغطُ في أيّ مكانٍ يفتح `ReviewSheet` نفسَها**.
          أقصرُ من البطاقة القديمة (لا رقاقةَ تحت النصّ) */}
      <Pressable
        onPress={onEditReview}
        accessibilityRole="button"
        accessibilityLabel={ar ? (data.my_review?.review ? "عدّل رأيي" : "اكتب رأيي") : data.my_review?.review ? "Edit my review" : "Write my review"}
        style={({ pressed }) => ({ padding: 12, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, gap: 10, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text size={12} weight="700" muted style={{ flex: 1 }} numberOfLines={1}>{t.listReviewMine}</Text>
          <View pointerEvents="none">
            <StarRow value={myRating} onChange={() => {}} size={15} />
          </View>
        </View>
        <View style={{ minHeight: 38, flexDirection: "row", alignItems: "flex-start", gap: 7, paddingVertical: 9, paddingHorizontal: 12, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
          {data.my_review?.review ? (
            data.my_review.has_spoiler ? (
              <>
                <View style={{ marginTop: 3 }}><Icon name="eye-off" size={13} color={tokens.muted} /></View>
                <Text size={13} muted numberOfLines={2} style={{ flex: 1, lineHeight: 19 }}>{data.my_review.review}</Text>
              </>
            ) : (
              <Text size={14} content numberOfLines={2} style={{ flex: 1, lineHeight: 20 }}>{data.my_review.review}</Text>
            )
          ) : (
            <>
              <View style={{ marginTop: 3 }}><Icon name="edit" size={13} color={tokens.muted} /></View>
              <Text size={13} muted numberOfLines={1} style={{ flex: 1, lineHeight: 19 }}>{t.reviewPlaceholder}</Text>
            </>
          )}
        </View>
      </Pressable>

      {data.reviews.map((r) => (
        <ReviewRow key={r.user_id} r={r} onOpen={onOpenReview ? () => onOpenReview(r.user_id) : undefined} onLike={onLikeReview ? () => onLikeReview(r) : undefined} />
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

/** D-1036 — مُصدَّرٌ: صفحةُ القائمة الأصليّة ترسم آراءَ الناس بالصفِّ نفسِه (شكلٌ واحدٌ للرأي) */
export function ReviewRow({ r, onOpen, onLike }: { r: TitleCommunityPayload["reviews"][number]; onOpen?: () => void; onLike?: () => void }) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(!r.has_spoiler);
  /* 🆕 D-1563 — مراجعةُ شخصيّةٍ AI هي هذا الصفُّ نفسُه: حلقةٌ بلونها و«AI» بجانب الاسم. 🆕 D-1565 — **ودرجتُها نجمةُ الصفّ كالعضو**
     (لا تدخل متوسّطَ الجمهور)، **ولا وصفَ تحت الاسم** — صفُّ العضو بلا سطرٍ ثانٍ، ووصفُها في ملفّها؛ يبقى نطاقُها إن كان (موسم) */
  const persona = r.persona ? personaOf(r.user_id) : null;
  /* 🆕 D-1567 — **شاراتُ كلِّ حساب** (PLUS · شريك · مؤسّس · موثّق) لا الشخصيّات وحدَها: الخادمُ صار يرسل حالةَ الحساب كما في صفحة
     الردود (أحمد ٢٩ أكتوبر: «الحسابات الثانية ليه ما هو ظاهر عندها بلس؟») — و«AI» من المعرّف كما كانت */
  const flags = identityFlags({ id: r.user_id, plan: r.plan ?? null, founder: r.founder ?? null, verified_at: r.verified_at ?? null });
  const badged = flags.ai || flags.partner || flags.plus || flags.founder || flags.verified;
  const liked = !!r.liked_by_me;
  /* 🆕 11-M · M3 — **الصفُّ بابُ خيطه** حين يمرّر المستدعي `onOpen` (تبويبُ مجتمع العمل)، وقراءةٌ وحدَها في صفحة القائمة */
  return (
    <Pressable disabled={!onOpen} onPress={onOpen} accessibilityRole={onOpen ? "link" : undefined} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: persona ? 2 : 0, borderColor: persona?.color }}>
          {r.avatar_url ? <Image source={{ uri: r.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text size={13} weight="700" style={{ flexShrink: 1 }} numberOfLines={1}>{r.name}</Text>
            {badged ? <IdentityBadges flags={flags} nameSize={13} /> : null}
          </View>
          {persona && r.persona?.scope ? (
            <Text size={11} muted numberOfLines={1}>{r.persona.scope}</Text>
          ) : null}
        </View>
        {r.rating != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name="star-filled" size={12} color={tokens.accent} />
            <Text size={12} weight="700" color={tokens.accent}>{num(r.rating, locale)}</Text>
          </View>
        ) : null}
      </View>
      {r.review ? (
        reveal ? (
          <Text size={14} content style={{ lineHeight: 21 }}>{r.review}</Text>
        ) : (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
            <Icon name="eye-off" size={13} color={tokens.muted} />
            <Text size={13} muted>{t.spoilerMark}</Text>
          </Pressable>
        )
      ) : null}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* 🆕 D-1567 — **القلبُ زرٌّ هنا** حين يمرّر المستدعي `onLike` (تبويبُ مجتمع العمل؛ ومراجعتي عدٌّ لا زرّ) — قلبُ المراجعة
            نفسُه الذي يكتبه خيطُها (`community/like`)، ولونُه لونُ قلب الخيط */}
        {onLike && !r.mine ? (
          <Pressable onPress={onLike} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.likesLabel} accessibilityState={{ selected: liked }} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Icon name={liked ? "heart-filled" : "heart"} size={13} color={liked ? tokens.accent : tokens.muted} />
            {r.likes > 0 ? <Text size={11} color={liked ? tokens.accent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{num(r.likes, locale)}</Text> : null}
          </Pressable>
        ) : r.likes > 0 ? (
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
    </Pressable>
  );
}

/**
 * انبثاقُ التقييم — النجومُ ١–١٠ والتعليقُ و«فيها حرق»؛ الحفظُ عبر `track/rate` (بيد المستدعي).
 *
 * 🆕 D-1033 — **انبثاقٌ وسطيٌّ بتصميمٍ اختاره أحمد** (ثلاثُ مسودّاتٍ ثمّ «ممتاز نفّذ»): رأسٌ بملصق العمل
 * واسمِه وسطرِ حال، ثمّ **الدرجةُ رقماً كبيراً بلون التمييز** فوق عشر نجومٍ تملأ العرض، ثمّ حقلُ التعليق
 * **ظاهراً لا مطويّاً** (طلبُه)، ثمّ «فيها حرق»، ثمّ زرّان. **مكوّنٌ واحدٌ لكلِّ تقييم** — العملُ من «شاهدته»
 * ومن آخر حلقة ومن نجمة الترويسة ومن تبويب المجتمع، **والحلقةُ** من نجمتها: شكلان للسؤال نفسِه عيب.
 *
 * 🔑 **حالتان لا مكوّنان**: `prompt` (سؤالٌ صعد بعد «شاهدته»: سطرُ الحال أخضرُ «أُشّر كمُشاهَد»، والزرُّ
 * الثانويّ «لاحقاً») وغيرُها (فتحه صاحبُه: «إلغاء»، و«حذف تقييمي» إن كان له تقييمٌ ومرّر المنادي `onRemove`).
 * ⚖️ «فيها حرق» **رقاقةٌ لا مفتاحُ تبديل** كما في المسودّة: عائلتا التحكّم اثنتان (segmented · chip)
 * ومفتاحٌ ثالثٌ عيبٌ يُبلَّغ. **ولا نصَّ جديداً في القاموس** — كلُّ كلمةٍ هنا مفتاحٌ قائم.
 */
export function ReviewSheet({
  initial,
  busy,
  onClose,
  onSave,
  title,
  head,
  prompt = false,
  onRemove,
}: {
  initial: { rating: number | null; review: string | null; has_spoiler: boolean };
  /** D-1015 — اسمُ السؤال: «قيّم هذا العمل» افتراضاً، أو «قيّم الموسم س الحلقة ص» */
  title?: string;
  /** رأسُ الانبثاق: العملُ الذي يُقيَّم — بلا رأسٍ يبقى العنوانُ النصّيّ */
  /** `posterPath` غائبٌ (لا `null`) = ما يُقيَّم لا ملصقَ له أصلاً (قائمة — D-1052): الاسمُ وحدَه بلا صندوقٍ فارغ */
  head?: { name: string; posterPath?: string | null };
  /** صعد وحدَه بعد «شاهدته»/آخر حلقة — لا فتحه صاحبُه */
  prompt?: boolean;
  /** «حذف تقييمي» — يُرسم فقط لمن له تقييمٌ محفوظ */
  onRemove?: () => void;
  busy: boolean;
  onClose: () => void;
  onSave: (v: { rating: number; review: string | null; has_spoiler: boolean }) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [rating, setRating] = useState(initial.rating ?? 0);
  const [body, setBody] = useState(initial.review ?? "");
  const [spoiler, setSpoiler] = useState(initial.has_spoiler);
  const had = initial.rating != null;
  const ask = title ?? t.rateTitle;
  const poster = head?.posterPath ? posterFor(head.posterPath, 40) : null;
  return (
    <Sheet
      title={ask}
      onClose={onClose}
      placement="center"
      header={
        head ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {head.posterPath === undefined ? null : (
              <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
                {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text size={17} weight="700" numberOfLines={1}>{head.name}</Text>
              {prompt ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="check-line" size={13} color={tokens.success} />
                  <Text size={12} color={tokens.success}>{t.watchedMarked}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : undefined
      }
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Text size={13} muted numberOfLines={1} style={{ flex: 1 }}>{had ? t.listReviewMine : ask}</Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 3 }}>
            <Text size={30} weight="700" color={rating ? tokens.accent : tokens.border} style={{ fontVariant: ["tabular-nums"], lineHeight: 36 }}>{rating ? num(rating, locale) : "–"}</Text>
            <Text size={13} muted style={{ fontVariant: ["tabular-nums"] }}>/{num(10, locale)}</Text>
          </View>
        </View>
        <StarRow spread size={22} value={rating || null} onChange={(n) => setRating(n ?? 0)} />
        <TextInput maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={3}
          maxLength={2000}
          placeholder={t.reviewPlaceholder}
          placeholderTextColor={tokens.muted}
          textAlignVertical="top"
          /* ثلاثةُ أسطرٍ لا ستّة: الصندوقُ في الوسط ولوحةُ المفاتيح تأخذ نصفَ الشاشة — وما زاد يُمرَّر داخل الحقل */
          style={{ minHeight: 3 * 22 + 24, maxHeight: 5 * 22 + 24, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, padding: 12, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left" }}
        />
        <View style={{ flexDirection: "row" }}>
          <Chip label={t.spoilerMark} active={spoiler} onPress={() => setSpoiler((v) => !v)} leading={<Icon name={spoiler ? "eye-off" : "eye"} size={14} color={spoiler ? tokens.onAccent : tokens.muted} />} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
          <Button label={prompt ? t.tourLater : t.cancelLabel} variant="ghost" onPress={onClose} />
          <Button label={t.doneLabel} busy={busy} disabled={!rating} style={{ flex: 1 }} onPress={() => onSave({ rating, review: body.trim() || null, has_spoiler: spoiler })} />
        </View>
        {had && onRemove && !prompt ? (
          <Pressable onPress={onRemove} hitSlop={8} disabled={busy} style={{ alignSelf: "center", paddingVertical: 4 }}>
            <Text size={13} color={tokens.error}>{t.deleteRating}</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}
