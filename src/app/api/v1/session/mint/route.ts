import { type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { handle, fail } from "@/lib/v1";
import { logSessionMint, sharedLimited } from "@/lib/sharedLimit";
import { ok } from "@/core/contracts/result";
import { sessionCookieParts } from "@/lib/sessionCookie";

/**
 * ====== `POST /api/v1/session/mint` — جلسةٌ مستقلّةٌ للتطبيق (Phase 11-K · K4b) ======
 *
 * **لماذا**: الجلسةُ اليومَ ملكُ الـWebView (D-922) والتطبيقُ يستعير رمزَ وصولها عبر جسر — والجسرُ
 * لا يُجاب والشاشاتُ الأصليّةُ فوقه (`react-native-screens` ينزع الويب، D-1144/D-1146). هنا يأخذ
 * التطبيقُ **جلسةً ثانيةً للمستخدم نفسِه برمزِ تجديدٍ من عائلةٍ منفصلة**، فيجدّدها بنفسه ولا يلمس
 * رمزَ الويب أبداً — عطلُ ٧ سبتمبر (عميلان يدوّران رمزاً واحداً، D-932) لا يعود بالتصميم.
 *
 * 🔑 **الطريقةُ** (قُرئت في مصدر Supabase Auth، ٢٧ سبتمبر): رابطُ دخولٍ يُولَّد بمفتاح الخدمة
 * (`admin/generate_link` — **لا بريدَ يُرسل**) ثمّ يُتحقَّق منه فوراً (`/verify`) في عميلٍ جديد ⇒
 * `issueRefreshToken` ⇒ صفٌّ جديدٌ في `auth.sessions`. **ولا يتوقّف على تفعيل الدخول بالبريد**:
 * ذلك الحارسُ في مسارات المستخدم (`/magiclink` · `/otp` · `/token`) وحدَها.
 *
 * 🔒 **الحرّاس**:
 * - الهويّةُ من `Authorization: Bearer`، **يُتحقَّق منه عند Supabase** (`getUser`).
 * - 🆕 **أو من كوكي جلسة الويب نفسِه** حين يغيب `Bearer` (K4b-c): `fetch` في React Native على أندرويد يمرّ
 *   بمخزن كوكي الـWebView (`ForwardingCookieHandler` ⇢ `CookieManager`)، فالطلبُ يحمل جلسةَ الويب — والجسرُ
 *   لا يُجاب تحت الشاشات الأصليّة (صفرُ رموزٍ من ستّة إقلاعاتٍ على جهاز خالد بعد D-1147). **يُقرأ رمزُ الوصول
 *   من الكوكي ولا يُجدَّد أبداً** (لا `Set-Cookie` ولا لمسَ لرمز تجديد الويب — D-932)، ويُتحقَّق منه كالسابق.
 *   ولهذا البابِ **ترويسةٌ مخصّصةٌ إلزاميّة** (`X-Loopz-App: 1`): متصفّحٌ لا يرسلها من موقعٍ آخر بلا طلبِ
 *   إذنٍ مسبق (CORS preflight) يُرفض — فلا تزويرَ طلبٍ عبر المواقع.
 * - **المستخدمُ المسكوكُ هو صاحبُ الرمز نفسُه**: المعرّفُ يُطابَق مرّتين (الرابط ثمّ الجلسة) — وإلّا
 *   لا شيء يعود. فرمزٌ صالحٌ لا يفتح إلّا حسابَ صاحبه.
 * - لا يُنشئ حساباً أبداً: بلا بريدٍ ⇒ `forbidden` (رابطُ الدخول لبريدٍ غيرِ موجودٍ يصير تسجيلاً).
 * - حدٌّ: ٦ في الساعة لكلِّ مستخدم — التطبيقُ يسكّ مرّةً لكلِّ تثبيتٍ أو بعد خروج. 🆕 A-14: **في القاعدة لا في ذاكرة النسخة**
 *   (`sharedLimited`) — فالستّةُ ستّةٌ مهما تعدّدت النسخ.
 * - 🆕 A-04 (المدقّق ٢١ أكتوبر): **وثلاثٌ في اليوم لكلِّ جلسة ويب** (`session_id` في الرمز): رمزُ وصولٍ مسروقٌ كان يصير جلساتٍ
 *   دائمةً بعدد ما يسمح الحدّ؛ والتطبيقُ يسكّ من جلسة الويب الواحدة مرّةً (وإعادةُ سكٍّ نادرةٌ بعد ضياع المملوكة). وكلُّ سكٍّ
 *   سطرٌ في `session_mints` بعمر الرمز — **القياسُ قبل أيِّ شرطٍ على العمر**.
 * - الردُّ `no-store` ولا يُسجَّل؛ والأخطاءُ بلا نصِّ Supabase.
 *
 * ⚖️ **أثرٌ جانبيٌّ واحدٌ مقصود**: سطرُ «دخول» في سجلّ تدقيق Supabase. ويُمسح رمزُ الاستعادة المؤقّت
 * في اللحظة نفسها (`user.Recover`). لا هويّةَ بريدٍ تُضاف للحساب.
 */
export const dynamic = "force-dynamic";

type Minted = { access_token: string; refresh_token: string; expires_at: number; user_id: string };

export async function POST(req: NextRequest) {
  return handle<Minted>(async () => {
    const auth = req.headers.get("authorization") ?? "";
    let token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token && req.headers.get("x-loopz-app") === "1") token = cookieAccess(req);
    if (token.split(".").length !== 3) return fail("unauthenticated");

    const admin = await createServiceClient();
    const who = await admin.auth.getUser(token);
    const user = who.data.user;
    if (who.error || !user) return fail("unauthenticated");
    const rl = await sharedLimited(`mint:${user.id}`, 6, 60 * 60_000);
    if (rl) return rl;
    const claims = jwtClaims(token);
    if (claims.sessionId) {
      const rs = await sharedLimited(`mint-s:${claims.sessionId}`, 3, 24 * 60 * 60_000);
      if (rs) return rs;
    }
    if (!user.email) return fail("forbidden");

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const hash = link.data?.properties?.hashed_token;
    if (link.error || !hash || link.data.user?.id !== user.id) return fail("internal");

    const fresh = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const v = await fresh.auth.verifyOtp({ type: "magiclink", token_hash: hash });
    const s = v.data.session;
    if (v.error || !s || s.user.id !== user.id || !s.refresh_token || !s.expires_at) return fail("internal");

    await logSessionMint({
      userId: user.id,
      sessionId: claims.sessionId,
      via: auth.startsWith("Bearer ") ? "bearer" : "cookie",
      tokenAgeS: claims.iat ? Math.max(0, Math.round(Date.now() / 1000) - claims.iat) : null,
    });
    return ok({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: user.id }, []);
    /* D-1341 — يحتاجه من لم يُتمّ الترحيب: لا يُسأل عن الختم */
  }, { open: true });
}

