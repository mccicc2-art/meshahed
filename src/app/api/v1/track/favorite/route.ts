import { toggleFavorite } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import { getDict } from "@/core/i18n";
import { getLocale } from "@/lib/locale";
import type { FavoriteBody } from "@/core/contracts/title";

/**
 * `POST /api/v1/track/favorite` — تبديلُ المفضّل (D-956 · D2). الفعلُ نفسُه الذي يضغطه
 * القلبُ في `TitleActions` (`toggleFavorite`)، **واسمُ قائمة المفضّلة بلغة القارئ**
 * كما هناك (`t.favListName`). يعود بالحالة الحقيقيّة بعد التبديل.
 */
export const POST = bodyRoute<FavoriteBody, { favorite: boolean }>(
  async (b) => {
    const t = getDict(await getLocale());
    const favorite = await toggleFavorite({ tmdbId: b.tmdbId, mediaType: b.mediaType, title: String(b.title ?? ""), posterPath: b.posterPath ?? null, listName: t.favListName });
    return { favorite };
  },
  () => ["me:library", "home"],
);
