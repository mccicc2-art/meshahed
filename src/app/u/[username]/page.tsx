/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getUser,
  getProfileByUsername,
  getRatingsOf,
  getFollowStats,
  amIFollowing,
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

  const [ratings, stats, following] = await Promise.all([
    getRatingsOf(profile.id),
    getFollowStats(profile.id),
    amIFollowing(profile.id),
  ]);

  const displayName = profile.nickname || profile.username || "—";
  const favNames = GENRES.filter((g) => profile.favorite_genres.includes(g.id));
  const isMe = profile.id === me.id;

  const withReview = ratings.filter((r) => r.review?.trim());

  return (
    <div className="space-y-10">
      <section className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="relative h-28 sm:h-40 bg-surface-2">
          {profile.cover_url ? (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
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

          <div className="flex items-center gap-5 mt-4 text-sm">
            <span>
              <b>{num(stats.followers, locale)}</b>{" "}
              <span className="text-muted">{t.followersLabel}</span>
            </span>
            <span>
              <b>{num(stats.following, locale)}</b>{" "}
              <span className="text-muted">{t.followingLabel}</span>
            </span>
            <span>
              <b>{num(ratings.length, locale)}</b>{" "}
              <span className="text-muted">★</span>
            </span>
          </div>

          {favNames.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {favNames.map((g) => (
                <span
                  key={g.id}
                  className="text-xs bg-surface-2 border border-border px-2.5 py-1 rounded-full"
                >
                  {g.emoji} {locale === "en" ? g.en : g.ar}
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
