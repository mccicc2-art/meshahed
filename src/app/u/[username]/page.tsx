import Image from "next/image";
import Link from "next/link";
import {
  getUser,
  getProfileByUsername,
  getRatingsOf,
  getFollowStats,
  getFollowRelation,
  recordProfileView,
  getFollowsOf,
  getWatchedOf,
  getPublicListsOf,
  getProfileArtists,
  getProfileFavorites,
  getProfileArt,
  getProfileAnimeFlags,
  getMyFavoritesListId,
  getReviewLikesOf,
  getSavedListsOf,
  getFollows,
  artKey,
  displayNameOf,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { getLevel, levelPoints, levelName } from "@/lib/level";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FollowUserButton } from "@/components/FollowUserButton";
import { PlusBadge } from "@/components/PlusBadge";
import { ProfileMenu } from "@/components/ProfileMenu";
import { isLoopz } from "@/lib/loopz";
import { BackButton } from "@/components/BackButton";
import { PublicListsRail } from "@/components/PublicListsRail";
import { ActivityScreen, type ActivityItem } from "@/components/ActivityScreen";
import { getProfileActivity } from "@/lib/myActivity";
import { posterUrl } from "@/lib/media";
import { PageTabs, type PageTab } from "@/components/ui/PageTabs";
import { ShareTitleButton } from "@/components/ShareTitleButton";
import { FeedReviewText } from "@/components/FeedReviewText";
import { RowPoster } from "@/components/ActivityFeed";
import { RowComment } from "@/components/RowComment";
import { LikeButton } from "@/components/LikeButton";
import { timeAgoShort } from "@/lib/when";
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
import { SavedListsToggle } from "@/components/SavedListsToggle";
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
  /* 🆕 **البروفايلُ مفتوحٌ للزائر** (D-627): البوّابةُ سقطت — `me` يبقى
     قابلاً للفراغ، وكلُّ القراءات الشخصيّة (علاقةُ المتابعة، إعجاباتي،
     مكتبتي) ذاتيّةُ الحراسة تعود false/فارغةً للزائر عبر RLS، وأزرارُ
     الكتابة يردّها `requireUser` حتى تأتي بوّابةُ المرحلة الثانية. */
  const me = await getUser();

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

  const isMe = profile.id === me?.id;

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
    rawFollows,
    watched,
    publicLists,
    artists,
    rawFavorites,
    profileArt,
    animeFlags,
    favListId,
    reviewLikes,
    myLibRows,
    activityRows,
    savedLists,
  ] = await Promise.all([
      getRatingsOf(profile.id),
      getFollowStats(profile.id),
      getFollowRelation(profile.id),
      /* ⚖️ **وقراءةُ العدّاد سقطت مع عرضه** (D-584) — **نداءٌ لا يُقرأ
         ثمنٌ بلا مقابل** (D-152)؛ والتسجيلُ (`recordProfileView`) باقٍ
         أدناه. */
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
      /* 🆕 **قلوبُ مراجعاته وذخيرةُ «عندك»** (D-583) — للبطاقة وقد لبست
         شكلَ المجتمع: الأعدادُ من دالّة الخطّ نفسِها بنداءٍ واحد،
         و«عندك» من مكتبة القارئ المخبّأة (`cache`) — **وحالُ الملصق
         يُقال صدقاً لا يُفترض** (D-217). */
      getReviewLikesOf(profile.id),
      getFollows(),
      /* 🆕 **النشاطُ الكامل** (D-586) — دالّةُ definer واحدةٌ محروسةٌ
         بـ`can_view_profile` (الهجرة ١٣٠)؛ **وتُقرأ في الموجة لأن
         عدّادَ التبويب منها** (D-374: العدّادُ يعدّ ما يعرضه جسمُه). */
      getProfileActivity(profile.id),
      /* 🆕 **محفوظاتُه** (D-588) — لتبويب «قوائم»، وعدّادُه منها (D-374).
         ⚖️ 🆕 **ولها رايةٌ الآن** (D-594): زائرٌ والرايةُ مطفأةٌ لا
         يدفع النداءَ أصلاً (D-152/D-510) — **ففراغُ المصفوفة عنده يعني
         أن القسمَ والعدّادَ يسقطان معاً بلا شرطٍ ثانٍ** (D-374). */
      isMe || prefs.savedLists ? getSavedListsOf(profile.id) : Promise.resolve([]),
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
  /* «عندك» على ملصق المراجعة — مفاتيحُ مكتبة **القارئ** لا صاحبِ الصفحة */
  const myLibKeys = new Set(myLibRows.map((f) => `${f.media_type}-${f.tmdb_id}`));

  /* 🆕 **صفوفُ النشاط بلبوس شاشة `/activity`** (D-586) — **الإثراءُ
     وصفةُ صفحة النشاط حرفاً**: كلُّ صفٍّ يحمل اسمَه يتبرّع به لغيره،
     **والمتابعاتُ والتقييماتُ هنا مترجمةٌ أصلاً** (D-048) فيتقدّم
     اسمُها على المخزَّن في الصفّ. */
  const actMeta = new Map<string, { title: string; poster: string | null }>();
  for (const f of follows) {
    actMeta.set(`${f.media_type}-${f.tmdb_id}`, { title: f.title, poster: f.poster_path });
  }
  for (const r of ratings) {
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!actMeta.has(key) && r.title) actMeta.set(key, { title: r.title, poster: r.poster_path });
  }
  const activityItems: ActivityItem[] = activityRows.map((r, i) => {
    const info = actMeta.get(`${r.mediaType}-${r.tmdbId}`);
    return {
      id: `${r.kind}-${r.mediaType}-${r.tmdbId}-${r.at}-${i}`,
      kind: r.kind,
      at: r.at,
      mediaType: r.mediaType,
      tmdbId: r.tmdbId,
      title: info?.title ?? r.title ?? `#${r.tmdbId}`,
      poster: posterUrl(info?.poster ?? r.posterPath ?? null, "w185"),
      season: r.season ?? null,
      episode: r.episode ?? null,
      rating: r.rating ?? null,
      listName: r.listName ?? null,
    };
  });
  /* النبذة تتبع الاسم في الإخفاء — والقطع منفَّذٌ في `public_profiles`
     نفسه لا هنا (profile_bio.sql)؛ هذا السطر حارسٌ ثانٍ لا أوّل */
  const bioText = profile.hide_name ? null : (profile.bio ?? null);

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
  /* ⚖️ 🆕 ~~والبطاقةُ صارت أربعَ خاناتٍ للجميع (D-601)~~ — **نُقضت
     بحكمه بعد يومٍ واحد** (D-610، بلقطاتٍ ثلاث: «هذي رجّعها مثل
     التصميم الي قبل: مسلسلات · أفلام · جميع الإحصائيات»): **البطاقةُ
     عادت بطاقةَ D-561 بعينها** — ثلاثُ خاناتٍ في إطار، والخانةُ
     الثالثةُ بابُ «الإحصائيات الكاملة» لصاحبها ورقمُ التقييمات
     لزائره (`/stats` تقرأ صاحبَ الجلسة — D-217)، **والحلقاتُ عادت
     إلى صفحة الإحصائيات وحدَها.** */
  /* ⚖️ **والمسلسلاتُ قبل الأفلام باقيةٌ** (D-602، حكمُه: «مسلسلات ثم
     أفلام — الكل») — العائدُ شكلُ D-561 لا ترتيبُها. */
  const headerStats = [
    { key: "shows", icon: "tv" as const, value: tvFollows.length, label: t.shortShows },
    { key: "movies", icon: "film" as const, value: movieFollows.length, label: t.shortMovies },
    ...(isMe
      ? []
      : /* 🆕 **ومفتاحُها `reviews` لا `ratings`** (D-643): **المفتاحُ صار
           وجهةً لا اسماً** — والخانةُ تفتح تبويبَ المراجعات، **وهو
           بعينه ما تعدّه** (تقييماتُه). **ومفتاحٌ بلا تبويبٍ يقابله
           بابٌ إلى لا شيء.** */
        [{ key: "reviews", icon: "star" as const, value: ratings.length, label: t.panelRatings }]),
  ];

  /* ===== ترتيبان من نفس الصفوف — بلا نداءٍ ثانٍ (D-438) =====
     **«الأعلى تقييماً» بالرقم، و«النشاط الأخير» بالزمن** — **والمصدرُ
     `ratings` نفسُه** المقروءُ أعلاه. **ونسخةٌ قبل الفرز** لأن `sort`
     تُبدّل المصفوفةَ في مكانها ويقرؤها قسمان. */
  const topRated = [...ratings].sort((a, b) => b.rating - a.rating);
  /* ⚖️ **و«النشاط الأخير» المشتقُّ من التقييمات سقط** (D-586): التبويبُ
     صار يقرأ السجلَّ الكاملَ من `profile_activity` — **وترتيبان لشيءٍ
     واحدٍ خلل** (D-152). */
  /* ⚖️ 🆕 **والتبويبُ صار يعرض التقييمَ ولو بلا سطرٍ معه** (D-587، طلبُ
     أحمد بلقطة: «وهنا اعرض كذلك التقييم حتى الي بدون تعليق») —
     **المصدرُ `ratings` كلُّه**، والنجمةُ وحدَها فعلٌ يستحقّ صفَّه
     (وهو عُرفُ خطِّ المجتمع نفسِه: صفُّ `rate` بلا متن). **والمتنُ
     يُرسم لمن كتبه وحدَه** — لا فقرةَ فارغةً تحت النجمة. */
  const reviewsNewest = [...ratings]
    .filter((r) => r.rating != null || r.review?.trim())
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));

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
  /* 🆕 **وتبويبا «مسلسلات» و«أفلام»** (D-643، حكمُه: «إذا ضغط على كارد
     الأفلام أو المسلسلات تظهر كل أفلامه أو مسلسلاته»).
     🔑 **ولا بياناتٍ جديدة ولا نداءَ ثانٍ**: `tvFollows`/`movieFollows`
     مقروءتان أصلاً — **رقماهما هما اللذان يُعرضان في البطاقة** —
     **فالتبويبُ يفرز ما عندنا لا يطلب المزيد** (نصُّ التبويبات نفسُه).
     ⚠️ **ولماذا تبويبٌ لا ورقة**: قائمةٌ من ٤٤ ملصقاً في ورقةٍ تُقرأ
     نصفَ شاشة، **وما يستحقّ صفحةً يأخذها** (حجّةُ D-353/D-534).
     **والبطاقةُ صارت باباً لهما** — **ورقمٌ يُضغط ولا يفتح شيئاً هو
     الوعدُ الفارغ الذي يمنعه D-217.** */
  const TABS = ["overview", "shows", "movies", "activity", "reviews", "lists"] as const;
  type ProfileTab = (typeof TABS)[number];
  /* 🆕 **تبويبٌ مخفيٌّ عن الزائر** (D-617): إخراجٌ لا قفلٌ — صاحبُ
     الصفحة يرى تبويباتِه كلَّها، والزائرُ لا يرى المطفأ **ولا يبلغه
     برابطٍ مباشر** (D-217: رأسٌ يسقط ومحتواه باقٍ بابٌ خلفيٌّ يكذب). */
  const tabHidden = (k: string) =>
    !isMe && (prefs.hiddenTabs as readonly string[]).includes(k);
  const wantedTab: ProfileTab = (TABS as readonly string[]).includes(rawTab ?? "")
    ? (rawTab as ProfileTab)
    : "overview";
  const tab: ProfileTab = tabHidden(wantedTab) ? "overview" : wantedTab;
  const base = `/u/${encodeURIComponent(profile.username ?? username)}`;
  const tabItemsAll: PageTab[] = [
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
      key: "shows",
      label: t.shortShows,
      icon: "tv",
      count: shows.length,
      href: `${base}?tab=shows`,
    },
    {
      key: "movies",
      label: t.shortMovies,
      icon: "film",
      count: movieFollows.length,
      href: `${base}?tab=movies`,
    },
    {
      key: "activity",
      label: t.communityTabMine,
      icon: "clock",
      count: activityItems.length,
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
      count: publicLists.length + savedLists.length,
      href: `${base}?tab=lists`,
    },
  ];
  /* 🆕 والمطفأ يسقط من الصفّ عند الزائر (D-617) — الرأسُ والمحتوى معاً */
  /* 🆕 **وكلُّ تبويبٍ يستبدل ولا يكدّس** (D-643): التبويبُ وجهٌ ثانٍ
     لصفحةٍ واحدة، **فسهمُ الرجوع يُخرجك من الملفّ لا يمشي بك بين
     وجوهه.** الحجّةُ في `PageTabs.replace`. */
  const tabItems = tabItemsAll
    .filter((i) => !tabHidden(i.key))
    .map((i) => ({ ...i, replace: true }));

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
          {/* 🆕 **الأقراصُ سقطت والأزرارُ عاريةٌ** (D-643، حكمُه: «الدوائر
              على الرجوع والمشاركة والثلاث نقاط شيلها») — **وهو تعميمُ
              D-288 لا نقضٌ له**: الحجّةُ هناك أن `black/35` **شفّافةٌ لا
              سوداء**، فعلى غلافٍ فاتحٍ تصير رماديّةً باهتةً والأيقونةُ
              `white/90` فوقها — **رماديٌّ على رماديّ**. **وقد طُبِّقت على
              السهم وحدَه يومَها، وبقي جاراه بالقرص** — **ورتبةٌ واحدةٌ
              بشكلين تُقرأ رتبتين.**
              **والظلُّ هو ما يفصل الأيقونةَ عن أيِّ صورة** على الفاتح
              والداكن معاً.
              ⚠️ **ومواضعُها تُشتقّ من `--safe-top` لا من رقمٍ ثابت**:
              شريطُ التطبيق غاب (أعلاه)، **فالغلافُ صار يبدأ من حافّة
              الشاشة ونتوءُ الجهاز فوقه** — **و`top-3` وحدَها تضع السهمَ
              تحت الساعة.**
              ⚠️ **والفجوةُ `gap-5` لا `gap-2`**: المرئيُّ ٢٤ وهدفُ اللمس
              ٤٤ (D-033) — **وفجوةٌ أصغرُ من ٢٠ تجعل هدفَي لمسٍ متداخلين
              فيُضغط جارُ ما قُصد.** */}
          <BackButton
            locale={locale}
            variant="bare"
            className="absolute start-4 top-[calc(var(--safe-top)+0.9rem)] z-10"
          />
          <div className="absolute end-4 top-[calc(var(--safe-top)+0.9rem)] z-10 flex items-center gap-5">
            <ShareTitleButton
              path={base}
              title={displayName}
              locale={locale}
              variant="cover"
            />
            {isMe ? null : (
              /* 🗑️ ⚖️ **وقلمُ الغلاف سقط** (D-637، سدادُ دَينٍ مُعلَنٍ منذ
                 D-571): كان يفتح `/profile/edit` **وصورةُ الملفّ تفتحها
                 أيضاً** — **بابان لفعلٍ واحد** (القاعدة ٣).
                 🔑 **ولماذا سقط القلمُ لا الصورة، وكلاهما يعمل**: الصورةُ
                 **طلبُ أحمد بنصّه** («وصورة البروفايل توديني على إعدادات
                 البروفايل»)، **والقلمُ اختيارُ تصميمٍ منّي** — **وحين
                 يصطدم اختياري بطلبه فاختياري هو الذي يتنحّى**، لا العكس.
                 **وليس لأن القلمَ أضعفُ**: هو الأظهرُ فعلاً (رمزٌ ووسمٌ
                 في زاوية الأفعال) — **لكنّ الأظهرَ لا يعني الأحقّ حين
                 يكون الآخرُ منصوصاً عليه.**
                 ⚠️ **ويعود بكلمةٍ منه** إن وجد الصورةَ وحدَها عُرفاً
                 صامتاً لا يكفي. **وزاويةُ صاحب الصفحة تبقى بالمشاركة
                 وحدَها** — والنقاطُ (بلاغٌ وحظرٌ ورسالة) **ثلاثتُها عن
                 غيرك** فلا تُعرض عليك. */
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

              ✅ **والدَّينُ سُدَّ** (D-637): كان قلمُ الغلاف يفتح الوجهةَ
              نفسَها — **بابان لفعلٍ واحد** (القاعدة ٣) — **فسقط القلمُ
              وبقيت الصورة**، لأن الصورةَ منصوصةٌ في طلبه والقلمَ اختيارُ
              تصميمٍ منّي. **وحين يصطدم اختياري بطلبه فاختياري يتنحّى.** */}
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
            {/* ⚖️ 🆕 **والزرُّ صغيرٌ على سطر الاسم نفسِه** (D-584، بلاغُ
                أحمد: «كلمة فولوينغ جداً كبيرة، خلّها صغيرة ومكانها على
                نفس سطر الاسم») — **نقضُ توسيطِ D-561 بحكم صاحبه**:
                `self-center` كان يوسّطه على ارتفاع الصورة كلِّها،
                **وصار جارَ الاسم بمقاس `sm`**، والاسمُ يحتفظ بأولويّة
                العرض (`min-w-0 truncate` له والزرُّ `shrink-0`).
                ⚖️ 🆕 **ونُزع `flex-1` عن `h1` وانتقل إلى مجموعةٍ تلفّ
                الاسمَ والشارةَ معاً** (D-634، بلاغُ أحمد بلقطةٍ محوَّطة:
                «فولوينغ رجّعها يمين وخلّها صغيرة») — **نقضٌ جزئيٌّ لإصلاحِ
                D-633 بيد صاحبه، وسببُ النقض أن الإصلاحَ حلَّ عطلاً وأحدث
                آخر**: نزعُ `flex-1` من `h1` قرّب الشارةَ من الاسم (وهو
                المطلوب) **وسحب معه زرَّ المتابعة من طرف السطر إلى جوار
                الاسم** — **وزرٌّ ملاصقٌ للاسم يُقرأ جزءاً منه لا فعلاً
                عليه.**
                **والصوابُ أن الفراغَ ملكُ المجموعة لا ملكُ الاسم**: المجموعةُ
                `min-w-0 flex-1` فتدفع الزرَّ إلى الطرف، **وداخلَها الاسمُ
                `truncate` والشارةُ `shrink-0` ملاصقةٌ له.** فالثلاثةُ في
                مواضعها: الاسمُ يُقصّ وحدَه، والشارةُ لا تفارقه، والزرُّ في
                الطرف حيث تُطلب الأفعال.
                ⚠️ **ويعمل في الاتّجاهين بلا شرط**: «الطرف» هو `flex` نفسُها
                (يمينٌ في LTR ويسارٌ في RTL) — **ولا `right` ولا `mr` مكتوبةً
                بيد** (D-105). */}
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <h1 className="hero-halo min-w-0 text-22 sm:text-xl font-bold leading-tight truncate">
                  {displayName}
                </h1>
                {/* 🆕 **شارةُ Loopz+ بجانب الاسم** (D-633، بحكمه) —
                    **خارجَ `truncate`**: اسمٌ طويلٌ يُقصّ ولا تُقصّ معه
                    الشارة، **وشارةٌ تختفي بطول اسمٍ ليست شارة.** */}
                <PlusBadge profile={profile} locale={locale} size={16} />
              </div>
              {!isMe && (
                <span className="shrink-0">
                  {/* 🆕 **ومقاسُه `xs` لا `sm`** (D-634): **جارُ كلمةٍ لا
                      فعلُ شاشة** — و`sm` كانت تجعله أطولَ من الاسم الذي
                      يجاوره. **والرتبةُ أُضيفت إلى سلّم `Button` نفسِه**
                      لا كُتبت هنا بيد. */}
                  <FollowUserButton
                    targetId={profile.id}
                    locale={locale}
                    initialFollowing={relation.following}
                    initialRequested={relation.requested}
                    size="xs"
                  />
                </span>
              )}
            </div>
            {/* ⚖️ 🆕 **والمعرّف عاد** (D-438، خطّةُ أحمد: «الاسم والـusername
                والنبذة»): **كان قد سقط بحكمٍ سابق لأنه يكرّر الاسم** —
                **وهو في الملفّ العامّ ليس تكراراً بل عنوانٌ يُكتب ويُشارَك**،
                وهو ما يفرّق بين متشابهَي الاسم. **ويغيب لمن أخفى اسمَه**
                لأن المعرّفَ يكشفه. */}
            {/* ⚖️ 🆕 **والعدّان لحقا بسطر المعرّف** (D-622، حكمُه بلقطةٍ
                محوَّطة على «@ahmed»: «وهنا نفس الشي — يكونون في نفس
                سطر الاسم @») — **نفسُ سطر الرئيسية حرفاً** (D-621):
                رمزان وعدّان بلا كلمات، المتابِعون أوّلاً. **نقضٌ جزئيٌّ
                لموضعِ D-566/D-561** (صفُّ اللقب والعدّادَين) بيد
                صاحبه — واللقبُ بقي في صفّه وحدَه. */}
            {/* 🆕 **وسطرُ المعرّف نزل إلى ١٢** (D-640، بحكمه: «يكون أصغر
                من النبذة»): كان `text-[12.5px]` — **خارج السلّم فلا يُضرب
                بمعامل حجم الخطّ**، نفسُ عطل النبذة في D-639.
                **والنزولُ لا الصعود بحكمه، ومعناه صحيح**: المعرّفُ
                والعدّادان **بياناتُ تعريفٍ لا كلامَ صاحبها** — **والنبذةُ
                هي ما كتبه بيده**، فتسبقه في الرتبة البصريّة.
                ⚠️ **ولا ١٣ في السلّم** (١٢ · ١٤ · ١٥ · ٢٠ · ٢٢ · ٢٤):
                **فالنصفُ الضائعُ من ١٢٫٥ ثمنُ الانضمام إليه** — **ورتبةٌ
                محسوبةٌ خيرٌ من نصفِ بكسلٍ يفلت من الإتاحة.** */}
            <p className="hero-halo mt-0.5 flex items-center gap-1.5 text-12 text-muted leading-tight">
              {profile.username && !profile.hide_name && (
                <>
                  {/* 🔴 و`text-white` كان عطلاً صامتاً في `daylight` —
                      **و`--muted` يُقرأ على السمتين.** والاتّجاهُ LTR
                      للمعرّف وحدَه فلا ينقلب @ في RTL. */}
                  <span dir="ltr" className="min-w-0 truncate">
                    @{profile.username}
                  </span>
                  <span aria-hidden className="shrink-0 opacity-60">
                    •
                  </span>
                </>
              )}
              <span className="shrink-0 inline-flex items-center gap-2">
                <FollowCountButton
                  targetId={profile.id}
                  dir="followers"
                  count={stats.followers}
                  label={t.followersLabel}
                  sheetTitle={t.followsTabFollowers}
                  locked={!isMe && !!profile.hide_follow_lists}
                  compact
                  labels={{ close: t.closeLabel, empty: t.followListEmpty, anonymous: t.anonymousUser }}
                />
                <FollowCountButton
                  targetId={profile.id}
                  dir="following"
                  count={stats.following}
                  label={t.followingLabel}
                  sheetTitle={t.followsTabFollowing}
                  locked={!isMe && !!profile.hide_follow_lists}
                  compact
                  labels={{ close: t.closeLabel, empty: t.followListEmpty, anonymous: t.anonymousUser }}
                />
              </span>
            </p>
            {/* 🆕 **و`dir="auto"` على النبذة** (D-601، حكمُه: «البايو
                خلّه يبدأ من يمين RTL»): نبذةٌ عربيّةٌ في واجهةٍ
                إنجليزيّةٍ كانت تبدأ من اليسار — **والاتّجاهُ يتبع
                الحروفَ لا لغةَ الواجهة** (عُرفُ `MediaTitle` في D-544). */}
            {/* 🆕 **والنبذةُ صعدت درجةً في السلّم** (D-639، بلاغُ أحمد
                بلقطةٍ محوَّطة: «البايو كبّر حجم الخط فيه شوي»):
                **`text-[12.5px]` → `text-14`**، وهي الدرجةُ التالية —
                **ولا درجةَ بينهما** (السلّم ١٢ · ١٤ · ١٥ · ٢٠ · ٢٢ · ٢٤).
                🔴 **والمكسبُ الأكبرُ ليس الحجم**: القيمةُ الحرفيّةُ
                `12.5px` **لا تُضرب بمعامل حجم الخطّ `--fs`** — **فمن
                كبّر خطَّه في الإعدادات كان كلُّ شيءٍ يكبر إلّا نبذته.**
                **وحجمٌ يُكتب بيدٍ خارج السلّم يسقط من الإتاحة صامتاً**،
                وهي بعينها حجّةُ D-634: **المقاسُ رتبةٌ في سلّمه لا رقمٌ
                عند المنادي.**
                ⚠️ **و`max-w-[46ch]` تبقى كما هي**: وحدةُ `ch` تُشتقّ من
                الخطّ نفسِه، **فالسطرُ يظلّ ٤٦ حرفاً مهما كبر.**
                🆕 **والفجوةُ فوقها `mt-2` لا `mt-1`** (D-642، بلاغُه:
                «النبذة لاصقة عند اليوزر والاسم»): الاسمُ والمعرّفُ
                عنقودٌ واحدٌ يفصلهما `mt-0.5` — **والنبذةُ ليست منه**:
                هي **ما كتبه صاحبُها**، لا بياناتِ تعريفه.
                **والفجوةُ داخلَ العنقود يجب أن تصغر عن الفجوة بينه وبين
                ما يليه، وإلّا قُرئ الثلاثةُ سطراً واحداً متّصلاً** —
                و٤ بكسلاتٍ بعد ١٢px كانت تفعل ذلك. **٨ الآن: أربعةُ
                أضعاف فجوةِ العنقود.** */}
            {bioText && (
              <p
                className="hero-halo text-14 text-muted leading-snug mt-2 line-clamp-2 max-w-[46ch]"
                dir="auto"
              >
                {bioText}
              </p>
            )}
          </div>


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
        {/* ⚖️ 🆕 **والعدّادان غادرا هذا الصفَّ إلى سطر المعرّف** (D-622)
            — فبقي اللقبُ وحدَه في عموده (D-601: يتوسّط الصورةَ من تحت)
            **والصفُّ لا يُرسم أصلاً لمن لا لقبَ له** (D-152). **وعدّادُ
            الزيارات كان قد سقط قبلهما** (D-584: «احذف visit، غير
            مهمّة» — نقضُ عرضِ D-465، والتسجيلُ `record_profile_view`
            باقٍ فعودتُه يوماً عرضٌ بلا فجوةِ بيانات، ومفتاحاه في
            `profile_prefs` بقيا في النوع). */}
        {metaTitle && (
          <div className="relative z-10 mt-2.5 flex items-start gap-3 text-14 leading-tight">
            <div className="w-20 shrink-0 -mt-1 text-center">
              <span className="block text-muted leading-snug break-words">{metaTitle}</span>
            </div>
          </div>
        )}

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
        {/* ⚖️ 🆕 ~~والإطارُ سقط والأيقوناتُ كبرت (D-601)~~ — **نُقضت
            بحكمه** (D-610): **الإطارُ عاد والأيقونةُ إلى جانب الرقم
            كما صمّمها في D-561** — بطاقةٌ واحدةٌ بحدٍّ ونصفِ قطر،
            ثلاثُ خاناتٍ أفقيّة، وبابُ «الإحصائيات الكاملة» خانتُها
            الثالثةُ لصاحبها (رابطٌ حقيقيٌّ لا سطرٌ تحتها). */}
        {canView && prefs.stats && (
          <div className="relative z-10 mt-3 rounded-2xl border border-border bg-surface overflow-hidden">
            {/* 🆕 **الرقمُ واسمُه سطرٌ واحد، والبابُ على قدر كلمته**
                (D-611، حكمُه: «الأفلام والمسلسلات تكون سطر واحد
                والإحصائيات كلمة وحدة بحيث ياخذون راحتهم»): خانةُ
                الإحصائيات `auto` تنكمش على كلمتها الواحدة **والعرضُ
                الباقي كلُّه للخانتين** — ولزائرٍ ثلاثُ خاناتٍ أرقامٌ
                فأثلاثٌ سواء. */}
            <div className={isMe ? "grid grid-cols-[1fr_1fr_auto]" : "grid grid-cols-3"}>
              {/* 🆕 **والخانةُ صارت باباً** (D-643): «١٦ مسلسلاً» رقمٌ
                  يُضغط، **ورقمٌ يُضغط ولا يفتح شيئاً وعدٌ فارغ** (D-217).
                  **ووجهتُه تبويبُه في الصفحة نفسِها** — لا صفحةٌ ثالثة.
                  ⚠️ **و`replace` هنا أيضاً**: نفسُ حكم التبويبات — **بابٌ
                  داخلَ الصفحة لا يكدّس تاريخاً.** */}
              {headerStats.map((c, i) => (
                <Link
                  key={c.key}
                  href={`${base}?tab=${c.key}`}
                  replace
                  className="relative flex items-center justify-center gap-2 px-2 py-3 hover:text-accent transition"
                >
                  {/* **والخطُّ بين خانتين لا بعد آخرِها**: خانةُ
                      «الإحصائيات» تلي الأخيرةَ لصاحب الصفحة وحدَه،
                      **فالشرطُ يعرف الحالتين** — **وخطٌّ على حافّة
                      البطاقة يُقرأ حدّاً مزدوجاً.** */}
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
                  <span className="min-w-0 flex items-baseline gap-1.5">
                    <span className="text-15 font-bold leading-none tabular-nums">
                      {c.value}
                    </span>
                    <span className="text-12 text-muted leading-none truncate">
                      {c.label}
                    </span>
                  </span>
                </Link>
              ))}
              {isMe && (
                <Link
                  href="/stats"
                  className="flex items-center justify-center gap-1 px-4 py-3 text-14 font-semibold text-muted hover:text-accent transition"
                >
                  <span className="whitespace-nowrap">{t.profileFullStats}</span>
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

      {/* ⚖️ 🆕 **وصفوفُ التبويب في حاويةٍ أضيقَ إيقاعاً** (D-585، بلاغُ
          أحمد بلقطتين محوَّطتين: «فيه هامش كبير فاضي احذفه»): إيقاعُ
          الصفحة `space-y-5` (٢٠px) صحيحٌ بين كتل الرأس، **ورفٌّ فوق رفٍّ
          كلاهما عنوانٌ وملصقاتٌ لا يحتاجانه** — **فالحاويةُ الواحدةُ
          تجعل الرفوفَ كتلةً واحدةً في عين الإيقاع الخارجيّ** (٢٠ تحت
          التبويبات مرّةً واحدة)، **وبينها `space-y-3` (١٢px).** */}
      {/* ===== 🆕 تبويبا «مسلسلات» و«أفلام» (D-643) ===== */}
      {/* **شبكةٌ لا رفّ**: الرفُّ يعرض ما يتّسع له السطر ويخفي البقيّة،
          **وسؤالُ التبويب «أرِني كلَّ ما عنده»** — **فالشبكةُ هي الشكلُ
          الذي يجيبه** (`posterGrid`، الوصفةُ نفسُها في المكتبة).
          ⚠️ **وبلا سقفِ `cap`**: سقفُ البطاقات تفضيلُ عرضٍ للرفوف
          (D-152) — **وتبويبٌ اسمُه «كلُّ مسلسلاته» يقصّها يكذب.** */}
      {canView && tab === "shows" && (
        <PosterGrid>
          {shows.map((i) => (
            <PosterCard
              key={`gs-${i.id}`}
              href={`/show/${i.id}`}
              title={i.title}
              posterPath={i.posterPath}
              progress={i.progress}
            />
          ))}
        </PosterGrid>
      )}

      {canView && tab === "movies" && (
        <PosterGrid>
          {movieFollows.map((f) => (
            <PosterCard
              key={`gm-${f.tmdb_id}`}
              href={`/movie/${f.tmdb_id}`}
              title={f.title}
              posterPath={f.poster_path}
            />
          ))}
        </PosterGrid>
      )}

      {canView && tab === "overview" && (
      <div className="space-y-3">
      {/* ===== المفضّلة — ثلاثةُ صفوفٍ ثم صفوفُه بترتيب صاحبها (D-129) =====
          🆕 **رأسُ التبويب مفضّلتُه مقسومةً** (D-561، تصميمُ أحمد):
          **Shows · Movies · Anime** — **والصفُّ الفارغُ لا يُرسم**،
          فمن لا أنمي عنده لا يرى عنواناً بلا ملصقات.

          ⚠️ **وتحتها صفوفُه المرتّبة كما هي** (D-129): **الترتيبُ
          إعدادٌ ضبطه صاحبُه ولا يُلغى لأن تبويباً تسمّى باسمٍ آخر** —
          **والتصميمُ لا يعرض ما تحت «Anime» أصلاً**، فلا تناقض. */}
        {favOrder.map((k) => {
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
        {favAnime.length > 0 && (
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
        {prefs.order
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
        {favorites.length === 0 && !prefs.order.some((sec) => sections[sec]) && (
          <p className="text-center text-muted py-16 text-sm">{t.profileEmptyFavorites}</p>
        )}
      </div>
      )}

      {/* ===== النشاط — تقييماتُه بالزمن ===== */}
      {/* ⚖️ 🆕 **التبويبُ صار سجلَّ `/activity` نفسَه** (D-586، طلبُ أحمد:
          «الاكتيفتي حطّ فيه كامل الاكتيفتي، نفس طريقة العرض الي
          بالمكتبة») — **سدادُ الدَّين المعلَن D-438 §12** («النشاطُ
          تقييماتٌ لا كلُّ فعل»). **والشاشةُ تُستورد لا تُنسخ** (القاعدة
          ٦): `ActivityScreen` بعينها — رقائقُها وقسمةُ الأيام بساعة
          القارئ ودمجُ الحلقات، **بلا فتاتِ «المكتبة»** (`crumb=false`). */}
      {canView && tab === "activity" && (
        activityItems.length === 0 ? (
          <p className="text-center text-muted py-16 text-sm">{t.profileEmptyActivity}</p>
        ) : (
          <ActivityScreen items={activityItems} locale={locale} crumb={false} />
        )
      )}

      {/* ===== المراجعات — بطاقةُ المجتمع نفسُها =====
          ⚖️ 🆕 **البطاقةُ العارية سقطت** (D-583، طلبُ أحمد بلقطة:
          «الرفيو خلّي شكلَه نفس شكله في المجتمع مع البوستر وعدد القلوب
          وكل شي»). **والشكلُ يُستورد لا يُنسخ** (القاعدة ٦): الترويسةُ
          والمتنُ والذيلُ والعمودُ هي مكوّناتُ خطِّ المجتمع بأعيانها —
          `FeedReviewText` (والحرقُ محجوبٌ فيها بالبوّابة نفسِها، D-315)
          و`LikeButton` و`RowComment` و`RowPoster` — **فأوّلُ تحسينٍ
          يصيب الخطَّ غداً يصيب هذا التبويبَ مجّاناً.**
          ⚠️ **وما غاب غاب بحجّته**: لا نقاطَ قائمةٍ (بابُ المتابعة
          والحظر في رأس الصفحة نفسِها — بابان لفعلٍ واحدٍ زيادة) **ولا
          عدّادَ مشاهدات** (العدُّ عقدُ الخطِّ وحدَه — D-237). */}
      {canView && tab === "reviews" && (
        <div className="divide-y divide-border/60">
          {reviewsNewest.length === 0 ? (
            <p className="text-center text-muted py-16 text-sm">{t.profileEmptyReviews}</p>
          ) : (
            reviewsNewest.map((r) => {
              const titleHref = `/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`;
              const reviewHref = `/review/${r.media_type}/${r.tmdb_id}/${profile.id}`;
              const social = reviewLikes.get(`${r.media_type}-${r.tmdb_id}`);
              return (
                <article key={`rv-${r.media_type}-${r.tmdb_id}`} className="py-4 first:pt-0 flex gap-3">
                  <div className="min-w-0 flex-1 flex flex-col min-h-[138px]">
                    {/* ⚖️ 🆕 **الترويسة بلا وجهِ صاحب الصفحة واسمِه**
                        (D-600، حكمُه بلقطةٍ دوّر فيها الاسمين: «احذف
                        اسمي وصورتي من هنا — ما يحتاج لأنها موجودة فوق»):
                        **بطاقةُ المجتمع تعرّف بكاتبٍ وسطَ غرباء،
                        وتبويبُ الملفّ كلُّه لكاتبٍ واحدٍ رأسُ الصفحة
                        يقولُه** — فتكرارُه في كلِّ بطاقةٍ ضجيج (نقضٌ
                        محصورٌ لشكل D-583 في هذا التبويب وحدَه).
                        **والعملُ ونجمتُه صارا سطرَ الهويّة**، والعمرُ
                        بابٌ ثانٍ إلى صفحة المراجعة كما كان — **ولا
                        يُرسم لصفٍّ بلا تاريخ** (D-222). */}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={titleHref}
                        prefetch={false}
                        className="min-w-0 flex items-center gap-1 truncate font-bold text-14 leading-tight hover:text-accent transition"
                      >
                        <bdi className="truncate">{r.title ?? "—"}</bdi>
                      </Link>
                      {/* **والنجمةُ لمن قيّم** — رأيٌ بلا نجمةٍ لا يلبس
                          صفراً كاذباً (D-219) */}
                      {r.rating != null && (
                        <span
                          className="shrink-0 text-14 font-bold text-accent tabular-nums"
                          title={t.rateOutOf(r.rating)}
                        >
                          ★ <span dir="ltr">{r.rating.toFixed(1)}</span>
                        </span>
                      )}
                      {r.updated_at && (
                        <Link
                          href={reviewHref}
                          prefetch={false}
                          className="ms-auto shrink-0 text-12 text-muted tabular-nums hover:text-accent transition"
                        >
                          {timeAgoShort(r.updated_at, t)}
                        </Link>
                      )}
                    </div>

                    {/* **المتنُ لمن كتبه** (D-587) — صفُّ نجمةٍ بلا نصٍّ
                        يبقى ترويسةً وذيلاً، كصفِّ `rate` في الخطّ */}
                    {r.review?.trim() ? (
                      <FeedReviewText
                        href={reviewHref}
                        review={r.review}
                        locale={locale}
                        hasSpoiler={!!r.has_spoiler}
                      />
                    ) : (
                      <div className="pb-2" />
                    )}

                    <div className="mt-auto">
                      <RowComment
                        reviewUserId={profile.id}
                        tmdbId={r.tmdb_id}
                        mediaType={r.media_type}
                        label={t.actionComment}
                        locale={locale}
                        before={
                          <LikeButton
                            reviewUserId={profile.id}
                            tmdbId={r.tmdb_id}
                            mediaType={r.media_type}
                            likes={social?.likes ?? 0}
                            likedByMe={social?.likedByMe ?? false}
                            isMine={isMe}
                            locale={locale}
                          />
                        }
                        after={
                          <ShareTitleButton path={titleHref} title={r.title ?? ""} locale={locale} />
                        }
                      />
                    </div>
                  </div>

                  <RowPoster
                    tmdbId={r.tmdb_id}
                    mediaType={r.media_type}
                    title={r.title ?? ""}
                    posterPath={r.poster_path}
                    added={myLibKeys.has(`${r.media_type}-${r.tmdb_id}`)}
                    locale={locale}
                  />
                </article>
              );
            })
          )}
        </div>
      )}

      {/* ===== القوائم — شبكةٌ كأختها في المكتبة (D-433) ===== */}
      {/* ⚖️ 🆕 **والتبويبُ صار قوائمَه كلَّها** (D-588، طلبُ أحمد:
          «اعرض الليستات الموجودة عنده كاملة — حتى الي معطيها قلب وماهي
          حقّته»): **قوائمُه المعلنةُ ثمّ محفوظاتُه** — **ترتيبُ صفحة
          `/lists` والمكتبة نفسُه** (قوائمي ثمّ المحفوظة)، والبطاقةُ
          والشبكةُ هما هما. **والعنوانان يفصلان الملكيّةَ عن الإعجاب**
          فلا تُنسب إليه قائمةُ غيره. */}
      {canView && tab === "lists" && (
        publicLists.length === 0 && savedLists.length === 0 ? (
          <p className="text-center text-muted py-16 text-sm">{t.profileEmptyLists}</p>
        ) : (
          <div className="space-y-6">
            {publicLists.length > 0 && (
              <PublicListsRail lists={listsOrdered} locale={locale} title={t.profileTabLists} grid />
            )}
            {/* ⚖️ 🆕 **وللقسم رقاقةُ On/Off لصاحبه** (D-594، حكمُه بلقطة:
                «حتى هذي حطّ لها on off») — **نموذجُ D-559**: صاحبُه يراه
                دائماً وعليه الرقاقة (وإلّا لم يجد بابَ العودة بعد
                الإطفاء)، **والزائرُ لا يصله أصلاً حين تقول «متوقّفة»**
                (النداءُ نفسُه يسقط في الموجة أعلاه). */}
            {savedLists.length > 0 && (
              <PublicListsRail
                lists={savedLists}
                locale={locale}
                title={t.savedListsSection}
                grid
                action={
                  isMe ? (
                    <SavedListsToggle locale={locale} initialOn={prefs.savedLists} />
                  ) : undefined
                }
              />
            )}
          </div>
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
