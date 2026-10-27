import { NextRequest } from "next/server";
import { tvImdbIdStrict } from "@/lib/tmdb";
import { getSeasonForView } from "@/lib/seasonView";
import { seasonImdbRatings } from "@/lib/omdb";
import { episodeTmdbFallback } from "@/core/episodeRating";
import { getEpisodeRatings, getWatchedForShow, getUserId, type EpisodeRatingRow } from "@/lib/data";
import { episodeKey } from "@/core/keys";
import { handle, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { SeasonPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/tv/{id}/season/{n}` — حلقاتُ موسمٍ مع حالتي عليها.
 *
 * 🔑 **الحالةُ مدمجةٌ في الحلقة لا في قائمةٍ جانبيّة**: التطبيقُ يرسم
 * صفّاً واحداً من كائنٍ واحد — **وقائمتان تُطابَقان في العميل موضعُ
 * انزلاقٍ** (رقمُ حلقةٍ يُعاد ترقيمُه في TMDB فتُعلَّم غيرُها).
 *
 * ⚠️ **الموسمُ صفر (الخاصّات) مباح** كما في `/api/season` — `n >= 0`.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; n: string }> },
) {
  return handle(
    async () => {
      const { id, n } = await ctx.params;
      const tvId = positiveInt(id);
      const seasonNumber = Number(n);
      if (!tvId || !Number.isInteger(seasonNumber) || seasonNumber < 0)
        return fail("invalid_input");

      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      // نفسُ أرقام `/api/season` (القاعدة ٧): ٦٠ في الدقيقة
      const lim = limited(`v1:season:${uid ?? ip}`, 60, 60_000);
      if (lim) return lim;

      /* D-1011 — `?r=1`: تقييماتُ IMDb للحلقات وتقييماتي — كما `/api/season?r=1` في الويب */
      const withRatings = req.nextUrl.searchParams.get("r") === "1";
      const [season, watched, imdb, mine] = await Promise.all([
        /* D-1254 — قائمةُ TMDB + ما حُسب معروضاً ولم يدخلها بعد */
        getSeasonForView(tvId, seasonNumber),
        uid ? getWatchedForShow(tvId) : new Set<string>(),
        /* D-1554 — `null` = لم نعرف (حصّةٌ أو شبكة) فلا بديلَ TMDB؛ `{}` = عرفنا ولا رقم.
           A-27 — والمعرّفُ بالنسخة التي ترمي: فشلُ TMDB جهلٌ يسقط في `.catch`، لا «لا معرّف» */
        withRatings ? tvImdbIdStrict(tvId).then((iid) => seasonImdbRatings(iid, seasonNumber)).catch(() => null) : Promise.resolve(null),
        /* 🔴 D-1501 — **تقييمي يُقرأ دائماً لا مع `r=1` وحده** (بلاغُ أحمد: «نظام تقييم الحلقات غير واضح»): كانت نجمتي
           تمتلئ لحظةَ التقييم ثمّ تفرغ بعد الخروج، لأنّ التطبيقَ لا يطلب `r=1` إلّا بالنجمة العلويّة. قراءةٌ من قاعدتنا لا من OMDb. */
        uid ? getEpisodeRatings(tvId, uid).catch(() => new Map<string, EpisodeRatingRow>()) : Promise.resolve(new Map<string, EpisodeRatingRow>()),
      ]);
      const payload: SeasonPayload = {
        tv_id: tvId,
        season_number: seasonNumber,
        episodes: season.episodes.map((e: (typeof season.episodes)[number]) => ({
          episode_number: e.episode_number,
          name: e.name,
          overview: e.overview,
          air_date: e.air_date,
          runtime: e.runtime,
          still_path: e.still_path,
          watched: watched.has(episodeKey(seasonNumber, e.episode_number)),
          ...(withRatings
            ? {
                imdb_rating: imdb?.[e.episode_number] ?? null,
                /* 🆕 D-1554 — بديلُ TMDB لما لا رقمَ له في IMDb (IMDb أوّلاً دائماً، يقينُ الغياب، ٣٠ صوتاً فأكثر) */
                tmdb_rating: episodeTmdbFallback(imdb?.[e.episode_number] ?? null, imdb !== null, e.vote_average, e.vote_count),
              }
            : {}),
          /* 🔴 D-1501 — مفتاحُ `getEpisodeRatings` هو «موسم-حلقة» (بشَرطة) لا `episodeKey` («موسم:حلقة»): كان البحثُ يخطئ
             دائماً فلا يرى التطبيقُ تقييمَه أبداً — ولو بالنجمة العلويّة. الويبُ يبني خريطتَه من الصفوف فلم يتأثّر. */
          ...(uid
            ? {
                my_rating: mine.get(`${seasonNumber}-${e.episode_number}`)?.rating ?? null,
                my_review: mine.get(`${seasonNumber}-${e.episode_number}`)?.review ?? null,
                my_spoiler: !!mine.get(`${seasonNumber}-${e.episode_number}`)?.has_spoiler,
              }
            : {}),
        })),
      };
      return ok(payload);
    },
    /* D-986 — يحمل `watched`: لا يُخزَّن (انظر مسارَ العمل) */
    { cacheControl: "private, no-store" },
  );
}
