import { PosterCard } from "@/components/PosterCard";
import { PlusPreview } from "@/components/stats/PlusPreview";
import { ProfileStatSheet } from "@/components/ProfileStatSheet";
import { buttonClass } from "@/components/ui/Button";
import { tallyGenres } from "@/components/LibraryAnalysis";
import { tasteMatch, onlyTheirs } from "@/core/tasteMatch";
import { getFollows, getFollowsOf, getFollowGenresOf, getProfile } from "@/lib/data";
import { isPlus } from "@/core/plan";
import { browseGenreForId, browseGenreName } from "@/core/browse";
import { getDict, num, type Locale } from "@/core/i18n";

/**
 * ============ «أنت وهو» — بابٌ في بطاقة الذوق (D-814 → ⚖️ D-829) ============
 *
 * **حكمُ أحمد بلقطةٍ محوَّطة**: «المقارنة خلها في زر هنا وبعدها يفتح
 * قسم فيه المقارنة منفصلة عن كارد الشخص».
 *
 * ⚖️ **ونقضٌ مسجَّلٌ لموضعِ D-814 لا لحجّتها**: تلك وضعت القسمَ **أعلى
 * الصفحة** بحجّة «الزائرُ جاء ليقيس نفسَه به لا ليقرأ أرقامَه» —
 * **والحجّةُ تصف سببَ الفتح لا حقَّ القسم في صدر الصفحة**: **قسمٌ
 * بارتفاع شاشةٍ يعلو بطاقةَ صاحب الملفّ يدفع صاحبَ الصفحة تحت الطَّيّ
 * في صفحةٍ اسمُها باسمه.** **فالمقارنةُ صارت باباً في بطاقة الذوق —
 * حيث تسكن**، **والقسمُ خلفه كاملاً بلا قصّ.**
 *
 * 🔑 **وموضعُ الباب ليس ذوقاً**: **المقارنةُ ذوقٌ، وبطاقةُ الذوق هي
 * بيتُها** — **وبابٌ يجلس بعيداً عمّا يفتحه يُقرأ زينةَ ترويسة.**
 *
 * 🔑 **والنسبةُ على وجه الباب لا خلفه**: **بابٌ مكتوبٌ عليه «المقارنة»
 * يُفتح مرّةً من الفضول**، **وبابٌ مكتوبٌ عليه «٦٢٪» يُفتح ليُعرف
 * ممَّ جاء الرقم.** **وهي قاعدةُ الضباب نفسُها** (D-809): **أوّلُ
 * حقيقةٍ تُعطى بلا ثمن، والتفصيلُ خلفها.**
 *
 * ⚠️ **ولا ورقةَ جديدةٌ ولا زرَّ جديد** (القاعدة ٣/D-018/D-017):
 * `ProfileStatSheet` بعينها — **الوجهُ يُمرَّر إليها والقسمُ مرسومٌ من
 * الخادم** (درسُ D-238) — **و`buttonClass` هي مصدرُ شكل الزرّ**،
 * **ورتبةُ `xs` هي التي وُلدت لزرٍّ يجاور كلمةً** (D-634).
 *
 * ⚖️ **ولا هجرةَ ولا دالّةَ قاعدةٍ جديدة**: الدوالُّ الثلاثُ قائمةٌ
 * ومحروسةٌ بـ`can_view_profile` (الهجرتان ١٤٢/١٤٥) — **فحسابٌ خاصٌّ لا
 * تخرج منه صفوفٌ أصلاً، والبابُ يغيب ولا يُرسم قفلاً كاذباً.**
 *
 * ⚠️ **ولا يُرسم لصاحب الملفّ نفسِه** (مقارنةُ المرء بنفسه ١٠٠٪ لا تقول
 * شيئاً) **ولا لزائرٍ بلا حساب** (لا ذوقَ له يُقارَن به) — **وزرٌّ لا
 * يفتح شيئاً وعدٌ فارغ** (D-217/D-346).
 */
