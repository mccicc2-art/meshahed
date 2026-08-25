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
  getProfileAnimeFlags,
  getMyFavoritesListId,
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
import { FollowCountButton } from "@/components/ProfilePeeks";
import { FavoritesRail } from "@/components/FavoritesRail";
import {
  PROFILE_SECTIONS,
  applySectionOrder,
  profileSectionMeta,
  sanitizeProfilePrefs,
  type ProfileSection,
} from "@/lib/profilePrefs";
import { SectionReorderButton, sectionKeyOf } from "@/components/SectionReorderButton";
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
    animeFlags,
    favListId,
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
      /* 🆕 **علَمُ الأنمي** (D-561) — **نداءٌ خفيفٌ لا يُرجع إلا صفوفَ
         الأنمي**، **وقبل تشغيل الهجرة ١٢٩ يُرجع فراغاً** فيغيب صفُّ
         الأنمي ولا ينكسر شيء. */
      getProfileAnimeFlags(profile.id),
      /* 🆕 **معرّفُ قائمة مفضّلتي** (D-567) — **لصاحب الصفحة وحدَه**:
         **زرُّ ترتيبٍ في صفحةِ غيرك يكتب في قائمته** (ق٨/D-217)،
         **ونداءٌ لا يُقرأ ثمنٌ بلا مقابل** (D-152). */
      isMe ? getMyFavoritesListId() : Promise.resolve(null),
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

  /* 🆕 **وترتيبُ صاحب الصفحة يُطبَّق عند القراءة** (D-581): المحفوظُ في
     `profile_prefs.sectionOrder` أوّلاً بترتيبه، **وما أُضيف بعد آخرِ
     ترتيبٍ يُذيَّل بترتيبه الطبيعيّ** فلا يختفي. */
  const secOrder = prefs.sectionOrder;
  const tvFollows = applySectionOrder(
    follows.filter((f) => f.media_type === "tv" && !f.dropped),
    secOrder.shows,
    (f) => sectionKeyOf.show(f.tmdb_id),
  );
  const movieFollows = applySectionOrder(
    follows.filter((f) => f.media_type === "movie" && !f.dropped),
    secOrder.movies,
    (f) => sectionKeyOf.movie(f.tmdb_id),
  );
  const artistsOrdered = applySectionOrder(
    artists,
    secOrder.artists,
    (a) => sectionKeyOf.artist(a.person_id),
  );
  /* **وقوائمُه بترتيبه في البابين** — قسمُ النظرة العامّة وتبويبُ
     «قوائم» يقرآن المصفوفةَ نفسَها، **وترتيبان لشيءٍ واحدٍ خلل** (D-152) */
  const listsOrdered = applySectionOrder(
    publicLists,
    secOrder.lists,
    (l) => sectionKeyOf.list(l.id),
  );
  const level = getLevel(levelPoints(watched.episodes, watched.movies.size));

  /* 🆕 **سطرُ اللقب** (D-561) — **ما كتبه صاحبُه، وإلّا اسمُ مستواه.**
     **والارتدادُ ليس زينةً**: **مفتاحُ «المستوى» في شاشة التخصيص كان
     يحكم رقاقةً صفراءَ سقطت**، **فلو لم يرث شيئاً لصار مفتاحاً لا
     يفعل** (D-217) — **وهو الآن يحكم هذا السطر.**
     ⚠️ **ويتبع الاسمَ في الإخفاء**: من أخفى اسمَه أخفى نبذتَه، **ولقبٌ
     يكتبه بيده يكشفه كما تكشفه نبذتُه.** */
  const metaTitle = profile.hide_name
    ? null
    : prefs.title || (canView && prefs.level ? levelName(level.level, t) : null);

  /* ⚖️ 🆕 **بابُ «وش باقي يتفرج» غادر البروفايل** (D-561، نقضٌ مُعلَنٌ
     لبقيّةِ D-438).

     **وD-438 أبقته بحجّةٍ صحيحةٍ في حينها**: «بابٌ يُفتح لا يُحذف لأن
     مكانَه تبدّل» — **يومَ لم يكن له مكانٌ آخر.** **وD-559 أعطته
     مكاناً دائماً**: «للمشاهدة» صارت **بطاقةً في قائمة الليستات**
     يُشغّلها صاحبُها ويُطفئها. **فصار البابُ الثاني نسخةً**، **ونسخةٌ
     ثانيةٌ لفعلٍ واحدٍ خللٌ** (القاعدة ٣). **والصفُّ الذي كان يحمله
     صار ثلاثةَ عناصرَ كما رسمها أحمد: اللقب · متابَعون · متابِعون.**

     🆕 **ومكانَه: المفضّلةُ تنقسم ثلاثةَ صفوفٍ** (تصميمُ أحمد:
     «Shows · Movies · Anime»). **والأنمي ليس نوعَ وسيطٍ ثالثاً عندنا**
     بل **علَمٌ على المتابعة** (D-182) — **فالقسمةُ بالعلَم أوّلاً ثم
     بالنوع**، **وعملٌ واحدٌ لا يظهر في صفَّين.** */
  const favAnime = favorites.filter((f) => animeFlags.get(artKey(f.media_type, f.tmdb_id)));
  const favRest = favorites.filter((f) => !animeFlags.get(artKey(f.media_type, f.tmdb_id)));
  const favShows = favRest.filter((f) => f.media_type === "tv");
  const favMovies = favRest.filter((f) => f.media_type === "movie");
  /* **وعاءُ الدمج** (D-567): مفاتيحُ المفضّلة كلِّها **بترتيبها الحاليّ
     كما جاءت من `profile_favorites`** (`sort_order` أوّلاً) — **فورقةُ
     نوعٍ واحدٍ تُعيد ترتيبَه داخل خاناته ولا تمسّ جيرانه.** */
  const favKeys = favorites.map((f) => `${f.media_type}-${f.tmdb_id}`);

  /* 🆕 **وأيُّهما أوّلاً — بترتيبِ صاحب الصفحة** (D-564، طلبُ أحمد:
     «أبغى أرتّب الأفلام والمسلسلات وش يظهر أوّل»).

     **ولا مفتاحَ جديد**: **`prefs.order` هو مكانُ هذا السؤال منذ
     D-129** — قائمةُ السحب في «تخصيص الصفحات ← البروفايل». **وثاني
     إعدادٍ لترتيبٍ واحدٍ خللٌ** (القاعدة ٦)، **ومن رتّب أقسامَه مرّةً
     يتوقّع أن يُطاع في كلِّ مكانٍ تُعرض فيه.**

     ⚠️ **والأنمي يذيّلهما دائماً**: **ليس قسماً في السجلّ** (لا مفتاحَ
     له في `PROFILE_SECTIONS`)، **وإقحامُه فيه كان سيُخفيه عن كلِّ من
     رتّب أقسامَه قبل اليوم** — ترتيبُه المحفوظُ لا يحوي المفتاحَ
     الجديد، **فيُقرأ الغيابُ إخفاءً** (D-152). */
  const favOrder = (["shows", "movies"] as const).slice().sort((a, b) => {
    const ia = prefs.order.indexOf(a);
    const ib = prefs.order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  /* ⚖️ 🆕 **البطاقةُ صارت ثلاثَ خاناتٍ داخل إطار** (D-561، تصميمُ
     أحمد: «Movies · Shows · Full statistics ›»، ونقضٌ مُعلَنٌ لأربعةِ
     D-438).

     **ولماذا سقط رقمان:** «تقييمات» و«قوائم» **صارا عدّادَين على
     تبويبَيهما** (`PageTabs.count`) — **والرقمُ مرّتين في شاشةٍ
     واحدةٍ لا يقول ضعفَ ما يقوله مرّةً** (D-374 من جهته المقابلة).
     **وما بقي هو ما لا تبويبَ له**: مسلسلاتُه وأفلامُه.

     ⚠️ **والخانةُ الثالثةُ بابٌ لا رقم** — **و`/stats` تقرأ صاحبَ
     الجلسة لا صاحبَ الصفحة**، **فبابٌ يفتح إحصائياتي في صفحةِ غيري
     يكذب** (D-217). **فهو لي وحدي، ولزائرِ ملفّي رقمُ تقييماتِه
     مكانَه** — **رقمٌ لا بابَ له في صفحته.** */
  const headerStats = [
    { key: "movies", icon: "film" as const, value: movieFollows.length, label: t.shortMovies },
    { key: "shows", icon: "tv" as const, value: tvFollows.length, label: t.shortShows },
    ...(isMe
      ? []
      : [{ key: "ratings", icon: "star" as const, value: ratings.length, label: t.panelRatings }]),
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
        <PosterRail
          title={t.shortShows}
          /* 🆕 **مقبضُ الترتيب لصاحب الصفحة** (D-581) — نفسُ مقبض
             المفضّلة بالبكسل، والكاتبُ `profile_prefs.sectionOrder` */
          action={
            isMe ? (
              <SectionReorderButton
                section="shows"
                locale={locale}
                items={tvFollows.map((f) => ({
                  tmdb_id: f.tmdb_id,
                  media_type: "tv" as const,
                  title: f.title,
                  poster_path: f.poster_path,
                }))}
              />
            ) : undefined
          }
        >
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
        <PosterRail
          title={t.shortMovies}
          action={
            isMe ? (
              <SectionReorderButton
                section="movies"
                locale={locale}
                items={movieFollows.map((f) => ({
                  tmdb_id: f.tmdb_id,
                  media_type: "movie" as const,
                  title: f.title,
                  poster_path: f.poster_path,
                }))}
              />
            ) : undefined
          }
        >
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
      artistsOrdered.length > 0 ? (
        <PosterRail
          title={t.shortArtists}
          action={
            isMe ? (
              <SectionReorderButton
                section="artists"
                locale={locale}
                items={artistsOrdered.map((a) => ({
                  key: sectionKeyOf.artist(a.person_id),
                  title: a.name ?? "—",
                  poster_path: a.profile_path,
                  fallbackIcon: "people" as const,
                }))}
              />
            ) : undefined
          }
        >
          {artistsOrdered.slice(0, cap(artistsOrdered.length)).map((a) => (
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
    /* ⚖️ 🆕 **«مفضّلاتي» غادرت سجلَّ الأقسام إلى رأس التبويب**
       (D-561): **صارت هي التبويبَ نفسَه** بثلاثة صفوفٍ مصنّفة، **وقسمٌ
       يُرسم مرّتين في صفحةٍ واحدة خللٌ** (D-374). **والمفتاحُ يبقى في
       السجلّ** لأن شاشةَ التخصيص تُظهره وتُخفيه — **والإخفاءُ يُسكت
       الصفوفَ الثلاثة كما كان يُسكت الصفَّ الواحد** (D-152: إظهارُه هو
       الإعلانُ نفسُه). */
    favorites: null,

    lists: (
      <PublicListsRail
        lists={listsOrdered}
        locale={locale}
        title={t.profileListsRail}
        action={
          isMe ? (
            <SectionReorderButton
              section="lists"
              locale={locale}
              items={listsOrdered.map((l) => ({
                key: sectionKeyOf.list(l.id),
                title: l.name,
                /* أوّلُ ملصقات البطاقة — الوجهُ الذي يعرفه من بطاقتها */
                poster_path: l.posters[0] ?? null,
                fallbackIcon: "list" as const,
              }))}
            />
          ) : undefined
        }
      />
    ),

    ratings:
      topRated.length > 0 ? (
        <PosterRail title={t.profileTopRated}>
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
    /* ⚖️ 🆕 **الأوّلُ صار «المفضّلة»** (D-561، تصميمُ أحمد) — **والاسمُ
       يرتدّ إلى «نظرة عامة» لمن أخفى مفضّلته**: **تبويبٌ يَعِد بمفضّلةٍ
       أخفاها صاحبُه يكذب** (D-217)، **وما تحته حينئذٍ صفوفُه المرتّبة
       فعلاً** — **فالاسمُ يتبع المحتوى لا العكس.** */
    {
      key: "overview",
      label: wants("favorites") ? t.profileTabFavorites : t.profileTabOverview,
      icon: wants("favorites") ? "heart" : "grid",
      href: base,
    },
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

  /* ⚖️ 🆕 **«النشاط الأخير» غادر التبويبَ الأوّل** (D-561، نقضُ
     كتلةِ D-438 الثابتة).

     **وحجّتُها يومَها كانت خطّةَ أحمد نفسَها** («Favorites · Recent
     activity · Top rated») — **وتصميمُه اليوم يبدأ التبويبَ بـ«Shows»
     مباشرةً**، **وتبويبُ «النشاط» على بُعد ضغطةٍ بنفس الصفوف
     بالضبط.** **فالكتلةُ كانت نسخةً مختصرةً من تبويبٍ مجاور**
     (القاعدة ٣)، **والمختصرُ يسقط والكاملُ يبقى.** */

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

          {/* ⚖️ 🆕 **وأدواتُ الغلاف عادت إلى الزاوية** (D-561، تصميمُ
              أحمد: ثلاثةُ أقراصٍ زجاجيّةٍ على الغلاف — رجوعٌ في زاوية
              البداية، مشاركةٌ ونقاطٌ في زاوية النهاية؛ **ونقضٌ مُعلَنٌ
              لـD-438**).

              **وحجّةُ D-438 كانت العدد لا الموضع**: «صفُّ الأفعال
              الثلاثة (متابعة · رسالة · مشاركة) لا يسع زاويةً». **والعددُ
              تبدّل**: **المتابعةُ صعدت إلى صفِّ الهوية بجانب الاسم**،
              **و«رسالة» رجعت إلى داخل ورقة النقاط** حيث حارسُها
              (D-051) يسكن أصلاً — **فبقي فعلان، وزاويةٌ تسعهما.**

              ⚠️ **والأقراصُ الثلاثةُ ٤٤×٤٤ سواءً** (D-033/D-168):
              **رجوعٌ ٤٤ ومشاركةٌ ٤٤ ونقاطٌ كانت ٤٠ فصارت ٤٤** —
              **ورتبةٌ واحدةٌ بمقاسين تُقرأ رتبتين.** */}
          <BackButton locale={locale} className="absolute top-3 start-3" />
          <div className="absolute top-3 end-3 z-10 flex items-center gap-2">
            <ShareTitleButton
              path={base}
              title={displayName}
              locale={locale}
              variant="cover"
            />
            {isMe ? (
              /* **وصاحبُ الصفحة يجد قلمَه مكانَ النقاط**: النقاطُ
                 بلاغٌ وحظرٌ ورسالة — **ثلاثتُها عن غيرك** — **وبابُ
                 صاحبها تعديلُ ملفِّه.** */
              <Link
                href="/profile/edit"
                aria-label={t.headerSettings}
                title={t.headerSettings}
                className="w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition"
              >
                <Icon name="edit" size={18} />
              </Link>
            ) : (
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
                locale={locale}
              />
            )}
          </div>
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
          {/* 🆕 **وصورةُ ملفّي بابُ تعديله** (D-571، طلبُ أحمد: «وصورة
              البروفايل توديني على إعدادات البروفايل»).

              **وهي ثالثةُ ثلاثٍ لكلٍّ وجهتُها**: **صورةُ الشريط ←
              الإعدادات** (رفيقةُ كلِّ صفحة، فوجهتُها عامّة) · **صورةُ
              الرئيسية ← ملفّي العامّ** (ترحيبٌ بي، فتُريني نفسي كما
              يراني الناس) · **وهذه ← تعديلُ ملفّي**: **أنا فيه أصلاً،
              فالباقي أن أغيّره.**

              ⚠️ **ولزائري لا رابط**: **صورةُ غيري لا تفتح تعديلاً ولا
              صفحةً أنا فيها** — **ورابطٌ يعيدك إلى مكانك بابٌ معطّل**
              (حجّةُ D-434 بحرفها). **والغلافُ يبقى غلافاً.**

              🟡 **ودَينٌ مُعلَن**: قلمُ الغلاف يفتح الوجهةَ نفسَها —
              **بابان لفعلٍ واحد** (القاعدة ٣). **أُبقيا لأن الصورةَ
              عُرفٌ لا يُعلَّم والقلمَ باب يُرى**، **ويسقط أحدُهما
              بكلمةٍ من أحمد.** */}
          {isMe ? (
            <Link
              href="/profile/edit"
              prefetch={false}
              aria-label={t.headerSettings}
              title={t.headerSettings}
              className="block rounded-full p-[3px] shrink-0 active:scale-95 transition"
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
            </Link>
          ) : (
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
          )}

          {/* **و`pb-1` سقطت مع `items-end`** — كانت ترفع النصَّ عن قاع
              الصفّ، **ولا قاعَ يُحاذى بعد اليوم.** **و`leading-tight`
              تُقلّل الرصاصةَ داخل السطر** فتعلو حروفُ الاسم إلى رأس
              صندوقه، **وإلّا بقيت ثلاثةُ بكسلاتٍ فراغاً يكسر التوازي.** */}
          <div className="min-w-0 flex-1">
            {/* 🔴 🆕 **والهالةُ صنفُ اللوحة لا ظلٌّ أسودُ مكتوبٌ بيد**
                (D-561، إصلاحُ عطلٍ في `daylight`): `.hero-halo` تشتقّ
                لونَها من `--background` (D-501) — **سوداءُ في الليل
                وبيضاءُ في النهار** — **والظلُّ الأسودُ الثابتُ كان
                لطخةً خلف نصٍّ أسودَ في السمة الفاتحة.** */}
            <h1 className="hero-halo text-22 sm:text-xl font-bold leading-tight truncate">
              {displayName}
            </h1>
            {/* ⚖️ 🆕 **والمعرّف عاد** (D-438، خطّةُ أحمد: «الاسم والـusername
                والنبذة»): **كان قد سقط بحكمٍ سابق لأنه يكرّر الاسم** —
                **وهو في الملفّ العامّ ليس تكراراً بل عنوانٌ يُكتب ويُشارَك**،
                وهو ما يفرّق بين متشابهَي الاسم. **ويغيب لمن أخفى اسمَه**
                لأن المعرّفَ يكشفه. */}
            {profile.username && !profile.hide_name && (
              <p
                /* 🔴 **و`text-white` كان عطلاً صامتاً في `daylight`**:
                   المعرّفُ والنبذةُ يسقطان **تحت** حافّة الغلاف
                   (`-mt-10` يرفع السطر الأوّل وحدَه)، **فيقفان على
                   `--background`** — **وأبيضُ ٦٠٪ على ‎#f5f5f3 لا
                   يُرى.** **و`--muted` يُقرأ على السمتين.** */
                className="hero-halo text-[12.5px] text-muted leading-tight truncate"
                dir="ltr"
              >
                @{profile.username}
              </p>
            )}
            {bioText && (
              <p className="hero-halo text-[12.5px] text-muted leading-snug mt-1 line-clamp-2 max-w-[46ch]">
                {bioText}
              </p>
            )}
          </div>

          {/* ⚖️ 🆕 **وزرُّ المتابعة صعد إلى صفِّ الهوية** (D-561، تصميمُ
              أحمد: رقاقةٌ صفراء «✓ Following» بمحاذاة الاسم؛ **ونقضُ
              صفِّ الأفعال في D-438**).

              **ولماذا هنا لا في سطرٍ تحته:** **المتابعةُ فعلٌ على
              الشخص لا على الصفحة** — **فمكانُها بجانب وجهه**، وهي
              أوّلُ ما يقصده الزائر. **وسطرٌ ثالثٌ يحمل زرّاً واحداً
              يدفع كلَّ ما تحته ستّةً وثلاثين بكسلاً بلا مقابل.**

              **و`self-center` لا `items-center` على الصفّ**: الصفُّ
              يُحاذي رؤوسَه (D-547 — رأسُ الاسم برأس الدائرة)،
              **والزرُّ وحدَه يتوسّط ارتفاعَ الصورة** — وهو ما رسمه. */}
          {!isMe && (
            <div className="shrink-0 self-center">
              <FollowUserButton
                targetId={profile.id}
                locale={locale}
                initialFollowing={relation.following}
                initialRequested={relation.requested}
              />
            </div>
          )}
        </div>

        {/* ===== المتابعون · المتابَعون · الزيارات · المستوى ===== */}
        {/* ⚖️ 🆕 **ثلاثةٌ في سطرٍ واحد: اللقب · متابَعون · متابِعون**
            (D-561، تصميمُ أحمد بحرفه: «Story lover — 13 Following · 12
            Followers»).

            **والترتيبُ انعكس**: كان «متابِعون» أوّلاً وصار «متابَعون» —
            **وهو ترتيبُ تصميمه**، ولا حجّةَ لأحدهما على الآخر غير
            الصورة.

            ⚖️ 🆕 **ورقاقةُ المستوى الصفراء سقطت** (نقضُ D-438):
            **صارت اسمَ المستوى في خانة اللقب** — **والاسمُ يقول ما
            يقوله الرقمُ وزيادة** («خبير» أفصحُ من «المستوى ٥»)،
            **والنسبةُ المئويّةُ رقمٌ ثالثٌ في سطرٍ فيه رقمان**.
            **ومفتاحُ `prefs.level` يبقى حاكماً** فلا يفقد أحدٌ إعداداً
            ضبطه. **وأصفرُ الصفحة صار للمتابعة وحدها** — **ولونٌ يعني
            شيئين لا يعني أحدَهما** (`02`). */}
        {/* ⚖️ 🆕 **والسطرُ صار عمودَين لا صفّاً واحداً** (D-566، طلبُ
            أحمد بخطٍّ أزرقَ رأسيٍّ على بداية الاسم: «الفولورز
            والفولوينغ يكونون على نفس خطّ بداية الاسم — ما أبغاهم
            يزاحمون اللقب، واللقب يأخذ راحته كاملة تحت الصورة»).

            **والعلّةُ أن السطرَ كان يصفّ ثلاثةَ عناصرَ متساوية**:
            اللقبُ أوّلاً ثمّ العدّادان، **فطولُ اللقب يزيح العدّادَين
            يميناً ويساراً بحسب ما كُتب** — **وسطرٌ يتحرّك بتغيّر نصٍّ
            فوقه لا يقف على خطٍّ أبداً.** **ولقبٌ طويلٌ يخنق العدّادَين
            في بقيّة السطر.**

            **والعمودان يحلّان الاثنين معاً**: **`w-20` هي عرضُ الصورة
            بالضبط** (٧٤ + حلقةُ ٣ من كلِّ جانب) **و`gap-3` هي فجوةُ
            صفِّ الهوية نفسُها** — **فبدايةُ العمود الثاني هي بدايةُ
            الاسم بالبكسل**، وهو خطُّه الأزرق حرفاً. **والرقمُ مشتقٌّ
            من المقاس لا مذوق**: يتغيّر مقاسُ الصورة يوماً فيتغيّر معه.

            **واللقبُ يملك عمودَه وحدَه** فينزل سطرَين إن طال (٢٤ حرفاً
            سقفُه) **ولا يزحزح شيئاً** — وهو «يأخذ راحته» بنصّه.

            ⚠️ **و`items-start` لا `items-center`**: **لقبٌ من سطرين
            كان سيُنزل العدّادَين إلى منتصفه** — **والمطلوب أن يبقى
            رأساهما على خطٍّ واحد.** */}
        <div className="relative z-10 mt-2.5 flex items-start gap-3 text-14 leading-tight">
          {/* **واللقبُ يتبع النبذةَ في الإخفاء**: من أخفى اسمَه أخفى
              سطرَه (نفسُ حارس `bioText`) — **ونصٌّ كتبه بيده يكشفه.** */}
          <div className="w-20 shrink-0">
            {metaTitle && (
              <span className="block text-muted leading-snug break-words">{metaTitle}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <FollowCountButton
            targetId={profile.id}
            dir="following"
            count={stats.following}
            label={t.followingLabel}
            sheetTitle={t.followsTabFollowing}
            locked={!isMe && !!profile.hide_follow_lists}
            labels={{ close: t.closeLabel, empty: t.followListEmpty, anonymous: t.anonymousUser }}
          />
          <FollowCountButton
            targetId={profile.id}
            dir="followers"
            count={stats.followers}
            label={t.followersLabel}
            sheetTitle={t.followsTabFollowers}
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
          </div>
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

        {/* ⚖️ 🆕 **البطاقةُ صارت إطاراً حقيقيّاً بثلاث خانات**
            (D-561، تصميمُ أحمد).

            **وكانت شبكةً عاريةً بأربع خانات وخطوطٍ فاصلة**: **أرقامٌ
            تطفو على الخلفية بلا حدٍّ يجمعها** — **والتصميمُ يضعها في
            بطاقةٍ واحدةٍ بحدٍّ ونصف قطرٍ ١٤** (نفسُ `settingsCard` في
            D-555)، **فتُقرأ كتلةً واحدةً لا أربعةَ أعمدةٍ متجاورة.**

            ⚠️ **والخانةُ الثالثةُ بابٌ لصاحبها ورقمٌ لزائره** — **وهي
            رابطٌ حقيقيٌّ لا `div` يُضغط** (D-217). */}
        {canView && prefs.stats && (
          <div className="relative z-10 mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="grid grid-cols-3">
              {headerStats.map((c, i) => (
                <div
                  key={c.key}
                  className="relative flex items-center justify-center gap-2 px-2 py-2.5"
                >
                  {/* **والخطُّ بين خانتين لا بعد آخرِها**: خانةُ
                      «الإحصائيات الكاملة» تلي الأخيرةَ لصاحب الصفحة
                      وحدَه، **فالشرطُ يعرف الحالتين** — **وخطٌّ على
                      حافّة البطاقة يُقرأ حدّاً مزدوجاً.** */}
                  {(i < headerStats.length - 1 || isMe) && (
                    <span
                      className="absolute inset-y-2 end-0 w-px bg-[color:var(--divider)]"
                      aria-hidden
                    />
                  )}
                  <Icon
                    name={c.icon}
                    size={20}
                    style={{ color: "var(--accent)" }}
                    className="shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-15 font-bold leading-none tabular-nums">
                      {c.value}
                    </span>
                    <span className="block text-12 text-muted mt-1 leading-[1.25] truncate">
                      {c.label}
                    </span>
                  </span>
                </div>
              ))}
              {isMe && (
                <Link
                  href="/stats"
                  className="flex items-center justify-center gap-1 px-2 py-2.5 text-14 font-semibold text-muted hover:text-accent transition"
                >
                  <span className="truncate">{t.profileFullStats}</span>
                  <Icon
                    name="chevron-down"
                    size={16}
                    className="shrink-0 -rotate-90 rtl:rotate-90"
                  />
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 🔴 🆕 **وشريطُ هذه الصفحة لا يختفي مع الكسوة** (D-564، بلاغُ
          أحمد): **هو الشريطُ الوحيدُ في التطبيق الذي يجلس في وسط
          الصفحة** — **فتحويلُ `chrome-sub` يرفعه فوق موضعه ويطفو على
          الصورة الشخصيّة، ويترك مكانَه فراغاً.** الحجّةُ كاملةً في
          `PageTabs`. */}
      {canView && (
        <PageTabs items={tabItems} active={tab} ariaLabel={t.profile} asNav autoHide={false} />
      )}

      {/* ===== المفضّلة — ثلاثةُ صفوفٍ ثم صفوفُه بترتيب صاحبها (D-129) =====
          🆕 **رأسُ التبويب مفضّلتُه مقسومةً** (D-561، تصميمُ أحمد):
          **Shows · Movies · Anime** — **والصفُّ الفارغُ لا يُرسم**،
          فمن لا أنمي عنده لا يرى عنواناً بلا ملصقات.

          ⚠️ **وتحتها صفوفُه المرتّبة كما هي** (D-129): **الترتيبُ
          إعدادٌ ضبطه صاحبُه ولا يُلغى لأن تبويباً تسمّى باسمٍ آخر** —
          **والتصميمُ لا يعرض ما تحت «Anime» أصلاً**، فلا تناقض. */}
      {canView &&
        tab === "overview" &&
        favOrder.map((k) => {
          const rows = k === "shows" ? favShows : favMovies;
          if (rows.length === 0) return null;
          return (
            <FavoritesRail
              key={`fav-${k}`}
              title={k === "shows" ? t.shortShows : t.shortMovies}
              listId={favListId}
              fullKeys={favKeys}
              items={rows}
              locale={locale}
            >
              {rows.slice(0, cap(rows.length)).map((f) => (
                <RailItem key={`fav-${f.media_type}-${f.tmdb_id}`}>
                  <PosterCard
                    href={`/${f.media_type === "tv" ? "show" : "movie"}/${f.tmdb_id}`}
                    title={f.title ?? "—"}
                    posterPath={f.poster_path}
                  />
                </RailItem>
              ))}
            </FavoritesRail>
          );
        })}
      {canView && tab === "overview" && favAnime.length > 0 && (
        <FavoritesRail
          title={t.discoverTabAnime}
          listId={favListId}
          fullKeys={favKeys}
          items={favAnime}
          locale={locale}
        >
          {favAnime.slice(0, cap(favAnime.length)).map((f) => (
            <RailItem key={`fa-${f.media_type}-${f.tmdb_id}`}>
              <PosterCard
                href={`/${f.media_type === "tv" ? "show" : "movie"}/${f.tmdb_id}`}
                title={f.title ?? "—"}
                posterPath={f.poster_path}
              />
            </RailItem>
          ))}
        </FavoritesRail>
      )}
      {/* 🔴 🆕 **وصفّان بعنوانٍ واحد في شاشةٍ واحدة** (D-564، بلاغُ
          أحمد: «و shows مكرّر»).

          **والعطلُ كان لي**: D-561 رفعت المفضّلةَ إلى رأس التبويب
          **وأبقيت صفوفَه المرتّبة تحتها** — **وأحمد كان قد اختار
          إسقاطَها وأنا خالفتُه.** **والنتيجةُ صفَّان اسمُهما
          «مسلسلات»**، **وأوّلُهما جزءٌ من ثانيهما حرفيّاً** (المفضّلةُ
          مأخوذةٌ من المكتبة نفسِها) — **فالملصقاتُ تتكرّر لا العناوينُ
          وحدَها.**

          **والقصُّ جراحيّ**: **يسقط قسمُ المكتبة الذي رسمته المفضّلةُ
          فعلاً** — لا كلُّ الأقسام. **فمن لا مفضّلةَ له في نوعٍ ما
          يبقى قسمُ مكتبته فيه كما كان** (D-152: لا يتحرّك ما لم
          يُطلب)، **و«فنّانوك» و«الأعلى تقييماً» و«قوائمه» لا يمسّها
          شيءٌ** لأنها لا تُكرَّر. */}
      {canView &&
        tab === "overview" &&
        prefs.order
          .filter(
            (sec) =>
              !(sec === "shows" && favShows.length > 0) &&
              !(sec === "movies" && favMovies.length > 0),
          )
          .map((sec) => {
            const node = sections[sec];
            return node ? <div key={sec}>{node}</div> : null;
          })}
      {/* **وتبويبٌ لا شيءَ فيه يقول ذلك** (D-374): من أخفى كلَّ أقسامه
          ولا مفضّلةَ له كان يرى صفحةً تنتهي عند التبويبات بلا كلمة. */}
      {canView &&
        tab === "overview" &&
        favorites.length === 0 &&
        !prefs.order.some((sec) => sections[sec]) && (
          <p className="text-center text-muted py-16 text-sm">{t.profileEmptyFavorites}</p>
        )}

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
          <PublicListsRail lists={listsOrdered} locale={locale} title={t.profileTabLists} grid />
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
