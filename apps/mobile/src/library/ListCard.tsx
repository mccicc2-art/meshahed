import React, { useEffect, useRef, useState } from "react";
import { I18nManager, PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { SYSTEM_FONT_CAP, useFontScale } from "../fontScale";
import { MarqueeText } from "./MarqueeText";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius, tokensOf, type Tokens } from "../theme";
import { Icon } from "../icons";
import { posterFor } from "../poster";
import { avatarSource } from "../avatarSource";
import { qk, queryClient, write } from "../api";
import { haptic } from "../haptics";
import type { LikeListBody, SaveListBody } from "@/core/contracts/library";
import { num } from "@/core/i18n";
import { themeById, themeScheme } from "@/core/themes";

/**
 * ====== بطاقةُ القائمة — نسخةُ `ListCardShell` (الويب، D-677) بالبكسل ======
 * (D-947 — تبويبُ «قوائم» أصليّاً)
 *
 * 🔑 **تشريحُ البطاقة كما رسمه أحمد** (D-677): الملصقاتُ الثلاثة (أو الغلافُ
 * المختار) **أرضيّةُ البطاقة كلِّها من جهة النهاية**، حجابٌ بلون السطح من جهة
 * البداية يذوب إلى الصفر عند ٦٠٪ (D-686 — «خلّه ذكيّ حول الكلام»)، الاسمُ
 * عريضاً بسطرين، وجهُ الصاحب واسمُه، سطرُ العدّ، **وشريطُ الحال في القاع**:
 * ♥ الحفظ · 💬 الآراء · ★ التقييم — والصفرُ لا يُطبع (T602 أعاد D-219) — **ورقاقةُ التشغيل في طرفه** (D-674).
 *
 * 📐 المقاسات بأسماء الويب: `rounded-2xl` ١٤ (`--radius-card`) · `min-h-[10.5rem]` ١٦٨ · حشوة
 * `p-3.5` ١٤ · الاسم `text-15 font-bold` · السطور `text-12` · الملصقاتُ `w-[72%]`
 * · الرقاقة `h-7 ps-3 pe-1.5 text-12 font-bold` · هالةُ العنقود `rounded-full
 * bg-surface/70 px-2 py-1`.
 *
 * 🔑 **والحجابُ صورةٌ ألفا تُلوَّن بلون أرضيّة البطاقة** (`tintColor`، `bg` منذ D-1081) — **فيصحّ في
 * `daylight` من الرمز لا من رقمٍ أصمّ**، ويُقلب في RTL لأنّ اتّجاهَه اتّجاهُ
 * القراءة (القاعدة ١٧). لا حزمةَ تدرّجٍ جديدة (وصفةُ `poster-veil` نفسُها).
 */
/* 🆕 D-1135 — **حجابان بالثيم** (أحمد بصورتين معتمدتين: «اعتمد ذي الثنتين للدارك وللنهاري»، بعد «السواد مغطّي
   عالبوستر .. جرّبت نهاري وجاي مزعج»). كان حجاباً واحداً صلباً حتى ٣٠٪ يذوب إلى الصفر عند ٦٠٪ — فيأكل الملصقَ الأوّل
   في الداكن ويصير ضباباً أبيضَ ساطعاً في «النهاري».
   • الداكن: الملصقاتُ في مكانها (`72%` من النهاية)، والحجابُ صلبٌ على عمود الكلام وحده (٠–٢٧٪) ثمّ **شبهُ شفّاف** فوقها:
     ٥٥٪ عند ٢٩٪ · ٣٥٪ عند ٤٢٪ · صفرٌ عند ٦٠٪.
   • الفاتح: **الملصقاتُ على البطاقة كلِّها**، والحجابُ أبيضُ ٧٥٪ لا صلب (٠–٣٠٪) · ٤٠٪ عند ٤٥٪ · صفرٌ عند ٦٠٪ — شيءٌ
     تحت الكلام يكسر سطوعَ الأبيض، وهو ما طلبه («الأبيض ساطع جدّاً، خلّه أخفّ»).
   كلاهما ألفا تُلوَّن بـ`tokens.bg` كما كان (D-1081)، ويُقلبان في RTL. */
