import "server-only";
/**
 * ====== نواةُ ملفّ الشخص — حسابٌ واحدٌ لقارئَين (🆕 Phase 11-N · N0) ======
 *
 * كلُّ ما كانت `app/u/[username]/page.tsx` تقرؤه وتشتقّه قبل الرسم **نُقل هنا حرفاً**: موجةُ القراءة الواحدة، والترجمةُ
 * (D-048)، وأغلفةُ صاحب الملفّ (D-131)، وقسمةُ الأنمي (D-941)، وترتيبُ صاحبه (D-581)، والنشاطُ بلبوس `/activity` (D-586).
 * **الصفحةُ ترسم منها، و`GET /api/v1/profile/{username}` يصوغ منها حمولةَ التطبيق** — فلا حسابَ ثانٍ يختلف عن الأوّل
 * (نهجُ `homeCore` · `communityCore` · `messagesCore`). لا نصَّ مترجماً هنا: ما يحتاج القاموسَ (`t`) يبقى عند من يرسم.
 */
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
} from "@/lib/data";
import type { Locale } from "@/core/i18n";
import { localizeRows } from "@/lib/localize";
import { sanitizeSocials, socialUrl } from "@/core/socials";
import type { ActivityItem } from "@/components/ActivityScreen";
import { getProfileActivity } from "@/lib/myActivity";
import { posterUrl } from "@/core/media";
import { getLibState } from "@/lib/libState";
import { applySectionOrder, sanitizeProfilePrefs, sectionKeyOf, type ProfileSection } from "@/core/profilePrefs";

/**
 * `handle` اسمُ المستخدم (أو معرّفُه) كما في الرابط بعد فكّ ترميزه. `null` ⇐ لا حساب.
 * ⚖️ `recordView: false` ⇐ لا تُسجَّل زيارة (للمعاينة؛ الصفحةُ والتطبيقُ يسجّلانها — كلٌّ لفتحه، فلا فتحَ يُعدّ مرّتين).
 */
export async function loadProfile(handle: string, locale: Locale, opts: { recordView?: boolean } = {}) {
  const me = await getUser();
  const profile = await getProfileByUsername(handle);
  if (!profile) return null;

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
    isMe || opts.recordView === false ? Promise.resolve() : recordProfileView(profile.id),
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
  /* 🆕 **والأنمي يخرج من «مسلسلات» إلى قسمه** (D-941): القسمةُ بالعلَم أوّلاً
     (`animeFlags`، D-182) كما في المفضّلة — **وعملٌ واحدٌ لا يظهر في صفَّين.**
     ⚖️ 🆕 **والعدُّ انقسم مع العرض** (D-941c، طلبُ أحمد: «أضف أنمي على اليمين
     قبل الإحصائيات»): خانةُ «مسلسلات» تعدّ ما في صفّها وخانةُ «أنمي» ما في
     صفّها — **رقمٌ فوق صفٍّ لا يطابقه يكذب** (D-217). */
  const tvAll = follows.filter((f) => f.media_type === "tv" && !f.dropped);
  const isAnime = (f: { media_type: "tv" | "movie"; tmdb_id: number }) =>
    !!animeFlags.get(artKey(f.media_type, f.tmdb_id));
  const tvFollows = applySectionOrder(
    tvAll.filter((f) => !isAnime(f)),
    secOrder.shows,
    (f) => sectionKeyOf.show(f.tmdb_id),
  );
  const animeFollows = applySectionOrder(
    tvAll.filter(isAnime),
    secOrder.anime,
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

  const withProgress = (f: (typeof tvAll)[number]) => {
    const aired = f.aired_episodes ?? f.total_episodes ?? 0;
    const w = Math.min(watched.byShow.get(f.tmdb_id) ?? 0, aired || Infinity);
    return {
      id: f.tmdb_id,
      title: f.title,
      posterPath: f.poster_path,
      progress: aired > 0 ? Math.round((w / aired) * 100) : 0,
    };
  };
  const shows = tvFollows.map(withProgress);
  /* **والأنمي بخيط التقدّم نفسِه** — مسلسلٌ في كلِّ شيءٍ إلا الصفَّ الذي يسكنه (D-941) */
  const anime = animeFollows.map(withProgress);

  return {
    me,
    profile,
    isMe,
    prefs,
    wants,
    canView,
    myLibKeys,
    myState,
    actMeta,
    activityItems,
    bioText,
    weeklyRanks,
    xHandle,
    xUrl,
    secOrder,
    tvAll,
    isAnime,
    tvFollows,
    animeFollows,
    movieFollows,
    artistsOrdered,
    listsOrdered,
    favAnime,
    favRest,
    favShows,
    favMovies,
    favKeys,
    favOrder,
    topRated,
    reviewsNewest,
    withProgress,
    shows,
    anime,
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
    ratings,
    follows,
    favorites,
  };
}

export type ProfileCore = NonNullable<Awaited<ReturnType<typeof loadProfile>>>;
