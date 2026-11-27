import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { titleImages } from "@/lib/tmdb";
import type { CommunityFeedRow } from "@/core/contracts/community";

/**
 * ====== 🆕 T602 (q22 «أ») — خلفيّةُ العمل للافتة تحت الرأي ======
 *
 * بطاقةُ الرأي في التطبيق صار فيها الكلامُ أوّلاً بخطٍّ أكبر، والعملُ تحته لافتةً بعرض البطاقة: خلفيّتُه، وعليها ملصقُه واسمُه
 * وتقييمُ الكاتب. الخلفيّةُ ليست في صفّ الرأي، فتُجلب هنا كأخيها `vividizeFeed`:
 * - **بلا نصٍّ أوّلاً** (`iso_639_1` فارغ): الكلامُ يُرسم فوقها، وخلفيّةٌ عليها شعارٌ تزاحمه.
 * - **مخبّأةٌ ثلاثين يوماً** لكلّ عمل، و**بمهلة**: ما لم يصل في `BUDGET_MS` يُرسل بلا خلفيّة (اللافتةُ بلون السطح) ويُكمل بعد الردّ.
 * - صفوفُ القوائم والتقييماتُ المجمّعةُ والنقاشُ خارجه.
 */

const BUDGET_MS = 700;

const cached = (media: "tv" | "movie", id: number) =>
  unstable_cache(
    async () => {
      const { backdrops } = await titleImages(media, id, "en");
      /* القائمةُ الفارغة تُرمى ولا تُخبَّأ: `titleImages` يبتلع أخطاءَ TMDB (٤٢٩ · مهلة) ويُرجع فراغاً، فلولا الرمي لخُبّئ
         «لا خلفيّة» ثلاثين يوماً بعد عثرةٍ عابرة. والعملُ الذي لا خلفيّةَ له حقّاً يُسأل عنه في كلّ فتحٍ حتى تُضاف */
      const clean = backdrops.find((b) => !b.iso_639_1) ?? backdrops[0] ?? null;
      if (!clean?.file_path) throw new Error("no-backdrop");
      return clean.file_path;
    },
    ["feed-backdrop-1", media, String(id)],
    { revalidate: 60 * 60 * 24 * 30 },
  )();

type Row = Extract<CommunityFeedRow, { kind: "comment" }>;

export async function backdropFeed(all: CommunityFeedRow[]): Promise<void> {
  const rows = all.filter((r): r is Row => r.kind === "comment" && !r.item.listId);
  const byKey = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.item.media_type}:${r.item.tmdb_id}`;
    const list = byKey.get(k);
    if (list) list.push(r);
    else byKey.set(k, [r]);
  }
  if (byKey.size === 0) return;
  const pending: Promise<unknown>[] = [];
  const timeout = new Promise<"late">((res) => setTimeout(() => res("late"), BUDGET_MS));
  await Promise.all(
    [...byKey.values()].map(async (group) => {
      const it = group[0].item;
      const job = cached(it.media_type, it.tmdb_id).catch(() => "");
      const got = await Promise.race([job, timeout]);
      if (got === "late") {
        pending.push(job);
        return;
      }
      if (!got) return;
      for (const r of group) r.backdrop_path = got;
    }),
  );
  if (pending.length) after(() => Promise.allSettled(pending));
}
