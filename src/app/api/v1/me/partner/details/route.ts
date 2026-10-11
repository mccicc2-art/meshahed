import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { savePartnerDetails } from "@/lib/actions";
import type { PartnerDetailsBody } from "@/core/contracts/profile";

/**
 * `POST /api/v1/me/partner/details` — **بياناتُ تحويل الشريك** (🆕 D-1362 · V-C · C7 · الدفعة ٢).
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`savePartnerDetails` — D-858): آيبانٌ سعوديٌّ حصراً، تطبيعُ الجوال، وحدُّه (٥ في الدقيقة) فيه؛
 * **والحَكَمُ قيودُ الجدول وRLS** (شريكٌ قائمٌ على صفّه وحدَه — D-011). هذا الملفُّ قشرةٌ تنقل الحقولَ وتسمّي السببَ بمفتاحه.
 * ⚖️ **لا يُكتب الآيبانُ في سجلٍّ ولا في ردّ**: الردُّ `{done:true}`، والقراءةُ من `GET …/partner` لصاحبها.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: Partial<PartnerDetailsBody>;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (!body || typeof body !== "object") return fail("invalid_input");
    try {
      await savePartnerDetails({
        iban: String(body.iban ?? ""),
        bankName: String(body.bankName ?? ""),
        accountName: String(body.accountName ?? ""),
        phone: String(body.phone ?? ""),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Saudi IBAN")) return fail("invalid_input", { field: "iban", message_key: "apiPartnerIban" });
      if (msg.includes("Bank and account")) return fail("invalid_input", { field: "bankName", message_key: "apiPartnerBank" });
      if (msg.includes("Saudi mobile")) return fail("invalid_input", { field: "phone", message_key: "apiPartnerPhone" });
      if (msg.includes("Could not save")) return fail("internal", { message_key: "apiPartnerSave" });
      throw e; /* «غير مسجّل» و«طلبات كثيرة» يترجمهما `handle` */
    }
    return ok({ done: true }, []);
  });
}
