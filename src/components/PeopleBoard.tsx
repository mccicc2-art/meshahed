import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, num, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { dirOf } from "@/lib/dir";
import type {
  PeopleLeaderRow,
  PeopleTopReviewRow,
  PeopleWatchingRow,
  SuggestedPerson,
} from "@/lib/data";
/* **من `people.ts` لا من `data.ts`**: ملفٌّ نقيٌّ لا يسحب عميلَ الخادم
   (D-193) — والنوعُ واحدٌ في الحالتين، **والأنقى أولى.** */
import type { PersonLite } from "@/lib/people";
import { PersonName } from "./PersonRow";
import { FollowUserButton } from "./FollowUserButton";
import { Icon, type IconName } from "./Icon";

/**
 * **أقسامُ تبويب «الناس»** (D-263 · D-264 · الهجرتان ٨١ و٨٢).
 *
 * ================= ⚠️ إعادةُ تصميمٍ بلوحة أحمد =================
 *
 * **حكمُ أحمد على النسخة الأولى: «التصميم سيء».** وكانت صفوفاً مكدّسةً
 * بخطوطٍ فاصلة — **وهي وصفةُ خطٍّ يُمسح لا وصفةُ لوحةٍ تُتصفَّح**:
 * الصفُّ الطويل يقول «اقرأني بالترتيب»، **واللوحةُ تقول «انظر من هنا»**.
 * فصارت **بطاقاتٍ ثلاثاً في الصفّ**، ولكلِّ قسمٍ **رأسٌ برمزٍ و«عرض
 * الكل»** كما في لوحته حرفاً.
 *
 * ================= وما لم يُنقل من اللوحة، ولماذا =================
 *
 * **١) «٢٤٥ نقطة» لم تُنقل** — **وأحمد أكّد العددَ الصريح بسؤالٍ ثانٍ.**
 * فالبطاقةُ تحمل «٨ تفاعلات» **ومكوّناتِها تحتها** (مشاركة · رأي ·
 * إعجاب): **رقمٌ لا يستطيع أحدٌ مراجعتَه يُفقِد الثقةَ بالصفحة كلِّها**
 * (D-219). **والمراجعةُ تُكتب ولا تُترك ممكنة** — ولهذا سطران لا سطر.
 *
 * **٢) «تطابق ٩٢٪» ورقاقاتُ الأنواع لم تُنقل** (اختيارُ أحمد): **لا
 * نملك أيّاً منهما في القاعدة**، ونسبةٌ مخترَعةٌ هي «النقطة» نفسُها في
 * ثوبٍ آخر. **والسببُ الحقيقيُّ في موضعها**: «يشاركك ٦ أعمال» — محسوبٌ
 * من مكتبتك وقابلٌ للمراجعة (D-216/D-126).
 *
 * **٣) قسما المتابعة صارا واحداً** (اختيارُ أحمد): مصدرُهما عندنا
 * `people_to_follow` وحدها، **وقسمان من مصدرٍ واحد يعرضان الأشخاصَ
 * أنفسَهم مرّتين** — وقد تكرّر Razan وM7MD في اللوحة نفسِها.
 *
 * **٤) «ما أضافه الأعضاء إلى مكتباتهم» ليس في اللوحة وبقي** — قسمٌ
 * مبنيٌّ ببياناتٍ حقيقية، **وحذفُ ما يعمل لأنه غاب عن رسمةٍ ليس تصميماً.**
 *
 * ================= ولا قسمَ فارغاً يُرسم =================
 *
 * كلُّ مكوّنٍ هنا يعيد `null` حين لا صفَّ له، **والصفحةُ تُعلن الفراغَ
 * مرّةً واحدةً حين تفرغ الخمسةُ معاً** (D-181/D-263).
 */

/* ============================================================
   وصفةُ القسم — رأسٌ برمزٍ و«عرض الكل»
   ============================================================
   **رمزٌ من `Icon.tsx` لا إيموجي**: لوحةُ أحمد ملوّنةٌ بالإيموجي،
   **والإيموجي يُرسم بخطّ النظام فيختلف شكلاً ولوناً بين أندرويد وآيفون**
   — وهو نصُّ قرارِ `Icon.tsx` منذ أوّل يوم. **الرموزُ ترث `currentColor`
   فتتبع الثيم**، ولا عائلةَ ثانية (D-002). */
