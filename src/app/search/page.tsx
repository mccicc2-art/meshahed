import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getLibState } from "@/lib/libState";
import { searchMulti, searchPeople, titleOf, yearOf } from "@/lib/tmdb";
import { getT } from "@/lib/locale";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { Icon } from "@/components/Icon";
import { matchNationality } from "@/lib/nationality";
import { matchBrowseIntent } from "@/lib/intent";
import { browseHref } from "@/lib/browse";
import { roleName, type Locale } from "@/lib/i18n";
import { SearchBox } from "@/components/SearchBox";
import { Alert } from "@/components/ui/Alert";
import { OneTimeHint } from "@/components/OneTimeHint";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { q = "" } = await searchParams;

  // النتائج خلف Suspense: كان طلب TMDB يحجب الصفحة كلها بما فيها صندوق
  // البحث نفسه — فيختفي الصندوق الذي كتب المستخدم فيه للتو طوال الاستعلام.
  // الآن الصندوق يرسم فوراً والنتائج تلحق بهيكل شبكة.
  return (
    <div>
      {/* «فلتر الاكتشاف» غادر هذه الصفحة (D-177) — رجع أحمد عن طلب D-174
          بنصّه، والفلترُ عاد إلى رأس اكتشف رمزاً بلا كلمة. */}
      <div className="max-w-xl mx-auto mb-8">
        <Suspense fallback={null}>
          <SearchBox big locale={locale} />
        </Suspense>
        <div className="mt-3">
          <OneTimeHint id="search-intro" text={t.hintSearch} closeLabel={t.closeLabel} />
        </div>
      </div>

      <Suspense
        key={q}
        fallback={
          q ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="skeleton aspect-[2/3] rounded-poster border border-border" />
              ))}
            </div>
          ) : null
        }
      >
        <SearchResults q={q} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

/** نتائج البحث — تجلب بياناتها بنفسها فلا تحجب رسم الصندوق */
async function SearchResults({
  q,
  t,
  locale,
}: {
  q: string;
  t: Awaited<ReturnType<typeof getT>>["t"];
  locale: Locale;
}) {
  const nationality = q ? matchNationality(q) : null;
  /* بحثٌ يفهم النية (طريق ١٠/١٠): «افلام كوميدية 2023» → رقاقة فلاتر.
     رقاقة الجنسية أولى عند التعارض — رقاقتان فوق النتائج ضجيج */
  const intent = nationality ? null : matchBrowseIntent(q, locale === "en" ? "en" : "ar");
  let results: Awaited<ReturnType<typeof searchMulti>> = [];
  let people: Awaited<ReturnType<typeof searchPeople>> = [];
  let failed = false;
  if (q) {
    try {
      // الأشخاص والأعمال معاً: `/search/multi` يُرجع الاثنين لكن الترتيب
      // بينهما ترتيبُ شعبيةٍ مختلط، فيضيع الممثل بين عشرين ملصقاً.
      // طلبان متوازيان وصفّان منفصلان أوضح، وتكلفتهما واحدة
      [results, people] = await Promise.all([searchMulti(q), searchPeople(q, 12)]);
    } catch {
      failed = true;
    }
  }

  /* 🆕 **والضغطُ المطوّل يعمّ البحثَ أيضاً** (بقيّةُ D-322): الإيماءةُ
     صارت في كلِّ رفوف اكتشف، **ونتائجُ البحث سطحُ اكتشافٍ كسائرها** —
     **وإيماءةٌ تعمل في نصف الأسطح تُنسى في كلِّها** (D-277: إيماءةٌ واحدةٌ
     لمالكٍ واحد، وسطحٌ يخالف يُعلّم القارئَ ألّا يجرّبها).
     ⚠️ **وثلاثةُ نداءاتٍ للصفحة كلِّها لا لكلِّ ملصق** — `getLibState`
     مغلَّفةٌ بـ`cache` (D-205)، **وسقوطُها يعني «ليس عندك» لا شاشةَ خطأ**. */
  const lib = q && !failed ? await getLibState().catch(() => null) : null;

  return (
    <>
      {failed && (
        <Alert center className="mb-4">
          {t.searchFailed}
        </Alert>
      )}

      {q && !failed && (
        <p className="text-muted text-sm mb-4">{t.searchResultsFor(q, results.length)}</p>
      )}

      {/* ===== رقاقة الجنسية =====
          TMDB لا يفهم «مسلسلات سعودية» — مسار البحث عنده يطابق العناوين
          وحدها. فبدل نتائجَ لا علاقة لها، يُقترح الطريق الصحيح: فلتر
          «اكتشف» ببلد الإنتاج. اقتراحٌ واحد فوق النتائج، لا شاشةٌ تتبدّل
          حسب الكلمة — يُؤخذ أو يُتجاهل بلا ثمن */}
      {nationality && (
        <Link
          href={browseHref({ lang: nationality.lang, co: nationality.country })}
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-accent hover:bg-accent/20 transition"
        >
          <Icon name="compass" size={18} className="shrink-0" />
          <span className="text-sm font-semibold">
            {t.searchBrowseFrom(locale === "en" ? nationality.en : nationality.ar)}
          </span>
          <span className="ms-auto shrink-0" aria-hidden>
            <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
          </span>
        </Link>
      )}

      {intent && (
        <Link
          href={intent.href}
          className="mb-5 flex items-center gap-2.5 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-accent hover:bg-accent/20 transition"
        >
          <Icon name="compass" size={18} className="shrink-0" />
          <span className="text-sm font-semibold">{t.searchIntentChip(intent.label)}</span>
          <span className="ms-auto shrink-0" aria-hidden>
            <Icon name="chevron-down" size={16} className="-rotate-90 rtl:rotate-90" />
          </span>
        </Link>
      )}

      {/* الأعمال فوق الأشخاص (طلب أحمد بفيديو «godf»: الأشخاص كانوا
          يدفنون العراب تحتهم — من يكتب اسم عملٍ أكثر، والممثل يبقى صفاً
          واضحاً تحت النتائج). وتحت اسم الشخص مهنته وحدها لا أعماله */}
      {results.length > 0 ? (
        <PosterGrid>
          {results.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`}
              title={titleOf(r)}
              posterPath={r.poster_path}
              year={yearOf(r)}
              badge={r.media_type === "tv" ? t.typeSeries : t.typeMovie}
              hold={
                lib
                  ? {
                      tmdbId: r.id,
                      mediaType: r.media_type === "tv" ? "tv" : "movie",
                      locale,
                      ...lib.of(r.id, r.media_type),
                    }
                  : undefined
              }
            />
          ))}
        </PosterGrid>
      ) : q && people.length === 0 ? (
        <p className="text-center text-muted py-16">{t.searchNoResults}</p>
      ) : !q ? (
        <p className="text-center text-muted py-16">{t.searchStart}</p>
      ) : null}

      {people.length > 0 && (
        <div className={results.length > 0 ? "mt-8" : ""}>
          <PosterRail title={t.searchPeopleTitle} icon="people">
            {people.map((p) => (
              <RailItem key={p.id}>
                <PosterCard
                  href={`/person/${p.id}`}
                  title={p.name}
                  posterPath={p.profile_path}
                  posterSize="w185"
                  fallbackIcon="people"
                  note={roleName(p.known_for_department, t)}
                />
              </RailItem>
            ))}
          </PosterRail>
        </div>
      )}
    </>
  );
}
