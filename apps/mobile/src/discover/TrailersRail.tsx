import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { I18nManager, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, write } from "../api";
import { TrailerPlayer } from "../trailers/TrailerPlayer";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import type { CuratedTab, FollowBody, TrackResult, TrailerCard, TrailersRailPayload } from "../contracts";

/**
 * ====== صفُّ التريلرات في «اكتشف» الأصليّة — D-958 (١٤ سبتمبر ٢٠٢٦) ======
 *
 * 🔑 **مصغّراتٌ وبابٌ لا مشغّل**: قرارُ C3 (D-955) أبقى المشغّلَ ويبيّاً، لكنّ
 * الشاشةَ الأصليّةَ **لم تعرض الصفَّ ولا باباً إليه أصلاً** — فمن يفتح «اكتشف» في
 * التطبيق لا يرى التريلرات (بلاغُ أحمد). هذا الصفُّ يسدّ الفجوةَ بلا تبعيّةٍ
 * جديدة: خلفيّةُ TMDB (أو مصغّرةُ يوتيوب من المفتاح) وزرُّ ▶ **والضغطُ يفتح
 * `/trailers?at=` في الغلاف** — المشغّلُ الواحدُ وصوتُه وتبديلُ الخانات كما هي.
 *
 * ⚖️ **١٤ سبتمبر مساءً — D-959: البابُ صار مشغّلاً في مكانه** (أمرُ أحمد
 * «نفّذها»): الضغطةُ على السطح تُبدّل الصورةَ بـ`TrailerPlayer` الأصليِّ فوق
 * البطاقة نفسِها — **لا مغادرةَ للشاشة**. **وواحدٌ يعمل في الصفّ**: من يفتح
 * بطاقةً يُغلق ما قبلها، **والبطاقةُ التي تخرج من العين تتوقّف** (`viewability`
 * — الرفُّ يلتقط بطاقةً واحدةً في المرّة)، **والخروجُ من «اكتشف» يوقف الكلّ**
 * (`useFocusEffect`): **صوتٌ يتبع مستخدماً غادر الشاشةَ عطلٌ لا ميزة.**
 * **و`href` باقٍ احتياطاً** — يُفتح حين ترفض يوتيوب مفاتيحَ البطاقة كلَّها.
 *
 * 🔑 **والبطاقةُ بقياس الويب لا بقياس الملصقات** (أحمد بلقطة، ١٤ سبتمبر: «أبغى
 * حجم شاشة عرض التريلر مثل حجمها في الويب»): الويبُ يعرضها `min(92vw, …)` —
 * **بطاقةٌ واحدةٌ تملأ العرضَ تقريباً، وسطحٌ 16:9، وتذييلٌ فيه الاسمُ وسطرُ
 * «سنة · نوع · نسبة» وفعلان: «التفاصيل» (صفحةُ العمل الأصليّة، D-956) و«مكتبتي»
 * (`track/follow` متفائلاً كما `useTrailerFollow`)**. هنا العرضُ = الشاشةُ − ٢×١٦
 * والتاليةُ تلوح من الحافّة كما في الويب. **«ترايلرات لك» بالنصّ نفسِه والأيقونةِ
 * نفسِها** (`t.trailersForYou` · `play`). ⚠️ **الصمتُ عند الفراغ أو الفشل** (D-222).
 */
const PAGE_PAD = 16;
const GAP = 12;

const thumbOf = (c: TrailerCard) => c.backdrop ?? `https://i.ytimg.com/vi/${c.video_key}/hqdefault.jpg`;

