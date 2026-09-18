import { setTitleArt } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { titleTag } from "@/core/contracts/tags";
import type { TitleArtBody } from "@/core/contracts/title";

/** `POST /api/v1/track/title-art` — حفظُ الغلاف والخلفيّة الشخصيَّين (D-1020): نفسُ `setTitleArt`؛ فارغان = العودةُ إلى الافتراضيّ. */
export const POST = bodyRoute<TitleArtBody, { ok: true }>(
  async (b) => {
    await setTitleArt({ tmdbId: Number(b.tmdbId), mediaType: b.mediaType === "tv" ? "tv" : "movie", posterPath: b.posterPath ?? null, backdropPath: b.backdropPath ?? null });
    return { ok: true };
  },
  (b) => ["home", "me:library", titleTag(b.mediaType === "tv" ? "tv" : "movie", Number(b.tmdbId))],
);
