import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser, getMyRatings } from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { posterUrl } from "@/core/media";
import { Icon } from "@/components/Icon";
import { segmentedItem, segmentedTrackBare, segmentedTrackFull } from "@/components/ui/controls";
import { PosterCard } from "@/components/PosterCard";
import { webWords } from "@/components/webWords";
import { RateQueueEntryServer } from "@/components/RateQueueServer";

/**
 * تقييماتي وتعليقاتي.
 *
 * صفحة واحدة لا صفحتان: التعليق عندنا نصٌّ داخل التقييم لا كيانٌ مستقل،
 * فتقسيمه صفحةً ثانية يكرّر نفس الصفوف. الشريحتان فوق تفصلان بينهما.
 *
 * العناوين والملصقات مخزّنة مع التقييم، ولا يُطلب TMDB إلا لما خالف خطُّ
 * اسمه لغة الواجهة (D-048).
 */
export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string; r?: string; sort?: string; m?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const w = webWords(locale);
  const { with: withParam, r: rParam, sort: sortParam, m: mParam } = await searchParams;
  const onlyComments = withParam === "comments";
  /* 🆕 R269 — مرشّحاتُ الحاسوب في الرابط لا في حالةِ عميل (أحمد ١٨ نوفمبر — «أ+ب»): رقمٌ من التوزيع، والترتيب، والنوع.
     تُطبَّق على الصفوف نفسِها، فمن فتح الرابطَ على الجوال يرى المصفّى ذاته. */
  const star = Number(rParam);
  const only = Number.isInteger(star) && star >= 1 && star <= 10 ? star : null;
  const sort = sortParam === "top" ? "top" : "new";
  const media = mParam === "tv" || mParam === "movie" ? mParam : null;

  const all = await localizeRows(await getMyRatings(), locale);
  const rows = (onlyComments ? all.filter((r) => r.review?.trim()) : all)
    .filter((r) => (only == null || Math.round(r.rating) === only) && (!media || r.media_type === media))
    .sort((a, b) => (sort === "top" ? b.rating - a.rating : 0));
  const commentCount = all.filter((r) => r.review?.trim()).length;

  /* رابطٌ يغيّر مفتاحاً ويُبقي البقيّة — المرشّحاتُ تتراكب */
  const hrefWith = (patch: Record<string, string | null>) => {
    const cur: Record<string, string | null> = { with: onlyComments ? "comments" : null, r: only ? String(only) : null, sort: sort === "top" ? "top" : null, m: media };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/ratings?${qs}` : "/ratings";
  };

  const chips: { key: string; href: string; label: string; count: number; on: boolean }[] = [
    { key: "all", href: hrefWith({ with: null }), label: t.ratingsAll, count: all.length, on: !onlyComments },
    {
      key: "comments",
      href: hrefWith({ with: "comments" }),
      label: t.ratingsWithComment,
      count: commentCount,
      on: onlyComments,
    },
  ];
  /* 🆕 R269 — عمودُ الحاسوب: معدّلُك، وتوزيعُ تقييماتك من ١٠ إلى ١ (كلُّ رقمٍ رابطٌ يصفّي الشبكة، والضغطُ ثانيةً يرفع المرشّح) */
  const avg = all.length ? Math.round((all.reduce((n, r) => n + r.rating, 0) / all.length) * 10) / 10 : 0;
  const dist = Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => ({ n, c: all.filter((r) => Math.round(r.rating) === n).length }));
  const maxC = Math.max(1, ...dist.map((d) => d.c));

  return (
    <div>
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.ratingsTitle}</h1>
      {/* 🆕 T530 — بابُ «بانتظار تقييمك» أعلى الصفحة (أحمد «٢أ») — في `Suspense`: حسابُه لا يؤخّر «تقييماتي» ولا يُسقطها إن فشل */}
      <Suspense fallback={null}>
        <RateQueueEntryServer locale={locale} className="mb-4" />
      </Suspense>

      {/* «ت٥أ» (أحمد ٢٦ نوفمبر، استوديو المشاركة): صفُّ الفلتر عائلةُ المقسّم بخطٍّ أصفر — لا كبسولات في أيِّ مكان */}
      <div className={`${segmentedTrackFull} flex-wrap mb-4`}>
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className={segmentedItem(c.on)}
          >
            {c.label} <span className="opacity-70 tabular-nums"><span dir="ltr">{c.count}</span></span>
          </Link>
        ))}
        {/* 🆕 R269 — الترتيبُ والنوعُ على الحاسوب — رقاقاتُ العائلة نفسِها (القاعدة ٣) */}
        <span className={`${segmentedTrackBare} hidden desk:flex ms-auto`}>
          <Link href={hrefWith({ sort: null })} className={segmentedItem(sort === "new")}>{w.ratingsNewest}</Link>
          <Link href={hrefWith({ sort: "top" })} className={segmentedItem(sort === "top")}>{w.ratingsTop}</Link>
          <Link href={hrefWith({ m: null })} className={segmentedItem(!media)}>{t.ratingsAll}</Link>
          <Link href={hrefWith({ m: "tv" })} className={segmentedItem(media === "tv")}>{t.shortShows}</Link>
          <Link href={hrefWith({ m: "movie" })} className={segmentedItem(media === "movie")}>{t.shortMovies}</Link>
        </span>
      </div>

      {/* 🆕 R269 — **تقييماتي على الحاسوب** (أحمد ١٨ نوفمبر — «ادمج أ وب، وعمود ب على اليسار»): شبكةُ «أ» — `PosterCard` نفسُها
          ستّةً في الصفّ بتقييمك على البوستر — وعمودُ «ب» بجانبها. وتحت ١٢٨٠ الصفوفُ كما هي. */}
      <div className="hidden desk:grid desk:grid-cols-[minmax(0,1fr)_300px] desk:gap-10 desk:items-start">
        {rows.length === 0 ? (
          <p className="text-sm text-muted text-center py-16">{t.ratingsEmpty}</p>
        ) : (
          <div className="grid grid-cols-6 gap-4">
            {rows.map((r) => (
              <PosterCard
                key={`${r.media_type}-${r.tmdb_id}`}
                href={r.media_type === "movie" ? `/movie/${r.tmdb_id}` : `/show/${r.tmdb_id}`}
                title={r.title ?? `#${r.tmdb_id}`}
                posterPath={r.poster_path}
                posterSize="w342"
                badge={`★ ${r.rating}`}
                year={[r.media_type === "movie" ? t.typeMovie : t.typeSeries, r.review?.trim() ? w.ratingsHasComment : null].filter(Boolean).join(" · ")}
                titleBelow
              />
            ))}
          </div>
        )}
        <aside className="sticky top-6 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3 text-center">
            {([
              [avg, w.ratingsAvg],
              [all.length, w.ratingsCount],
              [commentCount, t.ratingsWithComment],
            ] as const).map(([n, label]) => (
              <div key={label} className="rounded-xl bg-surface-2 py-2.5">
                <b className="block text-20 font-bold tabular-nums" dir="ltr">{n}</b>
                <span className="block truncate px-1 text-12 text-muted">{label}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3.5">
            <p className="mb-2 text-12 font-bold text-muted">{w.ratingsDist}</p>
            <ul className="space-y-1">
              {dist.map(({ n, c }) => (
                <li key={n}>
                  <Link
                    href={hrefWith({ r: only === n ? null : String(n) })}
                    aria-pressed={only === n}
                    className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-12 font-bold tabular-nums transition ${only === n ? "bg-accent/15 text-foreground" : c ? "text-muted hover:bg-surface-2" : "pointer-events-none text-muted/50"}`}
                  >
                    <span className="w-8 shrink-0" dir="ltr">★{n}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(c / maxC) * 100}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-end">{c}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-12 text-muted">{only ? w.ratingsDistClear : w.ratingsDistHint}</p>
          </div>
        </aside>
      </div>

      <div className="desk:hidden">
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">{t.ratingsEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const img = posterUrl(r.poster_path, "w185");
            const href = r.media_type === "movie" ? `/movie/${r.tmdb_id}` : `/show/${r.tmdb_id}`;
            return (
              <li key={`${r.media_type}-${r.tmdb_id}`}>
                <Link
                  href={href}
                  prefetch={false}
                  className="flex gap-3 p-2.5 rounded-2xl border border-border bg-surface hover:bg-surface-2 transition"
                >
                  <span className="relative w-11 h-16 shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border">
                    {img ? (
                      <Image src={img} alt="" fill sizes="44px" className="object-cover" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-muted">
                        <Icon name={r.media_type === "movie" ? "film" : "tv"} size={16} />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold truncate">
                      {r.title ?? `#${r.tmdb_id}`}
                    </span>
                    {/* 🔴 D-1357 — «★ 9/10» لا صفُّ نجوم: السلّمُ من ١٠ والصفُّ كان يفترضه من ٥ فيرسم تسعَ نجماتٍ
                        متتالية (قرارُ أحمد ١١ أكتوبر «2 أ») — وهو شكلُ شريط الرئيسيّة وشاشةِ التطبيق */}
                    <span className="block text-xs font-semibold tabular-nums mt-0.5" dir="ltr">
                      <span className="text-accent">★</span> {r.rating}/10
                    </span>
                    {r.review?.trim() && (
                      <span className="block text-12 text-muted mt-1 line-clamp-3 leading-relaxed">
                        {r.review}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
