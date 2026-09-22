import React from "react";
import { Image } from "expo-image";

/**
 * ====== مجموعةُ الأيقونات الواحدة — مساراتُ `Icon.tsx` (الويب) مرسومةً مرّةً ======
 *
 * 🔑 **لا مجموعةَ أيقوناتٍ ثانية** (القاعدة ٣): كلُّ ملفٍّ هنا هو مسارُ SVG
 * الويب نفسُه (`viewBox 0 0 24 24 · stroke 1.7 · round`) مرسومٌ أبيضَ ٧٢px
 * ويُلوَّن بـ`tintColor` وقتَ الرسم — فاللونُ من الرموز لا من الصورة. ولا
 * حزمةَ SVG في التطبيق: اثنا عشرَ ملفّاً صغيراً أرخصُ من محرّكٍ كامل.
 * **رمزٌ جديد = يُرسم من `Icon.tsx` بالطريقة نفسِها لا يُرسم بيد.**
 */
const ICONS = {
  play: require("../assets/icons/play.png"),
  info: require("../assets/icons/info.png"),
  repeat: require("../assets/icons/repeat.png"),
  "check-line": require("../assets/icons/check-line.png"),
  star: require("../assets/icons/star.png"),
  card: require("../assets/icons/card.png"),
  chart: require("../assets/icons/chart.png"),
  clock: require("../assets/icons/clock.png"),
  heart: require("../assets/icons/heart.png"),
  "heart-filled": require("../assets/icons/heart-filled.png"),
  sliders: require("../assets/icons/sliders.png"),
  search: require("../assets/icons/search.png"),
  close: require("../assets/icons/close.png"),
  /* 🆕 D-947 — رموزُ التبويبَين الرابع والخامس وبطاقةِ القائمة، من `Icon.tsx` بالطريقة نفسِها */
  people: require("../assets/icons/people.png"),
  list: require("../assets/icons/list.png"),
  share: require("../assets/icons/share.png"),
  comment: require("../assets/icons/comment.png"),
  "sparkle-star": require("../assets/icons/sparkle-star.png"),
  /* Phase 11-G — بديلا الملصق في صفّ نتيجة البحث (`film` · `tv`) وبابُ «ابحث بالوصف» (`sparkles`)،
     مساراتُ `Icon.tsx` نفسُها مرسومةً ٧٢px بالطريقة نفسِها */
  film: require("../assets/icons/film.png"),
  tv: require("../assets/icons/tv.png"),
  sparkles: require("../assets/icons/sparkles.png"),
  plus: require("../assets/icons/plus.png"),
  bookmark: require("../assets/icons/bookmark.png"),
  "chevron-down": require("../assets/icons/chevron-down.png"),
  /* D-948 — مقبضُ الترتيب، وعينُ الحرق، والنجمةُ الممتلئة (`fill-current` في الويب) */
  grip: require("../assets/icons/grip.png"),
  eye: require("../assets/icons/eye.png"),
  "eye-off": require("../assets/icons/eye-off.png"),
  "star-filled": require("../assets/icons/star-filled.png"),
  /* 🆕 D-959 — رموزُ المشغّل الأصليّ، من `Icon.tsx` بالطريقة نفسِها: دائرةُ
     الإيقاف، ومخروطُ الصوت الواحد بموجتِه أو بشطبِه (**عائلةٌ واحدةٌ للرمز**
     — التبديلُ يُقرأ حالةً لا أيقونتين غريبتين). */
  pause: require("../assets/icons/pause.png"),
  volume: require("../assets/icons/volume.png"),
  "volume-off": require("../assets/icons/volume-off.png"),
  /* 🆕 D-961 — رموزُ الشريط السفليّ، وجهان لكلِّ خانة: مفرَّغٌ للخامل وممتلئٌ
     للنشط (`Icon.tsx` نفسُها — والممتلئُ `fill="currentColor" stroke="none"`
     فيُرسم أبيضَ ويُلوَّن بـ`tintColor` كسائره). `people` و`search` المفرَّغتان
     موجودتان أصلاً فلم تُرسما ثانيةً. */
  home: require("../assets/icons/home.png"),
  "home-filled": require("../assets/icons/home-filled.png"),
  library: require("../assets/icons/library.png"),
  "library-filled": require("../assets/icons/library-filled.png"),
  compass: require("../assets/icons/compass.png"),
  "compass-filled": require("../assets/icons/compass-filled.png"),
  "people-filled": require("../assets/icons/people-filled.png"),
  "search-filled": require("../assets/icons/search-filled.png"),
  /* 🆕 D-1020 — رموزُ قائمة «المزيد» في صفحة العمل، من `Icon.tsx` بالطريقة نفسِها (cairosvg
     ٧٢×٧٢ أبيض على شفّاف، يُلوَّن بـ`tintColor`) */
  dots: require("../assets/icons/dots.png"),
  send: require("../assets/icons/send.png"),
  palette: require("../assets/icons/palette.png"),
  link: require("../assets/icons/link.png"),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  return <Image source={ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}
