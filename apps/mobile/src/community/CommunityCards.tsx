import React, { memo, useState } from "react";
import { talkActivity } from "@/core/talkSort";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { posterFor } from "../poster";
import { IdentityBadges, identityFlags } from "../IdentityBadges";
import { StatusThread } from "../library/PosterCard";
import { backdropUrl } from "@/core/media";
import { num } from "@/core/i18n";
import { formatDateShort, timeAgo, timeAgoShort } from "@/core/when";
import { displayNameOf, profileHref } from "@/core/people";
import { curatedName } from "@/core/universes";
import { LOOPZ_USERNAME } from "@/core/loopz";
import { likeOf, type CommunityActs, type FollowState } from "./communityActs";
import type { CommunityFeedRow, CommunityLeaderRow, CommunityRoom, CommunityTopReview } from "../contracts";

/**
 * ====== بطاقاتُ «المجتمع» الأصليّة — Phase 11-M · M1 (قراءةٌ وحدَها) ======
 *
 * 🔑 **الخياراتُ والوجهاتُ وجهاتُ الويب، والمقاساتُ للتطبيق** (قاعدةُ أحمد، ٢٢ و٢٤ سبتمبر): صفُّ «مجتمعي» هو
 * `CommentRow`/`NewsRow` في `ActivityFeed` — وجهٌ واسمٌ وشاراتٌ وعمرٌ مختصر · العملُ و★ صاحبِ الرأي · الكلامُ تحت الوجه
 * (والمحجوبُ خلف «فيها حرق» حتى يُضغط، D-315) · الذيلُ إعجابٌ وردودٌ ومشاهدات · الملصقُ في النهاية بخيط حالتك (D-850).
 * **الحمولةُ تصل جاهزة** (D-1172): الترجمةُ والسطرُ والأرقامُ من الخادم، وهنا الرسمُ وحدُه.
 *
 * ⚖️ **الأفعالُ في M1 أبواب** (خطّة §٣): العملُ ⇐ صفحتُه الأصليّة · القائمةُ ⇐ صفحتُها الأصليّة · الشخصُ والرأيُ
 * والنشرةُ والغرفة ⇐ بابٌ ويبيٌّ يعود رجوعُه إلى هنا.
 *
 * 🆕 **M2 — الذيلُ يفعل** (`RowComment`/`NewsComment` + `LikeButton` + `StatChip` + `ShareTitleButton`): قلبٌ يكتب ·
 * «تعليق» يفتح صندوقَ الردّ (وفي صفّ القائمة بابُ صفحتها — لا ردَّ على قائمةٍ في الخطّ، D-370) · المشاهداتُ تُقرأ ·
 * المشاركةُ بورقة النظام. **ودبّوسُ الغرفة** (`RoomPinButton`) **وزاويةُ المتابعة** في «عرض الكل» (`FollowUserButton
 * variant="corner"`). **والحالةُ في الكاش** (`communityActs`) — البطاقةُ ترسمها ولا تحملها.
 */

/**
 * 🆕 D-1353 — **«المزيد / أقل» تحت النصّ الطويل** (أحمد بلقطتين ١١ أكتوبر، الويبُ والتطبيق: «الويب يظهر التعليق كامل،
 * التطبيق لا — ابغى تضيف مزيد والشخص يضغط عليها لإظهار النصّ كامل»، ثمّ اعتمد صورتَي قبل/بعد). النصُّ كان يُقصّ عند
 * أربعة أسطرٍ بلا بابٍ لباقيه إلّا فتحُ الخيط. الضغطُ على النصّ نفسِه يفتح الخيطَ كما كان؛ الكلمةُ وحدَها تبسط وتطوي.
 *
 * 🔑 **الكلمةُ تظهر فقط حين يُقصّ شيءٌ فعلاً**: نسخةٌ غيرُ مرئيّةٍ من النصّ تُقاس مرّةً بلا قصّ (عددُ أسطرها) ثمّ تُنزع —
 * `onTextLayout` على النصّ المقصوص لا يقول كم كان سيبلغ. **وجهتُها جهةُ النصّ** لا جهةُ الواجهة: مراجعةٌ عربيّةٌ في
 * واجهةٍ إنجليزيّةٍ كلمتُها تحت بداية سطورها (اليمين)، كما في الصورة المعتمدة.
 */
const CLAMP_LINES = 4;

/** 🆕 D-1448 — جهةُ الكلام من أوّل حرفٍ قويّ: عربيٌّ/عبريٌّ ⇒ يمين، لاتينيٌّ ⇒ يسار، ولا حرف ⇒ جهةُ الواجهة («بوست جديد» يقرؤها) */
export function textIsRtl(text: string): boolean {
  const strong = /[A-Za-z\u0590-\u08FF]/.exec(text)?.[0] ?? "";
  return strong ? !/[A-Za-z]/.test(strong) : I18nManager.isRTL;
}

