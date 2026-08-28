import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 🆕 بابُ الشريك (D-770) — `loopztv.com/p/<code>`.
 *
 * توأمُ `/join/<code>` بالضبط — **كوكي واحدةٌ للنَسبَين** (`loopz_ref`):
 * جسمُ `claim_referral` (الهجرة ١٥٥) يعرف مصدرَ الكود بنفسه — في
 * `referral_codes` صديقٌ وفي `partners` شريكٌ — **فلا كوكي ثانية تفترق
 * عن أختها عند أوّل تعديل** (روح D-145). آخرُ رابطٍ يضغطه الزائر يكتب
 * فوق سابقه (آخرُ نقرةٍ تغلب — حكمُ النموذج النهائيّ).
 *
 * والعدُّ اليوميُّ (`bump_partner_click`): صفٌّ مجمَّعٌ `(شريك، يوم)`
 * بلا هويّةِ زائرٍ ولا عنوانِ IP — عدّادٌ يعرضه الشريكُ في لوحته لا
 * سجلُّ تتبّع. **ويُنتظر لا يُطلق**: على Vercel يتجمّد التنفيذُ بعد
 * إرسال الردّ فوعدٌ طليقٌ يموت قبل أن يصل — وثمنُ الانتظار upsert
 * مفهرسٌ واحد. وسقوطُه لا يعطّل التحويل: الزيارةُ أهمُّ من عدِّها.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const clean = String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const { origin } = new URL(request.url);
  const res = NextResponse.redirect(`${origin}/`);
  if (clean) {
    res.cookies.set("loopz_ref", clean, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    try {
      const supabase = await createClient();
      // كودٌ غيرُ موجودٍ صفرٌ صامتٌ في جسم الدالّة — لا شاشةَ خطأٍ لرابطٍ مكسور
      await supabase.rpc("bump_partner_click", { p_code: clean });
    } catch {
      /* عدٌّ تعذّر — التحويلُ يمضي والعدُّ يفوت */
    }
  }
  return res;
}
