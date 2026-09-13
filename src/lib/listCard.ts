import { curatedName } from "@/core/universes";
import type { PublicListCard } from "@/lib/data";
import type { LibraryListCard } from "@/core/contracts/library";

/**
 * بطاقةُ قائمةٍ عامّة ⇢ عقدُ الشاشة الأصليّة (`LibraryListCard`) — **مرّةً واحدة**
 * (D-145): كانت مكتوبةً في `/api/v1/me/library/lists` لتبويب «القوائم»، وصارت
 * `/api/v1/discover/lists` تحتاجها (Phase 11-C · C3 · D-955) — **فاستُخرجت لا
 * نُسخت**. اسمُ قائمةِ لوبز بلغة القارئ (`curatedName`)، وحالةُ الحفظ والرأي كما
 * تعرفها القراءة.
 */
export function toLibraryListCard(l: PublicListCard, locale: string): LibraryListCard {
  return {
    id: l.id,
    name: curatedName(l.source_slug, l.name, locale === "en" ? "en" : "ar"),
    kind: l.kind,
    owner: l.owner,
    owner_avatar: l.owner_avatar ?? null,
    item_count: l.item_count,
    posters: l.posters,
    saves: l.saves ?? 0,
    reviews: l.reviews ?? 0,
    rating: l.rating ?? null,
    count_label: null,
    cover: null,
    mine: !!l.mine,
    is_public: true,
    playlist: typeof l.playlist === "boolean" ? l.playlist : null,
    can_save: !!l.can_save,
    saved_by_me: l.saved_by_me !== false,
    can_review: !!l.can_review,
    my_review: l.my_review ? { rating: l.my_review.rating, body: l.my_review.body, has_spoiler: l.my_review.hasSpoiler } : null,
  };
}