function ClampedText({ text, onPress }: { text: string; onPress: () => void }) {
  const { t } = useApp();
  const [long, setLong] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const rtl = textIsRtl(text);
  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={onPress}>
        <Text size={14} content numberOfLines={open ? undefined : CLAMP_LINES} style={{ lineHeight: 21 }}>{text}</Text>
      </Pressable>
      {long === null ? (
        <Text size={14} content pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onTextLayout={(e) => setLong(e.nativeEvent.lines.length > CLAMP_LINES)} style={{ lineHeight: 21, position: "absolute", left: 0, right: 0, top: 0, opacity: 0 }}>{text}</Text>
      ) : null}
      {long ? (
        <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: rtl === I18nManager.isRTL ? "flex-start" : "flex-end", marginTop: 4 }}>
          <Text size={13} weight="700" muted>{open ? t.showLess : t.showMore}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const POSTER_W = 72;
const AVATAR = 40;

export type CardDoors = {
  onTitle: (kind: "tv" | "movie", id: number) => void;
  onList: (id: string) => void;
  /** بابٌ ويبيّ (ملفٌّ · رأيٌ · نشرةٌ · غرفة) */
  onWeb: (path: string) => void;
};

export function Avatar({ uri, size = AVATAR }: { uri: string | null; size?: number }) {
  const { tokens } = useApp();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : <Icon name="people" size={size * 0.45} color={tokens.muted} />}
    </View>
  );
}

/** أفعالُ البطاقة — حالتُها في الكاش (`useCommunityActs`)، والتعليقُ والمشاركةُ ورقتان يملكهما المستدعي */
export type CardActs = Pick<CommunityActs, "like" | "signedIn" | "meId"> & {
  comment: (row: CommunityFeedRow) => void;
  share: (path: string, title: string) => void;
  /** 🆕 D-1448 — ⋯ بجوار العمر: الورقةُ يملكها المستدعي (`FeedMenu`) */
  menu: (row: CommunityFeedRow) => void;
};

/**
 * 🆕 M2 — **الذيلُ** (`RowComment` + `LikeButton` + `StatChip` + `ShareTitleButton`) موزَّعاً بعرض العمود (`justify-between`):
 * - **القلبُ** رمزٌ وكلمةٌ ورقم (D-294 المنقوض: «رجّعها»)، والصفرُ لا يُرسم (D-219)، ولونُ التمييز حين أعجبك (`actionTailItem`).
 *   **ورأيُك أنت رقمٌ بلا زرّ** (لا يُعجب المرءُ بنفسه) — **وكذلك الزائر** (`readOnly`، D-221).
 * - **«تعليق»** رمزٌ وكلمةٌ ورقمُ الردود — وفي صفّ القائمة بابُ صفحتها (الخيطُ يسكن تبويبَ تقييماتها، D-333).
 * - **المشاهداتُ** رقمٌ يُقرأ (`StatChip`: باهتٌ على الصفر) · **المشاركةُ** رمزٌ عارٍ — ولا مشاهداتَ ولا مشاركةَ لصفِّ قائمة (D-370).
 * ⚠️ **٤٤ تُلمس** وإن رُسم الرمزُ ١٦ (`hitSlop` + حشوة، D-033).
 * 🆕 D-1484 · D-1485 (ينقض D-294 «رجّعها») — **الرمزُ والرقمُ بلا كلمة** (أحمد ٢٠ أكتوبر: «احذف كلمة تعليق وإعجاب، الأيقونات تكفي»):
 *   الكلمتان كانتا أعرضَ ما في الذيل وأوّلَ ما يُقصّ تحت خطٍّ كبير، والمشاهداتُ جنبهما رمزٌ ورقمٌ أصلاً. الكلمةُ باقيةٌ
 *   لقارئ الشاشة (`accessibilityLabel`) — العينُ ترى الرمز، والأذنُ تسمع الاسم.
 */
