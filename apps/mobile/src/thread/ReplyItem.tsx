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
}: ReplyItemProps) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(false);
  const [original, setOriginal] = useState(false);
  const pending = row.id.startsWith(TEMP);
  const p = row.person;
  const name = displayNameOf(p, t.anonymousUser);
  const text = row.translated && !original ? row.translated : row.body;
  const hidden = row.has_spoiler && !reveal;
  const canAct = signedIn && !row.mine && !pending;
  const pad = { flexDirection: "row" as const, alignItems: "center" as const, gap: 5, paddingVertical: 6, paddingHorizontal: 8, minHeight: 32 };
  const hasTail = !pending && ((signedIn && canReply) || fold || (showLikes && (canAct || row.likes > 0)) || (showVotes && (canAct || row.score !== 0)));

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
    </>
  );

  return (
    <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.divider, opacity: pending ? 0.6 : 1 }}>
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
        {!pending && signedIn ? (
          <Pressable onPress={() => onMenu(row)} hitSlop={8} accessibilityLabel={t.moreMenuTitle} style={{ marginStart: "auto", width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
            <Icon name="dots" size={16} color={tokens.muted} />
          </Pressable>
        ) : null}
      </View>

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
          <Text size={13} muted>{t.spoilerShow}</Text>
        </Pressable>
      ) : (
        <>
          {text.trim() ? <Text size={14} content style={{ lineHeight: 21, marginTop: 6 }}>{text}</Text> : null}
          {row.translated && !row.has_spoiler ? (
            <Pressable onPress={() => setOriginal((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 4 }}>
              <Text size={12} weight="700" muted>{original ? t.showTranslation : t.showOriginalText}</Text>
            </Pressable>
          ) : null}
          {media}
        </>
      )}

      {hasTail ? (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 2, marginTop: 4, marginHorizontal: -8 }}>
          {showVotes && (canAct || row.score !== 0) ? (
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
          {showLikes && (canAct || row.likes > 0) ? (
            <Pressable onPress={() => onLike(row)} disabled={!canAct} hitSlop={4} accessibilityLabel={t.likesLabel} accessibilityState={{ selected: row.liked_by_me }} style={pad}>
              <Icon name={row.liked_by_me ? "heart-filled" : "heart"} size={15} color={row.liked_by_me ? tokens.accent : tokens.muted} />
              <Text size={12} color={row.liked_by_me ? tokens.accent : tokens.muted}>{t.likesLabel}</Text>
              {row.likes > 0 ? <Text size={12} color={row.liked_by_me ? tokens.accent : tokens.muted} style={{ fontVariant: ["tabular-nums"] }}>{num(row.likes, locale)}</Text> : null}
            </Pressable>
          ) : null}
          {signedIn && canReply ? (
            <Pressable onPress={() => onReply(row)} hitSlop={4} accessibilityLabel={t.talkReply} style={pad}>
              <Icon name="comment" size={15} color={tokens.muted} />
              <Text size={12} muted>{t.talkReply}</Text>
              {replyCount > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(replyCount, locale)}</Text> : null}
            </Pressable>
          ) : null}
          {fold ? (
            <Pressable onPress={fold.onToggle} hitSlop={4} accessibilityState={{ expanded: fold.open }} style={pad}>
              <View style={{ transform: [{ rotate: fold.open ? "180deg" : "0deg" }] }}>
                <Icon name="chevron-down" size={14} color={tokens.muted} />
              </View>
              <Text size={12} weight="700" muted>{fold.open ? t.talkHideReplies : t.talkShowReplies(fold.count)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});
