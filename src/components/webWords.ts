import type { Locale } from "@/core/i18n";

/**
 * 🆕 R255 — كلماتٌ يحتاجها الويبُ وحده ولا مقابلَ لها في قاموس التطبيق (`core/i18n` لا يُمسّ في جولات المطابقة — أحمد:
 * «بدون ما نلمس التطبيق»). التطبيقُ يدخل التحديدَ بالضغط المطوَّل فلا يحتاج كلمة «تحديد»؛ الحاسوبُ يدخله من قائمة الرسالة.
 */
const AR = {
  msgSelect: "تحديد",
};

const EN: typeof AR = {
  msgSelect: "Select",
};

export type WebWords = typeof AR;

export function webWords(locale: Locale): WebWords {
  return locale === "en" ? EN : AR;
}
