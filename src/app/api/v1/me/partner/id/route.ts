import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handle, requireUser, fail, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { PartnerIdStartBody, PartnerIdStartPayload } from "@/core/contracts/profile";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * `POST /api/v1/me/partner/id` — **رابطُ رفعٍ موقَّعٌ لوثيقة الهويّة** (🆕 D-1362 · V-C · C7 · الدفعة ٢).
 *
 * 🔑 **الملفُّ لا يمرّ من هنا** — كما في الويب (`PartnerIdUpload`: «يصعد من العميل إلى المخزن مباشرةً، لا عبر جسم خادمٍ يحدّه
 * المقاس»): جسمُ دالّة Vercel يقف عند ٤٫٥ ميجابايت والحدُّ الموعودُ ٨. التطبيقُ لا يحمل جلسةَ Supabase في عميلٍ، فيأخذ من هنا
 * **رابطاً موقَّعاً لمسارٍ واحدٍ في مجلّده** (`<uid>/id-<ts>.<ext>`) ويرفع إليه، ثمّ يثبّت المسارَ بـ`…/id/confirm`.
 * ⚖️ **الحَكَمُ المخزن**: الرابطُ يُصنع بجلسة العضو، فسياسةُ الإدراج (`partner id write own`: مجلّدُه وهو شريكٌ قائم) هي التي
 * تأذن أو ترفض — وحدُّ المخزن (٨MB) وأنواعُه الأربعة يُفرضان عند الرفع نفسِه. فحصُ النوع والمقاس هنا تهذيبٌ للرسالة (D-011).
 */
export async function POST(req: NextRequest) {
  return handle<PartnerIdStartPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const slow = limited(`v1:partner-id:${auth.user.id}`, 10, 60_000);
    if (slow) return slow;
    let body: Partial<PartnerIdStartBody>;
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    const ext = typeof body?.type === "string" ? TYPES[body.type] : undefined;
    if (!ext) return fail("invalid_input", { field: "file", message_key: "apiPartnerIdType" });
    if (typeof body.size !== "number" || !(body.size > 0) || body.size > MAX_BYTES) {
      return fail("invalid_input", { field: "file", message_key: "apiPartnerIdSize" });
    }
    const supabase = await createClient();
    const path = `${auth.user.id}/id-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from("partner-ids").createSignedUploadUrl(path);
    /* رفضُ السياسة (ليس شريكاً) ورفضُ المخزن وجهٌ واحدٌ للعضو: لم يُفتح له بابُ رفع */
    if (error || !data?.signedUrl) return fail("forbidden", { message_key: "apiPartnerIdUpload" });
    return ok({ upload_url: data.signedUrl, path }, []);
  });
}
