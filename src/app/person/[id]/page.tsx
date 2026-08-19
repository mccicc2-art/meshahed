import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUser, isFollowingArtist } from "@/lib/data";
import { FollowArtistButton } from "@/components/FollowArtistButton";
import { getPerson, getPersonCredits, isTvProgram, profileUrl, titleOf, yearOf } from "@/lib/tmdb";
import { displayPersonName } from "@/lib/wikidata";
import { segmentedItem, segmentedTrackFull } from "@/components/ui/controls";
import { getT } from "@/lib/locale";
import { formatDate } from "@/lib/when";
import { Icon, SectionTitle } from "@/components/Icon";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { ReadMore } from "@/components/ReadMore";
import { Alert } from "@/components/ui/Alert";
import { AddWorksToList } from "@/components/AddWorksToList";
import { buttonClass } from "@/components/ui/Button";

/**
 * صفحة ممثل أو مخرج.
 *
 * الثغرة التي تسدّها: البحث كان يجد الأعمال ولا يجد صنّاعها، فمن أحبّ أداءً
 * لم يكن أمامه طريقٌ لمعرفة أين رآه من قبل — وهو أكثر أسئلة المشاهدين
 * تكراراً بعد «ماذا أشاهد».
 *
 * ولا مكوّن جديد فيها: الترويسة تركيبُ صورةٍ ونصّ، والقصّة `ReadMore`،
 * والأعمال `PosterGrid` + `PosterCard`. الصفحة تستهلك نظام التصميم ولا
 * تضيف إليه.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = Number.isFinite(Number(id)) ? await getPerson(Number(id)) : null;
  if (!person) return {};
  return {
    title: person.name,
    description: person.biography.slice(0, 200) || person.name,
  };
}

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;
  const { w } = await searchParams;
  /* تبويب الأعمال في الرابط (D-031 deep-linkable): الكل الافتراضي */
  const worksTab = w === "tv" || w === "movie" || w === "show" ? w : "all";
  const personId = Number(id);
  if (!Number.isFinite(personId)) notFound();

  /* بالتوازي: صفّ المتابعة من القاعدة وبيانات الشخص من TMDB */
  const [person, following] = await Promise.all([
    getPerson(personId),
    isFollowingArtist(personId),
  ]);
  if (!person) {
    return (
      <div className="text-center py-24">
        <p className="text-muted mb-4">{t.personLoadFailed}</p>
        <Link href="/search" className={buttonClass({ size: "sm" })}>
          {t.navSearch}
        </Link>
      </div>
    );
  }

  /* الاسم بالعربية من ويكي‑بيانات إن وُجد (D-171): TMDB لا يترجم أسماء
     الأشخاص، فكانت صفحة «عادل إمام» تكتب `Adel Emam` في واجهةٍ عربية.
     والنداء لا يقع إلا إن كانت الواجهة عربية والاسمُ ليس عربياً أصلاً،
     وفشلُه صامتٌ يُبقي اسم TMDB. */
  const name = await displayPersonName(personId, person.name, locale);

  const photo = profileUrl(person.profile_path, "h632");
  const facts = [
    person.known_for_department ? departmentName(person.known_for_department, t) : null,
    person.birthday ? lifeSpan(person, t) : null,
    person.place_of_birth,
  ].filter(Boolean) as string[];

  return (
    <div>
      {/* ترويسة بعمودين: الصورة إلى جانب الحقائق لا فوقها — صورةٌ بعرض
          الشاشة تدفع الاسم والأعمال تحت الطيّة، والصفحة تُفتح لتُقرأ لا
          لتُعجَب بالصورة */}
      <div className="flex gap-4 sm:gap-5 items-start">
        <div className="w-28 sm:w-40 shrink-0">
          <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border">
            {photo ? (
              <Image
                src={photo}
                alt={name}
                fill
                priority
                sizes="(max-width: 640px) 112px, 160px"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-muted" aria-hidden>
                <Icon name="people" size={30} />
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-22 sm:text-3xl font-bold leading-tight tracking-tight">
            {name}
          </h1>
          <div className="mt-2 space-y-1">
            {facts.map((f) => (
              <p key={f} className="text-xs sm:text-sm text-muted">
                {f}
              </p>
            ))}
          </div>

          {/* زرّ المتابعة أولاً (الفعل اليوميّ)، ثم «أضِف أعماله إلى قائمة»
              (فعل العمر) — كلاهما في ترويسة الفنان يملآن عمود البيانات */}
          <FollowArtistButton
            personId={personId}
            name={name}
            profilePath={person.profile_path}
            initialFollowing={following}
            locale={locale}
            className="w-full justify-center mt-4"
          />
          <AddWorksToList
            id={personId}
            locale={locale}
            className="w-full justify-center mt-2"
          />
        </div>
      </div>

      {person.biography && (
        <section className="mt-7">
          <SectionTitle icon="info" className="mb-2.5">
            {t.personBioTitle}
          </SectionTitle>
          {person.biographyIsFallback && (
            /* الصدق أرخص من الادّعاء: النبذة إنجليزية لأن العربية غير
               مكتوبة في TMDB، ونقولها بدل أن نترك القارئ يظنّ التطبيق
               تجاهل لغته */
            <Alert className="mb-3">{t.personBioEnglishOnly}</Alert>
          )}
          <div dir={person.biographyIsFallback ? "ltr" : undefined}>
            <ReadMore text={person.biography} locale={locale} />
          </div>
        </section>
      )}

      <section className="mt-8">
        {/* الزرّ انتقل إلى ترويسة الفنان (D-052)؛ هنا العنوان وحده */}
        <SectionTitle icon="film" className="mb-3">
          {t.personWorksTitle}
        </SectionTitle>
        <Suspense
          fallback={
            <div
              className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(96px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]"
              aria-hidden
            >
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton aspect-[2/3] rounded-poster border border-border" />
              ))}
            </div>
          }
        >
          <PersonWorks personId={personId} t={t} worksTab={worksTab} />
        </Suspense>
      </section>
    </div>
  );
}

