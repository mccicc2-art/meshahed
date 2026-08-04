import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  getUser,
  getProfileByUsername,
  getRatingsOf,
  getFollowStats,
  amIFollowing,
  recordProfileView,
  getProfileViewCount,
  displayNameOf,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { num } from "@/lib/i18n";
import { GENRES } from "@/lib/media";
import { Avatar } from "@/components/Avatar";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { FollowUserButton } from "@/components/FollowUserButton";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const me = await getUser();
  if (!me) redirect("/login");

  const { locale, t } = await getT();
  const { username } = await params;

  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) {
    return <p className="text-center text-muted py-24">{t.userNotFound}</p>;
  }

  // تُسجَّل الزيارة أولاً حتى يشمل العدّاد هذه الزيارة نفسها.
  // الدالة تتجاهل زيارة الشخص لصفحته وتتجاهل التكرار في نفس اليوم.
  const isMeEarly = profile.id === me.id;
  if (!isMeEarly) await recordProfileView(profile.id);

  const [ratings, stats, following, visits] = await Promise.all([
    getRatingsOf(profile.id),
    getFollowStats(profile.id),
    amIFollowing(profile.id),
    getProfileViewCount(profile.id),
  ]);

  const displayName = displayNameOf(profile, t.anonymousUser);
  const favNames = GENRES.filter((g) => profile.favorite_genres.includes(g.id));
  const isMe = profile.id === me.id;

  const withReview = ratings.filter((r) => r.review?.trim());

  return (
    <div className="space-y-10">
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="relative h-28 sm:h-40 bg-surface-2">
          {profile.cover_url ? (
            <Image
              src={profile.cover_url}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background:
                  "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color:var(--surface)] to-transparent" />
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="-mt-12 sm:-mt-14 flex items-end justify-between gap-4 flex-wrap">
            <Avatar
              src={profile.avatar_url}
              name={displayName}
              size={88}
              alt={t.avatarAlt}
              className="ring-4 ring-[color:var(--surface)]"
            />
            {!isMe && (
              <FollowUserButton
                targetId={profile.id}
                locale={locale}
                initialFollowing={following}
              />
            )}
          </div>

          <div className="mt-3">
            <h1 className="text-xl sm:text-2xl font-bold">{displayName}</h1>
            {profile.username && (
              <p className="text-muted text-sm mt-0.5" dir="ltr">
                @{profile.username}
              </p>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4">
            {[
              { v: stats.followers, l: t.followersLabel },
              { v: stats.following, l: t.followingLabel },
              { v: ratings.length, l: "★" },
              { v: visits, l: t.visitsLabel },
            ].map((s) => (
              <div key={s.l} className="bg-surface-2 rounded-xl py-2.5 text-center">
                <div className="text-base font-bold">{num(s.v, locale)}</div>
                <div className="text-[11px] text-muted">{s.l}</div>
              </div>
            ))}
          </div>

          {favNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {favNames.map((g) => (
                <span
                  key={g.id}
                  className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {locale === "en" ? g.en : g.ar}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4">{t.ratingsListTitle}</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 text-center">
            {t.noRatingsYet}
          </p>
        ) : (
          <PosterGrid>
            {ratings.map((r) => (
              <PosterCard
                key={`${r.media_type}-${r.tmdb_id}`}
                href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                title={r.title ?? "—"}
                posterPath={r.poster_path}
                badge={"★".repeat(r.rating)}
              />
            ))}
          </PosterGrid>
        )}
      </section>

      {withReview.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4">{t.reviewsTitle}</h2>
          <div className="space-y-3">
            {withReview.slice(0, 20).map((r) => (
              <article
                key={`rv-${r.media_type}-${r.tmdb_id}`}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <Link
                    href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                    prefetch={false}
                    className="font-semibold hover:text-accent transition"
                  >
                    {r.title}
                  </Link>
                  <span className="text-accent text-sm">{"★".repeat(r.rating)}</span>
                </div>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">
                  {r.review}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
