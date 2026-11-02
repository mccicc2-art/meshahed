import "server-only";
import { getTv } from "@/lib/tmdb";
import { getWatchedForShow } from "@/lib/data";
import { hasSkipList, parseSkipMode, type SkipMode } from "@/core/filler";
import { shownProgress, skipKeysForTv } from "@/core/skipProgress";

/**
 * ====== التقدّمُ بلا المخفيّ على الخادم (D-1623) ======
 *
 * الرئيسيّةُ والمكتبةُ تعدّان من عدّادات القاعدة (`aired_episodes` · `watchedByShow`) بلا رحلةٍ خارجيّة. لعملٍ في قوائم
 * الفلر وصاحبُه اختار الإخفاء، يُجلب ما يلزم لعدِّ صفحة العمل نفسِه: تفاصيلُه (خبيئةُ TMDB) ومفاتيحُ مشاهداته (بحدِّ دورة
 * الإعادة) — **وللأعمال التي في القوائم وحدَها** (٣٨ عملاً)، فمكتبةٌ بلا أنمي لا تدفع شيئاً.
 * 🔑 **السقوطُ إلى العدِّ القديم**: تفاصيلُ تأخّرت أو فشلت ⇐ يبقى رقمُ القاعدة — رقمٌ بالفلر خيرٌ من صفّ بلا رقم.
 */
export function skipModeOf(profile: { skip_mode?: string | null } | null | undefined): SkipMode {
  return parseSkipMode(profile?.skip_mode ?? null);
}

/** أقصى ما يُحسب من أعمال القوائم في الطلب الواحد — فوقه يبقى عدُّ القاعدة */
const CAP = 12;

export async function shownProgressFor(
  ids: readonly number[],
  mode: SkipMode,
  rewatchSince: ReadonlyMap<number, string>,
): Promise<Map<number, { aired: number; watched: number }>> {
  const out = new Map<number, { aired: number; watched: number }>();
  if (mode === "all") return out;
  const pick = [...new Set(ids.filter(hasSkipList))].slice(0, CAP);
  if (!pick.length) return out;
  await Promise.all(
    pick.map(async (id) => {
      const [tv, keys] = await Promise.all([
        getTv(id).catch(() => null),
        getWatchedForShow(id, rewatchSince.get(id) ?? null).catch(() => null),
      ]);
      if (!tv || !keys) return;
      const skip = skipKeysForTv(tv, mode);
      if (skip) out.set(id, shownProgress(tv, keys, skip));
    }),
  );
  return out;
}
