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
  plus: require("../assets/icons/plus.png"),
  bookmark: require("../assets/icons/bookmark.png"),
  "chevron-down": require("../assets/icons/chevron-down.png"),
  /* D-948 — مقبضُ الترتيب، وعينُ الحرق، والنجمةُ الممتلئة (`fill-current` في الويب) */
  grip: require("../assets/icons/grip.png"),
  eye: require("../assets/icons/eye.png"),
  "eye-off": require("../assets/icons/eye-off.png"),
  "star-filled": require("../assets/icons/star-filled.png"),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color: string }) {
  return <Image source={ICONS[name]} style={{ width: size, height: size }} tintColor={color} contentFit="contain" />;
}
