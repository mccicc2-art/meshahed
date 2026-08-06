"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import {
  BROWSE_GENRES,
  browseGenreName,
  genreFitsType,
  type BrowseType,
} from "@/lib/browse";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { chipClass, chipRow, segmentedItem, segmentedTrack } from "./ui/controls";

/**
 * فلاتر التصفّح في «اكتشف».
 *
 * الحالة في الرابط لا في الذاكرة: `/news?type=movie&g=drama` قابل
 * للمشاركة وللرجوع، والصفحة تُرسم على الخادم بالفلتر مطبَّقاً فلا وميضَ
 * قائمةٍ قديمة قبل الجديدة. وقيمُ الافتراض تُحذف من الرابط فيبقى نظيفاً.
 *
 * `replace` لا `push`: الرقائق تُلمس عشرات المرّات في جلسةٍ واحدة، ولو
 * سجّلنا كلّ لمسة لصار زرّ الرجوع يمشي بالمستخدم خطوةً خطوة عبر فلاترٍ
 * جرّبها ونسيها بدل أن يخرجه من التصفّح.
 *
 * لا صفَّ ترتيبٍ هنا: الفلتر لم يعد يفتح شبكةَ نتائجٍ تُرتَّب، بل يعيد
 * صفوف «اكتشف» نفسها مقصورةً على ما اختاره — ولكل صفٍّ ترتيبه بحكم
 * معناه (الأفضل، القادم، في السينما). قرارُ المالك، ويُحدَّث به D-023.
 *
 * ومدخل البحث يجلس في صفّ جهة المحتوى لا فوقه: كان الصفّ يترك فراغاً
 * بعرض الشاشة إلى جانب ثلاث كلمات، والبحث أولى بذلك الفراغ من سطرٍ
 * كاملٍ يزيح الصفوف إلى أسفل.
 */
export function DiscoverFilters({
  locale,
  type,
  genre,
  active,
}: {
  locale: Locale;
  type: BrowseType;
  /** slug النوع الدرامي المختار */
  genre: string | null;
  active: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();

  const TYPES: { value: BrowseType; label: string }[] = [
    { value: "all", label: t.browseAll },
    { value: "movie", label: t.browseMovies },
    { value: "tv", label: t.browseSeries },
  ];

  function go(next: { type?: BrowseType; g?: string | null }) {
    const nextType = next.type ?? type;
    let nextGenre = next.g === undefined ? genre : next.g;

    // تغيير الجهة قد يُسقط النوع المختار: «رعب» لا وجود له في المسلسلات،
    // فبدل نتيجةٍ فارغة يعود الاختيار إلى «كل الأنواع»
    const found = BROWSE_GENRES.find((g) => g.slug === nextGenre);
    if (!found || !genreFitsType(found, nextType)) nextGenre = null;

    const params = new URLSearchParams();
    if (nextType !== "all") params.set("type", nextType);
    if (nextGenre) params.set("g", nextGenre);

    const qs = params.toString();
    tap(8);
    start(() => router.replace(qs ? `/news?${qs}` : "/news", { scroll: false }));
  }

  const genres = BROWSE_GENRES.filter((g) => genreFitsType(g, type));

  return (
    <div
      className={`space-y-3 transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}
    >
      {/* ===== جهة المحتوى والبحث في سطرٍ واحد ===== */}
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label={t.browseTypeGroup}
          className={`${segmentedTrack} shrink-0`}
        >
          {TYPES.map((o) => {
            const on = type === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => go({ type: o.value })}
                className={segmentedItem(on)}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {/* مدخل البحث — حقلٌ شكليّ يفتح صفحة البحث، على عادة تبويبات
            «اكتشف» في التطبيقات الكبيرة */}
        <Link
          href="/search"
          className="min-w-0 flex-1 flex items-center gap-2 bg-surface border border-border rounded-full px-3.5 py-2 text-[13px] text-muted hover:border-accent/60 active:bg-surface-2 transition"
        >
          <Icon name="search" size={16} className="shrink-0" />
          <span className="truncate">{t.searchPlaceholder}</span>
        </Link>

        {active && (
          <button
            type="button"
            onClick={() => go({ type: "all", g: null })}
            title={t.browseReset}
            aria-label={t.browseReset}
            className="shrink-0 grid place-items-center w-8 h-8 rounded-full text-muted hover:text-accent active:bg-surface-2 transition"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* ===== النوع الدرامي ===== */}
      {/* الهوامش السالبة تُلامس حافّة الشاشة فيبدو الصفّ مكمِّلاً خلفها،
          وoverscroll-x-contain يمنع التمرير الزائد من تفعيل «رجوع» iOS */}
      <div
        role="group"
        aria-label={t.browseGenreGroup}
        className={chipRow}
      >
        <div className="flex gap-2 w-max pb-0.5">
          <button
            type="button"
            aria-pressed={!genre}
            onClick={() => go({ g: null })}
            className={chipClass(!genre)}
          >
            {t.browseAllGenres}
          </button>
          {genres.map((g) => {
            const on = genre === g.slug;
            return (
              <button
                key={g.slug}
                type="button"
                aria-pressed={on}
                onClick={() => go({ g: on ? null : g.slug })}
                className={chipClass(on)}
              >
                {browseGenreName(g, locale === "en" ? "en" : "ar")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