/** رمزُ الوصول من كوكي `@supabase/ssr` (مقطَّعاً أو لا، وبادئةُ `base64-`) — قراءةٌ فقط، والتحقّقُ بعدها عند Supabase */
function cookieAccess(req: NextRequest): string {
  try {
    let raw = sessionCookieParts(req.cookies.getAll()).join("");
    if (!raw) return "";
    if (raw.startsWith("base64-")) raw = Buffer.from(raw.slice(7), "base64").toString("utf8");
    const t = (JSON.parse(raw) as { access_token?: unknown } | null)?.access_token;
    return typeof t === "string" ? t : "";
  } catch {
    return "";
  }
}

/**
 * 🆕 A-04 — `session_id` و`iat` من حمولة الرمز. **قراءةٌ بلا تحقّق** وهي آمنةٌ هنا وحدَها: تُقرأ بعد أن قبل `getUser`
 * الرمزَ نفسَه عند Supabase، فالحمولةُ حمولتُه. ومعرّفٌ ليس بشكل UUID يُهمل (لا مفتاحَ حدٍّ من نصٍّ حرّ).
 */
function jwtClaims(token: string): { sessionId: string | null; iat: number | null } {
  try {
    const body = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { session_id?: unknown; iat?: unknown };
    const sid = typeof body.session_id === "string" && /^[0-9a-f-]{36}$/i.test(body.session_id) ? body.session_id : null;
    const iat = typeof body.iat === "number" && Number.isFinite(body.iat) ? body.iat : null;
    return { sessionId: sid, iat };
  } catch {
    return { sessionId: null, iat: null };
  }
}
