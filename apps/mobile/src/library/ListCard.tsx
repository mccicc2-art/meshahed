import React, { useEffect, useRef, useState } from "react";
import { I18nManager, Pressable, StyleSheet, View } from "react-native";
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
 * ♥ الحفظ · 💬 الآراء · ★ التقييم — **والصفرُ يُطبع** (نقضٌ محصورٌ لـD-219
 * بتصميمه) — **ورقاقةُ التشغيل في طرفه** (D-674).
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
const VEIL_DARK = require("../../assets/list-veil-dark.png");
const MIN_H = 168;
const PAD = 14;

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
}) {
  const { t, tokens, locale, themeId } = useApp();
  const light = themeScheme(themeById(themeId)) === "light";
  /* D-1257 — داخلُ البطاقة يلبس لوحةَ الثيم الداكن الرسميّ حين تكون الصفحةُ فاتحة */
  const c: Tokens = light ? tokensOf(null) : tokens;
  /* D-1135 — الكلامُ صار فوق صورةٍ نصفِ مغطّاة: سطرُ العدّ من لون المتن مخفّفاً لا الباهت (عدّ الملصقات يبقى مقروءاً) */
  const sub2 = c.fg + "CC";
  /* D-1027 (F3) — شريحةُ الغلاف ~٩٦dp: المقاسُ من القاعدة الواحدة فيطابق رابطَ بطاقة المكتبة */
  const posters = card.posters.map((p) => posterFor(p, 96)).filter(Boolean) as string[];
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
      accessibilityLabel={card.name}
      style={({ pressed }) => ({
        minHeight: MIN_H,
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
      {/* الأرضيّة: الغلافُ كاملاً، وإلّا الملصقاتُ الثلاثة من جهة النهاية (`w-[72%]`) */}
      {card.cover ? (
        <Image source={{ uri: card.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : posters.length > 0 ? (
        <View style={{ position: "absolute", top: 0, bottom: 0, end: 0, width: "72%", flexDirection: "row", justifyContent: "flex-end" }}>
          {posters.slice(0, 3).map((uri, i) => (
            <Image key={i} source={{ uri }} style={{ flex: 1, height: "100%" }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
          ))}
        </View>
      ) : null}
      {/* الحجابُ بلون الأرضيّة، من جهة البداية — يُقلب في RTL (D-1135: واحدٌ لكلِّ ثيم) */}
      <Image
        source={VEIL_DARK}
        tintColor={c.bg}
        contentFit="fill"
        style={[StyleSheet.absoluteFill, { transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }]}
      />

      <View style={{ flex: 1, minHeight: MIN_H, padding: PAD }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {card.icon ? (
            <View style={{ marginTop: 2 }}>
              <Icon name={card.icon} size={15} color={c.accent} />
            </View>
          ) : null}
          {/* 🆕 T454 — **الكلماتُ تملأ السطرَ الأوّلَ قبل أن تنزل** (`simple`) وسقفُ العرض ٦٤٪ (أحمد: «خل تو تطلع فوق
              وطلعها كاملة»): أندرويد يوازن السطرين افتراضاً (`highQuality`) فنزلت «to» وقُصّت «Doomsday» عند ٥٨٪ */}
          <Text size={15} weight="700" color={c.fg} numberOfLines={2} textBreakStrategy="simple" style={{ flex: 1, maxWidth: "64%", lineHeight: 20 }}>
            {card.name}
          </Text>
          {/* 🆕 D-952 — رمزُ الفلاتر (`sliders`) قبل المشاركة: الويبُ يضع «عدّل الشرط»
              في صفحة القائمة، **والتطبيقُ يختصر ضغطةً** لأنّ الصفحةَ بابٌ ويبيٌّ أصلاً.
              الرمزُ نفسُه رمزُ ورقة الأدوات التي يُفتح فيها الشرط (D-876). */}
          {onEdit ? (
            <Pressable
              onPress={onEdit.onPress}
              hitSlop={8}
              accessibilityLabel={onEdit.label}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: -6 }}
            >
              <Icon name="sliders" size={16} color={c.muted} />
            </Pressable>
          ) : null}
          {onShare ? (
            <Pressable
              onPress={onShare}
              hitSlop={8}
              accessibilityLabel={t.listShare}
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: -6, marginEnd: -6 }}
            >
              <Icon name="share" size={16} color={c.muted} />
            </Pressable>
          ) : null}
        </View>
        {card.owner ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, maxWidth: "58%" }}>
            {card.owner_avatar ? (
              /* ختمُ لوبز من الأصول لا من الشبكة (`avatarSource`)، وخلفيّتُه `surface2` لأن الرمزَ شفّافٌ — كأفاتاره في المجتمع */
              <Image source={avatarSource(card.owner_avatar)} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.surface2 }} contentFit="cover" />
            ) : (
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
                <Text size={8} weight="700" color={c.muted}>{card.owner.slice(0, 1)}</Text>
              </View>
            )}
            <Text size={12} color={c.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{card.owner}</Text>
          </View>
        ) : null}
        <Text size={12} color={sub2} numberOfLines={1} style={{ marginTop: 4, maxWidth: "58%" }}>
          {card.countText}
        </Text>

        {stats || play || saveMark ? (
          <View style={{ marginTop: "auto", paddingTop: 12, flexDirection: "row", alignItems: "center" }}>
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
                <Sep palette={c} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon name="comment" size={15} color={c.accent} />
                  <Text size={12} color={c.muted} style={styles.nums}>{num(stats.reviews, locale)}</Text>
                </View>
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
                  <Text size={12} weight="700" color={card.canReview && !card.hasMyReview ? c.muted : c.accent} style={styles.nums}>{num(stats.rating ?? 0, locale)}</Text>
                </Pressable>
              </View>
            ) : null}
            {/* رقاقةُ التشغيل ثمّ إشارةُ الحفظ في الزاوية السفلى (صورةُ card-B) — والعنقودُ قبلهما يتقلّص ولا يُدفع تحتهما */}
            {play || saveMark ? (
              <View style={{ marginStart: "auto", paddingStart: 8, flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {play}
                {saveMark}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
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
  return <View style={{ width: 1, height: 16, backgroundColor: tokens.divider, marginHorizontal: 10 }} />;
}

const styles = StyleSheet.create({
  nums: { fontVariant: ["tabular-nums"] },
});
