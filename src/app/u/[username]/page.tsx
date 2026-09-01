import Link from "next/link";
import {
  getUser,
  getProfileByUsername,
  getWeeklyRanks,
  getRatingsOf,
  getFollowStats,
  getFollowRelation,
  recordProfileView,
  getFollowsOf,
  getFollowGenresOf,
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
import { Avatar } from "@/components/Avatar";
import { CoverImage } from "@/components/CoverImage";
import { Icon } from "@/components/Icon";
import { isPlus } from "@/lib/plan";
import { PosterCard } from "@/components/PosterCard";
import { PosterGrid } from "@/components/PosterGrid";
import { ProfileStatSheet } from "@/components/ProfileStatSheet";
import { PosterRail, RailItem } from "@/components/PosterRail";
import { FollowUserButton } from "@/components/FollowUserButton";
import { AccountBadges, badgeLabelsOf } from "@/components/AccountIdentity";
import { ProfileMenu } from "@/components/ProfileMenu";
import { WeeklyRanksDoor } from "@/components/WeeklyRanksDoor";
import { sanitizeSocials, socialUrl } from "@/lib/socials";
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
import { getLibState } from "@/lib/libState";
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
  /* 🔴 **ومفاتيحُ الأقسام من `lib` لا من الزرّ** (D-669): الزرُّ
     `"use client"` **وهذه الصفحةُ خادميّة**، **وقيمةٌ تعبر الحدَّ في
     هذا الاتجاه تصل مرجعَ عميلٍ لا كائناً** — فكانت `sectionKeyOf.artist`
     ترمي `TypeError` وتُسقط الملفَّ كلَّه لمن أشعل صفَّ «فنّانوك». */
  sectionKeyOf,
  type ProfileSection,
} from "@/lib/profilePrefs";
import { SectionReorderButton } from "@/components/SectionReorderButton";
import { SavedListsToggle } from "@/components/SavedListsToggle";
import { capCards } from "@/lib/cardCount";
import { coverBareControl, HEADER_ICON } from "@/components/ui/controls";
import { browseGenreName, groupByGenre } from "@/lib/browse";
import { densityVars } from "@/lib/density";

/**
 * 🆕 **مقاسُ صورة الملفّ في درجتين** (D-836).
 *
 * **`AVATAR_LG` هو المقاسُ الجوهريُّ الذي تُطلب به الصورةُ من الخادم**
 * — **يُكتب بالأكبر دائماً** كي لا تُمدَّ صورةُ ٧٤ على دائرةِ ١٠٤.
 * **و`AVATAR_BOX` هو الصندوقُ المرسوم**: ٧٤ على الجوّال و١٠٤ على
 * الشاشة الواسعة، **والحرفُ (لمن لا صورةَ له) ٤٢٪ من الدائرة في
 * الدرجتين** — وهي نسبةُ `Avatar` نفسُها مكتوبةً بأصنافٍ لأن السطرَ
 * تنحّى.
 *
 * ⚠️ **ومن غيّر رقماً هنا غيّر التراكبَ معه**: `-mt` نصفُ الدائرة
 * بحلقتها (٨٠→٤٠، ١١٠→٥٥) — **قاعدةُ D-547 بحرفها.**
 */
