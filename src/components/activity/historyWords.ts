/**
 * 🆕 T412 — نصوصُ «سجلّ المشاهدة» في الويب وحده (القاموسُ المشتركُ لا يُلمس — يُطلق تحديثَ التطبيق).
 * ملفٌّ بلا "use client": يقرؤه مكوّنُ الخادم والعميلُ معاً (درسُ R247).
 */
export const HISTORY_WORDS = {
  ar: {
    sub: "كل ما شاهدته وقيّمته — مرّر على صفّ لتغيّر يومه أو تحذفه",
    subTouch: "كل ما شاهدته وقيّمته — ⋯ بجانب الصفّ لتغيّر يومه أو تحذفه",
    manual: "يدوي",
    sources: "من أين وصلت",
    sourcesSub: "مشاهدات آخر سبعة أيام",
    more: "خيارات",
  },
  en: {
    sub: "Everything you watched and rated — hover a row to change its day or remove it",
    subTouch: "Everything you watched and rated — ⋯ beside a row to change its day or remove it",
    manual: "By hand",
    sources: "Where they came from",
    sourcesSub: "Watches in the last seven days",
    more: "Options",
  },
} as const;
