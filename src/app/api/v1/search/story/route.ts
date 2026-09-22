import type { NextRequest } from "next/server";
import { handle, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { aiStorySearch } from "@/lib/actions";
import type { SearchStoryBody, SearchStoryPayload } from "@/core/contracts/search";

/**
 * `POST /api/v1/search/story` — «ابحث بالوصف» للتطبيق (Phase 11-G · G3).
 *
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`aiStorySearch`): جلسةٌ إلزاميّة، دلوٌ ٦/دقيقة،
 * تثبيتٌ بـTMDB، وذوقُ صاحبِ الحساب (D-076). رميُه «غير مسجّل»/«طلبات كثيرة»
 * يترجمه `handle` إلى رمزه — فلا حارسَ ثانياً هنا.
 *
 * 🔑 **`reason` بدل رفض**: وصفٌ قصيرٌ أو نتيجةٌ خاوية حالتا منتجٍ لا خطأان —
 * الواجهةُ تكتب نصَّها (`aiSearchHint`/`aiSearchEmpty`) كما يفعل الويب.
 */
export async function POST(req: NextRequest) {
  return handle<SearchStoryPayload>(async () => {
    const body = (await req.json().catch(() => null)) as SearchStoryBody | null;
    const description = typeof body?.description === "string" ? body.description : "";
    if (!description.trim()) return fail("invalid_input", { field: "description" });

    const res = await aiStorySearch(description);
    if (!res.ok) return ok({ items: [], reason: res.reason, fallback: false });
    return ok({
      items: res.results.map((r) => ({
        id: r.id,
        mediaType: r.kind === "tv" ? "tv" : "movie",
        title: r.title,
        titleSecondary: r.titleSecondary ?? null,
        year: r.year ?? null,
        poster: r.poster,
        reason: r.reason ?? null,
      })),
      reason: res.results.length ? null : "empty",
      fallback: !!res.fallback,
    });
  });
}