function Tail({ row, acts, onList, share }: { row: CommunityFeedRow; acts: CardActs; onList?: () => void; share?: { path: string; title: string } }) {
  const { t, tokens, locale } = useApp();
  /* 🆕 D-1503 — **صفُّ تقييم الحلقة: مشاركةٌ وحدَها** — لا قلبَ ولا ردَّ لتقييم الحلقة في القاعدة بعد، وقلبٌ هنا كان سيُكتب
     على مراجعة العمل كلِّه (`likeBody` يعرف «مراجعة» و«قائمة» وحدَهما) */
  if (row.kind === "comment" && row.item.kind === "ep_rate") {
    return share ? (
      <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: "auto", paddingTop: 4, marginHorizontal: -10 }}>
        <Pressable onPress={() => acts.share(share.path, share.title)} hitSlop={4} accessibilityRole="button" accessibilityLabel={t.shareLinkLabel} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, minHeight: 36 }}>
          <Icon name="share" size={16} color={tokens.muted} />
        </Pressable>
      </View>
    ) : null;
  }
  const { likes, liked } = likeOf(row);
  /* 🆕 R58 — منشورُ النقاش يُعجَب صاحبُه به كما في الغرفة (D-1512)؛ والرأيُ لا */
  const mine = row.kind === "comment" && row.item.person.id === acts.meId;
  const readOnly = mine || !acts.signedIn;
  const replies = row.kind === "comment" && row.item.listId ? row.list_social?.replies ?? 0 : row.replies;
  const views = row.kind === "talk" || (row.kind === "comment" && row.item.listId) ? null : row.views;
  const pad = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingVertical: 8, paddingHorizontal: 10, minHeight: 36 };
  const heartColor = liked ? tokens.accent : tokens.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4, marginHorizontal: -10 }}>
      {readOnly ? (
        likes > 0 ? (
          <View style={pad} accessibilityLabel={`${t.likesLabel}: ${likes}`}>
            <Icon name="heart" size={16} color={tokens.muted} />
            <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(likes, locale)}</Text>
          </View>
        ) : null
      ) : (
        <Pressable onPress={() => acts.like(row)} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={t.likesLabel} style={pad}>
          <Icon name={liked ? "heart-filled" : "heart"} size={16} color={heartColor} />
          {likes > 0 ? <Text size={12} color={heartColor} style={{ fontVariant: ["tabular-nums"] }}>{num(likes, locale)}</Text> : null}
        </Pressable>
      )}
      <Pressable
        onPress={() => (onList ? onList() : acts.signedIn ? acts.comment(row) : undefined)}
        disabled={!onList && !acts.signedIn}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={onList ? t.talkReply : t.actionComment}
        style={pad}
      >
        <Icon name="comment" size={15} color={tokens.muted} />
        {replies > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(replies, locale)}</Text> : null}
      </Pressable>
      {views != null ? (
        <View style={[pad, { gap: 4 }]} accessibilityLabel={views > 0 ? `${t.postViewsHint}: ${views}` : undefined}>
          <Icon name="chart" size={14} color={views > 0 ? tokens.muted : tokens.muted + "59"} />
          {views > 0 ? <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(views, locale)}</Text> : null}
        </View>
      ) : null}
      {share ? (
        <Pressable onPress={() => acts.share(share.path, share.title)} hitSlop={4} accessibilityRole="button" accessibilityLabel={t.shareLinkLabel} style={pad}>
          <Icon name="share" size={16} color={tokens.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 🆕 D-1448 — `dark`: لا أخَ ملوّناً لملصقه الداكن (`poster_dark` من الخادم) ⇒ إطارٌ رفيعٌ بلون النصّ فلا يذوب في الخلفيّة */
function RowPoster({ path, kind, lib, dark = false, onPress }: { path: string | null; kind: "tv" | "movie"; lib: CommunityFeedRow["lib"]; dark?: boolean; onPress: () => void }) {
  const { tokens } = useApp();
  const uri = posterFor(path, POSTER_W);
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={{ width: POSTER_W, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, alignSelf: "flex-start", borderWidth: dark ? 1 : 0, borderColor: tokens.fg + "59" }}>
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={120} /> : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Icon name={kind === "tv" ? "tv" : "film"} size={18} color={tokens.muted} />
        </View>
      )}
      {/* خيطُ حالتك (D-850): سماويٌّ «عندك» · أصفرُ بمقدار التقدّم · أخضرُ للمنتهي · أحمرُ للموقوف — وصفةُ المكتبة */}
      {lib.added || lib.watched || lib.progress > 0 || lib.dropped ? (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <StatusThread progress={lib.progress} completed={lib.watched} dropped={lib.dropped} saved={lib.added} />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * 🆕 R58 — **منشورُ نقاشٍ في الأنشطة** (أحمد ٢١ أكتوبر — الصورة ⑮): جذرٌ من القلم، أو جذرُ غرفةٍ نشط («٤ أ»: ٥ ردود أو ١٠
 * إعجابات). نفسُ هيكل صفِّ الرأي (الوجه · الاسم · العمر · الكلام · الذيل · الملصق)، والفارقُ وسمٌ واحدٌ بعد اسم العمل:
 * «نقاش» · «م·ح» للحلقة (ومحجوبٌ حتى يُضغط) · «النقاش العام» بلا ملصق · «نشط» لما جاء من الغرفة. **وكلُّ لمسةٍ تفتح مكانَه في
 * غرفته** (`?r=`) — الردُّ هناك لا في الخطّ.
 */
function TalkRow({ row, doors, acts }: { row: Extract<CommunityFeedRow, { kind: "talk" }>; doors: CardDoors; acts: CardActs }) {
  const { t, tokens } = useApp();
  const [reveal, setReveal] = useState(false);
  const p = row.item;
  const general = p.media_type === "general";
  const kind = p.media_type === "movie" ? "movie" : "tv";
  const room = general ? "/talk/general/0" : `/talk/${p.media_type}/${p.tmdb_id}`;
  const open = () => doors.onWeb(`${room}?r=${p.id}`);
  const openTitle = () => (general ? doors.onWeb(room) : doors.onTitle(kind, p.tmdb_id));
  const who = displayNameOf(p.person, t.anonymousUser);
  const whoPath = profileHref(p.person);
  const ep = p.season != null && p.episode != null;
  const hidden = p.has_spoiler && !reveal;
  const chip = (label: string, color: string, border: string, icon?: Parameters<typeof Icon>[0]["name"]) => (
    <Pressable onPress={open} hitSlop={4} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: border, backgroundColor: tokens.surface2, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
      {icon ? <Icon name={icon} size={11} color={color} /> : null}
      <Text size={11} weight="600" color={color} style={{ fontVariant: ["tabular-nums"] }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => whoPath && doors.onWeb(whoPath)} disabled={!whoPath} accessibilityRole="link" accessibilityLabel={who}>
            <Avatar uri={p.person.hide_name ? null : p.person.avatar_url} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable onPress={() => whoPath && doors.onWeb(whoPath)} disabled={!whoPath} style={{ flexShrink: 1 }}>
                <Text size={14} weight="700" numberOfLines={1}>{who}</Text>
              </Pressable>
              {p.person.hide_name ? null : <IdentityBadges flags={identityFlags(p.person)} nameSize={14} />}
              <Pressable onPress={open} hitSlop={6} style={{ marginStart: "auto" }}>
                <Text size={12} muted>{timeAgoShort(p.created_at, t)}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {general ? (
                chip(t.talkGeneralTitle, tokens.accent, tokens.accent + "59", "people")
              ) : (
                <>
                  <Pressable onPress={openTitle} style={{ flexShrink: 1 }}>
                    <Text size={12} muted numberOfLines={1}>{p.title ?? ""}</Text>
                  </Pressable>
                  {ep ? chip(t.epChip(p.season as number, p.episode as number, 0), tokens.fg, tokens.border) : p.hot ? null : chip(t.feedTalkTag, tokens.accent, tokens.accent + "59", "comment")}
                </>
              )}
              {p.hot ? chip(t.feedHotTag(row.replies), "#ff9a3c", "#ff9a3c59", "trending") : null}
            </View>
          </View>
        </View>
        {hidden ? (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
            <Icon name="eye-off" size={14} color={tokens.muted} />
            <Text size={13} muted>{ep ? t.epSpoilerUnwatched : t.spoilerMark}</Text>
          </Pressable>
        ) : p.body?.trim() ? (
          <ClampedText key={p.body} text={p.body} onPress={open} />
        ) : p.image ? (
          <Pressable onPress={open} style={{ marginTop: 8, width: 160, aspectRatio: 4 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
          </Pressable>
        ) : null}
        <Tail row={row} acts={acts} onList={open} share={{ path: room, title: general ? t.talkGeneralTitle : p.title ?? "" }} />
      </View>
      {general ? null : <RowPoster path={p.poster_path} kind={kind} lib={row.lib} onPress={openTitle} />}
    </View>
  );
}

export const FeedCard = memo(function FeedCard({ row, doors, acts }: { row: CommunityFeedRow; doors: CardDoors; acts: CardActs }) {
  if (row.kind === "talk") return <TalkRow row={row} doors={doors} acts={acts} />;
  return <ReviewOrNewsCard row={row} doors={doors} acts={acts} />;
});

function ReviewOrNewsCard({ row, doors, acts }: { row: Exclude<CommunityFeedRow, { kind: "talk" }>; doors: CardDoors; acts: CardActs }) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(false);
  /* «النص الأصلي» ⇄ «الترجمة» (`FeedReviewText`، D-307) — حالةُ ضغطةٍ في البطاقة لا تفضيل */
  const [original, setOriginal] = useState(false);
  const titleDoor = () => (row.kind === "comment" && row.item.listId ? doors.onList(row.item.listId) : doors.onTitle(row.item.media_type, row.item.tmdb_id));

  if (row.kind === "news") {
    const n = row.item;
    const post = `/post/${encodeURIComponent(n.key)}`;
    return (
      <View style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable onPress={() => doors.onWeb(`/u/${LOOPZ_USERNAME}`)} accessibilityRole="link">
              <View style={{ width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                <Image source={require("../../assets/loopz-mark.png")} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text size={14} weight="700" style={{ flexShrink: 1, writingDirection: "ltr" }}>Loopz</Text>
                <Pressable onPress={() => doors.onWeb(post)} hitSlop={6} style={{ marginStart: "auto" }}>
                  <Text size={12} muted>{timeAgoShort(n.published_at, t)}</Text>
                </Pressable>
                <Pressable onPress={() => acts.menu(row)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.moreMenuTitle} style={({ pressed }) => ({ width: 24, height: 18, alignItems: "center", justifyContent: "center", marginEnd: -4, opacity: pressed ? 0.5 : 1 })}>
                  <Icon name="dots" size={16} color={tokens.muted} />
                </Pressable>
              </View>
              <Pressable onPress={() => doors.onTitle(n.media_type, n.tmdb_id)}>
                <Text size={12} muted numberOfLines={1}>{n.title} · {n.media_type === "tv" ? t.typeSeries : t.typeMovie}</Text>
              </Pressable>
            </View>
          </View>
          <Pressable onPress={() => doors.onWeb(post)} style={{ marginTop: 8 }}>
            <Text size={14} weight="600" numberOfLines={3} style={{ lineHeight: 21 }}>{row.line}</Text>
          </Pressable>
          {row.source ? (
            <Text size={12} muted style={{ marginTop: 4 }}>{t.newsPerSource(row.source.name)}</Text>
          ) : null}
          <Tail row={row} acts={acts} share={{ path: `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`, title: n.title }} />
        </View>
        <RowPoster path={n.poster_path} kind={n.media_type} lib={row.lib} dark={row.poster_dark} onPress={() => doors.onTitle(n.media_type, n.tmdb_id)} />
      </View>
    );
  }

  const a = row.item;
  const isList = !!a.listId;
  const who = displayNameOf(a.person, t.anonymousUser);
  const whoPath = profileHref(a.person);
  /* D-1503 — تقييمُ الحلقة لا صفحةَ مراجعةٍ له: نصُّه يفتح العمل */
  const isEp = a.kind === "ep_rate";
  const reviewPath = isList || isEp ? null : `/review/${a.media_type}/${a.tmdb_id}/${a.person.id}`;
  const rowTitle = isList ? curatedName(a.listSlug, a.title ?? "", locale === "en" ? "en" : "ar") : a.title;
  /* المحجوبُ لا يُترجَم (D-315) — والخادمُ لا يرسل له ترجمة أصلاً */
  const translated = isList ? null : row.translated;
  const text = translated && !original ? translated : a.review ?? "";
  const hidden = a.hasSpoiler && !reveal;
  const openText = () => (isList && a.listId ? doors.onList(a.listId) : reviewPath ? doors.onWeb(reviewPath) : isEp ? doors.onTitle(a.media_type, a.tmdb_id) : undefined);
  const cover = isList && a.listCover ? backdropUrl(a.listCover, "w300") : null;

  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => whoPath && doors.onWeb(whoPath)} disabled={!whoPath} accessibilityRole="link" accessibilityLabel={who}>
            <Avatar uri={a.person.hide_name ? null : a.person.avatar_url} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable onPress={() => whoPath && doors.onWeb(whoPath)} disabled={!whoPath} style={{ flexShrink: 1 }}>
                <Text size={14} weight="700" numberOfLines={1}>{who}</Text>
              </Pressable>
              {a.person.hide_name ? null : <IdentityBadges flags={identityFlags(a.person)} nameSize={14} />}
              <Pressable onPress={openText} hitSlop={6} style={{ marginStart: "auto" }}>
                <Text size={12} muted>{timeAgoShort(a.updated_at, t)}</Text>
              </Pressable>
              <Pressable onPress={() => acts.menu(row)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.moreMenuTitle} style={({ pressed }) => ({ width: 24, height: 18, alignItems: "center", justifyContent: "center", marginEnd: -4, opacity: pressed ? 0.5 : 1 })}>
                <Icon name="dots" size={16} color={tokens.muted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Pressable onPress={titleDoor} style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}>
                {isList ? <Icon name="list" size={13} color={tokens.muted} /> : null}
                <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{rowTitle}</Text>
              </Pressable>
              {/* 🆕 D-1503 — وسمُ الحلقة «S1 · E3» (و«+٢» إن قُيّم معها غيرُها ذلك اليوم) بين العمل والنجمة */}
              {isEp && a.epSeason != null && a.epEpisode != null ? (
                <Pressable onPress={titleDoor} hitSlop={4} style={{ borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Text size={11} weight="600" style={{ fontVariant: ["tabular-nums"] }}>{t.epChip(a.epSeason, a.epEpisode, Math.max(0, (a.epCount ?? 1) - 1))}</Text>
                </Pressable>
              ) : null}
              {a.rating != null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Icon name="star-filled" size={12} color={tokens.accent} />
                  <Text size={13} weight="700" color={tokens.accent} style={{ writingDirection: "ltr" }}>{a.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {hidden ? (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
            <Icon name="eye-off" size={14} color={tokens.muted} />
            <Text size={13} muted>{isEp ? t.epSpoilerUnwatched : t.spoilerMark}</Text>
          </Pressable>
        ) : (
          <>
            <ClampedText key={text} text={text} onPress={openText} />
            {translated ? (
              <Pressable onPress={() => setOriginal((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Text size={12} weight="700" muted>{original ? t.showTranslation : t.showOriginalText}</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {isList ? (
          <Tail row={row} acts={acts} onList={() => a.listId && doors.onList(a.listId)} />
        ) : (
          <Tail row={row} acts={acts} share={{ path: `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`, title: a.title ?? "" }} />
        )}
      </View>
      {!isList ? (
        <RowPoster path={a.poster_path} kind={a.media_type} lib={row.lib} dark={row.poster_dark} onPress={titleDoor} />
      ) : cover ? (
        <Pressable onPress={titleDoor} style={{ width: POSTER_W, aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2, alignSelf: "flex-start" }}>
          <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** غرفةُ نقاش — `TalkRoomCard` الويب: الملصقُ في البداية، والغلافُ خلفها باهتاً، والعنوانُ المولَّد هو البطاقة */
/**
 * 🆕 M2 — **دبّوسُ الغرفة** (`RoomPinButton` · `Wrap` في `WorksTalk`): **الإدارةُ** دبّوسُها للجميع ويحلّ محلَّ الشخصيّ (D-314) ·
 * **المثبَّتةُ من لوبز** علامةٌ لا زرّ لغير الإدارة (D-217) · **وغيرُها** دبّوسُك (D-301). **ولا دبّوسَ في بطاقة اللوحة** (`hero`:
 * ليست قائمةً تُرتَّب) **ولا للزائر**. والدبّوسُ أخو البطاقة لا ابنُها — ضغطتُه لا تفتح الغرفة (D-155).
 */
/** `readOnly` = الزائر: لا دبّوسَ له، وتبقى علامةُ لوبز وحدَها (`globalPinned` في `Wrap`) */
export type RoomPin = { admin: boolean; readOnly: boolean; onPin: (room: CommunityRoom) => void } | null;

export const RoomCard = memo(function RoomCard({ room, doors, hero = false, pin = null, activity = false, general = false }: { room: CommunityRoom; doors: CardDoors; hero?: boolean; pin?: RoomPin; activity?: boolean; general?: boolean }) {
  const { t, tokens } = useApp();
  /* 🆕 R58 — «النقاش العام» (الصورة ⑯): البطاقةُ نفسُها، شعارُ لوبز مكانَ الملصق، وسطرُها «أي شي عن الأفلام والمسلسلات»،
     ودبّوسُها علامةٌ ثابتة — مثبّتةٌ للجميع فوق القائمة (أحمد «٢ أ») ولا تُفكّ */
  if (general) room = { ...room, posterPath: null, backdropPath: null, airing: null, episode_line: t.talkGeneralCard };
  /* 🆕 D-1494 — **التصميمُ الجديد** (لقطةُ أحمد ٢٠ أكتوبر): بوسترٌ كبيرٌ بطول البطاقة، والغلافُ ظاهرٌ كاملاً تحت ظلٍّ قويٍّ في
     البداية (حيث البوسترُ والنصّ) يخفّ نحو النهاية — كان الغلافُ باهتاً كلُّه (٣٥٪) بلا ظلّ. وثلاثةُ أسطرٍ قصيرة: العنوان ·
     «الحلقة ١٠ · الموسم ٣» · «٧ مشاركات · منذ ٨ دقائق»، ثمّ الوجوه. `hero` يكبّر المقاساتِ وحدَها (القاعدة ٣). */
  const posterW = hero ? 96 : 84;
  const poster = posterFor(room.posterPath, posterW);
  const bg = backdropUrl(room.backdropPath, "w780");
  const title = general ? t.talkGeneralTitle : t.talkRoomTitle(room.title?.trim() || "", room.mediaType === "tv");
  const shadeId = `room-shade-${room.mediaType}-${room.tmdbId}`;
  const card = (
    <Pressable
      onPress={() => doors.onWeb(general ? "/talk/general/0" : `/talk/${room.mediaType}/${room.tmdbId}`)}
      accessibilityRole="link"
      style={({ pressed }) => ({ flexDirection: "row", gap: 14, padding: 12, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      {/* 🔴 D-1201-fix — الخلفيّةُ داخل قاطعٍ بحوافّ البطاقة نفسِها (أندرويد لا يقصّ ابنَ عنصرٍ يحمل `transform`) */}
      {bg ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.card, overflow: "hidden" }}>
          <Image source={{ uri: bg }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
          {/* الظلُّ من لون السطح: قويٌّ في البداية خفيفٌ في النهاية. Svg لا يعرف اتّجاهَ الواجهة — فالبدايةُ يمينٌ بالعربيّ تُحدَّد بيدنا */}
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
            <Defs>
              <SvgGradient id={shadeId} x1={I18nManager.isRTL ? "1" : "0"} y1="0" x2={I18nManager.isRTL ? "0" : "1"} y2="0">
                <Stop offset="0" stopColor={tokens.surface} stopOpacity={0.96} />
                <Stop offset="0.45" stopColor={tokens.surface} stopOpacity={0.82} />
                <Stop offset="1" stopColor={tokens.surface} stopOpacity={0.2} />
              </SvgGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${shadeId})`} />
          </Svg>
        </View>
      ) : null}
      <View style={{ width: posterW, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", borderWidth: general ? 1 : 0, borderColor: tokens.border }}>
        {general ? (
          <Image source={require("../../assets/loopz-mark.png")} style={{ width: posterW * 0.6, height: posterW * 0.6, borderRadius: posterW * 0.3 }} contentFit="cover" />
        ) : poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6, paddingVertical: 4 }}>
        <Text size={hero ? 18 : 16} weight="700" numberOfLines={1} style={{ marginEnd: general || (pin && !(pin.readOnly && room.pin !== 2)) ? 28 : 0 }}>{title}</Text>
        {room.episode_line ? <Text size={13} numberOfLines={1}>{room.episode_line}</Text> : null}
        <Text size={12} muted numberOfLines={1}>
          {/* 🆕 D-1201 — مع «الأكثر تفاعلاً» الرقمُ رقمُ الترتيب (تفاعلُ الشهر) — وإلّا بدا الترتيبُ عشوائيّاً */}
          {activity ? t.talkRoomActivityMonth(talkActivity(room)) : hero && room.postsWeek > 0 ? t.talkRoomPostsWeek(room.postsWeek) : t.talkRoomPosts(room.posts)}
          {/* 🔴 D-1207 — الوقتُ من مشاركات الأعضاء لا من إشعار الحلقة؛ غرفةٌ بلا مشاركةٍ لا تقول وقتاً */}
          {room.lastPostAt ? ` · ${timeAgo(room.lastPostAt, t)}` : null}
        </Text>
        {room.faces.length ? (
          <View style={{ flexDirection: "row", marginTop: "auto" }}>
            {room.faces.slice(0, 3).map((f, i) => (
              <View key={f.id} style={{ marginStart: i ? -8 : 0, borderWidth: 2, borderColor: tokens.surface, borderRadius: 16 }}>
                <Avatar uri={f.hide_name ? null : f.avatar_url} size={28} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {room.airing ? <AiringBadge airing={room.airing} /> : null}
    </Pressable>
  );
  if (general)
    return (
      <View>
        {card}
        <View pointerEvents="none" style={{ position: "absolute", top: 8, end: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>
          <Icon name="pin-filled" size={17} color={tokens.accent} />
        </View>
      </View>
    );
  if (!pin || (pin.readOnly && room.pin !== 2)) return card;
  const level = pin.admin ? 2 : 1;
  /* درجتا التثبيت (D-301/D-314): لوبز ثمّ أنا — وما ثبّتته لوبز علامةٌ لا تُضغط لغير الإدارة */
  const lockedByLoopz = !pin.admin && room.pin === 2;
  const on = lockedByLoopz || room.pin === level;
  const label = lockedByLoopz ? t.talkPinnedByLoopz : pin.admin ? (on ? t.talkUnpinAll : t.talkPinAll) : on ? t.talkUnpin : t.talkPin;
  return (
    <View>
      {card}
      <Pressable
        onPress={() => pin.onPin(room)}
        disabled={lockedByLoopz}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
        style={({ pressed }) => ({ position: "absolute", top: 8, end: 8, width: 30, height: 30, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.9 : 1 }] })}
      >
        <Icon name={on ? "pin-filled" : "pin"} size={17} color={on ? tokens.accent : tokens.fg + "B3"} />
      </Pressable>
    </View>
  );
});

/**
 * 🆕 R56 — **شارةُ «يعرض الآن»** في زاوية البطاقة السفلى من جهة النهاية (أحمد ٢١ أكتوبر: «يمين تحت داخل ايطار العمل»؛ «ج»):
 * نقطةٌ خضراءُ وموعدُ القادمة («الأحد» إن كانت خلال أسبوع، وإلّا التاريخ)، ويومَ النزول أو بعده بيومٍ شارةٌ خضراءُ برقم الحلقة.
 * لونُ النجاح الواحد (القاعدة ٣)، والخلفيّةُ معتمةٌ لتُقرأ فوق أيّ غلاف.
 */
function AiringBadge({ airing }: { airing: NonNullable<CommunityRoom["airing"]> }) {
  const { t, tokens, locale } = useApp();
  const today = new Date().toISOString().slice(0, 10);
  const day = (d: string) => {
    const days = Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    return days <= 6 ? new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "ar" ? "ar" : "en", { weekday: "short", timeZone: "UTC" }) : formatDateShort(d, t);
  };
  const out = airing.out != null;
  /* 🆕 R57 — «On break» رماديّة: في القسم مع ما يعرض، لكنّها لا تدّعي حلقةً قريبة */
  const pause = !!airing.pause;
  const label = out ? t.talkAiringOut(airing.out!) : pause ? t.talkAiringBreak : airing.next === today ? t.talkAiringToday : airing.next ? t.talkAiringNext(day(airing.next)) : t.talkAiringNow;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", bottom: 10, end: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: out ? tokens.success : "rgba(0,0,0,0.6)", borderWidth: out ? 0 : 1, borderColor: pause ? "rgba(255,255,255,0.35)" : tokens.success }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: out ? "#04120A" : pause ? "rgba(255,255,255,0.55)" : tokens.success }} />
      <Text size={12} weight="800" color={out ? "#04120A" : pause ? "rgba(255,255,255,0.8)" : "#E9FBEF"} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** بطاقةُ شخصٍ في اللوحة — `PeopleLeaderboard` الويب: وجهٌ · اسمٌ · الرقمُ وتفصيلُه (D-219/D-275) */
/** 🆕 M2 — زاويةُ المتابعة (`FollowUserButton variant="corner"`، D-281): في «عرض الكل» وحدَه، ولا على وجهك */
export type LeaderFollow = { state: FollowState; onPress: () => void } | null;

export function LeaderCard({ p, mode, rank, doors, follow = null }: { p: CommunityLeaderRow; mode: "featured" | "top" | "rising"; rank: number; doors: CardDoors; follow?: LeaderFollow }) {
  const { t, tokens, locale } = useApp();
  const who = displayNameOf(p, t.anonymousUser);
  const path = profileHref(p);
  const medal = rank === 1 ? tokens.accent : rank === 2 ? "#C8CCD4" : rank === 3 ? "#B77B45" : null;
  return (
    <Pressable onPress={() => path && doors.onWeb(path)} disabled={!path} style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radius.card, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
      <View>
        <Avatar uri={p.hide_name ? null : p.avatar_url} size={52} />
        {mode === "top" && medal ? (
          <View style={{ position: "absolute", bottom: -2, start: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: medal, alignItems: "center", justifyContent: "center" }}>
            <Text size={11} weight="700" color="#000">{num(rank, locale)}</Text>
          </View>
        ) : null}
        {follow ? (
          /* الزاويتان متقابلتان فلا تصطدم بالميداليّة: هذه `top-end` وتلك `bottom-start` · ٢٦ تُرى و٤٤ تُلمس */
          <Pressable
            onPress={follow.onPress}
            hitSlop={9}
            accessibilityRole="button"
            accessibilityLabel={follow.state === "following" ? t.followingUser : follow.state === "requested" ? t.followRequested : t.followUser}
            style={{ position: "absolute", top: -4, end: -4, width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: tokens.bg, alignItems: "center", justifyContent: "center", backgroundColor: follow.state === "none" ? tokens.accent : tokens.surface2 }}
          >
            <Icon name={follow.state === "following" ? "check" : follow.state === "requested" ? "clock" : "plus"} size={14} color={follow.state === "none" ? tokens.onAccent : tokens.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, maxWidth: "100%" }}>
        <Text size={13} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{who}</Text>
        {p.hide_name ? null : <IdentityBadges flags={identityFlags(p)} nameSize={12} />}
      </View>
      <Text size={12} weight="700" color={mode === "rising" ? tokens.success : tokens.accent}>
        {mode === "rising" ? t.peopleBoardDelta(p.total - p.prevTotal) : t.peopleBoardActions(p.total)}
      </Text>
      <Text size={10} muted numberOfLines={1}>
        {mode === "rising" ? t.peopleBoardVsLast(p.total, p.prevTotal) : t.peopleBoardBreakdown(p.posts, p.reviews)}
      </Text>
    </Pressable>
  );
}

/** أعلى التعليقات إعجاباً — `TopReviews` الويب: الغلافُ خلفها، والوجهُ في البداية، والملصقُ في النهاية */
export function TopReviewCard({ r, doors }: { r: CommunityTopReview; doors: CardDoors }) {
  const { t, tokens } = useApp();
  const [reveal, setReveal] = useState(false);
  const who = displayNameOf(r, t.anonymousUser);
  const bg = backdropUrl(r.backdropPath, "w780");
  const poster = posterFor(r.posterPath, 72);
  const reviewPath = `/review/${r.mediaType}/${r.tmdbId}/${r.id}`;
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
      {bg ? <Image source={{ uri: bg }} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, opacity: 0.3 }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={() => { const p = profileHref(r); if (p) doors.onWeb(p); }}>
            <Avatar uri={r.hide_name ? null : r.avatar_url} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{who}</Text>
              {r.hide_name ? null : <IdentityBadges flags={identityFlags(r)} nameSize={14} />}
              <Text size={12} muted style={{ marginStart: "auto" }}>{timeAgoShort(r.createdAt, t)}</Text>
            </View>
            <Pressable onPress={() => doors.onTitle(r.mediaType, r.tmdbId)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text size={12} muted numberOfLines={1} style={{ flexShrink: 1 }}>{r.title}</Text>
              {r.rating > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                  <Icon name="star-filled" size={12} color={tokens.accent} />
                  <Text size={13} weight="700" color={tokens.accent} style={{ writingDirection: "ltr" }}>{r.rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
        {r.hasSpoiler && !reveal ? (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" }}>
            <Icon name="eye-off" size={14} color={tokens.muted} />
            <Text size={13} muted>{t.spoilerMark}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => doors.onWeb(reviewPath)} style={{ marginTop: 8 }}>
            <Text size={14} content numberOfLines={3} style={{ lineHeight: 21 }}>{r.review}</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Icon name="heart-filled" size={13} color={tokens.muted} />
          <Text size={12} muted>{t.peopleBoardLikes(r.likes)}</Text>
        </View>
      </View>
      <Pressable onPress={() => doors.onTitle(r.mediaType, r.tmdbId)} style={{ width: 72, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2, alignSelf: "flex-start" }}>
        {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      </Pressable>
    </View>
  );
}
