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
   ⚠️ **وهي موجودةٌ على `main` قبل هذه الجولة** في `VerifyScreen`
   و`admin/verify` (D-775) — **دَينٌ مُعلَنٌ يُسدّ في جولةٍ باسمه.**
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

