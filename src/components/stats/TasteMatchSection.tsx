import { PosterCard } from "@/components/PosterCard";
import { PlusPreview } from "@/components/stats/PlusPreview";
import { tallyGenres } from "@/components/LibraryAnalysis";
import { tasteMatch, onlyTheirs } from "@/lib/tasteMatch";
import { getFollows, getFollowsOf, getFollowGenresOf, getProfile } from "@/lib/data";
import { isPlus } from "@/lib/plan";
import { browseGenreForId, browseGenreName } from "@/lib/browse";
import { num, type Locale } from "@/lib/i18n";

/**
 * ============ «أنت وهو» — مقارنةُ ذوقين (D-814) ============
 *
 * **حكمُ أحمد**: «المقارنة».
 *
 * 🔑 **ولمَ هي أوّلُ ما بُني بعد التقرير**: **بطاقةُ المشاركة تجلب
 * غريباً من الخارج، وهذه تجعل الأعضاء يشدّون بعضهم من الداخل** —
 * اتّجاهان لمحرّكٍ واحد. **وبصمةُ الذوق بلا مقارنةٍ بلا مسطرة**: من
 * يقرأ «٢٥٪ دراما» لا يعرف أكثيرٌ هذا أم قليل — **وهي علّةُ المعدّل
 * اليوميّ في D-808 مطبَّقةً على الذوق.**
 *
 * ⚖️ **ولا هجرةَ ولا دالّةَ قاعدةٍ جديدة**: **الدوالُّ الثلاثُ قائمةٌ
 * ومحروسة** (`user_public_follows` · `user_follow_genres` — الهجرتان
 * ١٤٢/١٤٥ خلف `can_view_profile`) — **فحسابٌ خاصٌّ لا تخرج منه صفوفٌ
 * أصلاً، والقسمُ يغيب ولا يُرسم قفلاً كاذباً.**
 *
 * 🔒 **والقسمُ كلُّه بلس** (حكمُ الكشف D-783 §٣: **القائمُ في
 * `/stats` مجّانيٌّ والجديدُ كلُّه بلس**) — **والقفلُ ضبابٌ لا بابٌ
 * مغلق** (D-809): **النسبةُ مكشوفةٌ لأنها الطُّعم، والتفصيلُ مموَّه.**
 *
 * ⚠️ **ولا يُرسم لصاحب الملفّ نفسِه** — **مقارنةُ المرء بنفسه ١٠٠٪ لا
 * تقول شيئاً** — **ولا لزائرٍ بلا حساب**: لا ذوقَ له يُقارَن به.
 */
