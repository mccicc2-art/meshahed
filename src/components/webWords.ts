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
  /* 🆕 R261 — تفضيلاتُ المحتوى على الحاسوب: رقاقةٌ بثلاث حالات (أكثر · أقلّ · عادي) */
  cpMore: "المزيد",
  cpLess: "أقلّ",
  cpTriHint: "ضغطة = أكثر · ضغطتان = أقلّ · الثالثة ترجعها عادية",
  /* 🆕 R262 — معاينةُ التخصيص على الحاسوب بجهازين */
  custPhone: "جوال",
  custDesk: "كمبيوتر",
  custOneOrder: "ترتيبٌ واحد للجهازين — ما تغيّره هنا يتغيّر في الآخر أيضاً",
  /* 🆕 R264 — النقاشُ على الحاسوب */
  talkRestMine: "من مكتبتك",
  talkRestAll: "كل الغرف",
  talkAbout: "عن العمل",
  talkYourProgress: "تقدّمك",
  talkYourRating: "تقييمك",
  talkNextEpisode: "الحلقة القادمة",
  talkInRoom: "في الغرفة",
  talkPostsN: (n: number) => `${n} مشاركة`,
  talkWorkPage: "صفحة العمل",
  talkEnterRoom: "ادخل غرفة النقاش",
  talkLibraryRooms: "غرف من مكتبتك",
  talkAlsoInRoom: "أيضاً في الغرفة",
  talkOtherReviews: "آراء أخرى",
  talkAllReviews: "كل الآراء في صفحة العمل",
};

const EN: typeof AR = {
  msgSelect: "Select",
  trailerUpNext: "Up next",
  trailerMore: "More trailers →",
  trailerFullscreen: "Full screen",
  trailerExitFullscreen: "Exit full screen",
  trailerAutoplay: "Autoplay",
  cpMore: "More",
  cpLess: "Less",
  cpTriHint: "Tap once = more · twice = less · a third time resets it",
  custPhone: "Phone",
  custDesk: "Computer",
  custOneOrder: "One order for both devices — what you change here changes on the other too",
  talkRestMine: "From your library",
  talkRestAll: "All rooms",
  talkAbout: "About the title",
  talkYourProgress: "Your progress",
  talkYourRating: "Your rating",
  talkNextEpisode: "Next episode",
  talkInRoom: "In the room",
  talkPostsN: (n: number) => `${n} ${n === 1 ? "post" : "posts"}`,
  talkWorkPage: "Title page",
  talkEnterRoom: "Open the discussion",
  talkLibraryRooms: "Rooms from your library",
  talkAlsoInRoom: "Also in this room",
  talkOtherReviews: "Other reviews",
  talkAllReviews: "All reviews on the title page",
};

export type WebWords = typeof AR;

export function webWords(locale: Locale): WebWords {
  return locale === "en" ? EN : AR;
}
