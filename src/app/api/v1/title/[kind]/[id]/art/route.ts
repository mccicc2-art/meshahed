import type { NextRequest } from "next/server";
import { titleArtOptions, canUseArt } from "@/lib/actions";
import { getUserId } from "@/lib/data";
import { handle, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { TitleArtOptionsPayload } from "@/core/contracts/title";

/**
 * `GET /api/v1/title/{kind}/{id}/art` — صورُ العمل لمنتقي «غلاف العمل» أصليّاً (D-1020، قرارُ أحمد
 * «ليش ما تخلّي آرت وورك تطبيق أصليّ؟»). نفسُ `titleArtOptions` (٢٤ ملصقاً و١٢ خلفيّة بلغة
 * القارئ)، و`plus` يقول هل يستطيع الحفظ — الحارسُ في الخادم كما في الويب (`canUseArt`).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; id: string }> }) {
  return handle(
    async () => {
      const { kind, id } = await ctx.params;
      const tid = positiveInt(id);
      if (!tid || (kind !== "tv" && kind !== "movie")) return fail("invalid_input");
      const uid = await getUserId();
      if (!uid) return fail("unauthenticated");
      const lim = limited(`v1:title:art:${uid}`, 30, 60_000);
      if (lim) return lim;
      const [opts, plus] = await Promise.all([titleArtOptions(tid, kind), canUseArt()]);
      const payload: TitleArtOptionsPayload = { posters: opts.posters, backdrops: opts.backdrops, plus };
      return ok(payload);
    },
    { cacheControl: "private, no-store" },
  );
}
