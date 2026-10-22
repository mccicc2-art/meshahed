import { handle, requireUser, fail } from "@/lib/v1";
import { sharedLimited } from "@/lib/sharedLimit";
import { getT } from "@/lib/locale";
import { ok } from "@/core/contracts/result";
import { issueWidgetToken } from "@/lib/widgetToken";

/**
 * `POST /api/v1/widget/token` — رمزُ ✓ لهذا الجهاز (W14)، **بجلسة العضو** ويُعاد مرّةً واحدة.
 * التطبيقُ يطلبه حين لا يجد ملفَّ `token` في مجلّد الودجت، ويكتبه هناك — والجلسةُ نفسُها لا تخرج من التطبيق.
 * `upstream` = الجدولُ لم يُنشأ بعد (هجرة ٢٠١): التطبيقُ يسكت ويعيد المحاولةَ في الجلب التالي.
 */
export async function POST() {
  return handle(async () => {
    const u = await requireUser();
    if (!u.ok) return u;
    /* 🆕 A-14 — الحدُّ في القاعدة لا في ذاكرة النسخة: رمزٌ يُصدر بلا نهايةٍ عبر النسخ رموزٌ حيّة */
    const rl = await sharedLimited(`wtoken:${u.user.id}`, 10, 60 * 60_000);
    if (rl) return rl;
    const { locale } = await getT();
    const token = await issueWidgetToken(u.user.id, locale);
    if (!token) return fail("upstream");
    return ok({ token });
  });
}
