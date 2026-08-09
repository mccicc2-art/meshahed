import Image from "next/image";
import { redirect } from "next/navigation";
import {
  getUser,
  getProfileByUsername,
  getRatingsOf,
  getFollowStats,
  getFollowRelation,
  recordProfileView,
  getProfileViewCount,
  getFollowsOf,
  getWatchedOf,
  getPublicListsOf,
  displayNameOf,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { getLevel, levelPoints, levelName } from "@/lib/level";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PosterCard } from "@/components/PosterCard";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FollowUserButton } from "@/components/FollowUserButton";
import { ProfileMenu } from "@/components/ProfileMenu";
import { BackButton } from "@/components/BackButton";
import { PublicListsRail } from "@/components/PublicListsRail";
import { FollowCountButton, ToWatchStat } from "@/components/ProfilePeeks";
import { posterUrl } from "@/lib/media";

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
  const [rawRatings, stats, relation, visits, rawFollows, watched, publicLists] = await Promise.all([
    getRatingsOf(profile.id),
    getFollowStats(profile.id),
    getFollowRelation(profile.id),
    getProfileViewCount(profile.id),
    getFollowsOf(profile.id),
    getWatchedOf(profile.id),
    getPublicListsOf(profile.id),
    isMe ? Promise.resolve() : recordProfileView(profile.id),
  ]);

  /* ملفّ غيرك قد يكون كُتب بلغةٍ غير لغتك — العناوين تُترجَم عند العرض
     (D-048) فلا تُقرأ صفحةٌ نصفها عربي ونصفها إنجليزي */
  const [ratings, follows] = await Promise.all([
    localizeRows(rawRatings, locale),
    localizeRows(rawFollows, locale),
  ]);

  /* غلاف «حساب خاص»: الحارس الحقيقي في SQL (can_view_profile يفرغ الدوال
     لغير المتابِع — profile_visibility.sql)، وهذا الشرط للعرض فقط: نرسم
     قفلاً صريحاً بدل أصفارٍ تبدو عطلاً. طلبُ متابعةٍ معلّق لا يفتح شيئاً. */
  const canView = isMe || !profile.is_private || relation.following;

  const displayName = displayNameOf(profile, t.anonymousUser);
  /* النبذة تتبع الاسم في الإخفاء — والقطع منفَّذٌ في `public_profiles`
     نفسه لا هنا (profile_bio.sql)؛ هذا السطر حارسٌ ثانٍ لا أوّل */
  const bioText = profile.hide_name ? null : (profile.bio ?? null);
  const withReview = ratings.filter((r) => r.review?.trim());

  const tvFollows = follows.filter((f) => f.media_type === "tv" && !f.dropped);
  const movieFollows = follows.filter((f) => f.media_type === "movie" && !f.dropped);
  const level = getLevel(levelPoints(watched.episodes, watched.movies.size));

  /* «للمشاهدة» بدل عدّاد الحلقات (طلب أحمد) — ونفس عناصره تُمرَّر لورقة
     «وش باقي يتفرج»: محسوبة من صفوفه المقروءة أصلاً، فلا طلب إضافي */
  const toWatchItems = [
    ...tvFollows
      .map((f) => {
        const aired = f.aired_episodes ?? f.total_episodes ?? 0;
        const w = Math.min(watched.byShow.get(f.tmdb_id) ?? 0, aired || Infinity);
        return { f, aired, w };
      })
      .filter(({ aired, w }) => aired === 0 || w < aired)
      .map(({ f, aired, w }) => ({
        key: `tw-tv-${f.tmdb_id}`,
        href: `/show/${f.tmdb_id}`,
        title: f.title,
        poster: posterUrl(f.poster_path, "w185"),
        remainingLabel: aired > 0 ? t.remainingEps(aired - w) : null,
      })),
    ...movieFollows
      .filter((f) => !watched.movies.has(f.tmdb_id))
      .map((f) => ({
        key: `tw-mv-${f.tmdb_id}`,
        href: `/movie/${f.tmdb_id}`,
        title: f.title,
        poster: posterUrl(f.poster_path, "w185"),
        remainingLabel: null,
      })),
  ].slice(0, 60);

  const headerStats = [
    { key: "shows", icon: "tv" as const, color: "var(--accent)", value: tvFollows.length, label: t.shortShows },
    { key: "movies", icon: "film" as const, color: "var(--accent-2)", value: movieFollows.length, label: t.shortMovies },
    { key: "towatch", icon: "bookmark" as const, color: "var(--brand-3)", value: toWatchItems.length, label: t.profileWatchlist },
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
        <div className="relative h-[12.5rem] sm:h-[17rem] -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
          {profile.cover_url ? (
            <Image
              src={profile.cover_url}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 1152px"
              className="object-cover"
              /* التموضع الذي اختاره صاحب الملف — و٣٠٪ عند الغياب هي
                 القيمة القديمة نفسها */
              style={{ objectPosition: `50% ${profile.cover_pos ?? 30}%` }}
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

          {/* مكان أدوات المالك: زرّ المتابعة، وبجانبه نقاط القائمة —
              رسالة / بلاغ / حظر (ProfileMenu). «إضافة» ليست في القائمة
              عمداً: هي الزرّ الظاهر نفسه، وتكرارها حالتان تتعارضان.

              **بلا `env(safe-area-inset-top)` (إصلاح 9 Aug من لقطة أحمد:
              «نازل بزيادة»):** الأزرار الثلاثة كانت تضيف حجزَ شريط الحالة
              مرّةً ثانية. القاعدة في D-040 تخصّ ما يُثبَّت في **أعلى
              الشاشة**، وهذا الغلاف يبدأ **تحت الترويسة اللاصقة** التي
              حجزت `--safe-top` أصلاً — فالحجز الثاني يهبط بها ٤٧–٥٩ بكسلاً
              على الجوال ولا يظهر أثره على سطح المكتب حيث `env()` صفر. */}
          {!isMe && (
            <div className="absolute top-3 end-3 flex items-center gap-2">
              <FollowUserButton targetId={profile.id} locale={locale} initialFollowing={relation.following} initialRequested={relation.requested} />
              <ProfileMenu
                person={{
                  id: profile.id,
                  nickname: profile.nickname,
                  username: profile.username,
                  avatar_url: profile.avatar_url,
                  hide_name: profile.hide_name ?? false,
                }}
                mutual={relation.following && relation.followsMe}
                locale={locale}
              />
            </div>
          )}
          {/* زر الرجوع — كان في صفحات الأعمال وغائباً هنا (تدقيق 8 Aug م٣):
              من فتح ملفاً من قائمة الأصدقاء يرجع إليها من داخل الصفحة.
              شارة الزيارات زحفت بعده (start-16) لتفسح لعرضه 44px */}
          <BackButton
            locale={locale}
            className="absolute top-3 start-3"
          />
          <span className="absolute top-4 start-16 text-[11px] text-white/75 bg-black/40 backdrop-blur rounded-full px-2.5 py-1">
            {t.visitsLabel} <span className="font-bold text-white tabular-nums">{visits}</span>
          </span>
        </div>

        {/* ===== كتلة الهوية ===== */}
        <div className="flex items-end gap-3 pe-4 -mt-[5.25rem] sm:-mt-[5.75rem] relative z-10">
          <span
            className="block rounded-full p-[3px] shrink-0"
            style={{
              background:
                "var(--gradient-brand)",
            }}
          >
            <Avatar
              src={profile.avatar_url}
              name={displayName}
              size={74}
              posY={profile.avatar_pos ?? null}
              alt={t.avatarAlt}
              className="ring-[3px] ring-[color:var(--background)]"
            />
          </span>

          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-lg sm:text-xl font-bold truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {displayName}
            </h1>
            {/* المعرّف @ حُذف (طلب أحمد) والنبذة صعدت تحت الاسم — كالرئيسية */}
            {bioText && (
              <p className="text-[12.5px] text-white/70 leading-snug mt-0.5 drop-shadow line-clamp-2 max-w-[46ch]">
                {bioText}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-tight mt-1.5 drop-shadow">
              {/* العدّادان بابان (طلب أحمد): الضغط يفتح ورقة الأسماء —
                  والقفل (هجرة 43) يترك العدد ويطفئ الباب. النجمة واللايك
                  حُذفا: النجمة مكررة في البطاقة واللايك ضجيج */}
              <FollowCountButton
                targetId={profile.id}
                dir="followers"
                count={stats.followers}
                label={t.followersLabel}
                locked={!isMe && !!profile.hide_follow_lists}
                labels={{ close: t.closeLabel, empty: t.followListEmpty, anonymous: t.anonymousUser }}
              />
              <FollowCountButton
                targetId={profile.id}
                dir="following"
                count={stats.following}
                label={t.followingLabel}
                locked={!isMe && !!profile.hide_follow_lists}
                labels={{ close: t.closeLabel, empty: t.followListEmpty, anonymous: t.anonymousUser }}
              />
              {canView && withReview.length > 0 && (
                <span className="shrink-0 flex items-center gap-1 text-white/75">
                  <Icon name="comment" size={14} />
                  <span className="font-bold text-white tabular-nums">{withReview.length}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ===== غلاف «حساب خاص» — بدل الأرقام والمستوى والصفوف ===== */}
        {!canView && (
          <div className="relative z-10 mt-6 bg-surface border border-border rounded-2xl px-6 py-10 text-center">
            <Icon name="eye-off" size={28} className="mx-auto text-muted" />
            <p className="font-bold text-[15px] mt-3">{t.privateCoverTitle}</p>
            <p className="text-[13px] text-muted leading-relaxed mt-1 max-w-[36ch] mx-auto">
              {t.privateCoverHint}
            </p>
          </div>
        )}

        {/* ===== صفّ الأرقام — بلا إطار كما في الرئيسية ===== */}
        {canView && (
        <div className="relative z-10 mt-5">
          <div className="grid grid-cols-4">
            {headerStats.map((s, i) =>
              s.key === "towatch" ? (
                /* الخانة باب (طلب أحمد): «وش باقي يتفرج» ورقةً من نفس البيانات */
                <ToWatchStat
                  key={s.key}
                  value={s.value}
                  label={s.label}
                  icon={s.icon}
                  color={s.color}
                  items={toWatchItems}
                  divider={i < headerStats.length - 1}
                  labels={{ close: t.closeLabel, empty: t.toWatchEmpty }}
                />
              ) : (
                <div key={s.key} className="relative flex flex-col items-center justify-center px-1 py-2.5">
                  {i < headerStats.length - 1 && (
                    <span className="absolute inset-y-1 end-0 w-px bg-white/10" aria-hidden />
                  )}
                  <span className="flex items-center gap-2">
                    <Icon name={s.icon} size={20}  style={{ color: s.color }} className="shrink-0" />
                    <span className="text-[17px] font-bold leading-none tabular-nums">{s.value}</span>
                  </span>
                  <span className="block text-[11px] text-muted mt-1.5 leading-[1.25]">{s.label}</span>
                </div>
              ),
            )}
          </div>
        </div>
        )}

        {/* ===== المستوى — يتبع المحتوى في الحجب ===== */}
        {canView && (
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
        )}
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
              {/* بلا شارة «شوهد» وبلا خيط التقدم الأخضر (طلب أحمد) —
                  الملصق وحده؛ حالته عند صاحبه شأنه */}
              <PosterCard
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
              />
            </RailItem>
          ))}
        </PosterRail>
      )}

      {/* ===== قوائمه المعلنة (D-068) — صنعُه بعد متابعاته وقبل أحكامه.
          بطاقة اكتشف نفسها بلا سطر صاحبٍ (الصفحة كلّها صفحته)، والرابط
          إلى /lists/[id] حيث زرّ «أضِفها إلى قوائمي». تتبع القفل: قوائم
          حسابٍ خاصّ لا تُعرض لغير متابِعيه وإن بقيت سياسة SQL عامة —
          الصفحة الموصدة لا تفتح نافذةً جانبية ===== */}
      {canView && (
        <PublicListsRail lists={publicLists} locale={locale} title={t.profileListsRail} />
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

    </div>
  );
}