/* ⚖️ 🆕 D-1257 — **البطاقةُ داكنةٌ في «النهاري» أيضاً** (أحمد بلقطة، ٣ أكتوبر ٢٠٢٦: «الأبيض وهو مغطّي عالعمل مزعج شوي»؛
   عُرض عليه تخفيفُ الحجاب إلى ٦٠٪ بصورة فاختار الثالث: «نفّذ 3») — ينقض شطرَ «الفاتح» من D-1135 بكلمة صاحبه.
   الحجابُ الأبيضُ فوق صورةٍ يبقى ضباباً مهما خُفِّف، وتخفيفُه يُضعف سطرَ العدّ. **فبطاقةُ الثيم الداكن نفسُها تُرسم
   داخل الصفحة الفاتحة**: أرضيّةٌ داكنة، عمودُ كلامٍ صلب، ملصقاتٌ بألوانها في ٧٢٪، ونصٌّ أبيض — كبطاقات «أكمل
   المشاهدة» فوقها، وهي داكنةٌ في «النهاري» أصلاً. **اللوحةُ لوحةُ الثيم الرسميّ** (`tokensOf(null)`) لا أرقامٌ صمّاء،
   ويلبسها ما في داخل البطاقة كلُّه (الرقاقةُ والفاصلُ معها)؛ الحدُّ وحدَه من ثيم الصفحة. حجابٌ واحدٌ بقي. */
/* 🆕 T602 (q32 «أ» · q27) — **لا كلامَ فوق صورةٍ مزدحمة**: الحجابُ صلبٌ تحت عمود الكلام كلِّه (٠–٥٠٪) ثمّ يذوب حتى ٧٠٪،
   والكلامُ لا يتجاوز نصفَ البطاقة — كان «أفلام ديفيد فينشر» يذوب في شعار ALIEN لأنّ نصفَ الاسم فوق حجابٍ شبهِ شفّاف.
   والغلافُ المختار في جهة النهاية بعرض الملصقات (٧٢٪) لا تحت البطاقة كلِّها: الحجابُ مقيسٌ على الملصقات، فكان الغلافُ
   الكامل يُظهر صورتَه تحت الاسم. الصورةُ المعتمدة في الاستوديو: «البطاقةُ نفسها بلا زحمة».
   ↪️ T606 — الحجابُ صار يذوب في ٥٠–٥٥٪ (لا ٧٠٪)، والملصقان والغلافُ في النصف الحرّ (٥٠٪): ما بين ٥٠ و٧٢ كان يخفي الملصقَ الأوّل. */
const VEIL_DARK = require("../../assets/list-veil-dark.png");
/* 🆕 T608 (q57 «ب» — أحمد ٢٨ نوفمبر: «الارتفاع قلّله والعرض زوّده») — **قامةٌ ثابتةٌ ١٥٤ لا حدٌّ أدنى ١٧٦**، وعرضُ الصفوف ٣٣٠ لا ٢٦٠/٢٨٠:
   ثابتةٌ كي لا تختلف بطاقاتُ الصفّ الواحد (كانت `minHeight` فتطول بطاقةٌ بكلامها). والعرضُ ثابتٌ مشتركٌ تستورده الصفوفُ كلُّها
   (اكتشف والرئيسيّة والمجتمع والملفّ) لا رقماً في كلّ ملفّ. ومكتبتي عمودٌ بعرض الشاشة تأخذ القامةَ نفسَها. */
export const LIST_CARD_W = 330;
export const LIST_CARD_H = 154;
/** T608 — عرضُ بطاقة الصفّ: ٣٣٠ ويُقصّ على الشاشة الضيّقة فتبقى ٥٦ للهامش وطرف البطاقة التالية (وصفةُ «اكتشف» منذ D-955) */
export function useListCardW() {
  const { width } = useWindowDimensions();
  return Math.min(LIST_CARD_W, width - 56);
}
const PAD = 14;
/* T608 — **ملصقان بعرض ٧٢** (وثلاثةٌ في «مكتبتي»، T619) في شريطٍ ثابتٍ من جهة النهاية (لا نسبةٌ من البطاقة): الشريطُ نفسُه في بطاقة ٣٣٠ وبطاقة الشاشة الكاملة،
   فيبقى الملصقُ بقامته ولا يتمطّط في المكتبة. والكلامُ لا يدخل الشريط (حشوةُ النهاية) فلا تقع الأرقامُ فوق الملصق */
