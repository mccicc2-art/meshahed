"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import {
  BROWSE_GENRES,
  BROWSE_SORTS,
  browseGenreName,
  genreFitsType,
  type BrowseSort,
  type BrowseType,
} from "@/lib/browse";
import { tap } from "@/lib/haptics";

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
 * الترتيب لا يظهر إلا بعد أن يبدأ التصفّح فعلاً: في حالة السكون تكفي
 * صفوف «اكتشف» المنسّقة، وثلاثة صفوف من الأزرار فوقها ضجيجٌ بلا سبب.
 */
export function DiscoverFilters({
  locale,
  type,
  genre,
  sort,
  active,
}: {
  locale: Locale;
  type: BrowseType;
  /** slug النوع الدرامي المختار */
  genre: string | null;
  sort: BrowseSort;
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

  const SORTS: Record<BrowseSort, string> = {
    trending: t.browseSortTrending,
    top: t.browseSortTop,
    new: t.browseSortNew,
  };

  function go(next: { type?: BrowseType; g?: string | null; sort?: BrowseSort }) {
    const nextType = next.type ?? type;
    const nextSort = next.sort ?? sort;
    let nextGenre = next.g === undefined ? genre : next.g;

    // تغيير الجهة قد يُسقط النوع المختار: «رعب» لا وجود له في المسلسلات،
    // فبدل نتيجةٍ فارغة يعود الاختيار إلى «كل الأنواع»
    const found = BROWSE_GENRES.find((g) => g.slug === nextGenre);
    if (!found || !genreFitsType(found, nextType)) nextGenre = null;

    const params = new URLSearchParams();
    if (nextType !== "all") params.set("type", nextType);
    if (nextGenre) params.set("g", nextGenre);
    if (nextSort !== "trending") params.set("sort", nextSort);

    const qs = params.toString();
    tap(8);
    start(() => router.replace(qs ? `/news?${qs}` : "/news", { scroll: false }));
  }

  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-full text-sm border whitespace-nowrap transition ${
      on
        ? "bg-accent text-[color:var(--on-accent)] border-accent font-semibold"
        : "bg-surface text-muted border-border hover:text-foreground hover:border-accent/50"
    }`;

  const genres = BROWSE_GENRES.filter((g) => genreFitsType(g, type));

  return (
    <div
      className={`space-y-3 transition-opacity ${pending ? "opacity-60" : "opacity-100"}`}
    >
      {/* ===== جهة المحتوى: مقسّمٌ واحد لا ثلاث رقائق منفصلة ===== */}
      <div className="flex items-center gap-3">
        <div
          role="group"
          aria-label={t.browseTypeGroup}
          className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border"
        >
          {TYPES.map((o) => {
            const on = type === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => go({ type: o.value })}
                className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition ${
                  on
                    ? "bg-accent text-[color:var(--on-accent)] shadow-[0_4px_14px_rgba(0,0,0,0.35)]"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {active && (
          <button
            type="button"
            onClick={() => go({ type: "all", g: null, sort: "trending" })}
            className="ms-auto text-[12px] text-muted hover:text-accent transition shrink-0"
          >
            ✕ {t.browseReset}
          </button>
        )}
      </div>

      {/* ===== النوع الدرامي ===== */}
      {/* الهوامش السالبة تُلامس حافّة الشاشة فيبدو الصفّ مكمِّلاً خلفها،
          وoverscroll-x-contain يمنع التمرير الزائد من تفعيل «رجوع» iOS */}
      <div
        role="group"
        aria-label={t.browseGenreGroup}
        className="-mx-4 px-4 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-2 w-max pb-0.5">
          <button
            type="button"
            aria-pressed={!genre}
            onClick={() => go({ g: null })}
            className={chip(!genre)}
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
                className={chip(on)}
              >
                {browseGenreName(g, locale === "en" ? "en" : "ar")}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== الترتيب — لا يظهر إلا داخل التصفّح ===== */}
      {active && (
        <div
          role="group"
          aria-label={t.browseSortGroup}
          className="flex items-center gap-1.5 flex-wrap"
        >
          <span className="text-[11px] text-muted me-0.5">{t.browseSortGroup}</span>
          {BROWSE_SORTS.map((s) => {
            const on = sort === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => go({ sort: s })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                  on
                    ? "bg-accent/15 text-accent border-accent/50"
                    : "bg-transparent text-muted border-border hover:text-foreground"
                }`}
              >
                {SORTS[s]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
