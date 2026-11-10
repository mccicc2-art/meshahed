import { NextResponse } from "next/server";

/**
 * 🆕 بابُ الدعوة (D-768) — `loopztv.com/join/<code>`.
 *
 * لا صفحةَ هنا: الكودُ يُحفظ في كوكي ٣٠ يوماً ويُحوَّل الزائرُ إلى
 * الجذر (صفحةُ الهبوط لغير المسجَّل). النسبةُ نفسُها تقع بعد تمامِ
 * الدخول في ردهة OAuth (`claimReferralFromCookie`) — **فمن فتح الرابطَ
 * على جوّاله وسجّل مساءً لا تضيع دعوتُه** (مهلةُ الحرّاس ٤٨ ساعةً في
 * جسم `claim_referral`).
 *
 * التنقيةُ هنا شكليّةٌ فقط (أبجديةُ الأكواد `A-Z0-9` بطول ≤ ١٠) —
 * والحكمُ الحقيقيُّ في جسم الدالة (D-011/D-314: التنقيةُ حيث الباب).
 * كودٌ غيرُ موجودٍ يقع صفراً صامتاً هناك، فلا شاشةَ خطأٍ لرابطٍ مكسور —
 * الزائرُ يصل إلى صفحة الهبوط ويكمل طريقَه.
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
  /* 🆕 المهمة ٣٧٠ — **إلى صفحة الدعوة لا إلى الجذر**: كان الزائرُ يصل صفحةَ الهبوط بلا أن يعرف من دعاه، ومن على جوّاله
     لا يعود منها إلى التطبيق بالكود. الصفحةُ تسمّي الداعي وتحمل زرَّي المتجر و«افتح الدعوة في التطبيق». والكوكي باقٍ كما كان
     لمن يُكمل في المتصفّح (`/auth/callback`). */
  /* 🆕 `?to=login` — «أو أكمل في المتصفح» في صفحة الدعوة يمرّ من هنا ليُكتب الكوكي ثمّ يذهب إلى الدخول */
  const toLogin = new URL(request.url).searchParams.get("to") === "login";
  const res = NextResponse.redirect(toLogin ? `${origin}/login` : clean ? `${origin}/invite/${clean}` : `${origin}/`);
  if (clean) {
    res.cookies.set("loopz_ref", clean, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}
