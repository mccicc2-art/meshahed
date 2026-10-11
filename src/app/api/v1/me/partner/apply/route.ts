import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { applyPartner } from "@/lib/actions";
import type { PartnerApplyBody } from "@/core/contracts/profile";

/**
 * `POST /api/v1/me/partner/apply` — **طلبُ الانضمام إلى Loopz Partners** (🆕 D-1361 · V-C · C7 · الدفعة ١).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`applyPartner` — D-770/D-855): القصُّ وشرطُ `https` وحدُّه (٥ في الدقيقة) فيه، **والحارسُ
 * الحقيقيُّ في جسم `apply_partner`** (شرطا X وبلس · طلبٌ موافَقٌ عليه لا يُستبدل). يخدم التقديمَ الأوّل وتعديلَ طلبٍ قيد
 * المراجعة وإعادةَ التقديم بعد الرفض — كما في الصفحة.
 * 🔴 **`terms: true` شرط** كما يشترطه نموذجُ الويب (`submitApplication`) — الواجهةُ تعطّل الزرَّ، وهذا حزامُ الخادم.
 * ⚖️ **الأسبابُ الثلاثةُ تصل بمفاتيحها** لا «خللٌ عامّ»: الفعلُ يرمي نصّاً باللغتين معاً، والتطبيقُ يقول سببَه بلغة صاحبه.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: Partial<PartnerApplyBody>;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || typeof body !== "object") return fail("invalid_input");
    if (body.terms !== true) return fail("invalid_input", { field: "terms" });
    try {
      await applyPartner({
        channelUrl: String(body.channelUrl ?? ""),
        contentType: String(body.contentType ?? ""),
        platforms: String(body.platforms ?? ""),
        followersRange: String(body.followersRange ?? ""),
        country: String(body.country ?? ""),
        contentLanguage: String(body.contentLanguage ?? ""),
        reason: String(body.reason ?? ""),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("https://")) return fail("invalid_input", { field: "channelUrl", message_key: "apiPartnerChannel" });
      if (msg.includes("Requirements")) return fail("forbidden", { message_key: "apiPartnerRequirements" });
      if (msg.includes("Could not submit")) return fail("internal", { message_key: "apiPartnerSubmit" });
      throw e; /* «غير مسجّل» و«طلبات كثيرة» يترجمهما `handle` */
    }
    return ok({ done: true }, []);
  });
}
