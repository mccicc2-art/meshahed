import type { Locale } from "@/core/i18n";

/**
 * 🆕 R255 — كلماتٌ يحتاجها الويبُ وحده ولا مقابلَ لها في قاموس التطبيق (`core/i18n` لا يُمسّ في جولات المطابقة — أحمد:
 * «بدون ما نلمس التطبيق»). التطبيقُ يدخل التحديدَ بالضغط المطوَّل فلا يحتاج كلمة «تحديد»؛ الحاسوبُ يدخله من قائمة الرسالة.
 */
const AR = {
  msgSelect: "تحديد",
  /* 🆕 R258 — منصّةُ الترايلرات على الحاسوب: قائمةُ «التالي» وبابُ الصفحة وملءُ الشاشة الحقيقيّ والتشغيلُ المتتالي */
  trailerUpNext: "التالي",
  trailerMore: "المزيد من الترايلرات ←",
  trailerFullscreen: "ملء الشاشة",
  trailerExitFullscreen: "الخروج من ملء الشاشة",
  trailerAutoplay: "تلقائي",
};

const EN: typeof AR = {
  msgSelect: "Select",
  trailerUpNext: "Up next",
  trailerMore: "More trailers →",
  trailerFullscreen: "Full screen",
  trailerExitFullscreen: "Exit full screen",
  trailerAutoplay: "Autoplay",
};

export type WebWords = typeof AR;

export function webWords(locale: Locale): WebWords {
  return locale === "en" ? EN : AR;
}
