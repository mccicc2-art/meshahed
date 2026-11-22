import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { applyImportChunk } from "@/lib/actions";
import type { ImportPayload } from "@/core/importer";

/**
 * `POST /api/v1/me/import/apply` — **كتابةُ دفعةٍ مستوردةٍ في المكتبة** (🆕 D-1369 · V-C · C6).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`applyImportChunk`): خمسةُ مسلسلاتٍ أو ستّون فيلماً في الطلب، وكلُّ كتابةٍ `upsert` —
 * فمن انقطع استيرادُه (خرج من التطبيق) يعيده من أوّله بلا صفٍّ مكرّر، وما كُتب قبل الانقطاع باقٍ.
 * ⚖️ **بلا وسوم**: الإبطالُ مرّةٌ واحدةٌ عند `…/finish`، لا مع كلِّ دفعةٍ من مئتين — وإلّا أُعيد جلبُ الرئيسيّة مئتي مرّة تحت شريط التقدّم.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: Partial<ImportPayload>;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || typeof body !== "object") return fail("invalid_input");
    const shows = Array.isArray(body.shows) ? body.shows : [];
    const movies = Array.isArray(body.movies) ? body.movies : [];
    /* 🆕 قوائمُ IMDb — اختياريّةٌ: تطبيقٌ لم يصله التحديث لا يرسلها */
    const lists = Array.isArray(body.lists) ? body.lists : [];
    /* 🆕 Bingers — المفضّلةُ واسمُها و«ما في Loopz يبقى» (`keep`): اختياريّةٌ كالقوائم، وتُمرَّر بأنواعها الصريحة لا بالجسم كلِّه */
    const favorites = Array.isArray(body.favorites) ? body.favorites : [];
    const favoritesName = typeof body.favoritesName === "string" ? body.favoritesName : undefined;
    /* 🆕 T507 — مصدرُ الآراء يُمرَّر بقيمته المعروفة وحدها؛ والآراءُ نفسُها تُنقّى في `applyImportChunk` (نصّاً ويوماً) */
    const reviewFrom = body.reviewFrom === "letterboxd" || body.reviewFrom === "auto" ? body.reviewFrom : undefined;
    const done = await applyImportChunk({ shows, movies, lists, favorites, favoritesName, keep: body.keep === true, reviewFrom });
    return ok(done, []);
  });
}
