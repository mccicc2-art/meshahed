import React, { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { GifImage } from "./GifPicker";
import { num } from "@/core/i18n";
import { timeAgoShort } from "@/core/when";
import { displayNameOf } from "@/core/people";
import type { ThreadRow } from "../contracts";
import { richNodes } from "../richText";
import { posterFor } from "../poster";

/**
 * 🆕 D-1443 — متنُ الردّ بخطّ الرسائل (١٦/٢٣ بوزن ٥٠٠ ويتبع الأكبرَ من خطّ الواجهة وخطّ المحتوى، D-1434)، وروابطُه ومنشنُه تُلمس
 * (`richText.tsx` نفسُه) — أحمد ١٦ أكتوبر: «كل المزايا اللي عملناها في الرسائل الخاصة اعملها في المناقشات».
 */
/* 🆕 R54 — ١٤ كنصِّ «النشاط» (أحمد ٢١ أكتوبر: «وحده ١٤») — كان ١٦ فبدت المشاركةُ في الغرفة أكبرَ منها في الخلاصة */
const BODY_SIZE = 14;
const BODY_LINE = 21;

/**
 * ====== سطرٌ في الخيط — نسخةُ `ReplyItem.tsx` (الويب) · Phase 11-M · M3 ======
 *
 * 🔑 **الخياراتُ خياراتُ الويب والمقاساتُ للتطبيق**: وجهٌ ٣٤ واسمٌ وشاراتٌ وعمرٌ مختصر و⋯ (لصاحب الجلسة: «احذف ردّي»
 * لسطري و«إبلاغ» لغيره) · «يردّ على فلان» حين يكون الأبُ غيرَ الجذر · **النشرةُ** سطرُها وتقييمُها ومحجوبُها · **«فيها حرق»**
 * يحجب النصَّ والصورةَ والـGIF معاً حتى يُضغط (D-268) · **«النص الأصلي» ⇄ «الترجمة»** (D-307) · الصورةُ تُفتح كاملةً ·
 * الذيلُ: ▲ الرقم ▼ (الغرفة، D-305) · ♥ «إعجاب» (الغرفة) · «ردّ» بعدد ما تحته · وزرُّ طيِّ الأبناء.
 * **والسطرُ المتفائلُ باهتٌ بلا ذيلٍ ولا ⋯** حتى يعود معرّفُه (`TEMP`، D-241).
 */
export const TEMP = "temp:";

export type ReplyItemProps = {
  row: ThreadRow;
  /** 🆕 D-1495 — «حرق الأحداث» مفعّلٌ في رأس الغرفة: الحرقُ مكشوفٌ بلا ضغطة */
  revealAll?: boolean;
  /** 🆕 D-1508 — غرفةُ حلقةٍ لم يشاهدها القارئ: السطرُ مغطًّى ولو لم يعلن كاتبُه حرقاً، وغطاؤه يقول السبب */
  unwatched?: boolean;
  signedIn: boolean;
  replyingTo: string | null;
  canReply: boolean;
  replyCount: number;
  /** زرُّ «عرض N ردود / إخفاء الردود» — `null` بلا أبناء */
  fold: { open: boolean; count: number; onToggle: () => void } | null;
  showLikes: boolean;
  showVotes: boolean;
  onLike: (row: ThreadRow) => void;
  onVote: (row: ThreadRow, v: -1 | 0 | 1) => void;
  onReply: (row: ThreadRow) => void;
  onMenu: (row: ThreadRow) => void;
  onImage: (uri: string) => void;
  onProfile: (row: ThreadRow) => void;
  /** 🆕 D-1443 — من كتبوا هنا (صغيرة): `@اسم` منهم يُرسم مميّزاً ولمستُه تفتح ملفَّه */
  mentions?: ReadonlySet<string>;
  onMention?: (username: string) => void;
  /** رابطُ لوبز في متن: المسارُ يُفتح بالشاشة الأصليّة */
  onPath?: (path: string) => void;
  /** بطاقةُ العمل من «بحث لوبز» */
  onTitle?: (kind: "tv" | "movie", id: number) => void;
  /** 🆕 R55 — لمسةُ السطر تفتح صفحتَه (الغرفةُ جذورٌ وحدَها، والردودُ في صفحة كلِّ سطر) */
  onOpen?: (row: ThreadRow) => void;
  /** 🆕 R55 — خطُّ الوصل بين الوجهين (ردُّ صاحب الصفحة تحت ردٍّ عليه، كتويتر): `down` يمدّه إلى ما تحته، `up` يستقبله من فوقه */
  link?: "up" | "down" | null;
};

export const ReplyItem = memo(function ReplyItem({
  row,
  signedIn,
  replyingTo,
  canReply,
  replyCount,
  fold,
  showLikes,
  showVotes,
  onLike,
  onVote,
  onReply,
  onMenu,
  onImage,
  onProfile,
  mentions,
  onMention,
  onPath,
  onTitle,
  revealAll = false,
  unwatched = false,
  onOpen,
  link = null,
}: ReplyItemProps) {
  const { t, tokens, locale } = useApp();
  const [revealOne, setReveal] = useState(false);
  /* 🆕 D-1495 — مفتاحُ «حرق الأحداث» في رأس الغرفة يكشف الحرقَ كلَّه؛ والكشفُ بالضغطة على سطرٍ واحدٍ باقٍ كما كان */
  const reveal = revealOne || revealAll;
  const [original, setOriginal] = useState(false);
  const pending = row.id.startsWith(TEMP);
  const p = row.person;
  const name = displayNameOf(p, t.anonymousUser);
  const text = row.translated && !original ? row.translated : row.body;
  const hidden = (row.has_spoiler || unwatched) && !reveal;
  const canAct = signedIn && !row.mine && !pending;
  /* 🆕 R54 — القلبُ على مشاركتك مسموح (مثل تويتر)؛ التصويتُ وحدَه يبقى لغيرك */
  const canLike = signedIn && !pending;
  const pad = { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingVertical: 6, paddingHorizontal: 8, minHeight: 32 };
  /* 🆕 R56 — مراجعةُ صفحة العمل في «عام»: بلا أصواتٍ ولا ⋯ (حذفُها وبلاغُها في صفحتها)، وعددُ «💬» ردودُ صفحتها */
  const review = row.review ?? null;
  const votesOn = showVotes && !review;
  const replies = review ? review.replies : replyCount;
  const hasTail = !pending && ((signedIn && canReply) || replies > 0 || fold || (showLikes && (canLike || row.likes > 0)) || (votesOn && (canAct || row.mine || row.score !== 0)));

  const media = (
    <>
      {row.image ? (
        <Pressable onPress={() => onImage(row.image!)} accessibilityLabel={t.talkOpenImage} style={{ marginTop: 8, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
          <Image source={{ uri: row.image }} style={{ width: "100%", aspectRatio: 4 / 3, maxHeight: 420 }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={t.talkImageAlt} />
        </Pressable>
      ) : null}
      {row.gif_id ? (
        <View style={{ marginTop: 8, width: 220, aspectRatio: 1, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
          <GifImage id={row.gif_id} />
        </View>
      ) : null}
      {/* 🆕 D-1443 — بطاقةُ العمل من «بحث لوبز»: ملصقٌ واسمٌ ونوع، تفتح صفحةَ العمل */}
      {row.share ? (
        <Pressable
          onPress={() => row.share && onTitle?.(row.share.media_type, row.share.tmdb_id)}
          accessibilityRole="link"
          accessibilityLabel={row.share.title ?? ""}
          style={({ pressed }) => ({ marginTop: 8, alignSelf: "flex-start", maxWidth: 300, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: pressed ? tokens.surface2 : tokens.surface })}
        >
          <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {row.share.poster_path ? <Image source={{ uri: posterFor(row.share.poster_path, 44) ?? undefined }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="film" size={16} color={tokens.muted} />}
          </View>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Text size={14} weight="700" numberOfLines={2}>{row.share.title ?? "—"}</Text>
            <Text size={12} muted>{row.share.media_type === "tv" ? t.typeSeries : t.typeMovie}</Text>
          </View>
        </Pressable>
      ) : null}
    </>
  );

  /* 🆕 R55 — السطرُ الموصول يُزاح متنُه إلى جانب الوجه فيمرّ الخطُّ في عمود الوجوه ولا يشقّ الكلام (نهجُ تويتر في لقطة أحمد) */
  const indent = link ? { marginStart: 42 } : null;
  const Root = onOpen && !pending ? Pressable : View;
  return (
    <Root
      {...(onOpen && !pending ? { onPress: () => onOpen(row), accessibilityHint: t.talkReplyPage } : {})}
      style={{ paddingVertical: 12, borderBottomWidth: link === "down" ? 0 : 1, borderBottomColor: tokens.divider, opacity: pending ? 0.6 : 1 }}
    >
      {/* الخطُّ في منتصف عمود الوجه (٣٤ ⇒ ١٦) — من تحت الوجه إلى آخر السطر، أو من أعلى السطر إلى الوجه */}
      {link === "down" ? <View pointerEvents="none" style={{ position: "absolute", start: 16, width: 2, top: 50, bottom: 0, backgroundColor: tokens.border }} /> : null}
      {link === "up" ? <View pointerEvents="none" style={{ position: "absolute", start: 16, width: 2, top: 0, height: 10, backgroundColor: tokens.border }} /> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={() => onProfile(row)} disabled={p.hide_name} accessibilityRole="link" accessibilityLabel={name}>
          <View style={{ width: 34, height: 34, borderRadius: 17, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            {p.avatar_url && !p.hide_name ? <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={15} color={tokens.muted} />}
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
          <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
          {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={14} />}
        </View>
        <Text size={12} muted>· {timeAgoShort(row.created_at, t)}</Text>
        {!pending && signedIn && !review ? (
          <Pressable onPress={() => onMenu(row)} hitSlop={8} accessibilityLabel={t.moreMenuTitle} style={{ marginStart: "auto", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <Icon name="dots" size={16} color={tokens.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={indent}>
      {review ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: tokens.accent }}>
            <Text size={11} weight="700" color={tokens.accent}>{t.talkReviewTag}</Text>
          </View>
          {/* «★ 9 / 10» يُقرأ من اليسار في الاتجاهين — رقمٌ ومقامُه لا جملة */}
          <Text size={13} weight="800" color={tokens.accent} style={{ writingDirection: "ltr" }}>
            {`★ ${num(review.rating, locale)}`}
            <Text size={12} muted>{` / ${num(10, locale)}`}</Text>
          </Text>
        </View>
      ) : null}
      {replyingTo ? <Text size={12} muted style={{ marginTop: 2 }}>{t.talkReplyingTo(replyingTo)}</Text> : null}

      {row.bulletin ? (
        <View style={{ marginTop: 6 }}>
          <Text size={14} content style={{ lineHeight: 21 }}>
            {row.bulletin}
            {row.bulletin_vote ? `  ★ ${row.bulletin_vote}` : ""}
          </Text>
          {row.bulletin_spoiler ? (
            reveal ? (
              <Text size={14} content style={{ lineHeight: 21, marginTop: 4 }}>{row.bulletin_spoiler}</Text>
            ) : (
              <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
                <Icon name="eye-off" size={14} color={tokens.muted} />
                <Text size={13} muted>{t.spoilerShow}</Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : hidden ? (
        <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
          <Icon name="eye-off" size={14} color={tokens.muted} />
          <Text size={13} muted>{unwatched ? t.epSpoilerUnwatched : t.spoilerShow}</Text>
        </Pressable>
      ) : (
        <>
          {text.trim() ? (
            <Text size={BODY_SIZE} weight="500" chat style={{ lineHeight: BODY_LINE, marginTop: 6 }}>
              {richNodes(text, { size: BODY_SIZE, weight: "500", chat: true, color: tokens.fg, linkColor: tokens.info, mentions, onMention, onPath })}
            </Text>
          ) : null}
          {row.translated && !row.has_spoiler ? (
            <Pressable onPress={() => setOriginal((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 4 }}>
              <Text size={12} weight="700" muted>{original ? t.showTranslation : t.showOriginalText}</Text>
            </Pressable>
          ) : null}
          {media}
        </>
      )}

      {hasTail ? (
        <>
          {/* 🆕 R54 — **صفُّ التفاعل بخانات «النشاط»** (أحمد ٢١ أكتوبر: «خلها متباعده مثل ف اكتفتي .. ونفس نظام تويتر عادي اسوي لنفسي لايك»):
              ❤️ · 💬 · ▲▼ كلٌّ في ثلثٍ ثابتٍ من العرض — كانت متلاصقةً في الطرف، والقلبُ والتصويتُ يغيبان عن مشاركتك ما لم يتفاعل أحد.
              القلبُ على مشاركتك مسموح (سياسةُ القاعدة لا تمنعه، والمنعُ كان هنا وحده)؛ والتصويتُ على نفسك يبقى رقماً بلا ضغط */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, marginHorizontal: -8 }}>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              {showLikes && (canLike || row.likes > 0) ? (
                <Pressable onPress={() => onLike(row)} disabled={!canLike} hitSlop={4} accessibilityLabel={t.likesLabel} accessibilityState={{ selected: row.liked_by_me }} style={pad}>
                  <Icon name={row.liked_by_me ? "heart-filled" : "heart"} size={16} color={row.liked_by_me ? tokens.accent : tokens.muted} />
                  {row.likes > 0 ? <Text size={12} color={row.liked_by_me ? tokens.accent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{num(row.likes, locale)}</Text> : null}
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              {signedIn && canReply ? (
                <Pressable onPress={() => onReply(row)} hitSlop={4} accessibilityLabel={t.talkReply} style={pad}>
                  <Icon name="comment" size={15} color={tokens.muted} />
                  {replies > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(replies, locale)}</Text> : null}
                </Pressable>
              ) : replies > 0 ? (
                <View style={pad}>
                  <Icon name="comment" size={15} color={tokens.muted} />
                  <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(replies, locale)}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              {votesOn && (canAct || row.mine || row.score !== 0) ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Pressable
                    onPress={() => onVote(row, row.my_vote === 1 ? 0 : 1)}
                    disabled={!canAct}
                    hitSlop={4}
                    accessibilityLabel={t.voteUp}
                    accessibilityState={{ selected: row.my_vote === 1 }}
                    style={{ padding: 6, transform: [{ rotate: "180deg" }] }}
                  >
                    <Icon name="chevron-down" size={16} color={row.my_vote === 1 ? tokens.accent : tokens.muted} />
                  </Pressable>
                  <Text size={12} color={row.my_vote === 1 ? tokens.accent : tokens.muted} style={{ minWidth: 10, textAlign: "center", fontVariant: ["tabular-nums"] }}>{num(row.score, locale)}</Text>
                  <Pressable
                    onPress={() => onVote(row, row.my_vote === -1 ? 0 : -1)}
                    disabled={!canAct}
                    hitSlop={4}
                    accessibilityLabel={t.voteDown}
                    accessibilityState={{ selected: row.my_vote === -1 }}
                    style={{ padding: 6 }}
                  >
                    <Icon name="chevron-down" size={16} color={row.my_vote === -1 ? tokens.fg : tokens.muted} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          {fold ? (
            <View style={{ flexDirection: "row", marginHorizontal: -8 }}>
              <Pressable onPress={fold.onToggle} hitSlop={4} accessibilityState={{ expanded: fold.open }} style={pad}>
                <View style={{ transform: [{ rotate: fold.open ? "180deg" : "0deg" }] }}>
                  <Icon name="chevron-down" size={14} color={tokens.muted} />
                </View>
                <Text size={12} weight="700" muted>{fold.open ? t.talkHideReplies : t.talkShowReplies(fold.count)}</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      </View>
    </Root>
  );
});
