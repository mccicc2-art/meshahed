/**
 * 🆕 T409 — نصوصُ «الربط» في الويب **في ملفٍّ بلا "use client"**: صفحةُ `/links` (مكوّنُ خادم) تقرأ منها عنوانَها الفرعيّ، ومكوّنُ
 * الخادم لا يقدر أن يقرأ قيمةً من ملفِّ عميل (يصله مرجعٌ لا الكائن — خطأُ React رقم ٤٤١ الذي أسقط الصفحةَ في R247).
 */
/** نصوصُ الويب وحده (الفأرةُ لا الإصبع، وما لا يجري إلّا في التطبيق) — القاموسُ المشتركُ لا يُلمس */
export const LINK_WORDS = {
  ar: {
    sub: "تطبيقاتك التي تشاهد منها — ما تُنهيه عليها يصل Loopz",
    stremioNeeds: "إضافة Loopz في Stremio",
    stremioAsks: "Stremio يسأل دائماً",
    dragHint: "اسحب تطبيقاً من القائمة إلى خانة فارغة، أو اضغط «اربط»",
    tapHint: "اضغط «اربط» بجانب التطبيق، أو خانةً فارغة",
    link: "اربط",
    manage: "صفحته",
    askHome: "كل ما تُنهيه على تطبيق مربوط يسألك عنه Loopz في الرئيسية: شفتها؟",
    plexInApp: "من تطبيق Loopz على جوالك: يقرأ مكتبات سيرفرك من شبكة البيت",
    inApp: "في التطبيق",
    free: "مجاناً لتطبيق · ٥ مع Plus",
    fromApps: (name: string) => `من تطبيقاتك · ${name}`,
    waiting: (n: number) => (n > 1 ? `و${n - 1} غيرها تنتظر` : ""),
  },
  en: {
    sub: "The apps you watch on — what you finish there reaches Loopz",
    stremioNeeds: "The Loopz add-on in Stremio",
    stremioAsks: "Stremio always asks",
    dragHint: "Drag an app from the list onto an empty slot, or press Link",
    tapHint: "Press Link beside an app, or an empty slot",
    link: "Link",
    manage: "Open",
    askHome: "Whatever you finish on a linked app, Loopz asks you about on Home: watched it?",
    plexInApp: "In the Loopz app on your phone: it reads your server's libraries on your home network",
    inApp: "In the app",
    free: "Free for one app · 5 with Plus",
    fromApps: (name: string) => `From your apps · ${name}`,
    waiting: (n: number) => (n > 1 ? `${n - 1} more waiting` : ""),
  },
} as const;
