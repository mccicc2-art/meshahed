import Image from "next/image";
import Link from "next/link";
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
  getProfileArtists,
  getProfileFavorites,
  getProfileArt,
  artKey,
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
import { isLoopz } from "@/lib/loopz";
import { BackButton } from "@/components/BackButton";
import { PublicListsRail } from "@/components/PublicListsRail";
import { CompactMediaRow } from "@/components/CompactMediaRow";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { SpoilerText } from "@/components/SpoilerText";
import { FollowCountButton, ToWatchStat } from "@/components/ProfilePeeks";
import { posterUrl } from "@/lib/media";
import {
  PROFILE_SECTIONS,
  profileSectionMeta,
  sanitizeProfilePrefs,
  type ProfileSection,
} from "@/lib/profilePrefs";
import { capCards } from "@/lib/cardCount";
import { densityVars } from "@/lib/density";

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
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await getUser();
  if (!me) redirect("/login");

  const { locale, t } = await getT();
  const { username } = await params;
  /* **التبويبُ في الرابط لا في حالةِ عميل** (D-438، نمطُ `/news`): الصفحةُ
     خادميّةٌ كلُّها، **وتبويبٌ يُفتح برابطٍ يُشارَك ويُفهرَس ويعود إليه
     زرُّ الرجوع** — وحالةُ عميلٍ لا تفعل واحدةً منها. */
  const { tab: rawTab } = await searchParams;

  const profile = await getProfileByUsername(decodeURIComponent(username));
  if (!profile) {
    return <p className="text-center text-muted py-24">{t.userNotFound}</p>;
  }

  const isMe = profile.id === me.id;

  // تسجيل الزيارة كتابةُ تحليلاتٍ لا غير — يجري بالتوازي مع القراءات
  // بدل أن يضيف رحلة كتابةٍ كاملة قبل أول بايت من الصفحة
  /* التخصيص يُقرأ قبل الجلب لا بعده (D-129): قسمٌ أخفاه صاحبه لا يستحقّ
     نداءً — و«فنّانوك» خاصّةً دالّةٌ إضافية لا داعي لدفعها لمن أطفأها */
  const prefs = sanitizeProfilePrefs(profile.profile_prefs);
  const wants = (s: ProfileSection) => prefs.order.includes(s);

  const [
    rawRatings,
    stats,
    relation,
    visits,
    rawFollows,
    watched,
    publicLists,
    artists,
    rawFavorites,
    profileArt,
  ] = await Promise.all([
      getRatingsOf(profile.id),
      getFollowStats(profile.id),
      getFollowRelation(profile.id),
      getProfileViewCount(profile.id),
      getFollowsOf(profile.id),
      getWatchedOf(profile.id),
      /* 🆕 **القوائمُ تُقرأ دائماً** (D-438): صارت تبويباً وعدّاداً في
         بطاقة الأرقام، **وعدّادٌ يقول صفراً لأن القسمَ مخفيٌّ كذبٌ**
         (D-374). **والنداءُ واحدٌ خفيف.** */
      getPublicListsOf(profile.id),
      wants("artists") ? getProfileArtists(profile.id) : Promise.resolve([]),
      wants("favorites") ? getProfileFavorites(profile.id) : Promise.resolve([]),
      /* أغلفة صاحب البروفايل (D-131) — لا تحتاج إلا معرّفَه، فمكانُها
         الموجةُ الأولى لا الثانية (كانت تُنتظر مع الترجمة بلا سبب).
         والدالّة تمرّ بـ`can_view_profile` فالحارس واحد لا اثنان. */
      getProfileArt(profile.id),
      isMe ? Promise.resolve() : recordProfileView(profile.id),
    ]);

  /* ملفّ غيرك قد يكون كُتب بلغةٍ غير لغتك — العناوين تُترجَم عند العرض
     (D-048) فلا تُقرأ صفحةٌ نصفها عربي ونصفها إنجليزي */
  const [ratings, follows, favorites] = await Promise.all([
    localizeRows(rawRatings, locale),
    localizeRows(rawFollows, locale),
    /* المفضّلة عناوينُها مخزّنةٌ كبقية الصفوف، فتُترجَم عند العرض (D-048) */
    localizeRows(rawFavorites, locale),
  ]);

  /* استبدالٌ في مصدرٍ واحد: كل أقسام البروفايل تُبنى من هذين الصفّين،
     فلا تُلمس بطاقةٌ واحدة */
  if (profileArt.size) {
    for (const f of follows) {
      const a = profileArt.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
    for (const r of ratings) {
      const a = profileArt.get(artKey(r.media_type, r.tmdb_id));
      if (a?.poster_path) r.poster_path = a.poster_path;
    }
    for (const f of favorites) {
      const a = profileArt.get(artKey(f.media_type, f.tmdb_id));
      if (a?.poster_path) f.poster_path = a.poster_path;
    }
  }

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

  /* 🆕 **أربعُ خاناتٍ بأصفرٍ واحد** (D-438، وخطّةُ أحمد: «Shows · Movies ·
     Ratings · Lists»): **«واتش ليست» غادرت البطاقة** — وهي رقمٌ عن حالةِ
     مكتبةٍ لا عن صنعِ صاحبها، **والقوائمُ حلّت مكانها** لأنها ما يصنعه
     ويعلنه. **وورقةُ «وش باقي يتفرج» لم تسقط**: بابُها صفُّ «للمشاهدة»
     في مكتبته وصفحتُه، **والبابُ الذي سقط هو الرقمُ في الترويسة.**
     **واللونُ واحدٌ في الأربع** (D-437). */
  const headerStats = [
    { key: "shows", icon: "tv" as const, color: "var(--accent)", value: tvFollows.length, label: t.shortShows },
    { key: "movies", icon: "film" as const, color: "var(--accent)", value: movieFollows.length, label: t.shortMovies },
    { key: "ratings", icon: "star" as const, color: "var(--accent)", value: ratings.length, label: t.panelRatings },
    { key: "lists", icon: "list" as const, color: "var(--accent)", value: publicLists.length, label: t.profileTabLists },
  ];

  /* ===== ترتيبان من نفس الصفوف — بلا نداءٍ ثانٍ (D-438) =====
     **«الأعلى تقييماً» بالرقم، و«النشاط الأخير» بالزمن** — **والمصدرُ
     `ratings` نفسُه** المقروءُ أعلاه. **ونسخةٌ قبل الفرز** لأن `sort`
     تُبدّل المصفوفةَ في مكانها ويقرؤها قسمان. */
  const topRated = [...ratings].sort((a, b) => b.rating - a.rating);
  const recent = [...ratings].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );
  const reviewsNewest = [...withReview].sort((a, b) =>
    (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
  );

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

  /** كل قسمٍ يُبنى مرّةً هنا، ويُرسم أعلاه بترتيب صاحبه — والفارغ `null`
      فلا يترك عنواناً بلا محتوى */
  /* سقفُ المستخدم يُطبَّق هنا لا في كل صفٍّ على حدة (D-152): `capCards`
     تأخذ الأصغر من سقف الصفّ وسقفه، فالافتراضي `full` لا يغيّر شيئاً */
  const cap = (rowCap: number) => capCards(rowCap, prefs.cards);

  /* نفس سجلّ شاشة التخصيص — لا خريطةَ ثانية تنحرف عنها (D-152) */
  const hiddenMeta = profileSectionMeta(t);

  const sections: Record<ProfileSection, React.ReactNode> = {
    shows:
      shows.length > 0 ? (
        <PosterRail title={t.shortShows} icon="tv" iconColor="var(--accent)">
          {shows.slice(0, cap(shows.length)).map((i) => (
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
      ) : null,

    movies:
      movieFollows.length > 0 ? (
        <PosterRail title={t.shortMovies} icon="film" iconColor="var(--accent)">
          {movieFollows.slice(0, cap(movieFollows.length)).map((f) => (
            <RailItem key={`m-${f.tmdb_id}`}>
              {/* بلا شارة «شوهد» وبلا خيط التقدم الأخضر (طلب أحمد) —
                  الملصق وحده؛ حالته عند صاحبه شأنه */}
              <PosterCard href={`/movie/${f.tmdb_id}`} title={f.title} posterPath={f.poster_path} />
            </RailItem>
          ))}
        </PosterRail>
      ) : null,

    /* «فنّانوك» صفٌّ لا شبكة: البروفايل كلّه صفوف، والشبكة هنا لغةٌ
       بصرية ثانية لنفس المحتوى. وبلا سطر «شاهدتَ له ٧ أعمال» — ذاك
       العدد يُحسب من سجلّ **مشاهدتك أنت** (D-128)، وكتابتُه في صفحة
       غيرك كذبٌ صريح، وحسابُه له ثلاثون نداءً لا تُدفع في صفحةٍ عامة */
    artists:
      artists.length > 0 ? (
        <PosterRail title={t.shortArtists} icon="people" iconColor="var(--accent)">
          {artists.slice(0, cap(artists.length)).map((a) => (
            <RailItem key={`a-${a.person_id}`}>
              <PosterCard
                href={`/person/${a.person_id}`}
                title={a.name ?? "—"}
                posterPath={a.profile_path}
                posterSize="w185"
                fallbackIcon="people"
              />
            </RailItem>
          ))}
        </PosterRail>
      ) : null,

    /* قوائمه المعلنة (D-068) — صنعُه بعد متابعاته وقبل أحكامه. بطاقة
       اكتشف نفسها بلا سطر صاحبٍ (الصفحة كلّها صفحته)، والرابط إلى
       /lists/[id] حيث زرّ «أضِفها إلى قوائمي» */
    /* «مفضّلاتي» (D-152): القائمة المثبّتة من D-130 صفّاً في البروفايل.
       بلا شارةٍ ولا خيط تقدّم — الملصق وحده، كصفّ الأفلام تماماً: القلبُ
       رأيٌ في العمل لا حالةُ مشاهدةٍ له. وترتيبُها ترتيبُ صاحبها اليدويّ
       (يأتي مرتَّباً من الدالّة، فلا فرزَ هنا) */
    favorites:
      favorites.length > 0 ? (
        <PosterRail title={t.profileFavoritesRail} icon="heart" iconColor="var(--accent)">
          {favorites.slice(0, cap(favorites.length)).map((f) => (
            <RailItem key={`fav-${f.media_type}-${f.tmdb_id}`}>
              <PosterCard
                href={`/${f.media_type === "tv" ? "show" : "movie"}/${f.tmdb_id}`}
                title={f.title ?? "—"}
                posterPath={f.poster_path}
              />
            </RailItem>
          ))}
        </PosterRail>
      ) : null,

    lists: <PublicListsRail lists={publicLists} locale={locale} title={t.profileListsRail} />,

    ratings:
      topRated.length > 0 ? (
        <PosterRail title={t.profileTopRated} icon="star" iconColor="var(--accent)">
          {topRated.slice(0, cap(16)).map((r) => (
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
      ) : null,
  };

  /* ===== التبويبات (D-438) =====
     **أربعةٌ: نظرةٌ عامة · نشاط · مراجعات · قوائم** — **و«نظرة عامة» هي
     صفحتُه القديمة بترتيب صاحبها** (D-129) فلا يفقد أحدٌ قسماً خصّصه.
     **والثلاثةُ الباقية ليست بياناتٍ جديدة**: نشاطُه تقييماتُه بالزمن،
     ومراجعاتُه ما كتب فيه سطراً، وقوائمُه ما أعلنه — **كلُّها مقروءةٌ
     في الموجة نفسِها**، **فالتبويبُ يفرز ما عندنا لا يطلب المزيد.**
     ⚠️ **والعدّادُ يعدّ ما يعرضه جسمُه** (D-374). */
  const TABS = ["overview", "activity", "reviews", "lists"] as const;
  type ProfileTab = (typeof TABS)[number];
  const tab: ProfileTab = (TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as ProfileTab)
    : "overview";
  const base = `/u/${encodeURIComponent(profile.username ?? username)}`;
  const tabItems: PageTab[] = [
    { key: "overview", label: t.profileTabOverview, icon: "grid", href: base },
    {
      key: "activity",
      label: t.communityTabMine,
      icon: "clock",
      count: recent.length,
      href: `${base}?tab=activity`,
    },
    {
      key: "reviews",
      label: t.communityTabReviews,
      icon: "comment",
      count: reviewsNewest.length,
      href: `${base}?tab=reviews`,
    },
    {
      key: "lists",
      label: t.profileTabLists,
      icon: "list",
      count: publicLists.length,
      href: `${base}?tab=lists`,
    },
  ];

  /* 🆕 **«النشاط الأخير» كتلةٌ ثابتةٌ في «نظرة عامة» لا قسمٌ يُرتَّب**
     (D-438). **وخطّةُ أحمد تصفّ محتوى التبويب بترتيبه** («Favorites ·
     Recent activity · Top rated») — **فهو تركيبُ التبويب لا تفضيلُ
     صاحبه**، ونظامُ الترتيب يبقى لصفوف المكتبة كما هو (D-129).
     ⚠️ **وبلا نداءٍ جديد**: التقييماتُ مقروءةٌ أعلاه، **والصفُّ يفرزها
     بالزمن.** **و`CompactMediaRow` هو صفُّ الرئيسية المضغوط نفسُه**
     (D-434) — **ولا شكلَ ثانٍ لمعنًى واحد.** */
  const recentBlock =
    recent.length > 0 ? (
      <PosterRail title={t.profileRecent} icon="clock" iconColor="var(--accent)" bare>
        <div className="space-y-2">
          {recent.slice(0, cap(6)).map((r) => (
            <CompactMediaRow
              key={`rc-${r.media_type}-${r.tmdb_id}`}
              href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
              title={r.title ?? "—"}
              subtitle={`★ ${r.rating}/10`}
              posterPath={r.poster_path}
            />
          ))}
        </div>
      </PosterRail>
    ) : null;

  return (
    /* 🆕 **كثافةُ صاحب الصفحة تُكتب على جذرها** (D-441) — **فملصقاتُ
       ملفّه بمقاسه هو لا بمقاس قارئه**: الصفحةُ صفحتُه، **ومن يزورك يرى
       ما اخترتَه أنت.** */
    <div className="space-y-5" style={densityVars(prefs.density)}>
      {/* ===== الغلاف ===== */}
      <section>
        <div className="relative h-[9.5rem] sm:h-[15rem] -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
          {profile.cover_url ? (
            <Image
              src={profile.cover_url}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 1152px"
              className="object-cover"
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
          {/* ⚖️ 🆕 **والذوبانُ قصُر من ٩٦px إلى ٤٠** (D-547، طلبُ أحمد
              بخطّين على لقطته: «يصل الغلافُ للخطّ الأخضر — منتصفُ
              الدائرة تكون في الخلفية»).

              **والعلّةُ كانت هنا لا في الهوامش**: الغلافُ صندوقُه ينتهي
              عند حافّةٍ معلومة، **لكنّ آخرَ ٩٦px منه كانت تذوب إلى لون
              الخلفية** — **فالفنُّ يختفي قبل الحافّة بمسافةٍ تزيد على
              ارتفاع الصورة الشخصيّة كلِّها**، ويبدو الغلافُ منتهياً عند
              رأس الدائرة. **والحدُّ الحادُّ يبقى ممنوعاً** (خطٌّ أفقيٌّ
              يقطع الصورة)، **فبقي الذوبانُ وقصُر إلى ٤٠** — يكفي لإخفاء
              الحافّة ولا يأكل الصورة. */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-b from-transparent to-[color:var(--background)]" />

          {/* ⚖️ 🆕 **وأدواتُ الغلاف نزلت إلى صفِّ الأفعال** (D-438): زرُّ
              المتابعة والنقاط كانا يطفوان على الصورة، **وصفُّ الأفعال
              الثلاثة (متابعة · رسالة · مشاركة) لا يسع زاويةً** — **والفعلُ
              الذي يُقرأ باسمه أوضحُ من قرصٍ زجاجيّ** (D-138).
              **وزرُّ الرجوع وحدَه يبقى** لأن موضعَه عُرفٌ لا خيار. */}
          <BackButton locale={locale} className="absolute top-3 start-3" />
        </div>

        {/* ===== كتلة الهوية ===== */}
        {/* ⚖️ 🆕 **`items-start` لا `items-end`** (D-547، طلبُ أحمد:
            «الاسمُ تكون بدايتُه موازيةً لرأس الدائرة»): **كان الصفُّ
            يُحاذي القيعان** فيجلس الاسمُ عند أسفل الصورة **ويبقى فوقه
            فراغٌ بارتفاع الفرق**. **والمحاذاةُ من الأعلى تجعل رأسَ
            الاسم ورأسَ الدائرة على خطٍّ واحد** — وهو ما رسمه بالأزرق.

            ⚖️ 🆕 **والتراكبُ صار ٤٠px لا ٦٨** (طلبُه بالأخضر):
            **الهامشُ السالبُ هو المسافةُ التي يعلوها الصفُّ فوق حافّة
            الغلاف، وهي نفسُها النقطةُ التي تقطع فيها الحافّةُ الدائرة**
            — **والدائرةُ ٨٠px (٧٤ + حلقةُ التدرّج)، فنصفُها ٤٠.**
            **٦٨ كانت تقطعها قربَ قاعها، و٨٠ في الشاشة الواسعة كانت
            تُغرقها كلَّها.** **والرقمُ مشتقٌّ من المقاس لا مذوق**:
            يتغيّر مقاسُ الصورة يوماً فيتغيّر معه. */}
        <div className="flex items-start gap-3 pe-4 -mt-10 relative z-10">
          <span
            className="block rounded-full p-[3px] shrink-0"
            style={{ background: "var(--gradient-brand)" }}
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

          {/* **و`pb-1` سقطت مع `items-end`** — كانت ترفع النصَّ عن قاع
              الصفّ، **ولا قاعَ يُحاذى بعد اليوم.** **و`leading-tight`
              تُقلّل الرصاصةَ داخل السطر** فتعلو حروفُ الاسم إلى رأس
              صندوقه، **وإلّا بقيت ثلاثةُ بكسلاتٍ فراغاً يكسر التوازي.** */}
          <div className="min-w-0 flex-1">
            <h1 className="text-22 sm:text-xl font-bold leading-tight truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
              {displayName}
            </h1>
            {/* ⚖️ 🆕 **والمعرّف عاد** (D-438، خطّةُ أحمد: «الاسم والـusername
                والنبذة»): **كان قد سقط بحكمٍ سابق لأنه يكرّر الاسم** —
                **وهو في الملفّ العامّ ليس تكراراً بل عنوانٌ يُكتب ويُشارَك**،
                وهو ما يفرّق بين متشابهَي الاسم. **ويغيب لمن أخفى اسمَه**
                لأن المعرّفَ يكشفه. */}
            {profile.username && !profile.hide_name && (
              <p
                className="text-[12.5px] text-white/60 leading-tight truncate drop-shadow"
                dir="ltr"
              >
                @{profile.username}
              </p>
            )}
            {bioText && (
              <p className="text-[12.5px] text-white/70 leading-snug mt-1 drop-shadow line-clamp-2 max-w-[46ch]">
                {bioText}
              </p>
            )}
          </div>
        </div>

        {/* ===== صفُّ الأفعال (D-438) ===== */}
        {/* 🆕 **والفواصلُ ضاقت** (D-547، طلبُ أحمد: «صفُّ التبويب
            والمحتوى السفليّ ارفعه كذلك»): **٣ → ٢٫٥ هنا ومثلُها في صفِّ
            الأرقام، و٤ → ٣ قبل البطاقة** — **أربعةَ عشرَ بكسلاً تصعد
            بها التبويباتُ وكلُّ ما تحتها**، **بلا أن يلتصق صفٌّ بصفّ.** */}
        <div className="relative z-10 mt-2.5 flex items-center gap-2 flex-wrap">
          {!isMe ? (
            <>
              <FollowUserButton
                targetId={profile.id}
                locale={locale}
                initialFollowing={relation.following}
                initialRequested={relation.requested}
              />
              <ProfileMenu
                person={{
                  id: profile.id,
                  nickname: profile.nickname,
                  username: profile.username,
                  avatar_url: profile.avatar_url,
                  hide_name: profile.hide_name ?? false,
                }}
                mutual={relation.following && relation.followsMe}
                system={isLoopz(profile.id)}
                messageButton
                variant="plain"
                locale={locale}
              />
            </>
          ) : (
            <Link
              href="/profile/edit"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 h-9 text-14 font-bold transition hover:border-accent/50 active:scale-95"
            >
              <Icon name="edit" size={15} style={{ color: "var(--accent)" }} />
              {t.headerSettings}
            </Link>
          )}
          {/* **والمشاركةُ للاثنين**: صفحةٌ عامّةٌ تُشارَك سواءٌ كانت لك أو
              لغيرك — **ونفسُ زرِّ المشاركة لا نسخةٌ منه** (القاعدة ٦). */}
          <ShareTitleButton
            path={base}
            title={displayName}
            label={t.shareLinkLabel}
            locale={locale}
            className="border border-border bg-surface h-9 px-3.5"
          />
        </div>

        {/* ===== المتابعون · المتابَعون · الزيارات · المستوى ===== */}
        <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-14 leading-tight">
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
          {/* 🆕 **والجمهورُ يُطبَّق هنا لا في شاشة التخصيص** (D-465):
              **المفتاحُ يُطفئ الرقمَ عن الجميع بمن فيهم صاحبُه**،
              **والقائمةُ تختار من يراه حين يكون مضاءً** — **وصاحبُ
              الصفحة يراه دائماً** وإلّا ضبط رقماً لا يقع عليه بصرُه.
              ⚠️ **وهذا إخراجٌ لا قفلٌ في SQL** — كسائر `profile_prefs`. */}
          {prefs.visits &&
            (isMe ||
              prefs.visitsWho === "everyone" ||
              (prefs.visitsWho === "followers" && relation.following)) && (
            <span className="shrink-0 text-muted">
              <span className="font-bold text-foreground tabular-nums">{visits}</span>{" "}
              {t.visitsLabel}
            </span>
          )}
          {/* 🆕 **والمستوى صار رقاقةً** (D-438، خطّةُ أحمد: «Level pill»):
              **الشريطُ العريض كان سطراً كاملاً لرقمٍ لا يُقرأ إلا مرّةً**،
              **والرقاقةُ تقوله في مكانه بين الأرقام الأخرى** — **والنسبةُ
              معه فلا يضيع التقدّم.** */}
          {canView && prefs.level && (
            <span
              className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-12 font-bold"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
                color: "var(--accent)",
              }}
              title={`${t.levelLabel(level.level)} · ${levelName(level.level, t)}`}
            >
              <Icon name="sparkle-star" size={13} />
              {t.levelLabel(level.level)}
              <span className="text-muted tabular-nums" dir="ltr">
                {level.percent}%
              </span>
            </span>
          )}
          {/* **وورقةُ «وش باقي يتفرج» بقيت** (D-438) — **غادرت بطاقةَ
              الأرقام ولم تغادر الصفحة**: **بابٌ يُفتح لا يُحذف لأن مكانَه
              تبدّل** (D-346 من جهته الثانية). */}
          {canView && toWatchItems.length > 0 && (
            <ToWatchStat
              value={toWatchItems.length}
              label={t.profileWatchlist}
              icon="bookmark"
              color="var(--accent)"
              items={toWatchItems}
              inline
              labels={{ close: t.closeLabel, empty: t.toWatchEmpty }}
            />
          )}
        </div>

        {/* ===== غلاف «حساب خاص» ===== */}
        {!canView && (
          <div className="relative z-10 mt-6 bg-surface border border-border rounded-2xl px-6 py-10 text-center">
            <Icon name="eye-off" size={28} className="mx-auto text-muted" />
            <p className="font-bold text-15 mt-3">{t.privateCoverTitle}</p>
            <p className="text-12 text-muted leading-relaxed mt-1 max-w-[36ch] mx-auto">
              {t.privateCoverHint}
            </p>
          </div>
        )}

        {/* ===== بطاقةُ الأرقام الأربعة ===== */}
        {canView && prefs.stats && (
          <div className="relative z-10 mt-3">
            <div className="grid grid-cols-4">
              {headerStats.map((s, i) => (
                <div
                  key={s.key}
                  className="relative flex flex-col items-center justify-center px-1 py-2.5"
                >
                  {i < headerStats.length - 1 && (
                    <span
                      className="absolute inset-y-1 end-0 w-px bg-[color:var(--divider)]"
                      aria-hidden
                    />
                  )}
                  <span className="flex items-center gap-2">
                    <Icon name={s.icon} size={20} style={{ color: s.color }} className="shrink-0" />
                    <span className="text-20 font-bold leading-none tabular-nums">
                      {s.value}
                    </span>
                  </span>
                  <span className="block text-12 text-muted mt-1.5 leading-[1.25]">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {canView && (
        <PageTabs items={tabItems} active={tab} ariaLabel={t.profile} asNav />
      )}

      {/* ===== نظرة عامة — الكتلةُ الثابتة ثم صفوفُه بترتيب صاحبها (D-129) ===== */}
      {canView && tab === "overview" && recentBlock}
      {canView &&
        tab === "overview" &&
        prefs.order.map((sec) => {
          const node = sections[sec];
          return node ? <div key={sec}>{node}</div> : null;
        })}

      {/* ===== النشاط — تقييماتُه بالزمن ===== */}
      {canView && tab === "activity" && (
        <div className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-center text-muted py-16 text-sm">{t.profileEmptyActivity}</p>
          ) : (
            recent.slice(0, 60).map((r) => (
              <CompactMediaRow
                key={`ac-${r.media_type}-${r.tmdb_id}`}
                href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                title={r.title ?? "—"}
                subtitle={`★ ${r.rating}/10`}
                posterPath={r.poster_path}
              />
            ))
          )}
        </div>
      )}

      {/* ===== المراجعات — ما كتب فيه سطراً =====
          **والحرقُ محجوبٌ هنا كما يُحجب في كلِّ سطح** (D-315): البوّابةُ
          `SpoilerText` نفسُها، **ولا نصَّ محجوبٌ يُرسم ثم يُغطّى.** */}
      {canView && tab === "reviews" && (
        <div className="space-y-3">
          {reviewsNewest.length === 0 ? (
            <p className="text-center text-muted py-16 text-sm">{t.profileEmptyReviews}</p>
          ) : (
            reviewsNewest.map((r) => (
              <article
                key={`rv-${r.media_type}-${r.tmdb_id}`}
                className="rounded-2xl border border-border bg-surface p-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`}
                    className="min-w-0 truncate text-15 font-bold hover:text-accent transition"
                    dir="auto"
                  >
                    {r.title ?? "—"}
                  </Link>
                  <span
                    className="shrink-0 text-14 font-bold tabular-nums"
                    style={{ color: "var(--accent)" }}
                    dir="ltr"
                  >
                    ★ {r.rating}/10
                  </span>
                </div>
                <div className="fs-content mt-2 text-14 leading-relaxed whitespace-pre-line" dir="auto">
                  {r.has_spoiler ? (
                    <SpoilerText text={r.review ?? ""} locale={locale} />
                  ) : (
                    (r.review ?? "")
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* ===== القوائم — شبكةٌ كأختها في المكتبة (D-433) ===== */}
      {canView && tab === "lists" && (
        publicLists.length === 0 ? (
          <p className="text-center text-muted py-16 text-sm">{t.profileEmptyLists}</p>
        ) : (
          <PublicListsRail lists={publicLists} locale={locale} title={t.profileTabLists} grid />
        )
      )}

      {/* ===== ما أخفيتَه، تراه أنت وحدك (D-152) ===== */}
      {canView && isMe && tab === "overview" && (
        <>
          {PROFILE_SECTIONS.filter((s) => !prefs.order.includes(s)).map((sec) => (
            <div
              key={`hidden-${sec}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-bold text-muted">
                  <Icon name={hiddenMeta[sec].icon} size={16} className="shrink-0" />
                  <span className="truncate">{hiddenMeta[sec].label}</span>
                </span>
                <span className="block text-12 text-muted mt-0.5">{t.profileHiddenHint}</span>
              </span>
              <span className="shrink-0 text-12 text-muted border border-border rounded-full px-2.5 py-1">
                {t.profileHiddenBadge}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
