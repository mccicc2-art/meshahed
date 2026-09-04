import { getCredits } from "@/lib/tmdb";
import type { MediaType } from "@/core/media";
import { getDict, type Locale } from "@/core/i18n";
import { PosterRail, RailItem } from "./PosterRail";
import { PosterCard } from "./PosterCard";

/**
 * طاقم العمل — الباب إلى صفحات الأشخاص.
 *
 * بلا اسمٍ قابلٍ للنقر تحت العمل لا يصل أحدٌ إلى صفحة ممثل إلا بالبحث عنه
 * بالاسم، وهو ما لا يفعله إلا من يعرفه أصلاً. فهذا الصفّ ليس زينة: هو ما
 * يجعل الميزة كلها مكتشَفة.
 *
 * والبطاقة هي `PosterCard` نفسها لا بطاقةً ثانية — الشخص محتوىً كالعمل،
 * ونفس النحو البصري (نسبة ٢:٣، زوايا الملصق، الاسم داخل تدرّجٍ أسفل
 * الصورة). ما تغيّر مقاسُ صورة TMDB وأيقونةُ الفراغ، وكلاهما خيارٌ داخل
 * البطاقة لا نسخةٌ منها.
 */
export async function CastRail({
  mediaType,
  tmdbId,
  locale,
  credits,
}: {
  mediaType: MediaType;
  tmdbId: number;
  locale: Locale;
  /**
   * 🆕 **وعدُ الطاقم من الصفحة** (D-889، `LOOPZ-AUD-0074`): هذا الرفُّ
   * خلف `Suspense`، **فنداؤه لا ينطلق إلا بعد أن تُحلّ موجةُ الصفحة
   * الرئيسة** — رحلةُ TMDB ثانيةٌ متسلسلةٌ بلا سبب (+313 ms وسيطاً
   * بارداً في القياس). الصفحةُ تُطلق `getCredits` **مع** موجتها وتمرّر
   * الوعدَ هنا. **اختياريّ**: من لا يمرّره يبقى على النداء الداخليّ
   * حرفاً (D-152) — صفحةُ الفيلم لم تُمسّ بعد.
   */
  credits?: Promise<Awaited<ReturnType<typeof getCredits>>>;
}) {
  const t = getDict(locale);
  const { cast, crew } = await (credits ?? getCredits(mediaType, tmdbId));
  if (cast.length === 0 && crew.length === 0) return null;

  return (
    <section className="space-y-5">
      {cast.length > 0 && (
        <PosterRail title={t.castTitle} icon="people">
          {cast.map((p) => (
            <RailItem key={p.id}>
              <PosterCard
                href={`/person/${p.id}`}
                title={p.name}
                posterPath={p.profile_path}
                posterSize="w185"
                fallbackIcon="people"
                note={p.character || undefined}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {crew.length > 0 && (
        /* من خلف الكاميرا صفٌّ ثانٍ لا مزجٌ في الأول: من يبحث عن المخرج
           لا يريد أن يمرّ على عشرين ممثلاً أولاً */
        <PosterRail title={t.crewTitle} icon="film">
          {crew.map((p) => (
            <RailItem key={`${p.id}-${p.job}`}>
              <PosterCard
                href={`/person/${p.id}`}
                title={p.name}
                posterPath={p.profile_path}
                posterSize="w185"
                fallbackIcon="people"
                note={jobName(p.job, t)}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}
    </section>
  );
}

/** TMDB يُرجع المهنة بالإنجليزية دائماً — تُترجَم هنا، وما لا نعرفه يمرّ كما هو */
function jobName(job: string, t: ReturnType<typeof getDict>): string {
  switch (job) {
    case "Director":
      return t.jobDirector;
    case "Creator":
      return t.jobCreator;
    case "Writer":
    case "Screenplay":
      return t.jobWriter;
    case "Executive Producer":
      return t.jobProducer;
    default:
      return job;
  }
}