const AVATAR_LG = 104;
const AVATAR_BOX =
  "w-[74px] h-[74px] text-[31px] lg:w-[104px] lg:h-[104px] lg:text-[44px]";

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

  /* 🗑️ **ولونُ صاحبِ الصفحة سقط** (D-848): **كان يُقرأ من العرض العامّ
     ويُركَّب على جذر الصفحة** — **وزائرُ ملفِّك يراه بثيمه هو منذ
     اليوم**، وهو السلوكُ الذي سبق D-825 حرفاً. */
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
    followGenres,
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
    /* ⚖️ 🆕 **ومفضّلتُه تُقرأ دائماً** (D-658): **صارت تبويباً لا
         قسماً اختياريّاً** — **وتبويبٌ قائمٌ لا يُشترط بمفتاحِ قسمٍ
         سقط** (القاعدة ٣). والنداءُ واحدٌ خفيف. */
    getProfileFavorites(profile.id),
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
    isMe || prefs.savedLists
      ? getSavedListsOf(profile.id)
      : Promise.resolve([]),
    /* 🆕 **تصنيفاتُ مكتبته** (D-648) — **نداءٌ خفيفٌ مفتاحٌ وقيمة**،
         **وقبل تعبئةِ `‎/api/genres` يُرجع فراغاً** فتُقرأ الشبكتان
         أبجديّتين بلا مجموعاتٍ ولا ينكسر شيء. */
    getFollowGenresOf(profile.id),
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
  const myLibKeys = new Set(
    myLibRows.map((f) => `${f.media_type}-${f.tmdb_id}`),
  );
  /* ✅ 🆕 **والخيطُ يقول أربعةً لا واحداً** (D-850): **`myLibKeys` تجيب
     «عندك أم لا»** — **وتبويبُ المراجعات يلبس بطاقةَ المجتمع نفسَها**
     (D-583) **فيرث عطلَها نفسَه**: سماويُّ «لم يبدأ» فوق مراجعةٍ لعملٍ
     انتهيتَ منه. **والحالةُ حالةُ القارئ لا صاحبِ الصفحة**، كالمفاتيح
     فوقها حرفاً. */
  const myState = await getLibState().catch(() => undefined);

  /* 🆕 **صفوفُ النشاط بلبوس شاشة `/activity`** (D-586) — **الإثراءُ
     وصفةُ صفحة النشاط حرفاً**: كلُّ صفٍّ يحمل اسمَه يتبرّع به لغيره،
     **والمتابعاتُ والتقييماتُ هنا مترجمةٌ أصلاً** (D-048) فيتقدّم
     اسمُها على المخزَّن في الصفّ. */
  const actMeta = new Map<string, { title: string; poster: string | null }>();
  for (const f of follows) {
    actMeta.set(`${f.media_type}-${f.tmdb_id}`, {
      title: f.title,
      poster: f.poster_path,
    });
  }
  for (const r of ratings) {
    const key = `${r.media_type}-${r.tmdb_id}`;
    if (!actMeta.has(key) && r.title)
      actMeta.set(key, { title: r.title, poster: r.poster_path });
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

  /* 🆕 **مرتبتُه في أوائل الأسبوع** (D-835) — **قراءةٌ واحدةٌ مخبَّأةٌ
     للطلب** (ثلاثةُ صفوفٍ من دالّةِ definer)، **والفراغُ يعني ألّا
     شارةَ تُرسم** لا صفراً يُعرض. */
  /* 🆕 **سجلُّ مراتبِه كلِّه لا مرتبةُ الأسبوع الأخير** (D-838):
     **الشارةُ صارت تصف حسابَه لا أسبوعَه** — والحجّةُ في
     `WeeklyRanksDoor`. */
  const weeklyRanks = await getWeeklyRanks(profile.id);
  /* 🆕 **حسابُ X الموثَّق** (D-839) — **الموثَّقُ وحدَه يُعرض**:
     **معرّفٌ بلا `x_verified_at` كلامٌ لا دليل** — **وقد كان يُكتب
     باليد قبل اليوم**، **فصفٌّ قديمٌ لا يُرقّى بالسكوت** (D-063). */
  const xHandle = profile.x_verified_at
    ? (sanitizeSocials(profile.socials).x ?? null)
    : null;
  const xUrl = socialUrl("x", xHandle);

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
  const artistsOrdered = applySectionOrder(artists, secOrder.artists, (a) =>
    sectionKeyOf.artist(a.person_id),
  );
  /* **وقوائمُه بترتيبه في البابين** — قسمُ النظرة العامّة وتبويبُ
     «قوائم» يقرآن المصفوفةَ نفسَها، **وترتيبان لشيءٍ واحدٍ خلل** (D-152) */
  const listsOrdered = applySectionOrder(publicLists, secOrder.lists, (l) =>
    sectionKeyOf.list(l.id),
  );
  /* 🗑️ ⚖️ **وسطرُ اللقب ونظامُ المستوى حُذفا بحكمه** (D-807: «احذف
     نظام الليفل بالكامل، وكذلك اللقب الي تحت الصورة — ما لهم داعي
     وزحمة على الفاضي»). ⚖️ **نقضٌ صريحٌ لـD-561** (التي وُلد فيها
     السطر) **ولـD-601** (التي وسّطته). */

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
  const favAnime = favorites.filter((f) =>
    animeFlags.get(artKey(f.media_type, f.tmdb_id)),
  );
  const favRest = favorites.filter(
    (f) => !animeFlags.get(artKey(f.media_type, f.tmdb_id)),
  );
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
  /* ⚖️ 🆕 **والبطاقةُ صارت شكلاً واحداً لكلِّ الحسابات** (D-650، طلبُ
     أحمد: «كل الحسابات خلي الكارد الأساسي فيها مسلسلات أفلام
     احصائيات»): **كانت شكلين** — خانتان وبابٌ لصاحبها، وثلاثُ خاناتٍ
     ثالثتُها التقييماتُ لزائره — **وشكلان لبطاقةٍ واحدةٍ خللٌ**
     (D-145)، **وزائرٌ لم يكن يجد باباً إلى إحصائياتِ من يزور أصلاً.**
     ⚠️ **وخانةُ التقييمات سقطت**: عدَّها باقٍ في تبويب «مراجعات»
     نفسِه — **وثلاثةٌ هي التي طُلبت، ورابعةٌ زيادةٌ على الطلب** (درسُ
     D-644 بحرفه). */
  const headerStats = [
    {
      key: "shows",
      icon: "tv" as const,
      value: tvFollows.length,
      label: t.shortShows,
    },
    {
      key: "movies",
      icon: "film" as const,
      value: movieFollows.length,
      label: t.shortMovies,
    },
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

  /* 🆕 **وترتيبُ الشبكتين أبجديٌّ** (D-645، بلاغُ أحمد: «تطلع له الأفلام
     والمسلسلات بالكامل مرتّبة حسب التصنيف والأحرف»).
     🔴 **والتصنيفُ لا يمكن اليوم ولا يُزوَّر**: **لا عمودَ تصنيفٍ لأيِّ
     عملٍ في القاعدة** — `favorite_genres` ذوقُ العضو لا تصنيفُ عملِه —
     **وجلبُه من TMDB وقتَ الرسم خمسون نداءً لصفحةٍ واحدة** (وهو ما
     منعته D-580). **فشُحن الأحرفُ وحدَها، وقيل ذلك.**
     ⚠️ **وأدواتُ الترتيب تتجاهل أداةَ التعريف الإنجليزيّة** («The Boys»
     تحت B): **قائمةٌ نصفُها تحت حرف T لا تُقرأ مرتَّبة.**
     **ولا تُمَسّ «ال» العربيّة** — **ليست أداةً دائماً**، **وقصُّ حرفين
     من كلِّ عنوانٍ عربيٍّ يفسد أكثرَ ممّا يرتّب.**
     ⚠️ **والمقارنةُ بلغة القارئ** (`localeCompare`) لا بترتيب البايت. */
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "en", {
    sensitivity: "base",
    numeric: true,
  });
  const sortKey = (title: string) =>
    title.trim().replace(/^(the|a|an)\s+/i, "");
  const byTitle = <T extends { title: string }>(a: T, b: T) =>
    collator.compare(sortKey(a.title), sortKey(b.title));

  /* 🆕 **شبكتا «كلِّ مسلسلاته» و«كلِّ أفلامه»** (D-644) — تُرسمان على
     الخادم وتُمرَّران إلى الورقة، **فلا تعبر ملصقاتُ الخادم الحدَّ إلى
     العميل** (درسُ `PosterCard` في D-238).
     ⚠️ **وبلا سقفِ `cap`**: السقفُ تفضيلُ عرضٍ للرفوف (D-152)،
     **وبابٌ اسمُه «كلُّ أفلامه» يقصّها يكذب.** */
  /* 🆕 **والتصنيفُ صار ممكناً فشُحن** (D-648، تمامُ طلبِ أحمد: «مرتّبة
     حسب التصنيف والأحرف»): **العمودُ `follows.genres` يحمله الآن**
     (الهجرة ١٤٢)، **والاسمُ من `BROWSE_GENRES` القائمة** — **فلا سجلَّ
     تصنيفاتٍ ثانٍ يُكتب** (القاعدة ٣/D-145).
     ⚠️ **وما لم يُقرأ بعدُ يقع في «أخرى»** ولا يُدّعى أنه بلا نوع —
     **والتعبئةُ الخلفيّةُ تُفرغها** (`/api/genres`).
     ⚠️ **ولا عنوانَ لمجموعةٍ واحدة**: مكتبةٌ كلُّها في «أخرى» تُقرأ
     قائمةً أبجديّةً كما كانت، **وعنوانٌ فوق كلِّ ما في الصفحة زينةٌ
     تدّعي تصنيفاً.** */
  const genresOfKey = (media: "tv" | "movie", id: number) =>
    followGenres.get(`${media}-${id}`) ?? null;

  const groupedGrid = <T extends { title: string }>(
    rows: readonly T[],
    genresOf: (r: T) => number[] | null,
    card: (r: T) => React.ReactNode,
  ) => {
    const groups = groupByGenre(rows, genresOf, byTitle);
    if (groups.length <= 1) {
      return (
        <PosterGrid>{[...rows].sort(byTitle).map((r) => card(r))}</PosterGrid>
      );
    }
    return (
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.genre?.slug ?? "other"}>
            <h3 className="text-14 font-bold mb-2 text-muted">
              {g.genre ? browseGenreName(g.genre, locale) : t.genreOther}
            </h3>
            <PosterGrid>{g.rows.map((r) => card(r))}</PosterGrid>
          </section>
        ))}
      </div>
    );
  };

  const showsGrid = groupedGrid(
    shows,
    (i) => genresOfKey("tv", i.id),
    (i) => (
      <PosterCard
        key={`gs-${i.id}`}
        href={`/show/${i.id}`}
        title={i.title}
        posterPath={i.posterPath}
        progress={i.progress}
      />
    ),
  );
  const moviesGrid = groupedGrid(
    movieFollows,
    (f) => genresOfKey("movie", f.tmdb_id),
    (f) => (
      <PosterCard
        key={`gm-${f.tmdb_id}`}
        href={`/movie/${f.tmdb_id}`}
        title={f.title}
        posterPath={f.poster_path}
      />
    ),
  );

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
              <PosterCard
                href={`/movie/${f.tmdb_id}`}
                title={f.title}
                posterPath={f.poster_path}
              />
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
    /* 🗑️ ⚖️ **والمفتاحُ الفارغُ سقط معها** (D-658): كانت `null` هنا
       لتبقى في سجلِّ الأقسام لأجل شاشة التخصيص — **وقد صارت تبويباً
       بمفتاحه، فلا حاجةَ لظلٍّ في سجلٍّ آخر.** */

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
  /* 🔴 ⚖️ **ونُقض نصفُ D-643 بحكم صاحبه** («ليش غيّرت التبويب وحطّيت
     أفلام ومسلسلات؟! رجّعها مثل ما كانت»): **كنتُ قد أضفتُ تبويبَي
     «مسلسلات» و«أفلام» إلى الشريط ليكونا وجهةَ خانتَي البطاقة** —
     **وهو طلب باباً من البطاقة، لا شريطاً جديداً.**
     🔑 **والقاعدة: طلبُ بابٍ ليس إذناً بإعادة ترتيب ما حوله** —
     **والزيادةُ على الطلب نقضٌ له لا خدمةٌ فيه.** **والوجهةُ صارت
     ورقةً** (`ProfileStatSheet`): تفتح فوق الصفحة وتُغلق، **والشريطُ
     لا يُمسّ.** */
  /* ⚖️ 🆕 **و«المفضّلة» انفصلت تبويباً و«نظرة عامة» صارت تُطفأ**
     (D-658، حكمُ أحمد على شاشة التخصيص: «هنا يكون فيه أوفر فيو
     وفيفورت — وأوفر فيو يكون مقفل والي يبغاه يفعّله»).

     🔑 **وكانا تبويباً واحداً باسمين**: اسمُه يتبدّل بين «المفضّلة»
     و«نظرة عامة» حسب مفتاحِ قسمٍ — **وشيئان في مفتاحٍ واحدٍ لا يُطفأ
     أحدُهما دون الآخر.** **فصارا بابين: مفضّلتُه أوّلاً وأقسامُه خلفَه.**

     🔑 **والبابُ باقٍ وإن تبدّلت هويّتُه** (حجّةُ D-617): **«المفضّلة»
     لا تُطفأ** — **وصفُّ تبويباتٍ بلا أوّلٍ يقف عليه الزائرُ صفحةٌ بلا
     باب.** */
  const TABS = [
    "favorites",
    "overview",
    "activity",
    "reviews",
    "lists",
  ] as const;
  type ProfileTab = (typeof TABS)[number];
  /* ⚖️ 🆕 **والمطفأُ يسقط عن صاحبه كما يسقط عن زائره** (D-672، حكمُ
     أحمد: «حتى صاحب الحساب ما يراه إذا قفله») — **نقضٌ صريحٌ لشرط
     `!isMe` الذي كُتب في D-617 وتكرّر في D-658 وD-667.**

     🔴 **وحجّةُ «إخراجٌ لا قفل» سقطت بحجّةٍ أقوى**: **مفتاحٌ يقول
     «مطفأ» ثمّ يُبقي ما أطفأتَه أمام عينيك يُقرأ عطلاً لا ميزة**
     (D-217 بعينها) — **وبلاغُ مشعل دليلُ حالٍ لا رأي.**

     🔑 **وبابُه إلى محتواه لم يضع**: **شاشةُ التخصيص هي مكانُ المفتاح
     نفسِه**، وهي على بُعد ضغطتين من ترس غلافه (D-659)، **ورابطُها
     يُرسم له صريحاً حين لا يبقى تبويبٌ ظاهر** (أدناه).

     ⚠️ **والزائرُ لا يبلغه برابطٍ مباشر** كما كان (D-217: رأسٌ يسقط
     ومحتواه باقٍ بابٌ خلفيٌّ يكذب) — **والآن صاحبُه مثلُه**، فالمعاينةُ
     صارت صادقةً بلا وضعِ «كيف يراني غيري». */
  const tabHidden = (k: string) =>
    (prefs.hiddenTabs as readonly string[]).includes(k);
  /* ⚖️ 🆕 **والمهربُ صار ترتيباً لا اسماً** (D-667، حكمُ أحمد: «هذا
     خلّه مثل الباقي تقدر تطفيه وتشغّله»): **«المفضّلة» تُطفأ الآن
     كغيرها**، **فلا يصلح اسمٌ بعينه مهرباً** — **ومهربٌ إلى بابٍ مغلقٍ
     ليس مهرباً** (وهي علّةُ D-658 نفسُها وقد عادت من الجهة الأخرى).

     🔑 **فالصفحةُ تفتح على أوّلِ تبويبٍ ظاهرٍ بترتيب الصفّ** — **وهو
     تعريفٌ لا يسقط مهما أطفأ صاحبُه.**

     ⚠️ **و`null` حالةٌ حقيقيّةٌ لأوّل مرّة**: من أطفأ تبويباتِه كلَّها
     **لا يُرسم له صفٌّ ولا محتوى** — **ونصٌّ صريحٌ مكانَهما**، لا صفحةٌ
     مبتورةٌ تُقرأ عطلاً. **وصاحبُ الصفحة يرى تبويباتِه كلَّها دائماً**
     (`tabHidden` تشترط `!isMe`) **فلا يفقد بابَه إلى تخصيصه.** */
  const visibleTabs = TABS.filter((k) => !tabHidden(k));
  const firstVisible: ProfileTab | null = visibleTabs[0] ?? null;
  const wantedTab: ProfileTab | null = (TABS as readonly string[]).includes(
    rawTab ?? "",
  )
    ? (rawTab as ProfileTab)
    : firstVisible;
  const tab: ProfileTab | null =
    wantedTab && !tabHidden(wantedTab) ? wantedTab : firstVisible;
  const base = `/u/${encodeURIComponent(profile.username ?? username)}`;
  const tabItemsAll: PageTab[] = [
    /* **وعنوانُه ثابتٌ لكلِّ حساب** (D-658) — ⚖️ 🆕 **ويُطفأ كغيره
       منذ D-667**، **والصفحةُ تفتح على أوّلِ ظاهرٍ لا على اسمٍ بعينه.** */
    {
      key: "favorites",
      label: t.profileTabFavorites,
      icon: "heart",
      href: base,
    },
    /* **وأقسامُه خلفَه** — مطفأٌ افتراضاً، يفتحه صاحبُه من التخصيص */
    {
      key: "overview",
      label: t.profileTabOverview,
      icon: "grid",
      href: `${base}?tab=overview`,
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
    <div
      className="space-y-5"
      /* 🆕 **ولونُ صاحبِ الصفحة معها** (D-825، حكمُ أحمد: «الي يدخل
         حسابه يشوف الألوان المختارة») — **نظيرُ الكثافة فوقه حرفاً**
         (D-441: «من يزورك يرى ما اخترتَه أنت»).
         🔑 **وحاويةٌ لا `:root`**: **متغيّراتُ CSS تُورَّث** — **فكلُّ
         ما في الصفحة يلبس لونَه بلا سطرٍ واحدٍ في مكوّن**، **وشريطُ
         التطبيق وقائمتُه السفليّةُ خارجَها فتبقى بلونِ الزائر**:
         **ملفُّه يلبس لونَه، والتطبيقُ يبقى تطبيقَ قارئه.**
         ⚠️ **وستّةُ متغيّراتٍ لا ثمانيةَ عشر**: **لا خلفيّةَ ولا نصّ**
         — **فصفحةُ زائرٍ تقلب أرضيّتَها عليه ليست تخصيصاً.** */
      style={densityVars(prefs.density) as React.CSSProperties}
    >
      {/* ===== الغلاف ===== */}
      <section>
        {/* 🔴 🆕 **والغلافُ استعاد ما أخذه النتوء** (D-651، بلاغُ أحمد
            بلقطتين: «الهامشُ بين سطر المشاركة والصورة جدّاً صغير، كبّره
            مثل قبل»).

            **والعلّةُ أثرٌ لم أحسبه في D-643**: كان شريطُ التطبيق فوق
            الغلاف فيبتلع `--safe-top` وحدَه، **والغلافُ يبدأ تحته
            بارتفاعه كاملاً**. **ولمّا أُخفي الشريطُ صعد الغلافُ إلى
            حافّة الشاشة** — **فصارت المنطقةُ الآمنةُ تُقتطع من داخله**
            ونزلت الأزرارُ إليه، **والباقي تحتها أقصرُ بمقدار النتوء
            بالضبط.**

            🔑 **والزيادةُ `--safe-top` نفسُها لا رقمٌ مذوق**: ما أخذه
            النتوءُ يُردّ بمقداره — **ورقمٌ ثابتٌ يصيب جهازاً ويخطئ
            غيرَه** (٤٧ في المثبَّت، صفرٌ في المتصفّح، وأكبرُ في أجهزة
            الجزيرة). **وعلى الشاشة الواسعة `--safe-top` صفرٌ فلا شيء
            يتغيّر** — ولذلك بقي `sm:h-[15rem]` كما هو. */}
        {/* ⚖️ 🆕 **ودرجةٌ ثالثةٌ للشاشة الواسعة** (D-836، بلاغُ أحمد
            وخالد: «أبعادُ الهيدر في المتصفّح سيّئة، على الجوّال ممتازة»
            · «الهيدرُ شكلُه صغير في المتصفّح»).

            📏 **والعلّةُ نسبةٌ لا ارتفاع**: **العمودُ يتّسع إلى ١١٢٠
            بكسلاً** (`max-w-6xl` ناقصَ الهامش) **والارتفاعُ واقفٌ عند
            ٢٤٠** — **فالغلافُ ٤٫٧:١ شريطٌ رفيع**، **وهو على الجوّال
            ٢٫٦:١ صورةٌ كاملة.** **فالمقاسُ لم يصغر؛ النسبةُ هي التي
            انفرطت.**

            🔑 **ودرجةٌ واحدةٌ لا درجتان** (`lg` وحدَها): عند ٩٩٢
            تصير ٢٫٨:١ وعند ١١٢٠ تصير ٣٫٢:١ — **وكلاهما داخل النطاق
            الذي يُقرأ غلافاً**، **ورقمان لفرقٍ لا تراه العينُ زيادة.** */}
        <div className="relative h-[calc(9.5rem+var(--safe-top))] sm:h-[15rem] lg:h-[22rem] -mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:rounded-3xl overflow-hidden">
          {/* 🆕 **والتدرّجُ أرضيّةٌ دائمةٌ لا فرعٌ مقابل** (D-657):
              **صورةٌ تفشل بعد الرسم لا تعيد تشغيل الفرع** — فيجب أن
              يكون تحتها أصلاً. **ومن سقط غلافُه يرى ما يراه من لا
              غلافَ له**، لا أيقونةَ صورةٍ مكسورة. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(120deg, var(--glow-a), transparent 55%), linear-gradient(300deg, var(--glow-b), transparent 55%), var(--surface-2)",
            }}
          />
          {profile.cover_url && (
            <CoverImage
              src={profile.cover_url}
              posY={profile.cover_pos ?? null}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
          {/* 🆕 **وتدرّجٌ ثانٍ من الأعلى للأزرار العارية** (D-651، طلبُ
              أحمد: «المنطقة فوق اعمل فيها تدرّج ظلام»).

              **والحجابُ العامُّ فوقَه أفتحُ ما يكون** (`black/10`)
              **وهو بالضبط حيث تجلس الأزرار**: تدرُّجُه مبنيٌّ لقاع
              الغلاف حيث الاسمُ والنبذة، **لا لرأسه.** **وأزرارٌ عاريةٌ
              على غلافٍ فاتحٍ تختفي** — والظلُّ وحدَه لا يكفي على صورةٍ
              بيضاء (D-643/D-288).

              🔑 **والوصفةُ وصفةُ `TitleHero` نفسُها** (`from-black/50`
              إلى شفّاف) — **ولا تدرُّجَ ثالثٌ يُخترع لشيءٍ محلول.**
              ⚠️ **والارتفاعُ وحدَه يختلف وبسببٍ**: هناك شريطُ التطبيق
              فوق الغلاف فيكفي `h-24` ثابتة، **وهنا الغلافُ يبدأ من حافّة
              الشاشة** — **فالارتفاعُ يُشتقّ: المنطقةُ الآمنةُ + موضعُ
              الزرّ + ارتفاعُه.** */}
          <div className="absolute inset-x-0 top-0 h-[calc(var(--safe-top)+5rem)] bg-gradient-to-b from-black/50 to-transparent" />
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
          {/* **والسهمُ يقابلها بالإزاحة نفسِها** — طرفان متناظران */}
          <BackButton
            locale={locale}
            variant="bare"
            className="absolute start-2.5 top-[calc(var(--safe-top)+0.375rem)] z-10"
          />
          {/* 🆕 **والفجوةُ صارت صفراً كالشريط** (D-776): الصناديقُ ٤٤
              متلاصقةٌ هناك، **فـ`gap-5` هنا كانت تجعل إيقاعَ الصفّ
              مختلفاً وإن تطابق المقاس** — **والتطابقُ تطابقُ الشبكة لا
              الصندوق وحدَه.** */}
          <div className="absolute end-2.5 top-[calc(var(--safe-top)+0.375rem)] z-10 flex items-center">
            <ShareTitleButton
              path={base}
              title={displayName}
              locale={locale}
              variant="cover"
            />
            {/* 🆕 **وترسُ الإعدادات في خانةِ النقاط نفسِها** (D-659، طلبُ
                أحمد بلقطةٍ محوَّطةٍ على المشاركة: «ترس الإعدادات حطّه
                هنا يمين المشاركة»).

                🔑 **وهو بابٌ أخذه إخفاءُ الشريط ولم يُردَّ** (D-643):
                **صورةُ الشريط كانت تفتح الإعدادات من كلِّ صفحة** —
                **ولمّا أُخفي الشريطُ في `/u/` فقد صاحبُ الصفحة بابَه
                إليها وهو في صفحته هو.** **وهو نظيرُ D-651 حرفاً**:
                إخفاءُ شريطٍ يُسقط ما كان يحمله، **والحسابُ يُتمّ.**

                ⚠️ **وليس بابَ «تعديل الملفّ»** (D-637): تلك وجهةُ
                الصورة الشخصيّة، **وبابان لفعلٍ واحدٍ زيادة** — **وهذا
                يفتح الإعداداتِ نفسَها التي كان يفتحها الشريط**
                (`/profile/settings`)، **فالوجهةُ واحدةٌ والمنفذُ عاد.**

                🔑 **والخانةُ خانةُ النقاط**: **ما يخصّ زائرَك يشغلها
                عنده، وما يخصّك يشغلها عندك** — **رتبةٌ واحدةٌ وموضعٌ
                واحدٌ وشاغلان بحسب القارئ** (نمطُ D-650 نفسُه). */}
            {isMe ? (
              <Link
                href="/profile/settings"
                prefetch={false}
                aria-label={t.headerSettings}
                title={t.headerSettings}
                className={coverBareControl}
              >
                <Icon name="settings" size={HEADER_ICON} strokeWidth={2.5} />
              </Link>
            ) : (
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
        {/* 🆕 **والتراكبُ يتبع الدائرةَ في الدرجتين** (D-836):
            **٤٠ نصفُ ٨٠ و٥٥ نصفُ ١١٠** — **والقاعدةُ نفسُها لا رقمٌ
            ثانٍ يُذاق** (D-547: «الرقمُ مشتقٌّ من المقاس»). */}
        <div className="flex items-start gap-3 pe-4 -mt-10 lg:-mt-[3.4375rem] relative z-10">
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
                size={AVATAR_LG}
                boxClass={AVATAR_BOX}
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
                size={AVATAR_LG}
                boxClass={AVATAR_BOX}
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
              {/* 🆕 **ومقاسُ الخطّ انتقل من `h1` إلى الصفّ** (D-776):
                  **الشارةُ صارت نسبةً من خطِّ ما حولها** (`0.82em`)،
                  **فلو بقي المقاسُ على `h1` وحدَها لورثت الشارةُ ١٦ من
                  الصفحة بدل ٢٢ من الاسم** — **فتصغر إلى ١٣ بجانب اسمٍ
                  ٢٢.** والعنوانُ يرث المقاسَ من أبيه فلا يتغيّر شيءٌ فيه. */}
              {/* ⚖️ 🆕 **والاسمُ كان يصغر على الشاشة الواسعة** (D-836):
                  `sm:text-xl` **عشرون**، **و`text-22` على الجوّال اثنان
                  وعشرون** — **فاسمُك على الحاسوب أصغرُ منه على هاتفك**،
                  وهو نصفُ شكوى «الهيدر شكلُه صغير» حرفاً. **والاتّجاهُ
                  يُعكس**: ٢٢ ثم ٢٤ مع الغلاف الأطول، **ودرجةٌ واحدةٌ
                  عند `lg` كالغلاف والدائرة** — **ثلاثتُها تكبر معاً أو
                  لا يكبر منها شيء.** */}
              <div className="min-w-0 flex-1 flex items-center gap-1.5 text-22 lg:text-24">
                <h1 className="hero-halo min-w-0 font-bold leading-tight truncate">
                  {displayName}
                </h1>
                {/* 🆕 **شارةُ Loopz+ بجانب الاسم** (D-633، بحكمه) —
                    **خارجَ `truncate`**: اسمٌ طويلٌ يُقصّ ولا تُقصّ معه
                    الشارة، **وشارةٌ تختفي بطول اسمٍ ليست شارة.** */}
                <AccountBadges profile={profile} t={t} />
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
                  labels={{
                    close: t.closeLabel,
                    empty: t.followListEmpty,
                    anonymous: t.anonymousUser,
                    badges: badgeLabelsOf(t),
                  }}
                />
                <FollowCountButton
                  targetId={profile.id}
                  dir="following"
                  count={stats.following}
                  label={t.followingLabel}
                  sheetTitle={t.followsTabFollowing}
                  locked={!isMe && !!profile.hide_follow_lists}
                  compact
                  labels={{
                    close: t.closeLabel,
                    empty: t.followListEmpty,
                    anonymous: t.anonymousUser,
                    badges: badgeLabelsOf(t),
                  }}
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

            {/* 🆕 **شارةُ مدّة العضويّة** (D-831، البندُ ١٣ من خطّة
                الـ٢٤ — وحكمُه: «مدّة العضويّة من الانضمام»).
                🔑 **وسطرٌ لا رقاقةٌ في سطر الاسم**: **ذلك السطرُ يحمل
                الاسمَ والشارةَ وزرَّ المتابعة** — **وثالثٌ فيه يعيد عطلَ
                D-634 بيدي.** **وموضعُها ذيلُ عنقود الهويّة**: اسمٌ ·
                معرّفٌ · نبذةٌ · **ومنذ متى** — **وهي بياناتُ تعريفٍ
                فتتبعها لا تسبقها** (D-642).
                🔒 **وبلس** (D-783 §٣): **الجديدُ كلُّه بلس** — **وتغيب
                عمّن ليس مشتركاً بلا قفلٍ يُرسم**، **فشارةٌ مقفلةٌ على
                ملفِّ غيرك تبيع لمن لا يملك تغييرها.**
                ⚠️ **وتغيب عمّن لا تاريخَ له** (حسابُ المنصّة) —
                **والغيابُ يُكتب غياباً** (D-063). */}
            {/* 🆕 **وشارةُ أوائل الأسبوع في صفِّ العضويّة** (D-835،
                حكمُ أحمد: «تكون تظهر أيقونة في نفس صفّ عضو منذ كذا»)
                — **الصفُّ صار صفَّ ما تحمله لا سطرَ تاريخٍ وحدَه.**
                🔒 **وهي مجّانيّةٌ لا بلس**: **جائزةُ نشاطٍ تُكسب**،
                **وشارةٌ تُكسب ثمّ تُحجب عمّن لم يشترِ تعاقب الفائز.**
                ⚠️ **وتُرسم لصاحبها ولزائره سواء**: **مرتبةٌ لا يراها
                إلّا صاحبُها لا تشجّع أحداً** (نصُّ الطلب: «نشجّعهم»).
                ⚖️ 🆕 **وصارت باباً لا تختفي** (D-838، حكمُه: «الشارة لا
                تختفي · جنبها عدد المرّات · وإذا ضغط عليها تطلع قائمة
                بالأسابيع») — **ووجهُها عددٌ لا مرتبة**، **وما تقوله
                وما تفتحه في `WeeklyRanksDoor` لا هنا**: **الصفُّ يقرّر
                من يجلس فيه، لا ما يقوله كلٌّ منهم.** */}
            {/* ⚠️ **صفٌّ واحدٌ يلفّهما** (نصُّ الطلب: «في نفس صفّ عضو
                منذ كذا»): **الشارةُ والتاريخُ سطرٌ واحد** — **و`flex-wrap`
                لأنّ العربيّةَ والإنجليزيّةَ لا تقيسان الشهرَ بالطول
                نفسِه**، **وسطرٌ يفيض على شاشةٍ ضيّقةٍ ينزل ولا يُقصّ.**
                **والغلافُ لا يُرسم حين لا شيءَ فيه** (D-219/D-280). */}
            {(weeklyRanks.length > 0 || xUrl || (profile.joined_at && isPlus(profile))) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <WeeklyRanksDoor rows={weeklyRanks} locale={locale} />

                {/* 🆕 **وحسابُ X في الصفّ نفسِه** (D-839): **هو من
                    الهويّة لا من المحتوى** — **وصفُّ ما تحمله هو
                    بيتُه**، **لا صفٌّ رابعٌ يُفتح لسطرٍ واحد.**
                    ⚠️ **ورمزُ الصحّة بلون الهوية والنصُّ خافت**:
                    **الكأسُ وحدَها هي الجائزة**، **وثلاثُ رقاقاتٍ
                    ذهبيّةٍ في سطرٍ واحدٍ تُلغي بعضَها** (D-142: المعنى
                    في الرمز والكلمة لا في اللون وحدَه).
                    ⚠️ **و`dir="ltr"` على المعرّف**: لاتينيٌّ دائماً،
                    **وعلامةُ `@` تقفز إلى آخره في سطرٍ عربيّ.** */}
                {xUrl && xHandle ? (
                  <a
                    href={xUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    title={`X — ${t.xVerifiedTip}`}
                    className="hero-halo text-12 text-muted leading-none flex items-center gap-1.5 hover:text-foreground active:opacity-70 transition"
                  >
                    <Icon name="person-check" size={12} className="shrink-0 text-accent" />
                    <bdi className="font-semibold" dir="ltr">
                      X
                    </bdi>
                    <bdi dir="ltr">@{xHandle}</bdi>
                  </a>
                ) : null}

                {profile.joined_at && isPlus(profile) ? (
                  <p
                    className="hero-halo text-12 text-muted leading-none flex items-center gap-1.5"
                    dir="auto"
                  >
                    <Icon name="calendar" size={12} className="shrink-0" />
                    {t.memberSince(
                      new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "ar", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }).format(new Date(profile.joined_at)),
                    )}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* 🗑️ ⚖️ **وسقط من هذا الموضع سطرُ اللقب ونظامُ المستوى معاً**
            (D-807، حكمُ أحمد: «ما لهم داعي وزحمة على الفاضي») —
            **ونقضٌ صريحٌ لـD-561 وD-566 وD-601**، وثلاثتُها أحكامُه.
            **والحجّةُ تسنده**: **رقاقةُ المستوى سقطت في D-438 فورثها
            اللقبُ اسماً**، **ثمّ غادر العدّادان صفَّه في D-622 فبقي
            عمودان أحدُهما فارغٌ دائماً لأكثر الحسابات** — **و`w-20`
            محجوزةٌ لكلمةٍ لا يكتبها أحد.** **وحقلٌ يُملأ عند واحدٍ من
            اثنين وثلاثين ليس حقلاً، هو فراغٌ محجوز.**
            ⚠️ **ولا عمودَ يُحذف من القاعدة**: `profile_prefs.title`
            مفتاحٌ في JSON — **يُهمَل ولا يُمسّ** (D-063: ما لا يُقرأ لا
            يُتلف). */}
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
            {/* **والأعمدةُ `[1fr_1fr_auto]` للجميع** — حكمُ D-611 بحرفه:
                «الأفلام والمسلسلات تكون سطر واحد والإحصائيات كلمة وحدة
                بحيث ياخذون راحتهم». **والبابُ كلمةٌ لا رقمٌ عمداً**:
                **رقمٌ تحت اسم «الإحصائيات» يسأل «رقمُ ماذا؟»** — والخانتان
                قبله عدّادان صريحان. */}
            <div className="grid grid-cols-[1fr_1fr_auto]">
              {/* 🆕 **والخانةُ صارت باباً** (D-643): «١٦ مسلسلاً» رقمٌ
                  يُضغط، **ورقمٌ يُضغط ولا يفتح شيئاً وعدٌ فارغ** (D-217).
                  **ووجهتُه تبويبُه في الصفحة نفسِها** — لا صفحةٌ ثالثة.
                  ⚠️ **و`replace` هنا أيضاً**: نفسُ حكم التبويبات — **بابٌ
                  داخلَ الصفحة لا يكدّس تاريخاً.** */}
              {headerStats.map((c) => {
                const cellClass =
                  "relative w-full flex items-center justify-center gap-2 px-2 py-3 hover:text-accent transition";
                /* 🆕 **وجهُ الخانة يُرسم مرّةً** ثمّ يلبس فعلَه (D-644):
                    المسلسلاتُ والأفلامُ تفتحان ورقةً، **والتقييماتُ رابطُ
                    تبويبٍ لأن تبويبَها قائمٌ أصلاً** — **ولا ورقةَ لما له
                    وجهةٌ في الصفحة.** */
                const face = (
                  <>
                    {/* **والخطُّ بين خانتين لا بعد آخرِها**: خانةُ
                      «الإحصائيات» تلي الأخيرةَ لصاحب الصفحة وحدَه،
                      **فالشرطُ يعرف الحالتين** — **وخطٌّ على حافّة
                      البطاقة يُقرأ حدّاً مزدوجاً.** */}
                    {/* **وخطٌّ بعد كلِّ خانةٍ من الخانتين**: البابُ يليهما
                      دائماً الآن، **فلا حالةَ «آخرِ خانةٍ على الحافّة»**
                      التي كان الشرطُ القديمُ يحرسها. */}
                    <span
                      className="absolute inset-y-2 end-0 w-px bg-[color:var(--divider)]"
                      aria-hidden
                    />
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
                      {/* 🆕 D-699 (حكمُه: «حجم الخط خله متوافق مع الرقم،
                        طالع صغير»): الكلمةُ ١٢←١٤ بجوار رقمها الـ١٥ —
                        **وميزانُ D-676 باقٍ: الخاناتُ الثلاثُ مقاسٌ
                        واحد**، فخانةُ الإحصائيات تصعد معها أدناه. */}
                      <span className="text-14 text-muted leading-none truncate">
                        {c.label}
                      </span>
                    </span>
                  </>
                );
                const grid = c.key === "shows" ? showsGrid : moviesGrid;
                return (
                  <ProfileStatSheet
                    key={c.key}
                    title={c.label}
                    closeLabel={t.closeLabel}
                    className={cellClass}
                    content={grid}
                  >
                    {face}
                  </ProfileStatSheet>
                );
              })}
              {/* 🔴 🆕 **ووجهةُ البابِ تختلف بالقارئ لا اسمُه** (D-650):
                  `/stats` تقرأ **صاحبَ الجلسة** — **فزائرٌ يُوجَّه إليها
                  يرى أرقامَ نفسِه في ملفِّ مشعل ويظنّها أرقامَ مشعل**،
                  وهو بعينه ما تمنعه D-217. **ولصاحبها مداها الكامل
                  بتبويباته، ولزائره سطحُ العضو** (`/u/<user>/stats`)
                  **بما تسمح به دوالُّ `definer` وحدَه.** */}
              <Link
                href={isMe ? "/stats" : `${base}/stats`}
                /* ⚖️ 🆕 **وخطُّ الخانة الثالثة صار خطَّ أختيها** (D-676،
                   حكمُ أحمد بلقطةٍ محوَّطة: «مقاس خط جميع الكارد لازم
                   يكون واحد، هذا أكبر من الأفلام والمسلسلات — وازنهم»):
                   كان `text-14` بينما كلمتا «مسلسلات» و«أفلام»
                   `text-12` — **وثلاثُ خاناتٍ في بطاقةٍ واحدةٍ بمقاسين
                   تُقرأ صفَّين** (D-046/D-639).
                   🔑 **والوزنُ يبقى `font-semibold`**: هو الفرقُ بين
                   **بابٍ يُضغط** وكلمةٍ تصف رقماً — **والمطلوبُ توحيدُ
                   المقاس لا محوُ الفرق.** */
                className="flex items-center justify-center gap-1 px-4 py-3 text-14 font-semibold text-muted hover:text-accent transition"
              >
                {/* ⚖️ 🆕 **والكلمةُ أقصر، ومن الوجهة نفسِها** (D-676،
                    ذيلُ حكمه: «ولو فيه كلمة أقصر اكتبها») — **نظيرُ
                    D-675 في المكتبة حرفاً**: «Statistics» صارت
                    `statsPageTitle` **وهو اسمُ الصفحة التي يفتحها**
                    («الإحصائيات» / «Stats») — **ولا مفتاحَ جديد، ولا
                    اسمانِ لوجهةٍ واحدة** (D-030/D-145). */}
                <span className="whitespace-nowrap">{t.statsPageTitle}</span>
                <Icon
                  name="chevron-down"
                  size={14}
                  className="shrink-0 -rotate-90 rtl:rotate-90"
                />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 🔴 🆕 **وشريطُ هذه الصفحة لا يختفي مع الكسوة** (D-564، بلاغُ
          أحمد): **هو الشريطُ الوحيدُ في التطبيق الذي يجلس في وسط
          الصفحة** — **فتحويلُ `chrome-sub` يرفعه فوق موضعه ويطفو على
          الصورة الشخصيّة، ويترك مكانَه فراغاً.** الحجّةُ كاملةً في
          `PageTabs`. */}
      {canView && tab && (
        <PageTabs
          items={tabItems}
          active={tab}
          ariaLabel={t.profile}
          asNav
          autoHide={false}
        />
      )}

      {/* 🆕 **وحالةُ «لا تبويبَ ظاهراً»** (D-667): **صفحةٌ تنتهي عند
          البطاقة بلا كلمةٍ تُقرأ عطلاً في التطبيق** — **والنصُّ يقول إن
          صاحبَها أخفاها، لا إن شيئاً انكسر.** */}
      {canView && !tab && (
        <div className="text-center py-10 space-y-2">
          <p className="text-muted text-14">{t.profileNoTabs}</p>
          {/* 🆕 **وبابُ صاحبها لا يُغلق دونه** (D-672): صار يرى ما يراه
              زائرُه، **فحالةُ «كلُّها مطفأة» صارت ممكنةً عنده لأوّل
              مرّة** — **وصفحةٌ بلا مخرجٍ إلى مفتاحها فخّ** (D-628:
              تبويبٌ يبتلع شريطَه). **والوجهةُ شاشةُ التخصيص نفسُها**
              حيث تسكن المفاتيح، لا الإعداداتُ العامّة. */}
          {isMe && (
            <Link
              href="/profile/settings/home"
              className="inline-block text-14 font-bold text-accent underline underline-offset-4"
            >
              {t.custTitle}
            </Link>
          )}
        </div>
      )}

      {/* ⚖️ 🆕 **وصفوفُ التبويب في حاويةٍ أضيقَ إيقاعاً** (D-585، بلاغُ
          أحمد بلقطتين محوَّطتين: «فيه هامش كبير فاضي احذفه»): إيقاعُ
          الصفحة `space-y-5` (٢٠px) صحيحٌ بين كتل الرأس، **ورفٌّ فوق رفٍّ
          كلاهما عنوانٌ وملصقاتٌ لا يحتاجانه** — **فالحاويةُ الواحدةُ
          تجعل الرفوفَ كتلةً واحدةً في عين الإيقاع الخارجيّ** (٢٠ تحت
          التبويبات مرّةً واحدة)، **وبينها `space-y-3` (١٢px).** */}
      {canView && tab === "favorites" && (
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
          {/* **وتبويبُ مفضّلةٍ فارغٍ يقول ذلك** (D-374) */}
          {favorites.length === 0 && (
            <p className="text-center text-muted py-16 text-sm">
              {t.profileEmptyFavorites}
            </p>
          )}
        </div>
      )}

      {/* ===== نظرة عامة — أقسامُه بترتيبه (D-658) ===== */}
      {canView && tab === "overview" && (
        <div className="space-y-3">
          {/* 🗑️ ⚖️ 🔴 **وقصُّ D-564 سقط بسقوط سببه** (D-658).

          **حجّتُها كانت «صفّان بعنوانٍ واحد في شاشةٍ واحدة»** (بلاغُ
          أحمد: «و shows مكرّر») — **فكانت المفضّلةُ تُسقط قسمَ المكتبة
          الذي رسمته.** **وقد صارا في تبويبين**، **فلا شاشةَ واحدةَ
          تجمعهما ولا تكرارَ يُرى** — **ولو بقي القصُّ لصار «نظرة عامة»
          فارغةً لمن مفضّلتُه تغطّي نوعيه**، وهو نقضٌ لمعنى التبويب نفسِه.
          ⚠️ **ونقضٌ محصورٌ بالقصِّ لا بالحجّة**: **متى اجتمعا في شاشةٍ
          واحدةٍ يوماً عاد القصُّ معهما.** */}
          {prefs.order.map((sec) => {
            const node = sections[sec];
            return node ? <div key={sec}>{node}</div> : null;
          })}
          {/* **وتبويبٌ لا شيءَ فيه يقول ذلك** (D-374) */}
          {!prefs.order.some((sec) => sections[sec]) && (
            <p className="text-center text-muted py-16 text-sm">
              {t.profileEmptyOverview}
            </p>
          )}
        </div>
      )}

      {/* ===== النشاط — تقييماتُه بالزمن ===== */}
      {/* ⚖️ 🆕 **التبويبُ صار سجلَّ `/activity` نفسَه** (D-586، طلبُ أحمد:
          «الاكتيفتي حطّ فيه كامل الاكتيفتي، نفس طريقة العرض الي
          بالمكتبة») — **سدادُ الدَّين المعلَن D-438 §12** («النشاطُ
          تقييماتٌ لا كلُّ فعل»). **والشاشةُ تُستورد لا تُنسخ** (القاعدة
          ٦): `ActivityScreen` بعينها — رقائقُها وقسمةُ الأيام بساعة
          القارئ ودمجُ الحلقات، **بلا فتاتِ «المكتبة»** (`crumb=false`).
          🆕 **وعشرون ثمّ «المزيد»** (D-710، `initial={20}`): **التبويبُ
          جارٌ لتبويباتٍ أخرى**، **وذيلٌ بلا نهاية يدفن ما بعده** —
          **و`‎/activity` وحدَها تبقى بلا سقفٍ** لأن قارئَها قصدَها. */}
      {canView &&
        tab === "activity" &&
        (activityItems.length === 0 ? (
          <p className="text-center text-muted py-16 text-sm">
            {t.profileEmptyActivity}
          </p>
        ) : (
          <ActivityScreen
            items={activityItems}
            locale={locale}
            crumb={false}
            initial={20}
          />
        ))}

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
            <p className="text-center text-muted py-16 text-sm">
              {t.profileEmptyReviews}
            </p>
          ) : (
            reviewsNewest.map((r) => {
              const titleHref = `/${r.media_type === "tv" ? "show" : "movie"}/${r.tmdb_id}`;
              const reviewHref = `/review/${r.media_type}/${r.tmdb_id}/${profile.id}`;
              const social = reviewLikes.get(`${r.media_type}-${r.tmdb_id}`);
              return (
                <article
                  key={`rv-${r.media_type}-${r.tmdb_id}`}
                  className="py-4 first:pt-0 flex gap-3"
                >
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
                          <ShareTitleButton
                            path={titleHref}
                            title={r.title ?? ""}
                            locale={locale}
                          />
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
                    state={myState?.of(r.tmdb_id, r.media_type)}
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
      {canView &&
        tab === "lists" &&
        (publicLists.length === 0 && savedLists.length === 0 ? (
          <p className="text-center text-muted py-16 text-sm">
            {t.profileEmptyLists}
          </p>
        ) : (
          <div className="space-y-6">
            {publicLists.length > 0 && (
              <PublicListsRail
                lists={listsOrdered}
                locale={locale}
                title={t.profileTabLists}
                grid
              />
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
                    <SavedListsToggle
                      locale={locale}
                      initialOn={prefs.savedLists}
                    />
                  ) : undefined
                }
              />
            )}
          </div>
        ))}

      {/* ===== ما أخفيتَه، تراه أنت وحدك (D-152) ===== */}
      {canView && isMe && tab === "overview" && (
        <>
          {PROFILE_SECTIONS.filter((s) => !prefs.order.includes(s)).map(
            (sec) => (
              <div
                key={`hidden-${sec}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border px-4 py-3.5"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-bold text-muted">
                    <Icon
                      name={hiddenMeta[sec].icon}
                      size={16}
                      className="shrink-0"
                    />
                    <span className="truncate">{hiddenMeta[sec].label}</span>
                  </span>
                  <span className="block text-12 text-muted mt-0.5">
                    {t.profileHiddenHint}
                  </span>
                </span>
                <span className="shrink-0 text-12 text-muted border border-border rounded-full px-2.5 py-1">
                  {t.profileHiddenBadge}
                </span>
              </div>
            ),
          )}
        </>
      )}
    </div>
  );
}
