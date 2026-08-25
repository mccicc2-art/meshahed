// سجلُّ المنصّات الموثوقة — آمنٌ للخادم والمتصفّح معاً (لا اعتماد على next).
//
// 🆕 **D-608، طلبُ أحمد**: «الضغط على شعار المنصّة يؤدّي إلى العمل داخل
// المنصّة نفسها، بدل تحويل المستخدم تلقائيًا إلى JustWatch».
//
// ============ لماذا الاسمُ لا المعرّف مفتاحَ السجلّ ============
//
// TMDB تُرقّم المنصّاتِ بمعرّفاتٍ عدديّة، **وقائمةُ أرقامٍ منسوخةٌ من
// الذاكرة تخمينٌ** — والاسمُ (`provider_name`) يصل مع كلِّ صفٍّ من TMDB
// نفسِها، **فمطابقتُه أصدقُ من رقمٍ قد يُكتب خطأً ولا يراجعه أحد.**
// والمعرّفُ يبقى مفتاحَ التخزين في `provider_content_links` — من بيانات
// TMDB الحيّة لا من هذا الملفّ.
//
// ============ قاعدتان صارمتان ============
//
// ١) **https حصراً ونطاقٌ من القائمة** — رابطٌ خارجهما لا يُرسم ولا
//    يُحفظ (والقاعدةُ تفحص https مرّةً ثانية — دفاعُ عمق).
// ٢) **لا مسارَ بحثٍ غيرَ مجرَّب**: كلُّ قالبٍ أدناه فُتح فعلاً يوم
//    كتابته ورُئيت نتائجُه (٢٥ أغسطس ٢٠٢٦) — **ومنصّةٌ بلا قالبٍ
//    مجرَّبٍ لا تحصل على صفِّ بحثٍ أصلاً** (D-217: لا زرَّ لفعلٍ لا
//    يقع)، ويبقى لها خيارُ JustWatch الصريح.

interface ProviderRule {
  /** مطابقةُ اسم TMDB بعد خفضه — كلماتٌ مميِّزة لا مساواةٌ حرفيّة */
  match: (name: string) => boolean;
  /** النطاقاتُ الموثوقة — المضيفُ نفسُه أو نطاقٌ فرعيٌّ منه */
  hosts: string[];
  /** رابطُ البحث الرسميُّ المجرَّب — غيابُه يعني «لا صفَّ بحث» */
  search?: (q: string) => string;
  /** منصّةٌ عربيّةُ الفهرس — يُفضَّل العنوانُ العربيُّ في بحثها */
  arabicQuery?: boolean;
}

const RULES: ProviderRule[] = [
  {
    match: (n) => n.includes("netflix"),
    hosts: ["netflix.com"],
    search: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    match: (n) => n.includes("shahid"),
    hosts: ["shahid.mbc.net"],
    // مجرَّب: `term` هو المعامل الذي يكتبه موقعُ شاهد نفسُه عند الكتابة
    // في حقله (`/ar/search?q=` يفتح الصفحةَ ويتجاهل النصّ)
    search: (q) => `https://shahid.mbc.net/search?term=${encodeURIComponent(q)}`,
    arabicQuery: true,
  },
  {
    match: (n) => n.includes("amazon") || n.includes("prime"),
    hosts: ["primevideo.com", "amazon.com"],
    search: (q) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(q)}`,
  },
  {
    match: (n) => n.includes("apple"),
    hosts: ["tv.apple.com"],
    search: (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
  },
  {
    match: (n) => n.includes("youtube"),
    hosts: ["youtube.com"],
    search: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  { match: (n) => n.includes("disney"), hosts: ["disneyplus.com"] },
  { match: (n) => n.includes("osn"), hosts: ["osnplus.com", "osn.com"] },
  { match: (n) => n.includes("starz"), hosts: ["starzplay.com"] },
  // ‏\btod\b كلمةً كاملة — «tod» تعيش داخل أسماءَ أخرى
  { match: (n) => /\btod\b/.test(n), hosts: ["tod.tv"] },
  { match: (n) => n.includes("google play"), hosts: ["play.google.com"] },
  { match: (n) => n.includes("yango"), hosts: ["yangoplay.com"] },
  { match: (n) => n.includes("watch it"), hosts: ["watchit.com"] },
];

function ruleFor(providerName: string): ProviderRule | null {
  const n = (providerName ?? "").trim().toLowerCase();
  if (!n) return null;
  return RULES.find((r) => r.match(n)) ?? null;
}

/** هل هذا الرابطُ https على نطاقٍ موثوقٍ **لهذه المنصّة بعينها**؟ */
export function isTrustedProviderUrl(providerName: string, url: string): boolean {
  const rule = ruleFor(providerName);
  if (!rule) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return rule.hosts.some((h) => host === h || host === `www.${h}` || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/**
 * رابطُ البحث الرسميُّ للمنصّة — أو `null` لمن لا قالبَ مجرَّباً لها.
 * العنوانُ الأصليُّ مع سنة الإصدار، **والعربيُّ لمنصّةٍ فهرسُها عربيّ**
 * (شاهد) حين يتوفّر.
 */
export function providerSearchUrl(
  providerName: string,
  query: { q: string; qAr: string | null },
): string | null {
  const rule = ruleFor(providerName);
  if (!rule?.search) return null;
  const text = (rule.arabicQuery && query.qAr ? query.qAr : query.q).trim();
  return text ? rule.search(text) : null;
}

/** أسماءُ أحداث الاستخدام الأربعة — بلا بياناتٍ شخصيّة (D-608) */
export type ProviderEvent =
  | "provider_open_direct"
  | "provider_open_search"
  | "provider_open_justwatch"
  | "provider_link_missing";
