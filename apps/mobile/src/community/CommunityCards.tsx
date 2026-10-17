import React, { memo, useState } from "react";
import { talkActivity } from "@/core/talkSort";
import { I18nManager, Pressable, View } from "react-native";
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
import { timeAgoShort } from "@/core/when";
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
/**
 * 🆕 D-1448 — **ستّةُ أسطرٍ لا أربعة**، والملصقُ يطول معها (أحمد ١٧ أكتوبر بأربع لقطات: «البوستر أصغر ارتفاع له مساوي لـ٣ أسطر
 * وأطول ارتفاع له ٦ أسطر ويظهر بعدها المزيد»). العدُّ من النسخة غير المرئيّة نفسِها (`onLines`) — مرّةً واحدة، فلا يتذبذب
 * الملصقُ مع عرض العمود الذي يضيّقه هو.
 */
const CLAMP_LINES = 6;
/** 🆕 D-1449 — خطُّ الكلام ١٦ لا ١٤ («كبّره شوي بحيث نبرز التعليق») — والسطرُ ٢٤ */
const TEXT_SIZE = 16;
const LINE_H = 24;
/** الفرقُ بين أعرض الملصق (ستّة أسطر) وأضيقه (ثلاثة) — `(126 − 63) × ⅔` */
const MEASURE_INSET = Math.round(((CLAMP_LINES - 3) * LINE_H * 2) / 3);

/** جهةُ الكلام من أوّل حرفٍ قويّ: عربيٌّ/عبريٌّ ⇒ يمين، لاتينيٌّ ⇒ يسار، ولا حرف ⇒ جهةُ الواجهة */
export function textIsRtl(text: string): boolean {
  const strong = /[A-Za-z֐-ࣿ]/.exec(text)?.[0] ?? "";
  return strong ? !/[A-Za-z]/.test(strong) : I18nManager.isRTL;
}

