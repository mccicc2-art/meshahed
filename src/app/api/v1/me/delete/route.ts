import type { NextRequest } from "next/server";
import { handle, requireUser, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { deleteMyAccount } from "@/lib/actions";

/**
 * `POST /api/v1/me/delete` — **حذفُ الحساب من التطبيق** (🆕 D-1358 · Phase 11-V · V-C · C2، قرارُ أحمد ١١ أكتوبر: «نفذ»). كان صفُّ
 * «حذف الحساب» في الإعدادات الأصليّة يفتح صفحةَ الحساب الويبيّة فيُضغط الصفُّ مرّتين (تسجيلُه: شاشةُ «الحساب» مكرّرة).
 *
 * 🔑 **الفعلُ فعلُ الويب نفسُه** (`deleteMyAccount` — D-1340/D-1350) لا نسخةٌ ثانية: الملفّاتُ عبر Storage بهويّة صاحبها، ثمّ إلغاءُ
 * إذن أبل، ثمّ صفُّ الحساب — **وحدُّه معه** (٣ محاولات في الدقيقة، `requireUser("delete")` داخله). الهويّةُ هويّةُ حامل الرمز
 * وحدَه (`createClient` بالـBearer)؛ لا معرّفَ في الطلب يُحذف به غيرُه.
 * 🔴 **`confirm: "delete"` شرط**: فعلٌ لا رجوعَ فيه لا يُطلقه `POST` فارغٌ أو نداءٌ أخطأ مسارَه. الضغطتان في الشاشة؛ وهذا حزامُ الخادم.
 * ⚖️ **يُعيد سببَه ولا يرميه** كالفعل: `rate_limited` ⇐ «محاولات كثيرة»، و`internal` ⇐ «تعذّر الحذف — حسابك ما زال قائماً».
 * الخروجُ بعد النجاح على الجهاز (`/auth/signout` بطريق زرّ الخروج) — جلسةُ الطبقة كوكيزُها هناك لا هنا.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    let body: { confirm?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return fail("invalid_input");
    }
    if (body?.confirm !== "delete") return fail("invalid_input", { field: "confirm" });
    const res = await deleteMyAccount();
    if (res.error === "busy") return fail("rate_limited");
    if (res.error) return fail("internal");
    return ok({ done: true }, []);
  });
}
