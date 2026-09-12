import { getArtistShelf } from "@/lib/artists";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { LibraryArtistsPayload } from "@/core/contracts/library";

/**
 * `GET /api/v1/me/library/artists` — رفُّ الفنّانين للشاشة الأصليّة (D-947).
 *
 * 🔑 **الوصفةُ هي `getArtistShelf(60)` نفسُها** التي ترسم تبويبَ «فنّانون» في
 * الويب (D-128): «شاهدتَ له N أعمال» يُحسب هناك بسقفه (`CREDIT_LOOKUPS`) —
 * **ولذلك مسارٌ مستقلٌّ لا حقلٌ في `/me/library`**: الحسابُ ينادي TMDB لكلِّ
 * فنّان، **والصفحةُ لا تدفعه إلّا في تبويبه** (D-128)، فالشاشةُ كذلك.
 * والحدُّ أضيق من المكتبة لأنّ الكلفةَ أعلى.
 */
export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:library:artists:${auth.user.id}`, 20, 60_000);
    if (lim) return lim;
    const shelf = await getArtistShelf(60);
    const payload: LibraryArtistsPayload = {
      items: shelf.map((a) => ({
        person_id: a.person_id,
        name: a.name,
        profile_path: a.profile_path,
        watched_works: a.watchedWorks,
      })),
    };
    return ok(payload);
  });
}
