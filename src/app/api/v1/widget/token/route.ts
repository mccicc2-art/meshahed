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
export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser();
    if (!u.ok) return u;
    /* 🆕 A-05 — `{ scope: "dm" }` رمزٌ ثانٍ لردود الإشعار (أندرويد، بناء 1.14.0)؛ بلا جسمٍ أو بغيره رمزُ الودجت كما كان */
    const body = (await req.json().catch(() => null)) as { scope?: unknown } | null;
    const scope = body?.scope === "dm" ? "dm" : "widget";
    /* 🆕 A-14 — الحدُّ في القاعدة لا في ذاكرة النسخة: رمزٌ يُصدر بلا نهايةٍ عبر النسخ رموزٌ حيّة — ودلوٌ لكلِّ نطاق */
    const rl = await sharedLimited(scope === "dm" ? `wtoken-dm:${u.user.id}` : `wtoken:${u.user.id}`, 10, 60 * 60_000);
    if (rl) return rl;
    const { locale } = await getT();
    const token = await issueWidgetToken(u.user.id, locale, scope);
    if (!token) return fail("upstream");
    return ok({ token });
  });
}
