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
  /* 🆕 R266 — القوائم على الحاسوب */
  listYourProgress: "تقدّمك",
  listOfWatched: (n: string) => `من ${n} شاهدتها`,
  listNextUp: "التالي:",
  listAllItems: "ترتيب القائمة",
  listUnwatched: "لم أشاهدها",
  listNew: "قائمة جديدة",
  savedAll: "الكل",
  savedDone: "أكملتها",
  listWatchedOf: (a: string, b: string) => `شاهدت ${a} من ${b}`,
  /* 🆕 R267 — صفحةُ الممثّل على الحاسوب */
  personKnownFor: "أشهر أعماله",
  personAsRole: (r: string) => `بدور ${r}`,
  /* 🆕 R268 — ملخّصُ الشهر في التقويم على الحاسوب */
  calThisMonth: "هذا الشهر",
  calEpisodesN: "حلقة",
  calMoviesN: "فيلم",
  calWorksN: "عمل",
  /* 🆕 R269 — تقييماتي على الحاسوب */
  ratingsNewest: "الأحدث",
  ratingsTop: "الأعلى تقييماً",
  ratingsAvg: "معدّلك",
  ratingsCount: "تقييم",
  ratingsHasComment: "بتعليق",
  ratingsDist: "توزيع تقييماتك",
  ratingsDistHint: "اضغط رقماً لعرض أعماله فقط",
  ratingsDistClear: "اضغط الرقم نفسه لعرض الكل",
  /* 🆕 R273 — Trakt والاستيراد على الويب (بدل جملة «VIP» القديمة التي لم تثبت) */
  traktHint: "اربط حسابك في Trakt ونجلب مشاهداتك وتقييماتك مرة وحدة. بعد الاستيراد نفك الربط تلقائياً، فما ياخذ مكان تطبيقاتك الثانية المربوطة بـTrakt.",
  traktOff: "ربط Trakt ما تفعّل بعد على Loopz. إلى أن يتفعّل: صدّر بياناتك من Trakt وارفع الملف في بطاقة Simkl — قارئها يقبل أي تصدير فيه معرّفات TMDB.",
  importLocalNote: "يُقرأ الملف في جهازك ولا يُرفع إلى أي خادم — تُرسل أسماء الأعمال فقط لمطابقتها.",
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
  listYourProgress: "Your progress",
  listOfWatched: (n: string) => `of ${n} watched`,
  listNextUp: "Next:",
  listAllItems: "List order",
  listUnwatched: "Not watched",
  listNew: "New list",
  savedAll: "All",
  savedDone: "Finished",
  listWatchedOf: (a: string, b: string) => `Watched ${a} of ${b}`,
  personKnownFor: "Known for",
  personAsRole: (r: string) => `as ${r}`,
  calThisMonth: "This month",
  calEpisodesN: "Episodes",
  calMoviesN: "Movies",
  calWorksN: "Titles",
  ratingsNewest: "Newest",
  ratingsTop: "Highest rated",
  ratingsAvg: "Your average",
  ratingsCount: "Ratings",
  ratingsHasComment: "Commented",
  ratingsDist: "Your ratings",
  ratingsDistHint: "Click a score to show only those titles",
  ratingsDistClear: "Click the same score to show all",
  traktHint: "Connect your Trakt account and we bring in your watches and ratings once. Right after the import we disconnect, so it never takes the place of your other apps connected to Trakt.",
  traktOff: "Trakt linking isn't enabled on Loopz yet. Until it is: export your data from Trakt and upload the file in the Simkl card — its reader accepts any export carrying TMDB ids.",
  importLocalNote: "The file is read on your device and never uploaded — only titles are sent to be matched.",
};

export type WebWords = typeof AR;

export function webWords(locale: Locale): WebWords {
  return locale === "en" ? EN : AR;
}