/** الأعمال تُبثّ بعد الترويسة — `combined_credits` طلبٌ ثقيل لا يؤخّر الاسم */
async function PersonWorks({
  personId,
  t,
  worksTab,
}: {
  personId: number;
  t: Awaited<ReturnType<typeof getT>>["t"];
  worksTab: "all" | "movie" | "tv" | "show";
}) {
  const all = await getPersonCredits(personId);
  if (all.length === 0) {
    return <p className="text-sm text-muted text-center py-10">{t.personNoWorks}</p>;
  }

  /* التصنيف الثلاثي (طلب أحمد): ظهورات التوك شو كانت تُغرق السيرة —
     البرامج (أخبار/واقع/توك شو بأنواع TMDB) تبويبٌ مستقل لا خلطٌ بالدراما */
  const groups = {
    all,
    movie: all.filter((r) => r.media_type === "movie"),
    tv: all.filter((r) => r.media_type === "tv" && !isTvProgram(r)),
    show: all.filter((r) => isTvProgram(r)),
  };
  const works = groups[worksTab];

  const tabs: { id: "all" | "movie" | "tv" | "show"; label: string; n: number }[] = [
    { id: "all", label: t.browseAll, n: groups.all.length },
    { id: "movie", label: t.shortMovies, n: groups.movie.length },
    { id: "tv", label: t.shortShows, n: groups.tv.length },
    { id: "show", label: t.personTabPrograms, n: groups.show.length },
  ];

  return (
    <>
      {/* روابط لا حالة عميل: الرابط يحمل التبويب، وكاش الراوتر (D-088)
          يجعل التنقل بينها لحظياً بعد أول زيارة */}
      <div className={`${segmentedTrackFull} mb-4`} role="tablist" aria-label={t.personWorksTitle}>
        {tabs.map(({ id, label, n }) => (
          <Link
            key={id}
            role="tab"
            aria-selected={worksTab === id}
            href={id === "all" ? `/person/${personId}` : `/person/${personId}?w=${id}`}
            scroll={false}
            className={segmentedItem(
              worksTab === id,
              "flex-1 basis-0 min-w-0 flex items-center justify-center gap-1.5 px-2 pt-1.5 pb-3 text-14",
              false,
            )}
          >
            <span className="truncate">{label}</span>
            <span className="text-12 tabular-nums opacity-75" dir="ltr">{n}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted mb-3">{t.personWorksCount(works.length)}</p>
      <PosterGrid>
        {works.map((w) => (
          <PosterCard
            key={`${w.media_type}-${w.id}`}
            href={`/${w.media_type === "tv" ? "show" : "movie"}/${w.id}`}
            title={titleOf(w)}
            posterPath={w.poster_path}
            year={yearOf(w)}
            badge={w.media_type === "tv" ? (isTvProgram(w) ? t.typeProgram : t.typeSeries) : t.typeMovie}
          />
        ))}
      </PosterGrid>
    </>
  );
}

/** مهنة الشخص الأساسية — TMDB يكتبها بالإنجليزية دائماً */
function departmentName(dep: string, t: Awaited<ReturnType<typeof getT>>["t"]): string {
  switch (dep) {
    case "Acting":
      return t.depActing;
    case "Directing":
      return t.depDirecting;
    case "Writing":
      return t.depWriting;
    case "Production":
      return t.depProduction;
    default:
      return dep;
  }
}

/**
 * سطر الميلاد — ومعه العمر أو سنة الوفاة.
 *
 * العمر يُحسب من تاريخي الميلاد والوفاة معاً: من مات لا يكبر، وحسابه من
 * اليوم يعطي رقماً خاطئاً بصمت.
 */
function lifeSpan(
  person: { birthday: string | null; deathday: string | null },
  t: Awaited<ReturnType<typeof getT>>["t"],
): string {
  if (!person.birthday) return "";
  const born = formatDate(person.birthday, t);
  const end = person.deathday ? new Date(person.deathday) : new Date();
  const start = new Date(person.birthday);
  let age = end.getUTCFullYear() - start.getUTCFullYear();
  const m = end.getUTCMonth() - start.getUTCMonth();
  if (m < 0 || (m === 0 && end.getUTCDate() < start.getUTCDate())) age--;

  if (person.deathday) {
    return `${born} — ${formatDate(person.deathday, t)} (${t.personAgeAtDeath(age)})`;
  }
  return `${born} · ${t.personAge(age)}`;
}
