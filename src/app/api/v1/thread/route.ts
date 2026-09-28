import type { NextRequest } from "next/server";
import { getUserId } from "@/lib/data";
import { talkPayload, postPayload, reviewPayload } from "@/lib/threadCore";
import { handle, limited, fail, positiveInt } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { ThreadPayload } from "@/core/contracts/thread";

/**
 * `GET /api/v1/thread?t=talk&kind=tv&id=1` · `?t=post&key=…` · `?t=review&kind=tv&id=1&user=<uuid>` —
 * شاشةُ «النقاش» الأصليّة (Phase 11-M · M3): رأسُ الباب وخيطُه من الدوالّ التي ترسم صفحاتِ الويب الثلاث
 * (`lib/threadCore.ts`). **الزائرُ يقرأ** كما يقرأ الويبَ بلا حساب (D-221)، والكتابةُ لصاحب الجلسة.
 */
export async function GET(req: NextRequest) {
  return handle<ThreadPayload>(async () => {
    const sp = req.nextUrl.searchParams;
    const uid = await getUserId();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
    const lim = limited(`v1:thread:${uid ?? ip}`, 90, 60_000);
    if (lim) return lim;
    const t = sp.get("t");
    const kind = sp.get("kind");
    const media = kind === "tv" || kind === "movie" ? kind : null;
    if (t === "talk") {
      const id = positiveInt(sp.get("id"));
      if (!id || !media) return fail("invalid_input");
      return ok(await talkPayload(id, media));
    }
    if (t === "post") {
      const key = (sp.get("key") ?? "").trim().slice(0, 120);
      if (!key) return fail("invalid_input");
      const p = await postPayload(key);
      return p ? ok(p) : fail("not_found");
    }
    if (t === "review") {
      const id = positiveInt(sp.get("id"));
      const user = (sp.get("user") ?? "").trim();
      if (!id || !media || !/^[0-9a-f-]{36}$/i.test(user)) return fail("invalid_input");
      const p = await reviewPayload(id, media, user);
      return p ? ok(p) : fail("not_found");
    }
    return fail("invalid_input");
  });
}
