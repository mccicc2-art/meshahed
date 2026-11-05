import type { NextRequest } from "next/server";
import { issueHomeServerToken, revokeHomeServerToken } from "@/lib/homeServer";
import { linkGate } from "@/lib/deviceLinks";
import { sharedLimited } from "@/lib/sharedLimit";
import { handle, requireUser, fail } from "@/lib/v1";
import { isHomeKind } from "@/core/deviceLinks";
import { ok, type Result } from "@/core/contracts/result";
import type { HomeServerLinkBody, HomeServerLinkResult } from "@/core/contracts/homeServer";

/**
 * `POST /api/v1/me/home-server/link` `{action: "issue" | "revoke"}` — رابطُ Webhook سيرفرات البيت (هجرة ٢٣٥).
 * 🔑 **كرابط Stremio بحرفه**: يُعاد مرّةً واحدة، و«أصدر» يُسقط القديم، والإصدارُ بخانةٍ في المدار (٢٣٧)، والإلغاءُ لكلِّ أحد،
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
    /* 🆕 هجرة ٢٣٧ — `server` يختار رابطَ النوع؛ وغيابُه (تطبيقُ 1.13.x) هو الرابطُ القديمُ المشترك كما كان */
    if (body?.server != null && !isHomeKind(body.server)) return fail("invalid_input");
    const server = body?.server ?? null;
    if (body?.action === "revoke") {
      if (!(await revokeHomeServerToken(auth.user.id, server))) return fail("upstream");
      return ok<HomeServerLinkResult>({ linked: false }, ["me:home-server", "me:links"]);
    }
    if (body?.action !== "issue") return fail("invalid_input");
    const gate = await linkGate(auth.user.id, server ?? "unbound");
    if (gate) return gate;
    const rl = await sharedLimited(`home-server-link:${auth.user.id}`, 10, 60 * 60_000);
    if (rl) return rl;
    const out = await issueHomeServerToken(auth.user.id, server);
    if (!out.ok) return out.reason === "limit" ? fail("conflict", { message_key: "apiLinkSlotsFull" }) : fail("upstream");
    const token = out.token;
    const origin = new URL(req.url).origin;
    return ok<HomeServerLinkResult>({ linked: true, webhook_url: `${origin}/api/v1/home-server/${token}` }, ["me:home-server", "me:links"]);
  });
}
