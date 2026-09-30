import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getMyActivityItems } from "@/lib/activityCore";
import type { MyActivityPayload } from "@/core/contracts/profile";

/**
 * `GET /api/v1/me/activity` — **النشاط، سجلُّك أنت** (🆕 D-1213، طلبُ أحمد: «نفّذ النشاط»). كان بابُ «النشاط» في المكتبة
 * وبطاقةُ «حصيلة الأسبوع» في الرئيسيّة يفتحان صفحةَ الويب طبقةً؛ **الحمولةُ ما ترسمه `/activity` حرفاً** (`lib/activityCore.ts`)،
 * **والصفُّ صفُّ تبويب «النشاط» في ملفّ الشخص** (`ProfileActivity`) — فمكوّنٌ أصليٌّ واحدٌ يرسم الاثنين (القاعدة ٣).
 * **بلا سقف**: هذه وجهةٌ قصدها صاحبُها ليقرأ سجلَّه كلَّه (D-710). والقسمةُ على الأيّام في التطبيق بساعة القارئ.
 */
export async function GET() {
  return handle<MyActivityPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:activity:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const items = await getMyActivityItems(await getLocale());
    return ok({
      items: items.map((it) => ({
        id: it.id,
        kind: it.kind,
        at: it.at,
        media_type: it.mediaType,
        tmdb_id: it.tmdbId,
        title: it.title,
        poster: it.poster,
        season: it.season ?? null,
        episode: it.episode ?? null,
        rating: it.rating ?? null,
        list_name: it.listName ?? null,
      })),
    });
  });
}