export async function TasteMatchSection({
  targetId,
  targetName,
  locale,
}: {
  targetId: string;
  targetName: string;
  locale: Locale;
}) {
  const ar = locale !== "en";
  const me = await getProfile();
  /* **الزائرُ وصاحبُ الملفّ لا يُرسم لهما** — والغيابُ صمتٌ لا رسالة */
  if (!me || me.id === targetId) return null;

  const [mine, theirs, theirGenres] = await Promise.all([
    getFollows(),
    getFollowsOf(targetId),
    getFollowGenresOf(targetId),
  ]);
  if (!mine.length || !theirs.length) return null;

  /* 🔑 **والعدُّ بالدالّة نفسِها التي تعدّ لصفحة الإحصائيات** (D-145):
     **مقياسان لذوقٍ واحدٍ يفترقان عند أوّل تعديل.** ⚠️ **ومكتبتي
     تحمل تصنيفَها في الصفّ، ومكتبتُه في خريطةٍ ثانية** — **وهو فرقُ
     مصدرٍ لا فرقُ قاعدة** (D-182: عمودٌ جديدٌ لا يُقحم في استعلامٍ قائم). */
  const { bySlug: myTally } = tallyGenres(
    mine.map((f) => f.genres ?? null),
    locale,
  );
  const { bySlug: theirTally } = tallyGenres(
    theirs.map((f) => theirGenres.get(`${f.media_type}-${f.tmdb_id}`) ?? null),
    locale,
  );

  const match = tasteMatch(myTally, theirTally);
  /* **وبياناتٌ أقلُّ من أن تُقارَن تغيب ولا تُملأ برقم** (D-063/D-217) */
  if (match.thin) return null;

  const picks = onlyTheirs(mine, theirs, 12);

  const open = (
    <section>
      <h2 className="text-20 font-bold mb-3">
        {ar ? `أنت و${targetName}` : `You and ${targetName}`}
      </h2>
      {/* ═══ النسبةُ — الرقمُ الكبيرُ وحدَه، بلا رسمٍ يزاحمه ═══ */}
      <div className="flex items-baseline gap-3">
        <p className="text-[52px] leading-none font-bold tracking-tight text-accent tabular-nums">
          {num(match.pct, locale)}%
        </p>
        <p className="text-14 text-muted leading-tight">
          {ar ? "تطابقُ الذوق" : "taste match"}
        </p>
      </div>
      {/* 🔑 **وسطرٌ يقول ما قِيس** (D-800): **نسبةٌ بلا تعريفٍ تُقرأ
          حكماً على شخص** — **وهي حصصُ الأنواع لا الأعمالُ نفسُها.** */}
      <p className="text-12 text-muted mt-2 leading-relaxed">
        {ar
          ? "محسوبٌ من حصص الأنواع في مكتبتيكما — لا من الأعمال نفسها."
          : "Measured from the genre mix of both libraries — not the titles themselves."}
      </p>
    </section>
  );

  const locked = (
    <>
      {match.shared.length > 0 && (
        <section className="mt-6">
          <h3 className="text-14 font-bold mb-2.5">
            {ar ? "تجتمعان على" : "You both watch"}
          </h3>
          <ul className="space-y-2.5">
            {match.shared.map((r) => (
              <li key={r.slug} className="flex items-center gap-3">
                <span className="text-14 basis-[30%] max-w-[8rem] shrink-0 leading-tight">
                  {genreLabel(r.slug, locale)}
                </span>
                {/* **شريطان في مسارٍ واحد**: نصيبي فوق ونصيبُه تحت —
                    **وعمودان متجاوران يجعلان العينَ تقفز مرّتين لكلِّ صفّ.** */}
                <span className="flex-1 min-w-0 space-y-1">
                  <Bar pct={r.mine} tone="accent" />
                  <Bar pct={r.theirs} tone="muted" />
                </span>
                <span className="text-12 tabular-nums shrink-0 w-16 text-end leading-tight">
                  <span className="block text-accent font-bold">{num(r.mine, locale)}%</span>
                  <span className="block text-muted">{num(r.theirs, locale)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {match.apart.length > 0 && (
        <section className="mt-6">
          <h3 className="text-14 font-bold mb-2.5">
            {ar ? "وتفترقان في" : "Where you differ"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {match.apart.map((r) => (
              <span
                key={r.slug}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-12 leading-none"
              >
                {genreLabel(r.slug, locale)}
                <span className="text-muted"> · </span>
                <bdi className="tabular-nums">
                  {num(r.mine, locale)}% / {num(r.theirs, locale)}%
                </bdi>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ═══ الثمرة — **مقارنةٌ لا تنتهي إلى شيءٍ يُشاهَد رقمٌ يُنظر إليه مرّة** ═══ */}
      {picks.length > 0 && (
        <section className="mt-7">
          <h3 className="text-14 font-bold mb-3">
            {ar ? "في مكتبته وليست عندك" : "In their library, not yours"}
          </h3>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
            {picks.map((f) => (
              <div key={`${f.media_type}-${f.tmdb_id}`} className="w-[104px] shrink-0">
                <PosterCard
                  href={`/${f.media_type === "tv" ? "show" : "movie"}/${f.tmdb_id}`}
                  title={f.title}
                  posterPath={f.poster_path}
                  titleBelow
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );

  return (
    <div className="mt-2">
      {isPlus(me) ? (
        <>
          {open}
          {locked}
        </>
      ) : (
        <PlusPreview locale={locale} open={open} locked={locked} />
      )}
    </div>
  );
}

/** شريطُ حصّة — **مقياسٌ واحدٌ للصفّين** فلا يُقارَن طولان بمرجعين */
function Bar({ pct, tone }: { pct: number; tone: "accent" | "muted" }) {
  return (
    <span className="relative block h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <span
        aria-hidden
        className={`absolute inset-y-0 start-0 rounded-full ${
          tone === "accent" ? "bg-accent" : "bg-[color:var(--muted)]"
        }`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </span>
  );
}

/**
 * **اسمُ النوع من مفتاحه** — **وسجلُّ `browse` هو المصدرُ الوحيد**
 * (D-145): `tallyGenres` تعرف الاسمَ ولا تصدّره إلّا مع القمّة،
 * **وعكسُ المفتاحِ إلى اسمِه مكتوبٌ مرّةً هنا** (وهو الدَّينُ المُعلَنُ
 * في رأس `tallyGenres` بنصّه: «عكسٌ يُكتب مرّتين يفترق مرّة»).
 */
function genreLabel(slug: string, locale: Locale): string {
  const g = GENRE_BY_SLUG.get(slug);
  return g ? browseGenreName(g, locale) : slug;
}

const GENRE_BY_SLUG = (() => {
  const m = new Map<string, NonNullable<ReturnType<typeof browseGenreForId>>>();
  /* **معرّفاتُ TMDB المعروفة** — والسجلُّ يترجمها إلى مفاهيمه */
  const IDS = [
    28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878,
    10770, 53, 10752, 37, 10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768,
  ];
  for (const id of IDS) {
    const g = browseGenreForId(id);
    if (g && !m.has(g.slug)) m.set(g.slug, g);
  }
  return m;
})();
