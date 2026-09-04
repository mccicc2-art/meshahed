import type { Dict } from "@/core/i18n";
import type { LoopzNewsItem } from "@/lib/data";

/**
 * **جملةُ الخبر** — تُركَّب من حقائقَ في القاعدة لا تُقرأ نصّاً مخزَّناً
 * (D-211): فالخبرُ الواحد يُقرأ بالعربية والإنجليزية بلا عمودٍ ثانٍ، ومن
 * بدّل لغته وجد الخبرَ نفسَه بلغته، وتصحيحُ صياغةٍ يقع في `i18n.ts` وحده.
 *
 * **ولماذا خرجت من `LoopzNews.tsx` إلى وحدةٍ مستقلّة:** صارت الأخبارُ
 * صفوفاً داخل خطّ «النشاط» بجانب التعليقات (طلبُ أحمد: «الأخبار تُدمج مع
 * اكتيفتي»)، **فصار للجملة قارئان**. ونسخُها في الثاني كان يجعل تصحيح
 * صياغةٍ يقع في موضعين — **والعلاجُ عند المصدر لا عند كل قارئ** (D-148).
 */

/**
 * أسماءُ أشهر المنصّات بمعرّفات TMDB — **قائمةٌ قصيرةٌ مقصودة**: خبرُ
 * «صار على منصّة» لا يُكتب إلا لمن يعرفه القارئ، **وما لم نعرف اسمَه
 * يُقال «منصّةٌ جديدة» بلا اختراع**.
 */
const PROVIDERS: Record<number, string> = {
  8: "Netflix",
  9: "Prime Video",
  337: "Disney+",
  350: "Apple TV+",
  1899: "HBO Max",
  384: "HBO Max",
  283: "Crunchyroll",
  119: "Prime Video",
  2100: "Prime Video",
  1993: "Viu",
  188: "YouTube Premium",
  531: "Paramount+",
  386: "Peacock",
  1968: "Shahid",
  2178: "Shahid VIP",
  3000: "OSN+",
  1902: "StarzPlay",
};

/**
 * تنسيقُ يومٍ بلغة القارئ — **والأرقامُ لاتينيةٌ في اللغتين** (D-015)،
 * فالتقويمُ يُطلب بـ`nu-latn`. وما ليس تاريخاً يعود كما جاء بلا تخمين.
 */
export function newsDate(iso: unknown, locale: "ar" | "en"): string {
  const s = String(iso ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * **وما لا يعرفه القالبُ لا يُعرض**: خبرٌ بلا صيغةٍ صمتٌ لا خطأ — يعود
 * `null` فيُسقطه القارئ، ولا يظهر سطرٌ ناقصٌ ولا مفتاحٌ خام.
 */
export function newsLine(n: LoopzNewsItem, t: Dict, locale: "ar" | "en"): string | null {
  const d = (n.data ?? {}) as Record<string, string | number>;
  const day = (v: unknown) => newsDate(v, locale);
  switch (n.kind) {
    case "trailer":
      return t.newsTrailerOut(n.title);
    case "date":
      return d.from ? t.newsDateMoved(n.title, day(d.to)) : t.newsDateSet(n.title, day(d.to));
    case "season":
      return t.newsSeasonUp(n.title, Number(d.season) || 0);
    case "status":
      return d.status === "Ended"
        ? t.newsEnded(n.title)
        : d.status === "Canceled"
          ? t.newsCanceled(n.title)
          : t.newsReturning(n.title);
    case "season_date":
      return t.newsSeasonDate(n.title, Number(d.season) || 0, day(d.date));
    case "theatrical":
      return t.newsTheatrical(n.title, day(d.date));
    case "released":
      return t.newsOutNow(n.title);
    case "chart":
      return t.newsChart(n.title, Number(d.rank) || 0);
    case "provider": {
      const name = PROVIDERS[Number(d.provider)] ?? null;
      return name ? t.newsProvider(n.title, name) : t.newsProviderAny(n.title);
    }
    case "report":
      return d.event === "renewed"
        ? t.newsRenewed(n.title, Number(d.season) || 0)
        : d.event === "canceled"
          ? t.newsCanceled2(n.title)
          : t.newsDelayed(n.title);
    default:
      return null;
  }
}

/**
 * **سطرُ النسبة** (D-213): الحدثُ من الصحافة والجملةُ من عندنا، **فالمصدرُ
 * يُذكر دائماً**. ولا يُقرأ إلا لخبرٍ منقول (`report`)، وما بلا مصدرٍ
 * يعود `null` — **والإسنادُ ليس رخصةً فلا يُختلق اسم**.
 */
export function newsSource(n: LoopzNewsItem): { name: string; url: string | null } | null {
  const d = (n.data ?? {}) as Record<string, unknown>;
  if (n.kind !== "report" || typeof d.source !== "string") return null;
  return { name: d.source, url: typeof d.url === "string" ? d.url : null };
}
