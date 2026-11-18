/**
 * 🆕 T413 — نصوصُ «داعمو لوبز» في الويب، **بنصّ التطبيق** (`SupportersScreen.tsx › WORDS`) وما أضافه الويبُ («انضم للداعمين»).
 * ملفٌّ بلا "use client": صفحةُ الخادم وسطرُ الملفّ يقرآنه أيضاً (درسُ R247). والقاموسُ المشتركُ لا يُلمس.
 */
export const SUPPORTER_WORDS = {
  ar: {
    title: "داعمو لوبز",
    /* العددُ يحكم صيغةَ التمييز: ١–٢ بلا رقم، ٣–١٠ جمعٌ، ١١ فما فوق مفردٌ منصوب (كالتطبيق) */
    thanks: (n: number, s: string) => (n <= 2 ? "شكراً لداعمي لوبز ♡" : n <= 10 ? `شكراً لـ${s} داعمين ♡` : `شكراً لـ${s} داعماً ♡`),
    sub: "هؤلاء يُبقون لوبز بلا إعلانات",
    since: (d: string) => `داعم منذ ${d}`,
    line: (d: string | null) => (d ? `♡ داعم لوبز منذ ${d}` : "♡ داعم لوبز"),
    you: "أنت في اللوحة",
    shown: "ظاهر في اللوحة",
    hidden: "اسمك مخفيّ من اللوحة",
    showA11y: "إظهار اسمي في اللوحة",
    oldest: "الأقدم",
    newest: "الأحدث",
    empty: "لا داعمين ظاهرين بعد",
    note: "كل اسم يفتح ملفّه",
    failed: "تعذّر التحميل",
    joinTitle: "انضم للداعمين",
    joinBody: "اشتراك Gold يضعك هنا مع شارة GOLD بجانب اسمك.",
    joinCta: "اعرف عن Gold",
  },
  en: {
    title: "Loopz supporters",
    thanks: (n: number, s: string) => (n === 1 ? "Thank you, our supporter ♡" : `Thank you, ${s} supporters ♡`),
    sub: "They keep Loopz ad-free",
    since: (d: string) => `Supporter since ${d}`,
    line: (d: string | null) => (d ? `♡ Loopz supporter since ${d}` : "♡ Loopz supporter"),
    you: "You're on the board",
    shown: "Shown on the board",
    hidden: "Your name is hidden",
    showA11y: "Show my name on the board",
    oldest: "Oldest",
    newest: "Newest",
    empty: "No supporters shown yet",
    note: "Each name opens their profile",
    failed: "Couldn't load",
    joinTitle: "Join the supporters",
    joinBody: "A Gold subscription puts you here, with the GOLD badge beside your name.",
    joinCta: "About Gold",
  },
} as const;
