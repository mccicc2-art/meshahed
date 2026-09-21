import React, { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { num } from "@/core/i18n";
import { ReviewRow } from "../title/TitleCommunity";
import type { ListDetailPayload, ListReplyRow } from "../contracts";

/**
 * ====== آراءُ الناس في قائمة، بقلوبها وردودها — D-1038 (L2) ======
 *
 * **لماذا**: الشريحةُ الأولى عرضت الآراءَ للقراءة وأحالت القلبَ والردَّ إلى الويب. الدوالُّ قائمة
 * (`toggleListReviewLike` · `addListReviewReply` · `deleteMyListReviewReply`) فلا مانع.
 *
 * 🔑 **الرأيُ `ReviewRow` نفسُه** (شكلٌ واحدٌ للرأي — D-1036)؛ هذا الملفُّ يضيف **تحته** سطرَ الفعل: ♥ بعدّه ·
 * 💬 بعدّه · «ردّ». والخيطُ **مطويٌّ حتّى يُفتح** (مفرداتُ Talk نفسُها: `talkShowReplies`/`talkHideReplies`/
 * `talkReply`/`talkReplyingTo`) — رأيٌ بعشرين ردّاً لا يدفع الآراءَ الأخرى خارج الشاشة.
 * ⚖️ **عمقٌ واحد** (الهجرةُ ٦٢ تمنع الثالث): الردُّ على ردٍّ يُكتب بـ`parentId` ويُعرض في الخيط نفسِه مسطَّحاً
 * بترتيب زمنه — لا تداخلَ بصريّاً على شاشةٍ بعرض ٣٦٠. والكتابةُ بيد الشاشة (`on…`) لأنّ الكاشَ كاشُها.
 */
export function ListReviews({
  rows,
  replies,
  canAct,
  busy,
  onLike,
  onReply,
  onDeleteReply,
}: {
  rows: ListDetailPayload["review_rows"];
  replies: ListReplyRow[];
  /** مسجَّلُ دخول — الزائرُ يقرأ ولا يفعل */
  canAct: boolean;
  busy: boolean;
  onLike: (reviewUserId: string, liked: boolean) => void;
  onReply: (reviewUserId: string, body: string, parentId: string | null) => Promise<boolean>;
  onDeleteReply: (replyId: string) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [to, setTo] = useState<{ review: string; parent: string | null; name: string } | null>(null);
  const [draft, setDraft] = useState("");
  const byReview = useMemo(() => {
    const m = new Map<string, ListReplyRow[]>();
    for (const r of replies) m.set(r.review_user_id, [...(m.get(r.review_user_id) ?? []), r]);
    for (const list of m.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return m;
  }, [replies]);

  const send = async () => {
    const body = draft.trim();
    if (!to || !body) return;
    if (await onReply(to.review, body, to.parent)) {
      setOpen((p) => new Set(p).add(to.review));
      setDraft("");
      setTo(null);
    }
  };

  return (
    <View style={{ gap: 16 }}>
      {rows.map((r) => {
        const thread = byReview.get(r.user_id) ?? [];
        const shown = open.has(r.user_id);
        const replying = to?.review === r.user_id;
        return (
          <View key={r.user_id} style={{ gap: 8 }}>
            <ReviewRow r={r} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingStart: 4 }}>
              <Pressable disabled={!canAct || busy} onPress={() => onLike(r.user_id, !r.liked_by_me)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Icon name={r.liked_by_me ? "heart-filled" : "heart"} size={15} color={r.liked_by_me ? tokens.error : tokens.muted} />
                <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(r.likes, locale)}</Text>
              </Pressable>
              {thread.length > 0 ? (
                <Pressable onPress={() => setOpen((p) => { const n = new Set(p); if (n.has(r.user_id)) n.delete(r.user_id); else n.add(r.user_id); return n; })} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icon name="comment" size={15} color={tokens.muted} />
                  <Text size={12} muted>{shown ? t.talkHideReplies : t.talkShowReplies(thread.length)}</Text>
                </Pressable>
              ) : null}
              {canAct ? (
                <Pressable onPress={() => setTo(replying && to?.parent === null ? null : { review: r.user_id, parent: null, name: r.name })} hitSlop={8}>
                  <Text size={12} weight="600" color={replying ? tokens.accent : tokens.muted}>{t.talkReply}</Text>
                </Pressable>
              ) : null}
            </View>

            {shown ? (
              <View style={{ gap: 10, paddingStart: 14, borderStartWidth: 2, borderStartColor: tokens.divider, marginStart: 6 }}>
                {thread.map((x) => (
                  <View key={x.reply_id} style={{ gap: 2 }}>
                    <Text size={12} weight="700" numberOfLines={1}>{x.name}</Text>
                    <Text size={13} style={{ lineHeight: 20 }}>{x.body}</Text>
                    <View style={{ flexDirection: "row", gap: 16, marginTop: 2 }}>
                      {canAct ? (
                        <Pressable onPress={() => setTo({ review: r.user_id, parent: x.parent_id ?? x.reply_id, name: x.name })} hitSlop={8}>
                          <Text size={12} muted>{t.talkReply}</Text>
                        </Pressable>
                      ) : null}
                      {x.mine ? (
                        <Pressable disabled={busy} onPress={() => onDeleteReply(x.reply_id)} hitSlop={8}>
                          <Text size={12} color={tokens.error}>{t.talkDeleteReply}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {replying && to ? (
              <View style={{ gap: 6 }}>
                <Text size={12} muted numberOfLines={1}>{t.talkReplyingTo(to.name)}</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <TextInput
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    maxLength={1000}
                    placeholder={t.postReplyPlaceholder}
                    placeholderTextColor={tokens.muted}
                    style={{ flex: 1, minHeight: 40, maxHeight: 110, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: tokens.fg }}
                  />
                  <Pressable disabled={busy || !draft.trim()} onPress={() => void send()} accessibilityLabel={t.shareReplySend} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tokens.accent, opacity: busy || !draft.trim() ? 0.5 : 1 }}>
                    <Icon name="send" size={18} color={tokens.onAccent} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