function ClampedText({ text, onPress, onLines }: { text: string; onPress: () => void; onLines?: (n: number) => void }) {
  const { t } = useApp();
  const [long, setLong] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const rtl = textIsRtl(text);
  return (
    <View>
      <Pressable onPress={onPress}>
        <Text size={TEXT_SIZE} content numberOfLines={open ? undefined : CLAMP_LINES} style={{ lineHeight: LINE_H }}>{text}</Text>
      </Pressable>
      {long === null ? (
        <Text
          size={TEXT_SIZE}
          content
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(e) => {
            const n = e.nativeEvent.lines.length;
            setLong(n > CLAMP_LINES);
            onLines?.(n);
          }}
          /* يُقاس بأضيق عرضٍ يبلغه العمود (حين يطول الملصق إلى ستّة أسطر): «المزيد» قد يظهر زائداً ولا يُقصّ نصٌّ بلا باب */
          style={{ lineHeight: LINE_H, position: "absolute", start: 0, end: MEASURE_INSET, top: 0, opacity: 0 }}
        >
          {text}
        </Text>
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
/** 🆕 D-1449 — وجهُ بطاقة الخطّ أكبرُ قليلاً من الوجه العامّ (الصورة المرجعيّة) */
const FACE = 46;

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
  /** 🆕 D-1448 — ⋯ في زاوية البطاقة: الورقةُ يملكها المستدعي (`FeedMenu`) */
  menu: (row: CommunityFeedRow) => void;
};

/**
 * 🆕 M2 — **الذيلُ** (`RowComment` + `LikeButton` + `StatChip` + `ShareTitleButton`) موزَّعاً بعرض العمود (`justify-between`):
 * - **القلبُ** رمزٌ وكلمةٌ ورقم (D-294 المنقوض: «رجّعها»)، والصفرُ لا يُرسم (D-219)، ولونُ التمييز حين أعجبك (`actionTailItem`).
 *   **ورأيُك أنت رقمٌ بلا زرّ** (لا يُعجب المرءُ بنفسه) — **وكذلك الزائر** (`readOnly`، D-221).
 * - **«تعليق»** رمزٌ وكلمةٌ ورقمُ الردود — وفي صفّ القائمة بابُ صفحتها (الخيطُ يسكن تبويبَ تقييماتها، D-333).
 * - **المشاهداتُ** رقمٌ يُقرأ (`StatChip`: باهتٌ على الصفر) · **المشاركةُ** رمزٌ عارٍ — ولا مشاهداتَ ولا مشاركةَ لصفِّ قائمة (D-370).
 * ⚠️ **٤٤ تُلمس** وإن رُسم الرمزُ ١٦ (`hitSlop` + حشوة، D-033).
 */
function Tail({ row, acts, onList, share }: { row: CommunityFeedRow; acts: CardActs; onList?: () => void; share?: { path: string; title: string } }) {
  const { t, tokens, locale } = useApp();
  const { likes, liked } = likeOf(row);
  const mine = row.kind === "comment" && row.item.person.id === acts.meId;
  const readOnly = mine || !acts.signedIn;
  const replies = row.kind === "comment" && row.item.listId ? row.list_social?.replies ?? 0 : row.replies;
  const views = row.kind === "comment" && row.item.listId ? null : row.views;
  const pad = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingVertical: 8, paddingHorizontal: 10, minHeight: 36 };
  const heartColor = liked ? tokens.accent : tokens.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 4, marginHorizontal: -10 }}>
      {readOnly ? (
        likes > 0 ? (
          <View style={pad} accessibilityLabel={`${t.likesLabel}: ${likes}`}>
            <Icon name="heart" size={16} color={tokens.muted} />
            <Text size={12} muted>{t.likesLabel}</Text>
            <Text size={12} muted style={{ fontVariant: ["tabular-nums"] }}>{num(likes, locale)}</Text>
          </View>
        ) : null
      ) : (
        <Pressable onPress={() => acts.like(row)} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={t.likesLabel} style={pad}>
          <Icon name={liked ? "heart-filled" : "heart"} size={16} color={heartColor} />
          <Text size={12} color={heartColor}>{t.likesLabel}</Text>
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
        <Text size={12} muted>{onList ? t.talkReply : t.actionComment}</Text>
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

/**
 * 🆕 D-1448 — **ارتفاعُ الملصق بين ثلاثة أسطرٍ وستّة** والعرضُ يتبعه (٢:٣)؛ و**الداكنُ بلا بديل** (`poster_dark` من الخادم —
 * `lib/vividPoster`) يأخذ إطاراً رفيعاً بلون النصّ فلا يذوب في الخلفيّة (قرارُ أحمد «٢ أ»).
 */
const POSTER_MIN_H = 3 * LINE_H;
const POSTER_MAX_H = CLAMP_LINES * LINE_H;
const posterH = (rows: number) => Math.min(POSTER_MAX_H, Math.max(POSTER_MIN_H, rows * LINE_H));

function RowPoster({ path, kind, lib, height, dark = false, onPress }: { path: string | null; kind: "tv" | "movie"; lib: CommunityFeedRow["lib"]; height: number; dark?: boolean; onPress: () => void }) {
  const { tokens } = useApp();
  const width = Math.round((height * 2) / 3);
  const uri = posterFor(path, POSTER_W);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      style={{ width, height, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface2, borderWidth: dark ? 1 : 0, borderColor: tokens.fg + "59" }}
    >
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
 * 🆕 D-1448 · D-1449 — **هيكلُ البطاقة** كالصورة المرجعيّة (أحمد ١٧ أكتوبر: «مساحة تحت صورة الشخصيّة — المدّة يسار الثلاث نقاط
 * — اسم الفلم والتقييم تحت الاسم — خطّ المحتوى أكبر»):
 * - الوجهُ وحدَه في عموده، **وكلُّ ما سواه عمودٌ يبدأ من بداية الاسم** — الكلامُ والملصقُ والذيل؛ فما تحت الوجه فارغ.
 * - السطرُ الأوّل: الاسمُ وشاراتُه، وفي الزاوية العمرُ ثمّ ⋯.
 * - السطرُ الثاني (`sub`): اسمُ العمل و★ التقييم.
 * الرأسُ بجهة الواجهة دائماً؛ الجسمُ وحدَه يتبع جهةَ الكلام.
 */
function CardShell({ face, name, badges, when, sub, onWho, onWhen, onMenu, children }: { face: React.ReactNode; name: string; badges?: React.ReactNode; when: string; sub?: React.ReactNode; onWho?: () => void; onWhen?: () => void; onMenu: () => void; children: React.ReactNode }) {
  const { t, tokens } = useApp();
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
      <Pressable onPress={onWho} disabled={!onWho} accessibilityRole="link" accessibilityLabel={name} style={{ alignSelf: "flex-start" }}>
        {face}
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable onPress={onWho} disabled={!onWho} style={{ flexShrink: 1 }}>
            <Text size={15} weight="700" numberOfLines={1} style={{ lineHeight: 20 }}>{name}</Text>
          </Pressable>
          {badges}
          <Pressable onPress={onWhen} disabled={!onWhen} hitSlop={6} style={{ marginStart: "auto", paddingStart: 8 }}>
            <Text size={12} muted>{when}</Text>
          </Pressable>
          <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.moreMenuTitle} style={({ pressed }) => ({ width: 26, height: 20, alignItems: "center", justifyContent: "center", marginEnd: -4, opacity: pressed ? 0.5 : 1 })}>
            <Icon name="dots" size={18} color={tokens.muted} />
          </Pressable>
        </View>
        {sub}
        {children}
      </View>
    </View>
  );
}

/**
 * 🆕 D-1448 — **الجسم**: الكلامُ والملصقُ في صفٍّ واحد، **والملصقُ في نهاية سطر الكلام**: عربيٌّ ⇒ يسار، إنجليزيٌّ ⇒ يمين
 * — أيّاً كانت لغةُ الواجهة (لقطاتُ أحمد). الصفُّ يُقلب بـ`row-reverse` حين تخالف جهةُ الكلام جهةَ الواجهة.
 */
function Body({ rtl, children, poster }: { rtl: boolean; children: React.ReactNode; poster: React.ReactNode }) {
  return (
    <View style={{ flexDirection: rtl === I18nManager.isRTL ? "row" : "row-reverse", alignItems: "flex-start", gap: 12, marginTop: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {poster}
    </View>
  );
}

export const FeedCard = memo(function FeedCard({ row, doors, acts }: { row: CommunityFeedRow; doors: CardDoors; acts: CardActs }) {
  const { t, tokens, locale } = useApp();
  const [reveal, setReveal] = useState(false);
  /* «النص الأصلي» ⇄ «الترجمة» (`FeedReviewText`، D-307) — حالةُ ضغطةٍ في البطاقة لا تفضيل */
  const [original, setOriginal] = useState(false);
  /* أسطرُ الكلام كما قيست مرّةً (`ClampedText`) — تحدّد طولَ الملصق */
  const [lines, setLines] = useState(0);
  const titleDoor = () => (row.kind === "comment" && row.item.listId ? doors.onList(row.item.listId) : doors.onTitle(row.item.media_type, row.item.tmdb_id));
  const menu = () => acts.menu(row);

  if (row.kind === "news") {
    const n = row.item;
    const post = `/post/${encodeURIComponent(n.key)}`;
    return (
      <CardShell
        face={
          <View style={{ width: FACE, height: FACE, borderRadius: FACE / 2, overflow: "hidden", backgroundColor: tokens.surface2 }}>
            <Image source={require("../../assets/loopz-mark.png")} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          </View>
        }
        name="Loopz"
        when={timeAgoShort(n.published_at, t)}
        sub={
          <Pressable onPress={() => doors.onTitle(n.media_type, n.tmdb_id)} style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
            <Text size={12} weight="500" muted numberOfLines={1} style={{ lineHeight: 16, marginTop: 1 }}>{n.title} · {n.media_type === "tv" ? t.typeSeries : t.typeMovie}</Text>
          </Pressable>
        }
        onWho={() => doors.onWeb(`/u/${LOOPZ_USERNAME}`)}
        onWhen={() => doors.onWeb(post)}
        onMenu={menu}
      >
        <Body
          rtl={textIsRtl(row.line)}
          poster={<RowPoster path={n.poster_path} kind={n.media_type} lib={row.lib} height={posterH(lines + (row.source ? 1 : 0))} dark={row.poster_dark} onPress={() => doors.onTitle(n.media_type, n.tmdb_id)} />}
        >
          <Pressable onPress={() => doors.onWeb(post)}>
            <Text size={TEXT_SIZE} weight="600" content numberOfLines={CLAMP_LINES} onTextLayout={lines ? undefined : (e) => setLines(e.nativeEvent.lines.length)} style={{ lineHeight: LINE_H }}>{row.line}</Text>
          </Pressable>
          {row.source ? (
            <Text size={12} muted style={{ marginTop: 4 }}>{t.newsPerSource(row.source.name)}</Text>
          ) : null}
        </Body>
        <View style={{ marginTop: 10 }}>
          <Tail row={row} acts={acts} share={{ path: `/${n.media_type === "tv" ? "show" : "movie"}/${n.tmdb_id}`, title: n.title }} />
        </View>
      </CardShell>
    );
  }

  const a = row.item;
  const isList = !!a.listId;
  const who = displayNameOf(a.person, t.anonymousUser);
  const whoPath = profileHref(a.person);
  const reviewPath = isList ? null : `/review/${a.media_type}/${a.tmdb_id}/${a.person.id}`;
  const rowTitle = isList ? curatedName(a.listSlug, a.title ?? "", locale === "en" ? "en" : "ar") : a.title;
  /* المحجوبُ لا يُترجَم (D-315) — والخادمُ لا يرسل له ترجمة أصلاً */
  const translated = isList ? null : row.translated;
  const text = translated && !original ? translated : a.review ?? "";
  const hidden = a.hasSpoiler && !reveal;
  const openText = () => (isList && a.listId ? doors.onList(a.listId) : reviewPath ? doors.onWeb(reviewPath) : undefined);
  const cover = isList && a.listCover ? backdropUrl(a.listCover, "w300") : null;
  /* جهةُ الجسم من الكلام نفسِه؛ والمحجوبُ أو الفارغُ من اسم العمل */
  const rtl = textIsRtl(hidden || !text ? rowTitle ?? "" : text);
  /* أسطرُ الكلام (المقصوصةُ عند ستّة) — والمحجوبُ ثلاثةٌ: الحدُّ الأدنى */
  const rows = hidden || !text ? 0 : Math.min(lines, CLAMP_LINES);

  return (
    <CardShell
      face={<Avatar uri={a.person.hide_name ? null : a.person.avatar_url} size={FACE} />}
      name={who}
      badges={a.person.hide_name ? null : <IdentityBadges flags={identityFlags(a.person)} nameSize={15} />}
      when={timeAgoShort(a.updated_at, t)}
      sub={
        /* D-1449 — اسمُ العمل ثمّ ★ التقييم تحت الاسم (الصورة المرجعيّة) */
        /* D-1450 — أصغرُ من الاسم وملاصقٌ له (لقطةُ أحمد ٤:١٠): سطرٌ ثانٍ هادئ لا عنوانٌ ثانٍ */
        <Pressable onPress={titleDoor} hitSlop={4} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%", marginTop: 1 }}>
          {isList ? <Icon name="list" size={12} color={tokens.muted} /> : null}
          <Text size={12} weight="500" muted numberOfLines={1} style={{ flexShrink: 1, lineHeight: 16 }}>{rowTitle}</Text>
          {a.rating != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Icon name="star-filled" size={11} color={tokens.accent} />
              <Text size={12} weight="700" color={tokens.accent} style={{ writingDirection: "ltr", lineHeight: 16 }}>{a.rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </Pressable>
      }
      onWho={whoPath ? () => doors.onWeb(whoPath) : undefined}
      onWhen={openText}
      onMenu={menu}
    >
      <Body
        rtl={rtl}
        poster={
          !isList ? (
            <RowPoster path={a.poster_path} kind={a.media_type} lib={row.lib} height={posterH(rows)} dark={row.poster_dark} onPress={titleDoor} />
          ) : cover ? (
            <Pressable onPress={titleDoor} style={{ width: POSTER_W, aspectRatio: 16 / 9, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
              <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ) : null
        }
      >
        {hidden ? (
          <Pressable onPress={() => setReveal(true)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: tokens.surface2 }}>
            <Icon name="eye-off" size={14} color={tokens.muted} />
            <Text size={13} muted>{t.spoilerMark}</Text>
          </Pressable>
        ) : text ? (
          <View>
            <ClampedText key={text} text={text} onPress={openText} onLines={setLines} />
            {translated ? (
              <Pressable onPress={() => setOriginal((v) => !v)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 4 }}>
                <Text size={12} weight="700" muted>{original ? t.showTranslation : t.showOriginalText}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </Body>

      {/* المسافةُ تحت الملصق قبل الذيل (الصورة المعتمدة) */}
      <View style={{ marginTop: 10 }}>
        {isList ? (
          <Tail row={row} acts={acts} onList={() => a.listId && doors.onList(a.listId)} />
        ) : (
          <Tail row={row} acts={acts} share={{ path: `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`, title: a.title ?? "" }} />
        )}
      </View>
    </CardShell>
  );
});
/** غرفةُ نقاش — `TalkRoomCard` الويب: الملصقُ في البداية، والغلافُ خلفها باهتاً، والعنوانُ المولَّد هو البطاقة */
/**
 * 🆕 M2 — **دبّوسُ الغرفة** (`RoomPinButton` · `Wrap` في `WorksTalk`): **الإدارةُ** دبّوسُها للجميع ويحلّ محلَّ الشخصيّ (D-314) ·
 * **المثبَّتةُ من لوبز** علامةٌ لا زرّ لغير الإدارة (D-217) · **وغيرُها** دبّوسُك (D-301). **ولا دبّوسَ في بطاقة اللوحة** (`hero`:
 * ليست قائمةً تُرتَّب) **ولا للزائر**. والدبّوسُ أخو البطاقة لا ابنُها — ضغطتُه لا تفتح الغرفة (D-155).
 */
/** `readOnly` = الزائر: لا دبّوسَ له، وتبقى علامةُ لوبز وحدَها (`globalPinned` في `Wrap`) */
export type RoomPin = { admin: boolean; readOnly: boolean; onPin: (room: CommunityRoom) => void } | null;

export const RoomCard = memo(function RoomCard({ room, doors, hero = false, pin = null, activity = false }: { room: CommunityRoom; doors: CardDoors; hero?: boolean; pin?: RoomPin; activity?: boolean }) {
  const { t, tokens, locale } = useApp();
  const poster = posterFor(room.posterPath, hero ? 78 : 64);
  const bg = backdropUrl(room.backdropPath, "w780");
  const title = t.talkRoomTitle(room.title?.trim() || "", room.mediaType === "tv");
  const card = (
    <Pressable
      onPress={() => doors.onWeb(`/talk/${room.mediaType}/${room.tmdbId}`)}
      accessibilityRole="link"
      style={({ pressed }) => ({ flexDirection: "row", gap: 14, padding: hero ? 16 : 14, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, transform: [{ scale: pressed ? 0.99 : 1 }] })}
    >
      {/* 🔴 D-1201-fix — **الخلفيّةُ داخل قاطعٍ بحوافّ البطاقة نفسِها** (لقطةُ أحمد ٣٠ سبتمبر: بطاقةُ Ted Lasso مقصوصةٌ وشريطٌ من
          خلفيّتها خارجها): على أندرويد `overflow: hidden` في عنصرٍ يحمل `transform` (ضغطةُ `scale`) لا يقصّ ابنَه المطلقَ دائماً —
          فصارت الصورةُ ابنةَ `View` مستقلٍّ بـ`borderRadius` نفسِه وقصّه. الشكلُ كما هو. */}
      {bg ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: radius.card, overflow: "hidden" }}>
          <Image source={{ uri: bg }} style={{ width: "100%", height: "100%", opacity: 0.35 }} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      ) : null}
      <View style={{ width: hero ? 78 : 64, aspectRatio: 2 / 3, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
        {poster ? <Image source={{ uri: poster }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          <Text size={hero ? 16 : 15} weight="700" numberOfLines={2} style={{ flex: 1, marginEnd: pin && !(pin.readOnly && room.pin !== 2) ? 28 : 0 }}>{title}</Text>
        </View>
        {room.bulletin_line ? <Text size={12} color={tokens.accent} numberOfLines={1}>{room.bulletin_line}</Text> : null}
        <Text size={12} muted numberOfLines={1}>
          {/* 🆕 D-1201 — مع «الأكثر تفاعلاً» الرقمُ رقمُ الترتيب (تفاعلُ الأسبوع) — وإلّا بدا الترتيبُ عشوائيّاً */}
          {activity ? t.talkRoomActivityMonth(talkActivity(room)) : hero && room.postsWeek > 0 ? t.talkRoomPostsWeek(room.postsWeek) : t.talkRoomPosts(room.posts)}
          {/* 🔴 D-1207 — «آخر مشاركة» من مشاركات الأعضاء لا من إشعار الحلقة؛ غرفةٌ بلا مشاركةٍ لا تقول وقتاً */}
          {room.lastPostAt ? ` · ${t.talkRoomLastAt(timeAgoShort(room.lastPostAt, t))}` : null}
        </Text>
        {room.faces.length ? (
          <View style={{ flexDirection: "row", marginTop: "auto", paddingTop: 6 }}>
            {room.faces.slice(0, 5).map((f, i) => (
              <View key={f.id} style={{ marginStart: i ? -8 : 0, borderWidth: 2, borderColor: tokens.surface, borderRadius: 14 }}>
                <Avatar uri={f.hide_name ? null : f.avatar_url} size={24} />
              </View>
            ))}
            {room.posts > 5 ? <Text size={11} muted style={{ alignSelf: "center", marginStart: 6 }}>{num(room.posts, locale)}</Text> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
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