export function TrailersRail({
  tab,
  active,
  onOpenWeb,
  onOpenTitle,
  onError,
}: {
  tab: CuratedTab;
  /** هل لوحُ هذا الصفّ هو النشط؟ (D-975) */
  active: boolean;
  onOpenWeb: (path: string) => void;
  onOpenTitle: (c: { kind: "tv" | "movie"; id: number }) => void;
  onError: (e: unknown) => void;
}) {
  const { t, tokens } = useApp();
  const { width: screenW } = useWindowDimensions();
  /* عرضُ الويب `min(92vw, calc(45dvh·16/9), 760px)` — على الهاتف يحسمها `92vw`؛ هنا الهوامشُ الثابتة */
  const cardW = Math.min(screenW - PAGE_PAD * 2, 760);
  const q = useQuery({
    queryKey: ["discover:trailers", tab],
    queryFn: async () => (await api<TrailersRailPayload>(`/api/v1/discover/trailers?tab=${tab}`)).data,
    staleTime: 5 * 60_000,
  });
  /* «مكتبتي» متفائلٌ ويتراجع عند الفشل — نسخةُ `useTrailerFollow` (الويب) */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const follow = useMutation({
    mutationFn: (c: TrailerCard) =>
      write<TrackResult>("/api/v1/track/follow", { tmdbId: c.id, mediaType: c.kind, title: c.title, posterPath: c.poster_path } satisfies FollowBody),
    onMutate: (c) => setAdded((prev) => new Set(prev).add(`${c.kind}-${c.id}`)),
    onError: (e, c) => {
      setAdded((prev) => {
        const next = new Set(prev);
        next.delete(`${c.kind}-${c.id}`);
        return next;
      });
      onError(e);
    },
  });

  /**
   * 🆕 D-1041 — **مشغّلٌ واحدٌ للصفّ كلِّه، يتنقّل مع البطاقة الظاهرة** (قرارُ أحمد المسجَّل D-1017: «خلّ
   * الأدوات مثلها داخل صفحة التريلرات»، ثمّ بكلمته ٢١ سبتمبر: «نفّذ D-1017»). كان لكلِّ بطاقةٍ مشغّلُها: WebView
   * تُبنى وتُهدم مع كلِّ انزلاق، **وكلُّ مستندٍ جديدٍ يحتاج لمسةً جديدة** لأنّ يوتيوب لا يبدأ بلا لمسةٍ في
   * مستنده (D-982 · D-1023) — فلا بدءَ تلقائيّاً أبداً. صفحةُ التريلرات الويبيّة سلسةٌ لثلاثة (مكتوبةٍ في
   * `TrailerPlaybackController`): **مشغّلٌ واحدٌ في DOM · الانتقالُ `loadVideoById` · الإطارُ لا يُعاد إنشاؤه.**
   * هذه الوصفةُ هنا: المشغّلُ **ابنٌ مطلقُ الموضع داخل محتوى التمرير** يُزاح إلى بطاقته (`start`) فيتحرّك
   * معها أصليّاً، ومفاتيحُه تتبدّل في المكان. والمستندُ الذي لُمس مرّةً يُؤذَن له بما بعدها.
   *
   * ⚖️ **انحرافٌ معلَنٌ عن نصّ D-1017 — الأدواتُ بقيت أصليّةً فوق المشغّل، لم تُرسم داخل مستنده**: حجّةُ
   * D-1017 كانت تنازعَ اللمس؛ وأحمد أكّد أنّ زرَّ الصوت يعمل ⇒ الطبقةُ تصلها اللمسة (D-1016 سليمة) والعطلُ في
   * زرّ ⏸ نفسِه (D-1042). ورسمُها داخل المستند كان سيُسلّم اللمسَ للـWebView — **فيبتلع سحبَ الصفّ أفقيّاً
   * فوق الفيديو**، ويُخرج الأزرارَ من نظام التصميم. المكسبُ المطلوب («نفس صفحة التريلرات») في المشغّل الواحد.
   *
   * 🔑 `at` مؤشّرُ البطاقة الظاهرة (≥ نصفها)، و`live` = «لمسه صاحبُه فاشتغل». قبلها البطاقةُ **خاملةٌ مُحمّاة**
   * (D-971) بـ▶ وثقبِ اللمس (D-982) كما اليوم. وبعدها: تبدّلُ `at` يبدّل المقطعَ **ويحاول البدءَ وحدَه**؛ إن
   * رفض يوتيوب خلال مهلته (`onAutoRefused`) عادت خاملةً بـ▶ — **لا أسوأ من الحاضر في أيِّ حال.**
   */
  const [at, setAt] = useState(0);
  const [live, setLive] = useState(false);
  /**
   * 🔴 D-964 — **الرغبةُ والكتمُ يسكنان هنا لا في المشغّل** (بلاغُ أحمد: «إذا
   * وقفت الفيديو ونزلت تحت ثمّ رجعت فوق أشوفه يشتغل مرّة أخرى»): **حالةٌ داخل
   * المشغّل تموت مع أوّل إعادة تركيب** — وبطاقةُ الصفِّ تخرج من الشجرة وتعود
   * (تدويرُ `FlatList` وقصُّ أندرويد للمنقطع عن العين) — **فتُولد الرغبةُ من
   * جديدٍ «شغِّل» ويستأنف ما أوقفه صاحبُه.** فالصفُّ يملك «مَن يعمل» **ويملك
   * معه: هل يريد تشغيلاً؟ وهل هو مكتوم؟**
   * 🔑 **والإيقافُ يدوم حتّى يُشغِّله بيده أو يغادر «اكتشف»** (بنصِّ طلبه):
   * الغادرةُ تمحوه في `useFocusEffect` أدناه، وفتحُ بطاقةٍ جديدةٍ يبدأ برغبةٍ
   * جديدة — **والكتمُ يعبر البطاقات** لأنّه تفضيلُ جلسةٍ لا حالةُ مقطع.
   */
  const [wantPlay, setWantPlay] = useState(true);
  const [muted, setMuted] = useState(false);
  const open = useCallback(() => {
    setLive(true);
    setWantPlay(true);
  }, []);
  /* 🔑 **المؤشّرُ من الإزاحة، نسبيّاً لا مطلقاً**: في RTL تختلف إصداراتُ أندرويد/RN في معنى `contentOffset.x`
     (من بداية القراءة أم من اليسار الفيزيائيّ) — و`FlatList` كانت تخفي ذلك. فلا نثق بالصفر: عند بدء كلِّ سحبٍ
     نأخذ (الإزاحةَ، المؤشّرَ) مرجعاً، والاتّجاهُ يُكتشف مرّةً من أوّل سحبٍ عند البطاقة الأولى (إزاحةٌ كبيرةٌ
     وأنت في البداية ⇒ المحورُ فيزيائيٌّ معكوس). في LTR الاتّجاهُ معروفٌ سلفاً. */
  const axis = useRef<1 | -1 | null>(I18nManager.isRTL ? null : 1);
  const base = useRef({ x: 0, i: 0 });
  const atRef = useRef(0);
  atRef.current = at;
  const count = useRef(0);
  const onDragStart = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      if (axis.current === null && atRef.current === 0) axis.current = x > (cardW + GAP) / 2 ? -1 : 1;
      base.current = { x, i: atRef.current };
    },
    [cardW],
  );
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (axis.current === null) return;
      /* الرفُّ يلتقط بطاقةً في المرّة (`snapToInterval`): أقربُ بطاقة = التي يظهر نصفُها فأكثر */
      const moved = Math.round((e.nativeEvent.contentOffset.x - base.current.x) / (cardW + GAP));
      const i = Math.max(0, Math.min(Math.max(0, count.current - 1), base.current.i + axis.current * moved));
      setAt((cur) => (cur === i ? cur : i));
    },
    [cardW],
  );
  /* بطاقةٌ جديدةٌ تبدأ برغبة «شغِّل» (نصُّ D-964: الإيقافُ يدوم حتّى يشغّله بيده **أو تتبدّل البطاقة**) */
  useEffect(() => {
    setWantPlay(true);
  }, [at]);
  /* مغادرةُ الشاشة توقف الصوت — والعودةُ تبدأ من الصورة لا من منتصف مقطع */
  useFocusEffect(
    useCallback(
      () => () => {
        setLive(false);
        setWantPlay(true);
      },
      [],
    ),
  );

  /* 🔴 D-975 — **مشغّلٌ واحدٌ في التطبيق كلِّه لا واحدٌ لكلِّ لوح** (بلاغُ أحمد
     بتسجيل على 1.8.5: دوّارةٌ على البطاقة ولا تشغيل، ثمّ بابُ الويب): D-971 كانت
     تحمّي البطاقةَ الظاهرةَ في **كلِّ** لوحٍ مركّب — والجارُ الحيُّ (D-965) لوحٌ
     مركّب — فتعمل WebViewان أو ثلاثٌ ليوتيوب معاً فوق WebView الغلاف، ويوتيوب
     يخنق الثانيةَ حتّى تصل الأولى. **التحميةُ للّوح النشط وحدَه**، ومغادرةُ اللوح
     (سحبٌ أو ضغطةُ تبويب) توقف ما كان يعمل فيه كما توقفه مغادرةُ الشاشة. */
  useEffect(() => {
    if (!active) setLive(false);
  }, [active]);
  const items = q.data?.items ?? [];
  count.current = items.length;
  const cur = items[Math.min(at, Math.max(0, items.length - 1))] ?? null;
  const curKeys = useMemo(() => (cur ? (cur.video_keys?.length ? cur.video_keys : [cur.video_key]) : []), [cur]);
  /* ⚖️ D-1023 — **نُقض التشغيلُ التلقائيُّ (D-1010)** (بلاغُ أحمد بتسجيل على 1.9.4: «الفيديو ما
     يشتغل» — البطاقةُ الأولى تفتح حيّةً بدوّارٍ عند 0:00 عشرَ ثوانٍ ثمّ تموت): يوتيوب يرفض
     البدءَ برمجيّاً ولو مكتوماً داخل هذا الـWebView، فالتحفّظُ المسجَّل مع D-1010 تحقّق. البطاقةُ
     تعود خاملةً بصورتها و▶ (ما نجح في 1.9.1)، واللمسةُ الحقيقيّةُ وحدَها تشغّل. */
  /* فشلُ الجلب صمتٌ لا هيكلٌ أبديّ (درسُ ١٤ سبتمبر: 500 في المسار أبقى الهيكلَ معروضاً) */
  if (q.isError) return null;
  const header = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: PAGE_PAD, marginBottom: 10 }}>
      <Icon name="play" size={16} color={tokens.accent} />
      <Text size={17} weight="700" style={{ flex: 1 }} numberOfLines={1}>{t.trailersForYou}</Text>
      {q.data ? (
        <Pressable onPress={() => onOpenWeb(q.data.see_all)} hitSlop={8}>
          <Text size={12} weight="600" color={tokens.accent}>{t.seeAll}</Text>
        </Pressable>
      ) : null}
    </View>
  );
  if (!q.data) {
    return (
      <View>
        {header}
        <View style={{ paddingHorizontal: PAGE_PAD }}>
          <View style={{ width: cardW, borderRadius: radius.card, backgroundColor: tokens.surface2, aspectRatio: 16 / 9 }} />
        </View>
      </View>
    );
  }
  if (items.length === 0) return null;
  return (
    <View>
      {header}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: GAP }}
        snapToInterval={cardW + GAP}
        decelerationRate="fast"
        onScrollBeginDrag={onDragStart}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {/* D-1041 — `ScrollView` لا `FlatList`: الصفُّ عشرُ بطاقاتٍ من صورةٍ وتذييل (لا مشغّلَ فيها بعد اليوم)،
            والمشغّلُ الواحد يجب أن يكون **ابناً لمحتوى التمرير نفسِه** ليتحرّك مع بطاقته أصليّاً ويمرَّ السحبُ
            من فوقه — وترويسةُ `FlatList` المطلقةُ الموضع تُفسد حسابَ رؤيتها. */}
        {items.map((item, i) => {
          const id = `${item.kind}-${item.id}`;
          const isAdded = added.has(id);
          return (
            <View key={id} style={{ width: cardW, borderRadius: radius.card, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border }}>
              {/* 🔴 D-987 — **المصغّرةُ تحت كلِّ شيءٍ دائماً** (بلاغُ أحمد بتسجيل على 1.8.7: «إذا لفّيت
                  للإعلان الآخر فيه رمشة»): تبديلُ البطاقة بين «عاديّة» و«محمّاة» كان يفكّك صورتَها
                  ويركّب مشغّلاً خلفيّتُه سوداء وسِترُه صورةٌ تُفكّ من جديد — إطارٌ أسودُ في كلِّ
                  انزلاق. الصورةُ الآن طبقةٌ ثابتةٌ في البطاقة لا تُمسّ، والمشغّلُ شفّافٌ فوقها حتى
                  يثبت رسمُه. */}
              <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: tokens.surface2 }}>
                <Image source={{ uri: thumbOf(item) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} recyclingKey={id} />
              </View>
              {/* ▶ الخاملة — رسمٌ لا زرّ: المشغّلُ الواحد فوق البطاقة الظاهرة هو من يستقبل اللمسة (ثقبُ D-982)؛
                  والبطاقاتُ الأخرى تُسحب إلى الوسط فتصير هي الظاهرة */}
              {/* بطاقةُ المشغّل ترسم ▶ في سِتره — دائرتان شبهُ شفّافتين فوق بعضهما تُقرآن أغمق */}
              <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", opacity: i === at && active ? 0 : 1 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="play" size={24} color="#fff" />
                </View>
              </View>
              {/* التذييلُ: `flex items-center gap-3 px-3.5 py-3` — الاسمُ وسطرُه، ثمّ «التفاصيل» و«مكتبتي» */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
                {/* ⚖️ D-971 (نقضُ نصف D-959 بلقطةٍ معلَّمة من أحمد): **الاسمُ وسطرُه بابٌ إلى
                    صفحة التريلرات** (`href` — الصفحةُ نفسُها التي يفتحها «الكلّ»)؛ التشغيلُ في
                    المكان من السطح وزرّ ▶ وحدَهما. */}
                <Pressable onPress={() => onOpenWeb(item.href)} style={{ flex: 1, minWidth: 0 }}>
                  <Text size={15} weight="700" numberOfLines={1}>{item.title}</Text>
                  <Text size={12} muted numberOfLines={1} style={{ marginTop: 2 }}>{[item.year, item.genre, item.country].filter(Boolean).join(" · ")}</Text>
                </Pressable>
                <Pressable onPress={() => onOpenTitle(item)} hitSlop={6} style={{ alignItems: "center", gap: 4 }}>
                  <Icon name="info" size={19} color={tokens.muted} />
                  <Text size={12} muted>{t.trailerDetails}</Text>
                </Pressable>
                <Pressable onPress={() => follow.mutate(item)} disabled={isAdded} hitSlop={6} style={{ alignItems: "center", gap: 4 }}>
                  <Icon name={isAdded ? "check-line" : "plus"} size={19} color={isAdded ? tokens.accent : tokens.muted} />
                  <Text size={12} color={isAdded ? tokens.accent : tokens.muted}>{t.trailerMyList}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {cur && active ? (
          /* 🔴 D-1054 — **الحاملُ يحتاج ارتفاعاً صريحاً** (بلاغُ أحمد بتسجيل على 1.11.1: «الفيديو لا يعمل في
             اكتشف» — لا ▶ على البطاقة ولا استجابةَ للمس): `TrailerPlayer` بوضع `overlay` ابنٌ مطلقُ الموضع،
             والابنُ المطلقُ لا يُكسب أباه حجماً في Yoga ⇒ ارتفاعُ الحامل صفرٌ و`overflow: hidden` يقصّ المشغّلَ
             كلَّه (السِّتر و▶ وثقبَ اللمس). قبل D-1041 كان الحاملُ سطحَ البطاقة نفسَه بـ`aspectRatio` فلم يظهر
             العيب. الارتفاعُ هنا بحساب المشغّل نفسِه (`width · 9/16`) لا `aspectRatio` كي يتطابقا بايتاً. */
          <View style={{ position: "absolute", top: 0, start: PAGE_PAD + at * (cardW + GAP), width: cardW, height: Math.round((cardW * 9) / 16), borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: "hidden" }}>
            <TrailerPlayer
              videoKeys={curKeys}
              width={cardW}
              poster={thumbOf(cur)}
              overlay
              label={cur.title}
              idle={!live}
              onWake={open}
              wantPlay={live ? wantPlay : false}
              onWantPlay={setWantPlay}
              muted={muted}
              onMuted={setMuted}
              onAutoRefused={() => setLive(false)}
              onExhausted={() => {
                setLive(false);
                onOpenWeb(cur.href);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