const POSTER_W2 = 72;
/* 🆕 T619 (س٦٠ «ج» — أحمد ٢٨ نوفمبر: «أساسنا أفضل لكن أحتاج تكون ٣ بوسترات بدل ٢») — في «مكتبتي» البطاقةُ بعرض الشاشة، فثلاثةٌ بعرض ٦٤
   (شريطٌ ١٩٢) ويبقى للكلام نحو ١٤٠؛ وتحت ٤٠٠ (آيفون ٣٩٠ · أندرويد ٣٦٠–٣٨٤) بعرض ٥٦ كي يبقى لعنقود ♥ 💬 ★ نحو ١٥٠ فلا تُقصّ النجمة
   (مراجعةُ أندرويد). الصفوفُ (٣٣٠) تبقى بملصقين بعرض ٧٢ كما اعتمد في س٥٧ «ب» */
const POSTER_W3 = 64;
const POSTER_W3_NARROW = 56;
/* الحجابُ ٢٠٠ عرضاً: صلبٌ في نصفه ويذوب في ١٠ — يوضع فيذوب على أوّل ١٠ من الشريط (حافّةٌ ناعمةٌ بين الكلام والملصق) */
const VEIL_W = 200;

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
  stats: { saves: number; likes?: number; reviews: number; rating: number | null } | null;
  /** `null` = لا مفتاحَ (لا نعرف الراية أو القائمةُ فارغة — D-217) */
  playlist: boolean | null;
  /** 🆕 249 — الحفظُ (قائمةُ غيري): إشارةٌ في الزاوية السفلى (صورةُ card-B) — والقلبُ صار إعجاباً */
  canSave?: boolean;
  savedByMe?: boolean;
  /** 🆕 249 — القلبُ فعلُ إعجابٍ (شرطُه شرطُ الحفظ) — وإلّا رقمٌ ساكن */
  likedByMe?: boolean;
  /** D-948 — ★ فعلٌ لقائمة غيري (`ListRateStar`): ممتلئةٌ ولونُ التمييز حين لي رأي */
  canReview?: boolean;
  hasMyReview?: boolean;
  dashed?: boolean;
  /** 🆕 T474 — قائمةُ الحدث المثبَّتة: ملصقُه (مسارُ TMDB) في آخر خانةٍ وعليه شارةُ العدّ — بطاقةُ الويب نفسُها */
  event?: { poster: string | null; badge: string };
};