export async function TasteMatchDoor({
  targetId,
  targetName,
  locale,
}: {
  targetId: string;
  targetName: string;
  locale: Locale;
}) {
  const ar = locale !== "en";
  const t = getDict(locale);
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
     مصدرٍ لا فرقُ قاعدة** (D-182). */
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

  /* ⚠️ **ولا عنوانَ داخلَ الورقة**: **الورقةُ تحمل اسمَها في ترويستها**
     (`ProfileStatSheet`) — **وعنوانٌ ثانٍ تحته يقول الشيءَ مرّتين**
     (D-664). */
  const open = (
    <section>
      {/* ═══ النسبةُ — الرقمُ الكبيرُ وحدَه، بلا رسمٍ يزاحمه ═══ */}
      <div className="flex items-baseline gap-3">
        <p className="text-[52px] leading-none font-bold tracking-tight text-accent tabular-nums">
          {num(match.pct, locale)}%
        </p>
        <p className="text-14 text-muted leading-tight">{t.tasteMatchLabel}</p>
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
          <h3 className="text-14 font-bold mb-1">
            {ar ? "تجتمعان على" : "You both watch"}
          </h3>
          {/* **ووسيلةُ إيضاحٍ واحدةٌ للقسمين** — تُكتب مرّةً فوق أوّلهما */}
          <p className="text-12 text-muted mb-2.5 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-2 h-2 rounded-full bg-accent" />
              {ar ? "أنت" : "You"}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-2 h-2 rounded-full bg-[color:var(--muted)]" />
              {targetName}
            </span>
          </p>
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
                {/* 🔴 **ورقمان بلا صاحبٍ لا يُقرآن** (D-814، من الصفحة
                    الحيّة): **اللونُ هو الفارق** — الهويّةُ لك والخافتُ
                    له، **والاسمان في السطر أعلاه** (D-142). */}
                <bdi className="tabular-nums font-bold text-accent">{num(r.mine, locale)}%</bdi>
                <span className="text-muted"> / </span>
                <bdi className="tabular-nums text-muted">{num(r.theirs, locale)}%</bdi>
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
    <ProfileStatSheet
      title={ar ? `أنت و${targetName}` : `You and ${targetName}`}
      closeLabel={t.closeLabel}
      /* ⚠️ **والمرئيُّ رتبةٌ وهدفُ اللمس أوسعُ منه** (D-033/D-634):
         `-my-2 py-2` تمدّ الصندوقَ إلى ~٤٢ بكسلاً **بلا أن تزيح سطرَ
         العنوان** — وهي وصفةُ `HeaderTrailing` نفسُها (٢٤ مرئيّاً في ٤٤).
         **و`ms-auto` على الزرّ لا على غلافٍ ثالث**: **الفراغُ ملكُ
         المجموعة** (D-634). */
      className="ms-auto shrink-0 -my-2 py-2 active:opacity-70 transition"
      content={
        isPlus(me) ? (
          <>
            {open}
            {locked}
          </>
        ) : (
          /* 🔒 **والقسمُ كلُّه بلس** (D-783 §٣) **والقفلُ ضبابٌ لا بابٌ
             مغلق** (D-809): **النسبةُ مكشوفةٌ لأنها الطُّعم، والتفصيلُ
             مموَّه** — **ومن رأى ما يشتريه اشتراه.** */
          <PlusPreview locale={locale} open={open} locked={locked} />
        )
      }
    >
      <span className={buttonClass({ variant: "surface", size: "xs" })}>
        <bdi className="tabular-nums font-bold text-accent">
          {num(match.pct, locale)}%
        </bdi>
        <span className="font-normal text-muted">{t.tasteMatchLabel}</span>
      </span>
    </ProfileStatSheet>
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
 * **وعكسُ المفتاحِ إلى اسمِه مكتوبٌ مرّةً هنا.**
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
