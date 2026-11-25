import type { NextRequest } from "next/server";
import { linkPlatform, recordPlatformSync, revokePlatform } from "@/lib/linkTokens";
import { sharedLimited } from "@/lib/sharedLimit";
import { handle, requireUser, limited, fail } from "@/lib/v1";
import { ok, type Result } from "@/core/contracts/result";
import type { NetflixLinkBody, PlatformLinkResult } from "@/core/contracts/deviceLinks";

/**
 * 🆕 `POST /api/v1/me/links/netflix` — ربطُ نتفليكس ومزامنتُه وفكُّه (هجرة ٢٦٥، خطّة `PLAN-NETFLIX-SYNC.md`).
 *
 * 🔑 **لا يصل هنا شيءٌ من نتفليكس**: لا كلمةَ مرور ولا كوكي ولا سجلّ. الدخولُ والقراءةُ في متصفّح التطبيق على جهاز العضو،
 * وما يُطابَق ويُكتب في المكتبة يمرّ بمسار الاستيراد الواحد (`me/import/resolve` · `me/import/apply` بمصدر `netflix`). وهنا الحالُ
 * وحده: الربطُ بخانته وملفّه الشخصيّ و«من الآن فقط»، و«زامنتُ الآن حتى هذه المشاهدة»، والفكّ.
 * ⚖️ **الربطُ لـLoopz+** (أحمد ٢١ نوفمبر «٣ب») ⇐ المجّانيّ `forbidden`؛ والخانةُ الممتلئة `conflict` بمفتاح «خانتك ممتلئة»
 * كأبواب الأجهزة. والفكُّ لكلِّ أحد (اشتراكٌ انتهى يقدر على فكّ ربطه).
 */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export async function POST(req: NextRequest) {
  return handle(async (): Promise<Result<PlatformLinkResult>> => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: NetflixLinkBody;
    try {
      body = (await req.json()) as NetflixLinkBody;
    } catch {
      return fail("invalid_input");
    }
    const uid = auth.user.id;
    const tags = ["me:links"] as const;

    if (body?.action === "revoke") {
      const rl = await sharedLimited(`netflix-link:${uid}`, 30, 60 * 60_000);
      if (rl) return rl;
      if (!(await revokePlatform(uid, "netflix"))) return fail("upstream");
      return ok<PlatformLinkResult>({ linked: false }, [...tags]);
    }

    if (body?.action === "link") {
      if (typeof body.import_all !== "boolean") return fail("invalid_input", { field: "import_all" });
      if (body.profile_label != null && typeof body.profile_label !== "string") return fail("invalid_input", { field: "profile_label" });
      const rl = await sharedLimited(`netflix-link:${uid}`, 30, 60 * 60_000);
      if (rl) return rl;
      const out = await linkPlatform(uid, "netflix", body.profile_label ?? null, body.import_all);
      if (!out.ok) {
        if (out.reason === "plus") return fail("forbidden");
        if (out.reason === "limit") return fail("conflict", { message_key: "apiLinkSlotsFull" });
        return fail("upstream");
      }
      return ok<PlatformLinkResult>({ linked: true }, [...tags]);
    }

    if (body?.action === "sync") {
      const at = body.last_item_at;
      if (at !== null && (typeof at !== "string" || !ISO.test(at) || Number.isNaN(Date.parse(at)))) return fail("invalid_input", { field: "last_item_at" });
      /* لا يكتب إلا ختمَ وقت — والحدُّ في الذاكرة يكفي: المزامنةُ عند الفتح كلَّ ستِّ ساعات، و«زامن الآن» بيد العضو */
      const lim = limited(`v1:netflix-sync:${uid}`, 20, 60_000);
      if (lim) return lim;
      if (!(await recordPlatformSync(uid, "netflix", at))) return fail("conflict");
      return ok<PlatformLinkResult>({ linked: true }, [...tags]);
    }

    return fail("invalid_input");
  });
}