export function ListCard({
  card,
  onPress,
  onPlaylist,
  onShare,
  onEdit,
  onSave,
  onRate,
  busy,
  onError,
  three = false,
}: {
  card: ListCardData;
  onPress: () => void;
  onPlaylist?: (on: boolean) => void;
  onShare?: () => void;
  /** 🆕 D-952 — قائمةُ مكتبةٍ ذكيّةٌ لي: بابُ تعديل شرطها (`/library?edit=<id>`) */
  onEdit?: { label: string; onPress: () => void };
  /** يُرجع وعدَ كتابته إن كان له — فيبقى حارسُ الضغطة المزدوجة قائماً حتى يستقرّ */
  onSave?: (save: boolean) => void | Promise<unknown>;
  onRate?: () => void;
  busy?: boolean;
  /** 🆕 249 — رسالةُ الفشل حين يتراجع ♥ أو الحفظ: السطحُ الذي يملك مضيفَ الرسائل يمرّرها، وغيابُها تراجعٌ صامت */
  onError?: (e: unknown) => void;
  /** 🆕 T619 — ثلاثةُ ملصقاتٍ بعرض ٦٤ (بطاقةُ «مكتبتي» بعرض الشاشة) */
  three?: boolean;
}) {
  const { t, tokens, locale, themeId } = useApp();
  const { width: winW } = useWindowDimensions();
  const POSTER_W = three ? (winW >= 400 ? POSTER_W3 : POSTER_W3_NARROW) : POSTER_W2;
  const STRIP = POSTER_W * (three ? 3 : 2);
  const light = themeScheme(themeById(themeId)) === "light";
  /* D-1257 — داخلُ البطاقة يلبس لوحةَ الثيم الداكن الرسميّ حين تكون الصفحةُ فاتحة */
  const c: Tokens = light ? tokensOf(null) : tokens;
  /* D-1135 — الكلامُ صار فوق صورةٍ نصفِ مغطّاة: سطرُ العدّ من لون المتن مخفّفاً لا الباهت (عدّ الملصقات يبقى مقروءاً) */
  const sub2 = c.fg + "CC";
  /* D-1027 (F3) — شريحةُ الغلاف ~٩٦dp: المقاسُ من القاعدة الواحدة فيطابق رابطَ بطاقة المكتبة */
  /* T608 — ١٠٠ لا ٩٦: الملصقُ صار ٧٢ عرضاً بقامة البطاقة كلِّها، وملصقُ الحدث مكبَّرٌ ١٣٩٪ */
  const posters = card.posters.map((p) => posterFor(p, 100)).filter(Boolean) as string[];
  /* 🆕 T474 — **ملصقُ الحدث يأخذ أوضحَ خانة** (الأخيرةُ في جهة النهاية، أبعدُ ما يكون عن الحجاب) — `ListCardShell` الويب حرفاً */
  const ev = card.event;
  /* 🆕 T606 (q37 «أ» — أحمد ٢٨ نوفمبر: «البوستر يبدأ يسار والمفروض يمين») — **ملصقان في النصف الحرّ لا ثلاثةٌ على ٧٢٪**: حجابُ R334
     صلبٌ تحت عمود الكلام حتى منتصف البطاقة، فكان الملصقُ الأوّلُ (وهو في جهة البداية) مختفياً تحته ويُرى ملصقان من النهاية.
     الآن ملصقان كاملان يبدآن بجانب الكلام، والحدثُ ثانيهما (الأبعدُ عن الحجاب كما كان) */
  const evPoster = ev ? (ev.poster ? posterFor(ev.poster, 100) : null) : null;
  const slots: (string | null)[] = ev
    ? three
      ? [posters[0] ?? null, posters[1] ?? null, evPoster ?? posters[2] ?? null]
      : [posters[0] ?? null, evPoster ?? posters[1] ?? null]
    : posters.slice(0, three ? 3 : 2);
  /* T608 — الشريطُ موجودٌ حين يكون غلافٌ أو ملصقٌ واحدٌ على الأقلّ؛ وإلّا فالكلامُ يأخذ البطاقةَ كلَّها */
  const strip = !!card.cover || slots.some(Boolean) || !!ev;
  /* T608 — القامةُ ثابتة، فالسطورُ تُحسب بحجم الخطّ: درجةُ Loopz × خطُّ الجهاز (بسقفه) — فوق ١٫٠٥ يقصر العنوانُ والوصفُ كي لا
     يُقصّ شريطُ ♥ ★ في القاع (مراجعةُ أندرويد: «كبير» أو خطُّ جهازٍ ١٫٣ كان يدفعه خارج البطاقة) */
  const big = useFontScale() * Math.min(PixelRatio.getFontScale(), SYSTEM_FONT_CAP) > 1.05;
  const titleLines = big ? 2 : card.owner ? 3 : 2;
  const countLines = big ? (card.stats ? 1 : 2) : 3;
  /* زرّا الزاويتين يجلسان على الشريط؛ وبلا شريطٍ يبقى مكانُه محجوزاً كي لا يقع الكلامُ تحتهما */
  const reserveEnd = strip || !!onShare || !!onEdit || card.playlist !== null || !!card.canSave;
  const play =
    card.playlist === null ? null : (
      <PlayPill palette={c} on={!!card.playlist} label={t.listPlaylist} disabled={busy || !onPlaylist} onToggle={(on) => onPlaylist?.(on)} />
    );

  const stats = card.stats;
  /* 🆕 249 — **القلبُ إعجابٌ والإشارةُ حفظ** (أحمد ١٩ نوفمبر ٢٠٢٦: «لازم يكون فيه اعجاب و الاضافة للقوائم منفصله
     عنها»). البطاقةُ تكتبهما بنفسها (`/api/v1/lists/like` · `/save`) تفاؤليّاً مع تراجُع — فكلُّ سطحٍ يرسمها يحصل عليهما
     بلا توصيلٍ في كلِّ مستدعٍ؛ ومن يمرّر `onSave` (محفوظاتُ المكتبة تُحدّث مخزنَها) يبقى كاتبَ الحفظ. */
  const [liked, setLiked] = useState(!!card.likedByMe);
  const [saved, setSaved] = useState(!!card.savedByMe);
  useEffect(() => setLiked(!!card.likedByMe), [card.likedByMe]);
  useEffect(() => setSaved(!!card.savedByMe), [card.savedByMe]);
  const likes = Math.max(0, (stats?.likes ?? 0) + (liked === !!card.likedByMe ? 0 : liked ? 1 : -1));
  /* 🆕 249 — **نداءٌ واحدٌ في الطريق لكلِّ مفتاح**: ضغطاتٌ سريعةٌ كانت تُطلق «أعجب/ألغِ/أعجب» معاً
     فإن وصلت بغير ترتيبها خالف الخادمُ ما تراه. **وبعد النجاح تُبطَل صفحةُ القائمة المخزَّنة** فلا
     تُفتح من المخزن بحالتها القديمة. */
  const likeBusy = useRef(false);
  const saveBusy = useRef(false);
  const toggleLike = () => {
    if (likeBusy.current) return;
    likeBusy.current = true;
    const next = !liked;
    haptic.pick();
    setLiked(next);
    write<{ liked: boolean }>("/api/v1/lists/like", { listId: card.id, like: next } satisfies LikeListBody)
      .then(() => void queryClient.invalidateQueries({ queryKey: qk.list(card.id) }))
      .catch((e) => {
        setLiked(!next);
        onError?.(e);
      })
      .finally(() => {
        likeBusy.current = false;
      });
  };
  const toggleSave = () => {
    /* والحارسُ قبل الفرعين: ضغطتان في الإطار نفسِه قبل أن يُرسم `busy` كانتا تمرّان إلى `onSave` معاً */
    if (saveBusy.current) return;
    if (onSave) {
      const next = !saved;
      haptic.pick();
      setSaved(next);
      saveBusy.current = true;
      /* الكاتبُ هنا المستدعي، **ووعدُه يعود إلينا** فيُرفع الحارسُ حين يستقرّ لا قبله */
      void Promise.resolve(onSave(next)).finally(() => {
        saveBusy.current = false;
      });
      return;
    }
    saveBusy.current = true;
    const next = !saved;
    haptic.pick();
    setSaved(next);
    write<{ saved: boolean }>("/api/v1/lists/save", { listId: card.id, save: next } satisfies SaveListBody)
      .then(() => void queryClient.invalidateQueries({ queryKey: qk.list(card.id) }))
      .catch((e) => {
        setSaved(!next);
        onError?.(e);
      })
      .finally(() => {
        saveBusy.current = false;
      });
  };
  const saveMark = card.canSave ? (
    <Pressable
      onPress={toggleSave}
      disabled={busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? t.listUnsaveLabel : t.listSaveBtn}
      style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.bg + "CC" }}
    >
      <Icon name={saved ? "bookmark-filled" : "bookmark"} size={15} color={saved ? c.accent : c.fg} />
    </Pressable>
  ) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ev ? `${card.name} · ${ev.badge}` : card.name}
      style={({ pressed }) => ({
        height: LIST_CARD_H,
        borderRadius: radius.card,
        borderWidth: 1,
        borderStyle: card.dashed ? "dashed" : "solid",
        borderColor: tokens.border,
        /* D-1081 — أرضيّةُ البطاقة لونُ الصفحة (`bg`) لا السطح: بلاغُ أحمد «خلّ خلفيّتها سوداء» —
           في الرئيسيّة والمكتبة واكتشف معاً، لأنّها بطاقةٌ واحدة. الحجابُ والهالةُ يتبعانها فلا
           يظهر السطحُ الرماديّ شريطاً عند حافّة الملصقات؛ و`daylight` يبقى صحيحاً من الرمز */
        backgroundColor: c.bg,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* الأرضيّة: الغلافُ أو الملصقان في النصف الحرّ من جهة النهاية (T606) — كلاهما يبدأ حيث ينتهي الحجابُ الصلب */}
      {card.cover ? (
        <Image source={{ uri: card.cover }} style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: STRIP }} contentFit="cover" transition={150} />
      ) : slots.length > 0 ? (
        <View style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: STRIP, flexDirection: "row", justifyContent: "flex-start" }}>
          {slots.map((uri, i) =>
            ev && i === slots.length - 1 ? (
              /* 🆕 T474 — خانةُ الحدث بتكبيرٍ متوسّط (نموذجُ أحمد): ٧٢٪ من عرض الملصق ملتصقاً بالقاع، وفوقه الملصقُ نفسُه مموّهاً
                 معتماً يحمل الشارةَ الصفراء — فلا تغطّي الشارةُ وجهاً */
              <View key={i} style={{ width: POSTER_W, height: "100%" }}>
                {uri ? (
                  <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} cachePolicy="memory-disk" />
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
                    <Image source={{ uri }} style={{ position: "absolute", bottom: 0, left: "-19.5%", width: "139%", aspectRatio: 2 / 3 }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                  </View>
                ) : null}
                <EventBadge text={ev.badge} bg={c.accent} fg={c.onAccent} />
              </View>
            ) : uri ? (
              /* كلُّ ملصقٍ نصفُ الشريحة (ربعُ البطاقة) — والواحدُ يبقى بعرضه بجانب الكلام لا يُمَطّ فيُقصّ وجهُه */
              <Image key={i} source={{ uri }} style={{ width: POSTER_W, height: "100%" }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
            ) : null,
          )}
        </View>
      ) : null}
      {/* الحجابُ بلون الأرضيّة، من جهة البداية — يُقلب في RTL (D-1135: واحدٌ لكلِّ ثيم). T608: صار حافّةً لا غطاءً — صندوقُه ٢٠٠
          ينتهي على بُعد (الشريط − ١٠٠) من النهاية، فنصفُه الصلبُ على الكلام وذوبانُه على أوّل ١٠ من الشريط */}
      {strip ? (
        <Image
          source={VEIL_DARK}
          tintColor={c.bg}
          contentFit="fill"
          style={{ position: "absolute", top: 0, bottom: 0, end: STRIP - VEIL_W / 2, width: VEIL_W, transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }}
        />
      ) : null}

      <View style={{ flex: 1, padding: PAD, paddingEnd: reserveEnd ? STRIP + 8 : PAD }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {card.icon ? (
            <View style={{ marginTop: 2 }}>
              <Icon name={card.icon} size={15} color={c.accent} />
            </View>
          ) : null}
          {/* 🆕 T454 — **الكلماتُ تملأ السطرَ الأوّلَ قبل أن تنزل** (`simple`) وسقفُ العرض ٦٤٪ (أحمد: «خل تو تطلع فوق
              وطلعها كاملة»): أندرويد يوازن السطرين افتراضاً (`highQuality`) فنزلت «to» وقُصّت «Doomsday» عند ٥٨٪ */}
          {/* T608 — بلا سقف ٤٦٪: عمودُ الكلام نفسُه محدودٌ بالشريط. وسطران حين يأخذ سطرُ الوصف ثلاثةً (قامةٌ ثابتة) */}
          <Text size={15} weight="700" color={c.fg} numberOfLines={titleLines} textBreakStrategy="simple" style={{ flex: 1, lineHeight: 20 }}>
            {card.name}
          </Text>
          {/* 🆕 D-952 — رمزُ الفلاتر (`sliders`) قبل المشاركة: الويبُ يضع «عدّل الشرط»
              في صفحة القائمة، **والتطبيقُ يختصر ضغطةً** لأنّ الصفحةَ بابٌ ويبيٌّ أصلاً.
              الرمزُ نفسُه رمزُ ورقة الأدوات التي يُفتح فيها الشرط (D-876). */}
        </View>
        {/* T608 (q57) — **الصاحبُ والعددُ سطرٌ واحد** «Loopz · 16 عملاً» كي تتّسع القامةُ الأقصر؛ وما بعد العدد (مصدرُ الجوائز الطويل)
            يسقط هنا ويبقى في صفحة القائمة. وبلا صاحب (قوائمي) **سطرُ العدّ والوصف حتى ثلاثة أسطر** (q54 — كان يُقصّ في سطر) */}
        {card.owner ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            {card.owner_avatar ? (
              /* ختمُ لوبز من الأصول لا من الشبكة (`avatarSource`)، وخلفيّتُه `surface2` لأن الرمزَ شفّافٌ — كأفاتاره في المجتمع */
              <Image source={avatarSource(card.owner_avatar)} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.surface2 }} contentFit="cover" />
            ) : (
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
                <Text size={8} weight="700" color={c.muted}>{card.owner.slice(0, 1)}</Text>
              </View>
            )}
            {/* نصّان أخوان لا نصٌّ واحد: «Loopz» اللاتينيّ أوّلاً كان يقلب السطرَ كلَّه LTR في العربيّ (مراجعةُ الآيفون)، والاسمُ الطويلُ
                يتقلّص ويبقى العدد */}
            <Text size={12} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{card.owner}</Text>
            <Text size={12} color={c.muted} numberOfLines={1} style={{ flexShrink: 0 }}>{`· ${card.countText.split(" · ")[0]}`}</Text>
          </View>
        ) : (
          <Text size={12} color={sub2} numberOfLines={countLines} style={{ marginTop: 4, lineHeight: 16 }}>
            {card.countText}
          </Text>
        )}

        {stats || play || saveMark ? (
          <View style={{ marginTop: "auto", paddingTop: 6, flexDirection: "row", alignItems: "center" }}>
            {stats ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: radius.pill,
                  backgroundColor: c.bg + "B3",
                  marginStart: -6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  /* 🆕 249 — يتقلّص قبل إشارة الحفظ في البطاقات الضيّقة فلا تتراكب الأرقامُ عليها */
                  flexShrink: 1,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                {/* ♥ — 🆕 249 إعجابٌ لقائمة غيري (لا حفظ)، رقمٌ ساكنٌ لقائمتي — والعددُ عددُ المعجبين */}
                <Pressable
                  disabled={!card.canSave || busy}
                  onPress={toggleLike}
                  hitSlop={6}
                  accessibilityLabel={liked ? t.listUnlikeLabel : t.listLikeLabel}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Icon name={card.canSave && !liked ? "heart" : "heart-filled"} size={15} color={c.accent} />
                  {/* **والصفرُ لا يُطبع** (D-219) — كقلب بطاقة الويب */}
                  {likes > 0 ? <Text size={12} color={c.muted} style={styles.nums}>{num(likes, locale)}</Text> : null}
                </Pressable>
                {/* 🆕 T602 (q27 · q32) — **الصفرُ لا يُطبع** (D-219 يعود؛ ينقض استثناءَه المحصور في هذه البطاقة بكلمة أحمد في الاستوديو):
                    💬 بلا آراء لا يُرسم، و★ تبقى فعلاً بلا «0» */}
                {stats.reviews > 0 ? (
                  <>
                    <Sep palette={c} />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Icon name="comment" size={15} color={c.accent} />
                      <Text size={12} color={c.muted} style={styles.nums}>{num(stats.reviews, locale)}</Text>
                    </View>
                  </>
                ) : null}
                <Sep palette={c} />
                {/* ★ — فعلٌ يفتح ورقةَ الرأي لقائمة غيري (D-948)، رقمٌ ساكنٌ لقائمتي */}
                <Pressable
                  disabled={!card.canReview || !onRate}
                  onPress={onRate}
                  hitSlop={6}
                  accessibilityLabel={t.listReviewsTitle}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                >
                  <Icon name={card.hasMyReview ? "star-filled" : "star"} size={15} color={card.canReview && !card.hasMyReview ? c.muted : c.accent} />
                  {stats.rating ? <Text size={12} weight="700" color={card.canReview && !card.hasMyReview ? c.muted : c.accent} style={styles.nums}>{num(stats.rating, locale)}</Text> : null}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {/* رقاقةُ التشغيل ثمّ إشارةُ الحفظ في الزاوية السفلى (صورةُ card-B) — T608: خارج عمود الكلام، في زاوية الشريط على دوائرها الداكنة */}
      {play || saveMark ? (
        <View style={{ position: "absolute", bottom: 10, end: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {play}
          {saveMark}
        </View>
      ) : null}
      {/* 🆕 T606 (q44 «أ» — لقطةُ أحمد ٢٧ نوفمبر: «تعديل مكان المشاركة بحيث يكون متناسقاً مع أماكنها في التطبيق») — **المشاركةُ في زاوية
          النهاية العليا على دائرةٍ داكنة**، كإشارة الحفظ في الزاوية السفلى: كانت تلي الاسمَ فتقع وسط البطاقة فوق الملصقات بلا أرضيّة.
          وفي بطاقة الحدث تنزل تحت شارته الصفراء (الشارةُ أعلى خانة النهاية) فلا تغطّيها */}
      {/* T608 — وزرُّ الشرط (D-952) جارُ المشاركة في الزاوية العليا: خرج من سطر الاسم لأنّ عمودَ الكلام صار لا يدخل الشريط */}
      {onShare || onEdit ? (
        <View style={{ position: "absolute", top: ev ? 38 : 10, end: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          {onEdit ? (
            <Pressable
              onPress={onEdit.onPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={onEdit.label}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.bg + "CC" }}
            >
              <Icon name="sliders" size={16} color={c.fg} />
            </Pressable>
          ) : null}
          {onShare ? (
            <Pressable
              onPress={onShare}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.listShare}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.bg + "CC" }}
            >
              <Icon name="share" size={15} color={c.fg} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * 🆕 N3 — **رقاقةُ On/Off واحدةٌ للتطبيق** (`PlayPill` الويب، D-677): كانت مكتوبةً داخل هذه البطاقة وحدَها، ورايةُ «القوائم
 * المحفوظة» في ملفّي (D-594) تلبسها في الويب أيضاً — فخرجت مكوّناً يُستورد لا نسخةً ثانية (القاعدة ٣). المقاساتُ كما كانت حرفاً.
 */
export function PlayPill({ on, label, disabled, onToggle, palette }: { on: boolean; label: string; disabled?: boolean; onToggle: (on: boolean) => void; /** D-1257 — لوحةُ البطاقة التي تجلس عليها (داكنةٌ في «النهاري»)؛ غيابُها = ثيمُ الصفحة */ palette?: Tokens }) {
  const app = useApp();
  const t = app.t;
  const tokens = palette ?? app.tokens;
  return (
    <Pressable
      onPress={() => onToggle(!on)}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 28,
        paddingStart: 12,
        paddingEnd: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: on ? tokens.accent + "99" : tokens.border,
        backgroundColor: tokens.surface2,
      }}
    >
      <Text size={12} weight="700" color={on ? tokens.accent : tokens.muted}>
        {on ? t.toWatchOn : t.toWatchOff}
      </Text>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: on ? tokens.accent : tokens.divider }} />
    </Pressable>
  );
}

function Sep({ palette }: { palette?: Tokens }) {
  const app = useApp();
  const tokens = palette ?? app.tokens;
  /* T608 — ٧ لا ١٠: عمودُ الكلام صار ~١٥٧ على آيفون ٣٧٥، والعنقودُ بأرقامه الثلاثة كان يقصّ التقييم */
  return <View style={{ width: 1, height: 16, backgroundColor: tokens.divider, marginHorizontal: 7 }} />;
}

const styles = StyleSheet.create({
  nums: { fontVariant: ["tabular-nums"] },
});

/**
 * 🆕 T474 — **شارةُ العدّ على ملصق الحدث**: صغيرةٌ ووسطَ الخانة لا تتجاوزها (أحمد: «لا تدخل عالعمل الثاني» ثمّ «أ»)، ونصٌّ أطولُ
 * منها يمشي ولا يُقصّ («Tomorrow» — «خليها متحركه عشان تظهر بشكل كامل») بـ`MarqueeText` نفسِه.
 * 📐 **عرضُها يُقاس**: مسارُ `MarqueeText` عريضٌ عمداً فيملأ ما يُعطى — فالشارةُ تأخذ عرضَ نصِّها الطبيعيّ (يُقاس خفيّاً) أو عرضَ
 * الخانة أيّهما أصغر، **وتبقى مخفيّةً حتى يتمّ القياس** فلا تومض بعرض الخانة كلِّها.
 */
function EventBadge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  const [room, setRoom] = useState(0);
  const [natural, setNatural] = useState(0);
  const PAD = 4;
  const ready = room > 0 && natural > 0;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 6, left: 3, right: 3, alignItems: "center" }}
      onLayout={(e) => setRoom(e.nativeEvent.layout.width - PAD * 2)}
    >
      {/* القياسُ الخفيّ: صفٌّ عريضٌ يترك النصَّ بطوله (حيلةُ `MarqueeText` نفسُها) */}
      <View style={{ position: "absolute", opacity: 0, width: 1000, flexDirection: "row" }}>
        <Text size={9} weight="700" numberOfLines={1} style={{ flexShrink: 0 }} onLayout={(e) => setNatural(Math.ceil(e.nativeEvent.layout.width))}>
          {text}
        </Text>
      </View>
      <View style={{ opacity: ready ? 1 : 0, width: ready ? Math.min(natural, room) + PAD * 2 : undefined, borderRadius: 999, backgroundColor: bg, paddingHorizontal: PAD, paddingVertical: 1 }}>
        <MarqueeText text={text} size={9} weight="700" color={fg} />
      </View>
    </View>
  );
}
