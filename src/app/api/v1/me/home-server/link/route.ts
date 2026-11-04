import type { NextRequest } from "next/server";
import { getProfile } from "@/lib/data";
import { issueHomeServerToken, revokeHomeServerToken } from "@/lib/homeServer";
import { sharedLimited } from "@/lib/sharedLimit";
import { handle, requireUser, fail } from "@/lib/v1";
import { isPlus } from "@/core/plan";
import { ok, type Result } from "@/core/contracts/result";
import type { HomeServerLinkBody, HomeServerLinkResult } from "@/core/contracts/homeServer";

/**
 * `POST /api/v1/me/home-server/link` `{action: "issue" | "revoke"}` — رابطُ Webhook سيرفرات البيت (هجرة ٢٣٥).
 * 🔑 **كرابط Stremio بحرفه**: يُعاد مرّةً واحدة، و«أصدر» يُسقط القديم، والإصدارُ لـLoopz+ وحده، والإلغاءُ لكلِّ أحد،
 * والحدُّ في القاعدة (A-14) — بابٌ يصنع رموزاً حيّة.
 */
export async function POST(req: NextRequest) {
  return handle(async (): Promise<Result<HomeServerLinkResult>> => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: HomeServerLinkBody;
    try {
      body = (await req.json()) as HomeServerLinkBody;
    } catch {
      return fail("invalid_input");
    }
    if (body?.action === "revoke") {
      if (!(await revokeHomeServerToken(auth.user.id))) return fail("upstream");
      return ok<HomeServerLinkResult>({ linked: false }, ["me:home-server"]);
    }
    if (body?.action !== "issue") return fail("invalid_input");
    if (!isPlus(await getProfile())) return fail("forbidden");
    const rl = await sharedLimited(`home-server-link:${auth.user.id}`, 10, 60 * 60_000);
    if (rl) return rl;
    const token = await issueHomeServerToken(auth.user.id);
    if (!token) return fail("upstream");
    const origin = new URL(req.url).origin;
    return ok<HomeServerLinkResult>({ linked: true, webhook_url: `${origin}/api/v1/home-server/${token}` }, ["me:home-server"]);
  });
}
