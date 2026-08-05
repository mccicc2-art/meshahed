import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getUser, getMyRatings } from "@/lib/data";
import { getT } from "@/lib/locale";
import { posterUrl } from "@/lib/media";
import { Icon } from "@/components/Icon";
import { chipClass } from "@/components/ui/controls";

/**
 * تقييماتي وتعليقاتي.
 *
 * صفحة واحدة لا صفحتان: التعليق عندنا نصٌّ داخل التقييم لا كيانٌ مستقل،
 * فتقسيمه صفحةً ثانية يكرّر نفس الصفوف. الشريحتان فوق تفصلان بينهما.
 *
 * العناوين والملصقات مخزّنة مع التقييم، فلا طلب TMDB واحد هنا.
 */
export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ with?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { t } = await getT();
  const { with: withParam } = await searchParams;
  const onlyComments = withParam === "comments";

  const all = await getMyRatings();
  const rows = onlyComments ? all.filter((r) => r.review?.trim()) : all;
  const commentCount = all.filter((r) => r.review?.trim()).length;

  const chips: { key: string; href: string; label: string; count: number; on: boolean }[] = [
    { key: "all", href: "/ratings", label: t.ratingsAll, count: all.length, on: !onlyComments },
    {
      key: "comments",
      href: "/ratings?with=comments",
      label: t.ratingsWithComment,
      count: commentCount,
      on: onlyComments,
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">{t.ratingsTitle}</h1>
      <p className="text-xs text-muted mb-4">{t.ratingsSub}</p>

      <div className="flex gap-1.5 mb-4">
        {chips.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            className={chipClass(c.on, "sm")}
          >
            {c.label} <span className="opacity-70 tabular-nums"><span dir="ltr">{c.count}</span></span>
          </Link>
        ))}
      </div>

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
                    <span className="block text-accent text-xs mt-0.5" dir="ltr">
                      {"★".repeat(r.rating)}
                      <span className="text-muted">{"★".repeat(Math.max(0, 5 - r.rating))}</span>
                    </span>
                    {r.review?.trim() && (
                      <span className="block text-[12px] text-muted mt-1 line-clamp-3 leading-relaxed">
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
  );
}