export function BoardSection({
  icon,
  title,
  seeAllHref,
  seeAllLabel,
  children,
}: {
  icon: IconName;
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="mt-6 pt-5 border-t border-[color:var(--divider)] first:mt-0 first:pt-0 first:border-t-0"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold min-w-0">
          <Icon name={icon} size={17} className="text-accent shrink-0" />
          <span className="truncate">{title}</span>
        </h2>
        {seeAllHref && seeAllLabel && (
          <Link
            href={seeAllHref}
            prefetch={false}
            className="shrink-0 text-[12px] text-muted hover:text-accent transition"
          >
            {seeAllLabel}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * **البحثُ بالاسم داخل التبويب** (D-266) — **آخرُ ما بقي من D-262.**
 *
 * **ونموذجُ `GET` لا مكوّنُ عميل:** `searchPeople` تعيش في `data.ts` منذ
 * زمن **ولها سطحٌ واحدٌ في ورقة المحادثات**، وبناءُ سطحٍ ثانٍ بحالةٍ
 * وتأخيرٍ ونداءٍ لكل حرف **يشتري لمعةً بثمنِ ملفٍّ ثالث**.
 * **والنتيجةُ في الرابط** (`?tab=people&q=…`): تُشارَك، ويعود منها الظهر،
 * **وتُرسم على الخادم فلا تومض** (D-051/D-054) — **وهي القاعدة نفسُها
 * التي بُني عليها «عرض الكل».**
 *
 * ⚠️ **والبحثُ يبتلع اللوحةَ ولا يجاورها**: هو مرشِّحٌ لا قسمٌ سادس،
 * **ولوحةٌ تحت نتائجِ بحثٍ تُقرأ ضجيجاً** — **وفراغُ المرشِّح ليس فراغَ
 * الصفحة** (D-106/D-181).
 *
 * ⚠️ **ونفسي لا أظهر في نتائجي**: زرُّ «متابعة» على وجهك **يعد بما تمنعه
 * القاعدة** (D-217).
 */
export function PeopleSearch({
  q,
  results,
  followingIds,
  meId,
  locale,
}: {
  q: string;
  results: PersonLite[];
  /** **من أتابعهم** — **وزرُّ «متابعة» على من تتابعه كذبةٌ صغيرة** (D-238) */
  followingIds: Set<string>;
  meId: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const term = q.trim();
  const searching = term.length >= 2;
  const list = results.filter((p) => p.id !== meId);

  return (
    <div className="mb-5">
      {/* **حقلٌ ١٦px وهدفُ لمسٍ ٤٤** (D-033/D-168) — ووصفةُ الحقل هي
          وصفةُ `NewListForm` نفسُها، لا ثانيةٌ لها (D-145) */}
      <form method="get" action="/people" className="flex items-center gap-2">
        <input type="hidden" name="tab" value="people" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={t.peopleSearchPlaceholder}
          aria-label={t.peopleSearchPlaceholder}
          className="flex-1 min-w-0 min-h-11 rounded-control bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
        />
        <button
          type="submit"
          aria-label={t.navSearch}
          title={t.navSearch}
          className="shrink-0 w-11 h-11 grid place-items-center rounded-control border border-border text-muted hover:text-accent hover:border-[color:var(--divider)] transition"
        >
          <Icon name="search" size={17} />
        </button>
      </form>

      {/* **والحدُّ يُقال قبل أن يُصطدم به** — لا بعد ضغطةٍ تعود فارغة */}
      {term.length > 0 && !searching && (
        <p className="mt-2 text-xs text-muted">{t.peopleSearchHint}</p>
      )}

      {searching &&
        (list.length === 0 ? (
          <p className="mt-4 text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
            {t.searchNoResults}
          </p>
        ) : (
          <CardGrid>
            {list.map((p) => (
              <PersonCard key={p.id}>
                <PersonName person={p} t={t} size={56} vertical />
                <div className="w-full flex justify-center">
                  <FollowUserButton
                    targetId={p.id}
                    locale={locale}
                    initialFollowing={followingIds.has(p.id)}
                  />
                </div>
              </PersonCard>
            ))}
          </CardGrid>
        ))}
    </div>
  );
}

/** **ثلاثٌ في الصفّ على كل عرض** — وبطاقةُ الشخص واحدةٌ في الأقسام الثلاثة */
function CardGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-3 gap-2.5">{children}</ul>;
}

function PersonCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface border border-border">
      {children}
    </li>
  );
}

/**
 * **شارةُ المرتبة** — ذهبٌ وفضّةٌ وبرونز كما في اللوحة، **وما بعد الثالث
 * رقمٌ صامت**: الميداليةُ تمييزٌ، **وميداليةٌ للعاشر تُلغي معنى الأولى.**
 */
function RankBadge({ rank, locale }: { rank: number; locale: Locale }) {
  const tone =
    rank === 1
      ? "bg-accent text-black"
      : rank === 2
        ? "bg-[#C8CCD4] text-black"
        : rank === 3
          ? "bg-[#B77B45] text-white"
          : "bg-surface-2 text-muted border border-border";
  return (
    <span
      aria-hidden
      className={`absolute -bottom-1 -start-1 w-[22px] h-[22px] rounded-full grid place-items-center text-[11px] font-extrabold tabular-nums ${tone}`}
    >
      {num(rank, locale)}
    </span>
  );
}

/**
 * **لوحةُ النشاط — قسمان من نداءٍ واحد** (D-198).
 *
 * `mode="top"` يسأل عن **حجم** النافذة، و`mode="rising"` عن **الفرق**
 * بينها وبين التي قبلها. **والدالّةُ ترجع النافذتين معاً فالواجهةُ تطرح.**
 *
 * ⚠️ **والفرزُ هنا لا في SQL**: الدالّةُ ترتّب بالمجموع، **والصاعدُ قد
 * يكون العاشرَ مجموعاً وهو الأوّل فرقاً** — فلو قُصّت القائمةُ في القاعدة
 * بثلاثةٍ لصار القسمُ الثاني نسخةً من الأوّل بترتيبٍ آخر.
 *
 * **والنافذةُ متدحرجةٌ سبعةَ أيام** (اختيارُ أحمد حين سُئل عن معنى
 * «أسبوعيّ»): **تُحسب عند كل فتحةٍ من `now()`** فلا cron ولا لقطة —
 * **والرقمُ يتحرّك كلَّ يوم ولا ينتظر السبت.**
 */
export function PeopleLeaderboard({
  rows,
  locale,
  mode,
  limit = 3,
  seeAllHref,
}: {
  rows: PeopleLeaderRow[];
  locale: Locale;
  mode: "top" | "rising";
  limit?: number;
  seeAllHref?: string;
}) {
  const t = getDict(locale);

  /* **ومن لم يصعد لا يظهر في «الصاعدين»**: فرقٌ صفرٌ أو سالبٌ ليس
     صعوداً، **و«زاد ٠» تحت عنوانٍ يقول «صاعدون» تكذب** (D-216). */
  const list =
    mode === "top"
      ? [...rows].sort((a, b) => b.total - a.total).slice(0, limit)
      : rows
          .map((r) => ({ r, delta: r.total - r.prevTotal }))
          .filter((x) => x.delta > 0)
          .sort((a, b) => b.delta - a.delta)
          .slice(0, limit)
          .map((x) => x.r);

  if (!list.length) return null;

  return (
    <BoardSection
      icon={mode === "top" ? "chart" : "trending"}
      title={mode === "top" ? t.peopleBoardTop : t.peopleBoardRising}
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <CardGrid>
        {list.map((p, i) => (
          <PersonCard key={p.id}>
            <PersonName
              person={p}
              t={t}
              size={56}
              vertical
              /* **الميداليةُ للأوائل وحدها، وفي «الصاعدين» لا مرتبة**:
                 الصعودُ ليس ترتيباً دائماً بل حركةَ أسبوع */
              badge={mode === "top" ? <RankBadge rank={i + 1} locale={locale} /> : undefined}
              sub={
                <>
                  <span
                    className={`block text-[12px] font-bold tabular-nums ${
                      mode === "top" ? "text-accent" : "text-success"
                    }`}
                  >
                    {mode === "top"
                      ? t.peopleBoardActions(p.total)
                      : t.peopleBoardDelta(p.total - p.prevTotal)}
                  </span>
                  {/* **مكوّناتُ الرقم تحته** — وهي سببُ بقاء العدد صريحاً */}
                  <span className="block mt-0.5 text-[10px] opacity-80">
                    {t.peopleBoardBreakdown(p.posts, p.reviews, p.likesIn)}
                  </span>
                </>
              }
            />
          </PersonCard>
        ))}
      </CardGrid>
    </BoardSection>
  );
}

/**
 * **أعلى التعليقات إعجاباً** — **ثلاثةٌ لا واحد** (طلبُ أحمد، الهجرة ٨٢).
 *
 * **وواحدٌ كان قليلاً بحقّ:** قسمٌ يعرض صفّاً واحداً **لا يُقرأ قسماً بل
 * استثناء**، وثلاثةٌ تُظهر أن للموقع كلاماً يُعجب الناس. **والسقفُ كان
 * `limit 1` في جسم الدالّة** فلم يكن للواجهة أن تطلب أكثر — **حدٌّ
 * متجمّدٌ لا حارس** (D-193/D-264).
 *
 * **والبطاقةُ بابٌ إلى `/review`** حيث الردودُ والإعجاب، **ولا نسخةَ
 * ثانية من شريط الأفعال** (D-224). **والوجهُ في البداية والملصقُ في
 * النهاية** — عائلةُ صفّ النشاط نفسُها (D-222)، لا عائلةُ بطاقةِ الغرفة
 * التي لا وجهَ فيها (D-257).
 */
export function TopReviews({
  rows,
  locale,
  seeAllHref,
}: {
  rows: PeopleTopReviewRow[];
  locale: Locale;
  seeAllHref?: string;
}) {
  const t = getDict(locale);
  if (!rows.length) return null;

  return (
    <BoardSection
      icon="heart-filled"
      title={t.peopleBoardTopReview}
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const poster = posterUrl(row.posterPath, "w185");
          const title = row.title?.trim();
          return (
            <li key={`${row.id}-${row.mediaType}-${row.tmdbId}`}>
              <article className="flex gap-3 p-3.5 rounded-2xl bg-surface border border-border">
                <div className="min-w-0 flex-1">
                  <PersonName
                    person={row}
                    t={t}
                    size={32}
                    sub={timeAgo(row.createdAt, t)}
                  />
                  <Link href={`/review/${row.mediaType}/${row.tmdbId}/${row.id}`} prefetch={false}>
                    <p
                      dir={dirOf(row.review)}
                      className="mt-2 text-[13px] leading-relaxed text-foreground/85 line-clamp-3"
                    >
                      {row.review}
                    </p>
                  </Link>
                  <div className="mt-2 flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1.5 shrink-0">
                      <Icon name="heart-filled" size={13} />
                      <span className="tabular-nums">{t.peopleBoardLikes(row.likes)}</span>
                    </span>
                    {row.rating > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="shrink-0 tabular-nums text-accent font-bold">
                          ★{num(row.rating, locale)}
                        </span>
                      </>
                    )}
                    {title && (
                      <>
                        <span aria-hidden>·</span>
                        <span dir={dirOf(title)} className="truncate">
                          {title}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Link
                  href={row.mediaType === "tv" ? `/show/${row.tmdbId}` : `/movie/${row.tmdbId}`}
                  prefetch={false}
                  className="relative w-12 h-[72px] shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border"
                >
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={row.mediaType === "tv" ? "tv" : "film"} size={14} />
                    </span>
                  )}
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </BoardSection>
  );
}

/**
 * **«أشخاص يشبهون ذوقك»** — **وريثُ `PeopleToFollow`** (D-126) بعد أن
 * صار للتبويب لوحةٌ ببطاقات.
 *
 * **وحجّةُ D-126 تبقى كما هي:** `FeedEmptyCta` يقول «ابحث عن أصدقاء»
 * **ويفترض أن المستخدم يعرف من يبحث عنه بالاسم**، وأكثرُ الحسابات
 * الجديدة لا تعرف أحداً هنا. **هذا القسم يحمل الاسمَ إليه بدل أن يطلبه
 * منه.** ولا فيدَ عامّ (D-059): الغرباءُ **اقتراحُ متابعة** لا محتوى.
 *
 * **وسببٌ واحدٌ لا سببان** (D-126): التقاطعُ إن وُجد، وإلا المتابِعون —
 * **وسطران يشرحان لا شيء.**
 *
 * ⚠️ **ولا «تطابق ٩٢٪»**: النسبةُ تحتاج مقاماً لا نملكه، **ورقمٌ بلا
 * مقامٍ من نفس القوم هو ما تمنعه D-216.**
 */
export function PeopleSuggestions({
  people,
  locale,
  limit = 3,
  seeAllHref,
}: {
  people: SuggestedPerson[];
  locale: Locale;
  limit?: number;
  seeAllHref?: string;
}) {
  const t = getDict(locale);
  const list = people.slice(0, limit);
  if (!list.length) return null;

  return (
    <BoardSection
      icon="sparkles"
      title={t.suggestPeopleTitle}
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <CardGrid>
        {list.map((p) => (
          <PersonCard key={p.id}>
            <PersonName
              person={p}
              t={t}
              size={56}
              vertical
              sub={
                p.shared > 0
                  ? t.suggestShared(p.shared)
                  : p.followers > 0
                    ? t.suggestFollowers(p.followers)
                    : undefined
              }
            />
            <div className="w-full flex justify-center">
              <FollowUserButton targetId={p.id} locale={locale} initialFollowing={false} />
            </div>
          </PersonCard>
        ))}
      </CardGrid>
    </BoardSection>
  );
}

/**
 * **ما أضافه الأعضاء إلى مكتباتهم** — **لا «ماذا يشاهدون الآن»**.
 *
 * لوحةُ أحمد الأولى كتبت «الأعضاء يشاهدون الآن»، **ولا حضورَ لحظيّاً
 * عندنا** فلا نعلمه. **والذي نعلمه ما أُضيف إلى المكتبة للتوّ** —
 * **فالجملةُ تتبع البيانات لا العكس** (D-216). **وشخصٌ واحدٌ لكلِّ عملٍ
 * في SQL**، فمن أضاف عشرةً لا يملأ القسمَ وحده.
 *
 * **⚠️ وهذا القسمُ ملصقٌ لا وجه** — فبطاقتُه غيرُ بطاقةِ الشخص عمداً:
 * **الصفُّ هنا عملٌ أضافه فلان**، والملصقُ هو هويّته (D-257).
 */
export function PeopleWatching({
  rows,
  locale,
  limit = 4,
  seeAllHref,
}: {
  rows: PeopleWatchingRow[];
  locale: Locale;
  limit?: number;
  seeAllHref?: string;
}) {
  const t = getDict(locale);
  const list = rows.slice(0, limit);
  if (!list.length) return null;

  return (
    <BoardSection
      icon="bookmark"
      title={t.peopleBoardWatching}
      seeAllHref={seeAllHref}
      seeAllLabel={t.seeAll}
    >
      <ul className="grid grid-cols-2 gap-2.5">
        {list.map((r) => {
          const poster = posterUrl(r.posterPath, "w185");
          const title = r.title?.trim();
          return (
            <li key={`${r.id}-${r.mediaType}-${r.tmdbId}`}>
              <div className="flex gap-3 p-2.5 rounded-xl bg-surface border border-border h-full">
                <Link
                  href={r.mediaType === "tv" ? `/show/${r.tmdbId}` : `/movie/${r.tmdbId}`}
                  prefetch={false}
                  className="relative w-11 h-16 shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border"
                >
                  {poster ? (
                    <Image src={poster} alt="" fill sizes="44px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={14} />
                    </span>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  {title && (
                    <p
                      dir={dirOf(title)}
                      className="text-[13px] font-semibold leading-snug line-clamp-2"
                    >
                      {title}
                    </p>
                  )}
                  <div className="mt-1">
                    <PersonName
                      person={r}
                      t={t}
                      size={20}
                      sub={t.peopleBoardAdded(timeAgo(r.addedAt, t))}
                    />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </BoardSection>
  );
}
