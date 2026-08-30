import { num, type Locale } from "@/lib/i18n";

/**
 * ============ صياغةُ أرقام الإحصائيات — مصدرٌ واحد (D-799) ============
 *
 * **ولمَ في `lib` لا داخل مكوّن**: **قارئوها ثلاثة** — «تقريرك»
 * والتبويباتُ الأربعة — **ودالّةٌ تُستورَد من مكوّنٍ تجرّ المكوّنَ كلَّه
 * معها** (D-376: عند القارئ الثاني يُستخرج).
 */
/* 🔴 **ولا مقاسَ خطٍّ خارج السلّم** (D-799): السلّمُ في `globals.css`
   **١٢ · ١٤ · ١٥ · ٢٠ · ٢٢ · ٢٤** وكلُّها مضروبةٌ في `--fs` (معامل حجم
   الخطّ الذي يختاره القارئ). **و`text-13` و`text-17` أصنافٌ لا وجودَ
   لها** — **لا تُخطئ، بل لا تُولَّد أصلاً**، فيرث النصُّ مقاسَ أبيه
   **ويصمت العطلُ عن نفسه.**
   ✅ **والدَّينُ المُعلَنُ هنا سُدّ** (D-811): **سبعةَ عشرَ موضعاً في
   `VerifyScreen` و`admin/verify` و`/plus` و`/trailers` و`TrailerRail`**
   — **وكانت كلُّها تُرسم ١٦ بكسلاً** (افتراضُ المتصفّح، إذ لا مقاسَ على
   `body`) — **فصارت عناوينُ الأقسام والشروحُ أكبرَ من عنوان الصفحة
   نفسِه.** 🔑 **والصنفُ الذي لا يُولَّد لا يصغّر النصّ، يُطلقه.**
   ⚖️ **والأرقامُ العرضيّةُ وحدَها بمقاسٍ حرّ** (`text-[52px]`) — عُرفُ
   `LibraryAnalysis` القائم، **وثمنُه أنها لا تكبر مع تفضيل القارئ.** */
/** «12h 48m» — **والساعةُ تُكتب وحدَها حين لا دقائق** */
export function hm(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${num(m, locale)}m`;
  if (m === 0) return `${num(h, locale)}h`;
  return `${num(h, locale)}h ${num(m, locale)}m`;
}

/** «4:12» فوق العمود — **ساعةٌ ونقطتان ودقيقتان**، كما في الصورة */
export function clock(minutes: number, locale: Locale): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${num(h, locale)}:${String(m).padStart(2, "0")}`;
}

/** «9–11 PM» — **بصيغة ١٢ ساعةً كما في الصورة** */
export function primeLabel(hours: [number, number]): string {
  const f = (h: number) => {
    const x = h % 24;
    const ampm = x >= 12 ? "PM" : "AM";
    const hh = x % 12 === 0 ? 12 : x % 12;
    return { hh, ampm };
  };
  const a = f(hours[0]);
  const b = f(hours[1]);
  return a.ampm === b.ampm ? `${a.hh}–${b.hh} ${b.ampm}` : `${a.hh} ${a.ampm} – ${b.hh} ${b.ampm}`;
}


/**
 * ============ سطرُ افتتاح التقرير — قاعدةٌ واحدةٌ لقارئَين (D-810) ============
 *
 * **ولمَ خرج من `ReportView`**: **قارئُه الثاني وُلد** — بطاقةُ مشاركة
 * التقرير ترسم الجملةَ نفسَها على صورة (D-810) — **ودالّةٌ تُنسخ في
 * سطحين تفترق عند أوّل تعديل** (D-145/D-376: **عند القارئ الثاني
 * يُستخرج، لا قبله ولا بعده**).
 *
 * ⚖️ **وحدودُ الصدق من D-808 بحرفها**: **٢٥٪ للعمل الواحد**، **٥٥٪
 * للصنف الغالب** — **وإلّا فالمعدّلُ وحدَه.** **وجملةٌ تُكتب لتُملأ
 * تصير زخرفةً تتخطّاها العين** (D-063).
 *
 * ⚠️ **والمَدخلُ بنيويٌّ لا `PeriodStats`**: **`periodStats` تستورد
 * `server-only`** — **ونوعٌ يُستورد منها يشدّ الملفَّ إلى الخادم بلا
 * حاجة.** **والحقولُ الأربعةُ هي كلُّ ما تقرؤه هذه الدالّة**، فتُطلَب
 * بأعيانها.
 */
export interface ReportLead {
  /** المعدّلُ اليوميُّ مصوغاً — «4h 4m» */
  avg: string;
  /** ما بعده مباشرةً — «في اليوم — و» أو «في اليوم.» */
  tail: string;
  /**
   * 🔴 **الشطرُ الأوّلُ تامّاً بلا اسمِ العمل** (D-810) — **لسطحٍ لا
   * يحتمل اسماً داخل جملة.**
   * **وعلّتُه مقيسةٌ لا متوقَّعة**: **satori تقلب حروفَ الكلمة العربيّة
   * التي تبدأ بـ«** — «صراع» خرجت «عارص» في الرسم المحلّيّ — **ثمّ
   * يلتفّ السطرُ فينكسر في غير موضعه.** **واسمُ العمل مرسومٌ تحته في
   * «الأكثر مشاهدة» باسمه ووقته**، **فالجملةُ تخسر زينةً لا خبراً.**
   */
  plain: string;
  /** نسبةُ العمل الأوّل — «31٪» — وغيابُها يعني: لا شطرَ ثانيَ صادق */
  pct?: string;
  /** ذيلُ النسبة — « منها «Lost».» */
  after?: string;
}

export function reportLead(
  s: {
    dailyAvgMin: number;
    minutes: number;
    topTitles: { title: string; minutes: number }[];
    mix: { key: "shows" | "movies" | "anime"; pct: number }[];
  },
  locale: Locale,
): ReportLead | null {
  if (s.dailyAvgMin <= 0) return null;
  const ar = locale !== "en";
  const avg = hm(s.dailyAvgMin, locale);

  const top = s.topTitles[0];
  const topPct = top && s.minutes > 0 ? Math.round((top.minutes / s.minutes) * 100) : 0;
  if (top && topPct >= 25) {
    return {
      avg,
      tail: ar ? "في اليوم — و" : "a day — and ",
      plain: ar ? "في اليوم." : "a day.",
      pct: `${num(topPct, locale)}${ar ? "٪" : "%"}`,
      after: ar ? ` منها «${top.title}».` : ` of it was ${top.title}.`,
    };
  }

  const kind = [...s.mix].sort((a, b) => b.pct - a.pct)[0];
  if (kind && kind.pct >= 55) {
    const word = ar
      ? kind.key === "anime"
        ? "أنمي"
        : kind.key === "movies"
          ? "أفلاماً"
          : "مسلسلات"
      : kind.key === "anime"
        ? "anime"
        : kind.key === "movies"
          ? "films"
          : "series";
    /* **والصنفُ الغالبُ كلمةٌ عربيّةٌ لا اسمُ عمل** — **فيسلم في
       الصورة كما يسلم في الصفحة**، و`plain` تساويه. */
    const t = ar ? `في اليوم — ومعظمُها ${word}.` : `a day — and most of it ${word}.`;
    return { avg, tail: t, plain: t };
  }

  const t = ar ? "في اليوم." : "a day.";
  return { avg, tail: t, plain: t };
}
