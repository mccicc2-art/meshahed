import { getCredits, getCollection, relatedTitles, altTitles, tvImdbId, getWatchProviders, getMovie, getTv, titleOf, yearOf, type WatchOptions } from "@/lib/tmdb";

import { externalRatings, imdbIdByName, type ExternalRatings } from "@/lib/omdb";
import { imdbOverride } from "@/core/imdbOverrides";
import { getTitlePulse, getMyLists, getListsContaining, getMyFavorites, getProviderLinks, artKey } from "@/lib/data";

/**
 * ====== ملحقاتُ صفحة العمل — وصفةٌ واحدةٌ للصفحة وللشاشة الأصليّة ======
 * (Phase 11-D · D2 — D-956)
 *
 * 🔑 **`resolveImdbId` كانت مدفونةً في `HeroRatings`** (المكوّن) — استُخرجت هنا
 * ليقرأها المسارُ `/api/v1/title/{kind}/{id}/extras` والمكوّنُ معاً (D-145/D-199):
 * التثبيتُ اليدويّ (`imdbOverride`) ⇢ معرّفُ TMDB ⇢ البحثُ بالاسم والسنة ⇢
 * العناوينُ البديلة. **لا نسخةَ ثانية للترتيب.**
 */
export async function resolveImdbId(
  kind: "tv" | "movie",
  id: number,
  name: string | null,
  year: number | null,
  imdbId?: string | null,
  tvImdbIdPromise?: Promise<string | null>,
): Promise<string | null> {
  const omdbKind = kind === "tv" ? ("series" as const) : ("movie" as const);
  const pinned = imdbOverride(kind, id);
  const first = pinned ?? imdbId ?? (kind === "tv" ? await (tvImdbIdPromise ?? tvImdbId(id)) : null);
  let iid = first ?? (name && year ? await imdbIdByName(name, year, omdbKind) : null);
  if (!iid && year) {
    for (const alt of await altTitles(kind, id)) {
      if (name && alt.toLowerCase() === name.trim().toLowerCase()) continue;
      const hit = await imdbIdByName(alt, year, omdbKind);
      if (hit) {
        iid = hit;
        break;
      }
    }
  }
  return iid;
}

export type TitleExtrasResult = {
  ratings: ExternalRatings | null;
  pulse: { hearts: number; votes: number; avg: number };
  watch: { region: string; options: WatchOptions; links: Record<number, string> } | null;
  cast: { id: number; name: string; character: string | null; profile_path: string | null }[];
  collection: { id: number; name: string; parts: { id: number; title: string; poster_path: string | null; year: string | null }[] } | null;
  related: { kind: "tv" | "movie"; id: number; title: string; poster_path: string | null; year: string | null }[];
  my_lists: { id: string; name: string }[];
  containing: string[];
  favorite: boolean;
};

/**
 * كلُّ ما تجلبه الصفحةُ حول البطل، بالدوالِّ نفسِها (`show/[id]` · `movie/[id]` ·
 * `RelatedTitles` · `CastRail` · `TitleActions`): تقييماتُ IMDb/RT/العمر · النبضُ ·
 * أين يُشاهَد (بروابط المزوّدين لمنطقة القارئ) · الطاقمُ (٢٠) · السلسلةُ والمشابهات
 * (ببصمة العمل: لغتُه وأنواعُه — D-410) · قوائمي وما يحويه · المفضّل.
 * **الشخصيُّ منها ذاتيُّ الحراسة**: للزائر يعود فارغاً عبر RLS.
 */
export async function titleExtras(kind: "tv" | "movie", id: number): Promise<TitleExtrasResult> {
  const base = kind === "tv" ? await getTv(id).catch(() => null) : await getMovie(id).catch(() => null);
  const name = base ? ("name" in base ? base.name : base.title) ?? null : null;
  const dateStr = base ? (("first_air_date" in base ? base.first_air_date : base.release_date) ?? null) : null;
  const year = dateStr ? Number(String(dateStr).slice(0, 4)) || null : null;
  const genreIds = base?.genres?.map((g) => g.id) ?? [];
  const language = base?.original_language ?? null;
  const collectionId = base && "belongs_to_collection" in base ? (base.belongs_to_collection?.id ?? null) : null;
  const movieImdb = base && "imdb_id" in base ? (base.imdb_id ?? null) : null;

  const [iid, pulse, watch, credits, collection, related, lists, containing, favs] = await Promise.all([
    resolveImdbId(kind, id, name, year, movieImdb).catch(() => null),
    getTitlePulse(id, kind).catch(() => ({ hearts: 0, votes: 0, avg: 0 })),
    getWatchProviders(kind, id).catch(() => null),
    getCredits(kind, id).catch(() => ({ cast: [], crew: [] })),
    collectionId ? getCollection(collectionId).catch(() => null) : Promise.resolve(null),
    relatedTitles(kind, id, 20, { language, genreIds }).catch(() => []),
    getMyLists().catch(() => []),
    getListsContaining(id, kind).catch(() => [] as string[]),
    getMyFavorites().catch(() => new Set<string>()),
  ]);
  const [ratings, links] = await Promise.all([
    externalRatings(iid).catch(() => null),
    watch ? getProviderLinks(id, kind, watch.region).catch(() => ({}) as Record<number, string>) : Promise.resolve({} as Record<number, string>),
  ]);
  const favSet = favs instanceof Set ? favs : new Set<string>();
  return {
    ratings: ratings && (ratings.imdb || ratings.rt || ratings.rated) ? ratings : null,
    pulse,
    watch: watch ? { region: watch.region, options: watch.options, links } : null,
    cast: credits.cast.slice(0, 20).map((c) => ({ id: c.id, name: c.name, character: c.character ?? null, profile_path: c.profile_path ?? null })),
    collection: collection
      ? { id: collection.id, name: collection.name, parts: collection.parts.map((p) => ({ id: p.id, title: titleOf(p), poster_path: p.poster_path, year: yearOf(p) || null })) }
      : null,
    related: related
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .map((r) => ({ kind: r.media_type === "tv" ? ("tv" as const) : ("movie" as const), id: r.id, title: titleOf(r), poster_path: r.poster_path, year: yearOf(r) || null })),
    my_lists: lists.filter((l) => l.kind !== "smart").map((l) => ({ id: l.id, name: l.name })),
    containing,
    favorite: favSet.has(artKey(kind, id)),
  };
}
