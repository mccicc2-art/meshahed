import "server-only";
import { unstable_cache } from "next/cache";
import { after } from "next/server";
import { IMG } from "@/core/media";
import { pickVivid, posterTone, type PosterTone } from "@/core/posterTone";
import { titleImages } from "@/lib/tmdb";
import type { CommunityFeedRow } from "@/core/contracts/community";

/**
 * ====== 🆕 D-1448 — الملصقُ الملوّن بدل الداكن في بطاقات «المجتمع» (التطبيق) ======
 *
 * أحمد ١٧ أكتوبر («١ أ»: بطاقاتُ المجتمع وحدَها في هذه الدفعة · «٢ أ»: الداكنُ بلا بديلٍ يأخذ إطاراً فاتحاً).
 * - يُقرأ الملصقُ الحاليّ بأصغر مقاسٍ في TMDB (`w92`)، ويُصغَّر إلى ١٢×١٨ بكسلاً فيُحسب لونُه (`core/posterTone`).
 * - **غيرُ الداكن يبقى كما هو** — لا نبدّل الملصقَ الرسميَّ إلا لعلّة.
 * - الداكنُ ⇒ ملصقاتُ العمل الأخرى بالأولويّة نفسِها في معرض الصور (`titleImages`: لغةُ القارئ · الإنجليزيّة · بلا نصّ)،
 *   **بلا لغاتٍ أخرى** (لا نضع ملصقاً يابانيّاً لقارئٍ عربيّ)، وأوّلُ ستّةٍ فقط.
 * - **المهلة**: الخطُّ لا ينتظر أكثر من `BUDGET_MS`؛ ما لم يُحسب بعدُ يُرسل بملصقه الأصليّ ويكمل حسابُه بعد الردّ (`after`)
 *   فيصل محسوباً في الفتحة التالية. والنتيجةُ مخبّأةٌ ٣٠ يوماً لكلّ عملٍ وملصقٍ ولغة.
 * - `sharp` يأتي مع Next (محسّنُ الصور) ويُستورد عند الحاجة؛ غيابُه أو أيُّ فشلٍ ⇒ الملصقُ الأصليّ بلا علامة — لا شيءَ ينكسر.
 */

const BUDGET_MS = 700;
const MAX_CANDIDATES = 6;
const THUMB = "w92";

type Sharp = (typeof import("sharp"))["default"];
let sharpMod: Promise<Sharp | null> | null = null;
function loadSharp(): Promise<Sharp | null> {
  sharpMod ??= import("sharp").then((m) => m.default).catch(() => null);
  return sharpMod;
}

async function toneOf(path: string): Promise<PosterTone | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  try {
    const res = await fetch(`${IMG}/${THUMB}${path}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buf).resize(12, 18, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    return posterTone(data);
  } catch {
    return null;
  }
}

async function compute(media: "tv" | "movie", id: number, path: string, locale: "ar" | "en"): Promise<{ path: string; dark: boolean } | null> {
  const tone = await toneOf(path);
  if (!tone) return null;
  if (!tone.dark) return { path, dark: false };
  const lang = locale === "en" ? "en" : "ar";
  const { posters } = await titleImages(media, id, locale);
  const pool = posters
    .filter((p) => p.file_path !== path && (p.iso_639_1 === lang || p.iso_639_1 === "en" || !p.iso_639_1))
    .slice(0, MAX_CANDIDATES);
  const tones = await Promise.all(pool.map(async (p) => ({ path: p.file_path, tone: await toneOf(p.file_path) })));
  return pickVivid(
    { path, tone },
    tones.filter((c): c is { path: string; tone: PosterTone } => c.tone !== null),
  );
}

/** الفشلُ لا يُخبّأ (`null` ⇒ رمي): نريد محاولةً أخرى لا ٣٠ يوماً من «لا أدري» */
const cached = (media: "tv" | "movie", id: number, path: string, locale: "ar" | "en") =>
  unstable_cache(
    async () => {
      const out = await compute(media, id, path, locale);
      if (!out) throw new Error("tone-unavailable");
      return out;
    },
    ["vivid-poster-1", media, String(id), path, locale],
    { revalidate: 60 * 60 * 24 * 30 },
  )();

/**
 * يعدّل الصفوفَ في مكانها: `item.poster_path` بالبديل الملوّن، و`poster_dark` لمن بقي داكناً.
 * صفوفُ القوائم بلا ملصق ⇒ تُترك.
 */
type VividRow = Exclude<CommunityFeedRow, { kind: "talk" }>;

export async function vividizeFeed(all: CommunityFeedRow[], locale: "ar" | "en"): Promise<void> {
  /* 🆕 R58 — منشوراتُ النقاش خارجه: ملصقُها ملصقُ الغرفة كما كُتب، و«النقاش العام» بلا ملصق */
  const rows = all.filter((r): r is VividRow => r.kind !== "talk");
  const byKey = new Map<string, VividRow[]>();
  for (const r of rows) {
    if (r.kind === "comment" && r.item.listId) continue;
    const p = r.item.poster_path;
    if (!p) continue;
    const k = `${r.item.media_type}:${r.item.tmdb_id}:${p}`;
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
      const job = cached(it.media_type, it.tmdb_id, it.poster_path as string, locale).catch(() => null);
      const got = await Promise.race([job, timeout]);
      if (got === "late") {
        pending.push(job);
        return;
      }
      if (!got) return;
      /* نسخةٌ لا تعديلٌ في المكان: العنصرُ نفسُه قد يسكن نواةَ المجتمع المشتركة */
      for (const r of group) {
        if (r.kind === "comment") r.item = { ...r.item, poster_path: got.path };
        else r.item = { ...r.item, poster_path: got.path };
        if (got.dark) r.poster_dark = true;
      }
    }),
  );
  if (pending.length) after(() => Promise.allSettled(pending));
}
