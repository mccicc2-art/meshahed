import { NextResponse } from "next/server";
import { getUser, getWatchedMovieIds, getFollows } from "@/lib/data";
import { awardWinners, getCollection, moviesByIds, posterUrl, resolveSetIds, titleOf, yearOf } from "@/lib/tmdb";
import { topChartRows } from "@/lib/topChart";
import { universeBySlug, universeName } from "@/lib/universes";
import { getLocale } from "@/lib/locale";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * أجزاء السلسلة، مع حالة كلّ جزءٍ عند صاحب الحساب.
 *
 * لماذا مسارٌ منفصل بدل تمريرها مع الصفحة: هذه القائمة لا تُعرض إلا بعد
 * ضغطة ✓ — أي لقلّةٍ من زوّار الصفحة. جلبها مع كل فتحة صفحةٍ يدفع ثمنها
 * الجميع ليستفيد قليل، وتأخيرُها بعد الضغطة يُخفيه هيكلٌ قصير. والطلب
 * مخبّأ ساعةً في طبقة `tmdb()` فالضغطة الثانية على العمل نفسه لا تكلّف
 * شيئاً.
 *
 * وتُرجع `watched` و`saved` لكل جزء: زرٌّ يبدأ فارغاً وقد أشاهدتَ صاحبه
 * فعلاً يكذب على المستخدم ويدفعه إلى ضغطةٍ لا لزوم لها.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ parts: [] }, { status: 401 });

  const key = `franchise:${user.id}`;
  if (!allow(key, 30, 60_000)) {
    return NextResponse.json(
      { parts: [] },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  const exclude = Number(url.searchParams.get("exclude"));
  const slug = url.searchParams.get("slug");

  /* slug = مجموعة منسّقة من universes.ts (معاينة بطاقات القوائم —
     دفعة أحمد الثالثة): تُحلّ معرّفاتها ثم تُلبس نفس شكل ردّ السلسلة،
     فورقة المعاينة الواحدة تخدم المصدرين بلا فرع في العميل */
  if (slug) {
    const u = universeBySlug(slug.trim().toLowerCase());
    if (!u) return NextResponse.json({ parts: [] });

    /* مجموعات الجوائز (طلب أحمد): الفائزون مثبَّتين على TMDB، وكل جزءٍ
       يحمل **سنة فوزه** — هي ما يُعرض في صدر الصفّ ويُرتَّب بها */
    if (u.award) {
      const [rows, watchedIds, follows, locale] = await Promise.all([
        awardWinners(u.award),
        getWatchedMovieIds(),
        getFollows(),
        getLocale(),
      ]);
      const savedKeys = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
      return NextResponse.json({
        name: universeName(u, locale === "en" ? "en" : "ar"),
        parts: rows.map((r) => ({
          id: r.id,
          mediaType: r.media_type === "tv" ? "tv" : "movie",
          title: titleOf(r),
          year: String(r.awarded),
          awarded: r.awarded,
          poster: posterUrl(r.poster_path, "w342"),
          watched: r.media_type === "movie" && watchedIds.has(r.id),
          saved: savedKeys.has(`${r.media_type}-${r.id}`),
        })),
      });
    }

    /* مجموعات TOP 250 (طلب أحمد): عناصرها تُحلّ من قوائم top_rated لا
       من معرّفاتٍ مكتوبة — وقد تكون مسلسلات، فكل جزءٍ يحمل mediaType */
    if (u.top) {
      const want = u.topLimit ?? 250;
      /* **مصدرٌ واحد للمعاينة والحفظ** (D-135): `topChartRows` هي نفسها
         التي يستدعيها `saveUniverseList`، فقائمةٌ محفوظة لا يمكن أن
         تخالف ما عايَنه المستخدم قبل ثانية. طبقاتها الثلاث موصوفةٌ عندها. */
      const [rows, watchedIds, follows, locale] = await Promise.all([
        topChartRows(u.top, want),
        getWatchedMovieIds(),
        getFollows(),
        getLocale(),
      ]);
      const savedKeys = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
      return NextResponse.json({
        name: universeName(u, locale === "en" ? "en" : "ar"),
        parts: rows.map((r) => ({
          id: r.id,
          mediaType: r.media_type === "tv" ? "tv" : "movie",
          title: titleOf(r),
          year: yearOf(r) || null,
          poster: posterUrl(r.poster_path, "w342"),
          // «شوهد» للمكتمل يقيناً وحده: الأفلام من سجلّها — والمسلسل
          // لا حكم سريعاً عليه هنا فلا نكذب بعلامة
          watched: r.media_type === "movie" && watchedIds.has(r.id),
          saved: savedKeys.has(`${r.media_type}-${r.id}`),
        })),
      });
    }

    const [ids, watchedIds, follows, locale] = await Promise.all([
      resolveSetIds(u),
      getWatchedMovieIds(),
      getFollows(),
      getLocale(),
    ]);
    const movies = await moviesByIds(ids).catch(() => []);
    const savedSet = new Set(
      follows.filter((f) => f.media_type === "movie").map((f) => f.tmdb_id),
    );
    return NextResponse.json({
      name: universeName(u, locale === "en" ? "en" : "ar"),
      parts: movies.map((m) => ({
        id: m.id,
        title: m.title,
        year: (m.release_date ?? "").slice(0, 4) || null,
        poster: posterUrl(m.poster_path, "w342"),
        watched: watchedIds.has(m.id),
        saved: savedSet.has(m.id),
      })),
    });
  }

  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ parts: [] });

  const [collection, watchedIds, follows] = await Promise.all([
    getCollection(id),
    getWatchedMovieIds(),
    getFollows(),
  ]);
  if (!collection) return NextResponse.json({ parts: [] });

  const saved = new Set(
    follows.filter((f) => f.media_type === "movie").map((f) => f.tmdb_id),
  );

  const parts = collection.parts
    .filter((p) => p.id !== exclude)
    .map((p) => ({
      id: p.id,
      title: titleOf(p),
      year: yearOf(p),
      poster: posterUrl(p.poster_path, "w342"),
      watched: watchedIds.has(p.id),
      saved: saved.has(p.id),
    }));

  return NextResponse.json({ name: collection.name, parts });
}
