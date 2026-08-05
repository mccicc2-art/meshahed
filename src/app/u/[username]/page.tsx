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
  getReceivedLikes,
  getFollowsOf,
  getWatchedOf,
  displayNameOf,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { getLevel, levelPoints, levelName } from "@/lib/level";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PosterCard } from "@/components/PosterCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FollowUserButton } from "@/components/FollowUserButton";

/**
 * صفحة المستخدم العامة — بهيئة الرئيسية نفسها.
 *
 * من يفتح ملفّ شخصٍ يرى ما يراه ذلك الشخص في رئيسيته: الغلاف الممتدّ
 * والهوية فوقه، ثم صفّ الأرقام والمستوى، ثم صفوف أعماله. الفرق الوحيد
 * أن أدوات المالك (الإعدادات والجرس) يحلّ محلّها زرّ المتابعة.
 *
 * القراءة عبر دوال definer محدودة (supabase/security2.sql) لا بفتح
 * الجداول: هذا تطبيقٌ اجتماعي ومكتبتك ملفّك، لكن الأعداد والملصقات فقط
 * هي ما يخرج — لا صفوف الحلقات ولا أوقات المشاهدة.
 */
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

  const isMe = profile.id === me.id;

  // تسجيل الزيارة كتابةُ تحليلاتٍ لا غير — يجري بالتوازي مع القراءات
  // بدل أن يضيف رحلة كتابةٍ كاملة قبل أول بايت من الصفحة
  const [ratings, stats, following, visits, likes, follows, watched] = await Promise.all([
    getRatingsOf(profile.id),
    getFollowStats(profile.id),
    amIFollowing(profile.id),
    getProfileViewCount(profile.id),
    getReceivedLikes(profile.id),
    getFollowsOf(profile.id),
    getWatchedOf(profile.id),
    isMe ? Promise.resolve() : recordProfileView(profile.id),
  ]);

  const displayName = displayNameOf(profile, t.anonymousUser);
  const withReview = ratings.filter((r) => r.review?.trim());

  const tvFollows = follows.filter((f) => f.media_type === "tv" && !f.dropped);
  const movieFollows = follows.filter((f) => f.media_type === "movie" && !f.dropped);
  const level = getLevel(levelPoints(watched.episodes, watched.movies.size));

  const headerStats = [
    { key: "shows", icon: "tv" as const, color: "var(--accent)", value: tvFollows.length, label: t.shortShows },
    { key: "movies", icon: "film" as const, color: "var(--accent-2)", value: movieFollows.length, label: t.shortMovies },
    { key: "eps", icon: "check" as const, color: "var(--brand-3)", value: watched.episodes, label: t.statsWatchedEpisodes },
    { key: "ratings", icon: "star" as const, color: "var(--accent)", value: ratings.length, label: t.panelRatings },
  ];

  const shows = tvFollows.map((f) => {
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    const w = Math.min(watched.byShow.get(f.tmdb_id) ?? 0, aired || Infinity);
    return {
      id: f.tmdb_id,
      title: f.title,
      posterPath: f.poster_path,
      progress: aired > 0 ? Math.round((w / aired) * 100) : 0,
    };
  });

  return (
    <div className="space-y-8">
      {/* ===== الغلاف — كما في الرئيسية ===== */}
      <section>
        <div className="relative h-[15.75rem] sm:h-[20.25rem] -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
          {profile.cover_url ? (
            <Image
              src={profile.cover_url}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 1152px"
              className="object-cover object-[50%_30%]"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[color:var(--background)]" />

          {/* مكان أدوات المالك: زرّ المتابعة والزيارات */}
          {!isMe && (
            <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] end-3">
              <FollowUserButton targetId={profile.id} locale={locale} initialFollowing={following} />
            </div>
          )}
          <span className="absolute top-[calc(1rem+env(safe-area-inset-top))] start-4 text-[11px] text-white/75 bg-black/40 backdrop-blur rounded-full px-2.5 py-1">
            {t.visitsLabel} <span className="font-bold text-white tabular-nums">{visits}</span>
          </span>
        </div>

        {/* ===== كتلة الهوية ===== */}
        <div className="flex items-end gap-3 pe-4 -mt-[5.25rem] sm:-mt-[5.75rem] relative z-10">
          <span
            className="block rounded-full p-[3px] shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-3), var(--accent-2) 55%, var(--accent))",
            }}
          >
            <Avatar
              src={profile.avatar_url}
              name={displayName}
              size={74}
              alt={t.avatarAlt}
              className="ring-[3px] ring-[color:var(--background)]"
            />
          </span>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-lg sm:text-xl font-bold truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {displayName}
            </h1>
            {profile.username && (
              <p className="text-[13px] text-white/55 truncate leading-tight mt-0.5 drop-shadow">
                <span dir="ltr">@{profile.username}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/75 leading-tight mt-1 drop-shadow">
              <span className="shrink-0 flex items-center gap-1">
                <Icon name="people-filled" size={15} />
                <span className="font-bold text-white tabular-nums">{stats.followers}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1">
                <Icon name="comment" size={14} />
                <span className="font-bold text-white tabular-nums">{withReview.length}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1">
                <Icon name="star" size={14} />
                <span className="font-bold text-white tabular-nums">{ratings.length}</span>
              </span>
              <span className="shrink-0 flex items-center gap-1">
                <Icon name="like" size={14} />
                <span className="font-bold text-white tabular-nums">{likes}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ===== صفّ الأرقام — بلا إطار كما في الرئيسية ===== */}
        <div className="relative z-10 mt-5">
          <div className="grid grid-cols-4">
            {headerStats.map((s, i) => (
              <div key={s.key} className="relative flex flex-col items-center justify-center px-1 py-2.5">
                {i < headerStats.length - 1 && (
                  <span className="absolute inset-y-1 end-0 w-px bg-white/10" aria-hidden />
                )}
                <span className="flex items-center gap-2">
                  <Icon name={s.icon} size={20} strokeWidth={1.8} style={{ color: s.color }} className="shrink-0" />
                  <span className="text-[17px] font-bold leading-none tabular-nums">{s.value}</span>
                </span>
                <span className="block text-[11px] text-muted mt-1.5 leading-[1.25]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ===== المستوى ===== */}
        <div className="relative z-10 mt-5 px-0.5">
          <p className="text-[13px] font-bold">
            {t.levelLabel(level.level)} ·{" "}
            <span className="text-accent">{levelName(level.level, t)}</span>
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex-1 h-[5px] rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${level.percent}%`,
                  background:
                    "linear-gradient(90deg, var(--brand-3) 0%, var(--accent-2) 55%, var(--accent) 100%)",
                }}
              />
            </div>
            <span className="text-[12px] text-muted shrink-0 tabular-nums">
              <span dir="ltr">{level.percent}%</span>
            </span>
          </div>
        </div>
      </section>

      {/* ===== صفوف أعماله ===== */}
      {shows.length > 0 && (
        <PosterRail title={t.shortShows} icon="tv" iconColor="var(--accent)">
          {shows.map((i) => (
            <RailItem key={`s-${i.id}`}>
              <PosterCard
                href={`/show/${i.id}`}
                title={i.title}
                posterPath={i.posterPath}
                progress={i.progress}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {movieFollows.length > 0 && (
        <PosterRail title={t.shortMovies} icon="film" iconColor="var(--accent-2)">
          {movieFollows.map((f) => (
            <RailItem key={`m-${f.tmdb_id}`}>
              <PosterCard
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
                progress={watched.movies.has(f.tmdb_id) ? 100 : undefined}
                badge={watched.movies.has(f.tmdb_id) ? t.watchedBadge : undefined}
                badgeTone={watched.movies.has(f.tmdb_id) ? "watched" : "neutral"}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {/* ===== تقييماته ومراجعاته ===== */}
      {ratings.length > 0 && (
        <PosterRail title={t.ratingsListTitle} icon="star" iconColor="var(--verified)">
          {ratings.slice(0, 16).map((r) => (
            <RailItem key={`r-${r.media_type}-${r.tmdb_id}`}>
              <PosterCard
                href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                title={r.title ?? "—"}
                posterPath={r.poster_path}
                badge={`★ ${r.rating}/10`}
                badgeTone="rating"
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {withReview.length > 0 && (
        <section>
          <h2 className="text-[19px] font-bold mb-4 flex items-center gap-2.5">
            <Icon name="comment" size={22} className="text-muted" />
            {t.reviewsTitle}
          </h2>
          <div className="space-y-3">
            {withReview.slice(0, 20).map((r) => (
              <article
                key={`rv-${r.media_type}-${r.tmdb_id}`}
                className="bg-surface border border-border rounded-[18px] p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <Link
                    href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                    prefetch={false}
                    className="font-semibold hover:text-accent transition"
                  >
                    {r.title}
                  </Link>
                  <span className="text-accent text-sm font-bold tabular-nums">
                    ★ <span dir="ltr">{r.rating}/10</span>
                  </span>
                </div>
                <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{r.review}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
