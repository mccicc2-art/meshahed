import type { Locale } from "@/core/i18n";

/**
 * ====== 🆕 T414 — نصوصُ «المشهد» (الترحيبُ العريض على الويب وحدَه) ======
 *
 * ⚖️ **هنا لا في `core/i18n`**: قاعدةُ هذه الجولات «كلُّ شغلنا عالويب بدون ما نلمس التطبيق» — وملفُّ الترجمة
 * المشترك يُطلق تحديثاً هوائيّاً للتطبيق. وما يشترك فيه الوجهان (عناوينُ الخطوات · الأزرار · الدعوة) يُقرأ من `t`
 * كما هو؛ هنا ما لا يقوله إلّا الحاسوب. وملفٌّ عاديٌّ لا `"use client"` — قاعدةُ R248.
 */
const AR = {
  steps: ["أنت", "أعمالك", "أين وصلت", "أنواعك", "أشخاص"],
  cardTitle: "بطاقتك في Loopz",
  cardHint: "ما تكتبه هنا يُطبع على بطاقتك مباشرة — وهذا ما يراه أصدقاؤك",
  member: "عضو · MEMBER",
  since: "عضو منذ",
  invitedBy: "بدعوة من",
  changePhoto: "غيّر الصورة",
  stampHint: "إن قلت نعم يُختَم اسمه على بطاقتك",
  pickKicker: "ماذا شاهدت؟",
  pickHint: "اضغط على ما شاهدته أو تشاهده — ومرّر على أي عمل فتتغيّر الشاشة له",
  shelves: { show: "مسلسلات", movie: "أفلام", anime: "أنمي" } as Record<"show" | "movie" | "anime", string>,
  watched: "شاهدته",
  added: "أضفته",
  findHere: "ابحث في هذه الأعمال…",
  noMatch: "لا عمل بهذا الاسم هنا",
  picked: (n: number) => (n === 1 ? "عمل واحد" : n === 2 ? "عملان" : n <= 10 ? `${n} أعمال` : `${n} عملاً`),
  oneIsEnough: "يكفي واحد لتبدأ",
  seasons: (n: number) => (n === 1 ? "موسم واحد" : n === 2 ? "موسمان" : n <= 10 ? `${n} مواسم` : `${n} موسماً`),
  progressHint: "اضغط آخر حلقة شاهدتها — وكل ما قبلها يُعلَّم تلقائياً",
  movieHint: "هل شاهدت هذا الفيلم؟",
  lastSeen: "آخر حلقة شاهدتها",
  notSet: "لم تحدّد",
  next: (name: string) => `التالي: ${name}`,
  ep: (n: number) => `ح${n}`,
  at: (s: number, e: number) => `م${s} · ح${e}`,
  noEpisodes: "لا حلقات معروضة بعد",
  optional: "اختياريّة",
  genresN: (n: number) => (n === 1 ? "نوع واحد" : n === 2 ? "نوعان" : n <= 10 ? `${n} أنواع` : `${n} نوعاً`),
  last: "الأخيرة",
  follow: "تابع",
  followingNow: "تتابعه",
  invitedYou: "دعاك",
  prevEps: "الحلقات السابقة",
  nextEps: "الحلقات التالية",
  prevRail: "السابق",
  nextRail: "التالي",
};

const EN: typeof AR = {
  steps: ["You", "Titles", "Progress", "Genres", "People"],
  cardTitle: "Your Loopz card",
  cardHint: "What you type is printed on your card — it's what your friends see",
  member: "MEMBER",
  since: "Member since",
  invitedBy: "Invited by",
  changePhoto: "Change photo",
  stampHint: "Say yes and their name is stamped on your card",
  pickKicker: "What have you watched?",
  pickHint: "Click what you've watched or are watching — hover any title to bring it on screen",
  shelves: { show: "Series", movie: "Movies", anime: "Anime" },
  watched: "Watched it",
  added: "Added",
  findHere: "Search these titles…",
  noMatch: "No title by that name here",
  picked: (n: number) => (n === 1 ? "1 title" : `${n} titles`),
  oneIsEnough: "One is enough to start",
  seasons: (n: number) => (n === 1 ? "1 season" : `${n} seasons`),
  progressHint: "Click the last episode you watched — everything before it is marked for you",
  movieHint: "Have you watched this movie?",
  lastSeen: "Last episode you watched",
  notSet: "Not set",
  next: (name: string) => `Next: ${name}`,
  ep: (n: number) => `E${n}`,
  at: (s: number, e: number) => `S${s} · E${e}`,
  noEpisodes: "No episodes have aired yet",
  optional: "optional",
  genresN: (n: number) => (n === 1 ? "1 genre" : `${n} genres`),
  last: "last",
  follow: "Follow",
  followingNow: "Following",
  invitedYou: "Invited you",
  prevEps: "Earlier episodes",
  nextEps: "Later episodes",
  prevRail: "Previous",
  nextRail: "Next",
};

export type SceneWords = typeof AR;

export function sceneWords(locale: Locale): SceneWords {
  return locale === "en" ? EN : AR;
}
