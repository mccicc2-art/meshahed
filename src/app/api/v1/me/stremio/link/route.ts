import type { NextRequest } from "next/server";
import { issueStremioToken, revokeStremioToken } from "@/lib/stremio";
import { linkGate } from "@/lib/deviceLinks";
import { sharedLimited } from "@/lib/sharedLimit";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok, type Result } from "@/core/contracts/result";
import type { StremioLinkBody, StremioLinkResult } from "@/core/contracts/stremio";

/**
 * `POST /api/v1/me/stremio/link` `{action: "issue" | "revoke"}` — رابطُ إضافة Loopz في Stremio.
 * 🔑 **الرابطُ يُعاد مرّةً واحدة** (الرمزُ لا يُحفظ عندنا، بصمتُه فقط)، و«أصدر» يُسقط القديم — فمن نسخ رابطاً في مكانٍ خطأ
 * يصدر غيرَه. والإصدارُ بخانةٍ في مدار العضو (هجرة ٢٣٧: المجانيُّ جهازٌ، بلس خمسة)؛ الإلغاءُ لكلِّ أحد.
 * ⚖️ الحدُّ في القاعدة (A-14): بابٌ يصنع رموزاً حيّةً لا يُعدّ في ذاكرة النسخة.
 */
export async function POST(req: NextRequest) {
  return handle(async (): Promise<Result<StremioLinkResult>> => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: StremioLinkBody;
    try {
      body = (await req.json()) as StremioLinkBody;
    } catch {
      return fail("invalid_input");
    }
    if (body?.action === "revoke") {
      if (!(await revokeStremioToken(auth.user.id))) return fail("upstream");
      return ok<StremioLinkResult>({ linked: false }, ["me:stremio", "me:links"]);
    }
    if (body?.action !== "issue") return fail("invalid_input");
    /* 🆕 هجرة ٢٣٧ — خانةٌ في المدار بدل «بلس وحده»: المجانيُّ يربط جهازاً واحداً */
    const gate = await linkGate(auth.user.id, "stremio");
    if (gate) return gate;
    const rl = await sharedLimited(`stremio-link:${auth.user.id}`, 10, 60 * 60_000);
    if (rl) return rl;
    const out = await issueStremioToken(auth.user.id);
    if (!out.ok) return out.reason === "limit" ? fail("conflict", { message_key: "apiLinkSlotsFull" }) : fail("upstream");
    const token = out.token;
    const origin = new URL(req.url).origin;
    const manifest = `${origin}/api/v1/stremio/${token}/manifest.json`;
    const result: StremioLinkResult = {
      linked: true,
      manifest_url: manifest,
      install_url: manifest.replace(/^https?:\/\//, "stremio://"),
      web_install_url: `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifest)}`,
    };
    return ok(result, ["me:stremio", "me:links"]);
  });
}
