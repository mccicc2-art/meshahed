import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { traktConfigured, traktToken, harvestTrakt } from "@/lib/trakt";
import { IMPORT_CAPS } from "@/core/importer";
import { revalidatePath } from "next/cache";

// الاستيراد قد يكتب عشرات الآلاف من الصفوف — المهلة الافتراضية لا تكفي
export const maxDuration = 300;

/** عودة Trakt — يجلب المكتبة ويكتبها ثم يعيد المستخدم بملخّصٍ في الرابط */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/profile/settings/import?${q}`, request.url));

  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!traktConfigured()) return back("trakt=off");

  const store = await cookies();
  const expected = store.get("trakt_state")?.value;
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  store.delete("trakt_state");

  // الشِفرة بلا حالةٍ مطابقة لا تُصرف — انظر تعليق البداية
  if (!code || !state || !expected || state !== expected) return back("trakt=denied");

  const token = await traktToken(code, new URL("/api/trakt/callback", request.url).toString());
  if (!token) return back("trakt=failed");

  let harvest;
  try {
    harvest = await harvestTrakt(token);
  } catch {
    return back("trakt=failed");
  }

  const supabase = await createClient();
  // ختمٌ واحد يحلّ محلّ التاريخ الغائب — انظر السبب في applyImportChunk
  const stamp = new Date().toISOString();
  let shows = 0;
  let episodes = 0;
  let movies = 0;

  /* الملصقات لا تُجلب هنا: أربعمئة طلبِ TMDB داخل ردٍّ واحد تُنهي المهلة.
     `poster_path` يبقى فارغاً وتملؤه `FollowMetaSync` و`ShowStatsSync`
     عند أول زيارةٍ للمكتبة — نفس الطريق الذي تسلكه المتابعة اليدوية. */
  for (const sh of harvest.shows.slice(0, IMPORT_CAPS.shows)) {
    const { error } = await supabase.from("follows").upsert(
      {
        user_id: user.id,
        tmdb_id: sh.tmdbId,
        media_type: "tv",
        title: sh.title.slice(0, 300),
        poster_path: null,
      },
      { onConflict: "user_id,tmdb_id,media_type" },
    );
    if (error) continue;
    shows++;

    const rows = sh.episodes.slice(0, IMPORT_CAPS.episodesPerShow).map((ep) => ({
      user_id: user.id,
      show_tmdb_id: sh.tmdbId,
      season_number: ep.s,
      episode_number: ep.e,
      runtime: null as number | null,
      watched_at: ep.at ?? stamp,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const slice = rows.slice(i, i + 500);
      const { error: e2 } = await supabase.from("watched_episodes").upsert(slice, {
        onConflict: "user_id,show_tmdb_id,season_number,episode_number",
      });
      if (!e2) episodes += slice.length;
    }

    if (sh.rating) {
      await supabase.from("ratings").upsert(
        {
          user_id: user.id,
          tmdb_id: sh.tmdbId,
          media_type: "tv",
          rating: Math.max(1, Math.min(10, Math.round(sh.rating))),
          review: null,
          title: sh.title.slice(0, 300),
          poster_path: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    }
  }

  for (const mv of harvest.movies.slice(0, IMPORT_CAPS.movies)) {
    const { error } = await supabase.from("follows").upsert(
      {
        user_id: user.id,
        tmdb_id: mv.tmdbId,
        media_type: "movie",
        title: mv.title.slice(0, 300),
        poster_path: null,
      },
      { onConflict: "user_id,tmdb_id,media_type" },
    );
    if (error) continue;
    movies++;

    await supabase.from("watched_movies").upsert(
      {
        user_id: user.id,
        movie_tmdb_id: mv.tmdbId,
        runtime: null,
        watched_at: mv.at ?? stamp,
      },
      { onConflict: "user_id,movie_tmdb_id" },
    );

    if (mv.rating) {
      await supabase.from("ratings").upsert(
        {
          user_id: user.id,
          tmdb_id: mv.tmdbId,
          media_type: "movie",
          rating: Math.max(1, Math.min(10, Math.round(mv.rating))),
          review: null,
          title: mv.title.slice(0, 300),
          poster_path: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,tmdb_id,media_type" },
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath("/stats");
  revalidatePath("/diary");

  return back(`trakt=ok&sh=${shows}&ep=${episodes}&mv=${movies}&un=${harvest.unmatched.length}`);
}
