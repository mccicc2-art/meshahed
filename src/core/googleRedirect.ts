/**
 * ====== 🆕 T538 — دخولُ Google على الآيفون يعود إلى `loopztv.com` لا إلى Supabase ======
 *
 * **لماذا** (أحمد ٢٤ نوفمبر «١أ»): الآيفون والآيباد يدخلان بالتحويل لا بنافذة GIS (نافذتُها تبقى بيضاء تحت ITP — انظر
 * `GoogleButton`)، والتحويلُ القديم (`signInWithOAuth`) يعود إلى عنوان Supabase، وGoogle تطبع في شاشة الموافقة صاحبَ عنوان
 * العودة: «to continue to uvgmvrdrxzpudoldjxaa.supabase.co». هنا نطلب من Google **رمزَ الهويّة نفسَه** ونجعل العودةَ إلى
 * صفحةٍ عندنا (`/auth/google`)، فتُنسب الشاشةُ إلى نطاقنا، ثمّ يُسلَّم الرمزُ إلى Supabase كما تفعل نافذةُ GIS على الحاسوب.
 *
 * 🔑 **الرمزُ في جزء `#` من العنوان** (`response_mode` الافتراضيُّ لـ`id_token`): لا يصل خادمَنا ولا سجلّاتِه، والصفحةُ تقرؤه وتمحوه.
 * 🔑 **`state` و`nonce` لا يُستغنى عنهما**: `state` يثبت أنّ العودةَ ردٌّ على طلبٍ بدأ من هذا المتصفّح (لا رابطٌ ملغومٌ وصل
 * العضوَ)، و`nonce` المعمّى يذهب إلى Google والخامُ يبقى معنا لـSupabase — فحصُها له باقٍ مفعَّلاً (`14_Authentication.md`).
 * والاثنان في `sessionStorage` لهذا التبويب وحده، بعمرٍ قصير، ويُمحيان بعد أوّل قراءة.
 *
 * دوالُّ صافية هنا (تُختبر)، والمتصفّحُ في `GoogleButton` وصفحة `app/auth/google`.
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_RETURN_PATH = "/auth/google";
export const GOOGLE_STASH_KEY = "loopz:google-return";
/** عشرُ دقائق تكفي لاختيار حسابٍ والموافقة — وما بعدها طلبٌ قديمٌ لا يُصرف */
export const GOOGLE_STASH_MAX_AGE_MS = 10 * 60_000;

/**
 * الأصولُ المسجَّلُ لها عنوانُ العودة في عميل Google (٢٤ نوفمبر) — ومن سواها (معاينةُ Vercel، `localhost`) يسلك الطريقَ القديم
 * بدل صفحة «redirect_uri_mismatch» لا رجوعَ منها (مراجعةُ الوكيل، البند ٤)
 */
export const GOOGLE_RETURN_ORIGINS = ["https://loopztv.com", "https://www.loopztv.com", "https://meshahed.vercel.app"] as const;

export type GoogleStash ={ state: string; nonce: string; next: string; at: number };

export function googleAuthUrl(o: { clientId: string; origin: string; state: string; hashedNonce: string; locale: string }): string {
  const q = new URLSearchParams({
    client_id: o.clientId,
    redirect_uri: `${o.origin}${GOOGLE_RETURN_PATH}`,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: o.hashedNonce,
    state: o.state,
    /* اختيارُ الحساب دائماً: من له حسابان (D-885) يرى أيّهما يدخل بدل أن يُدخَل بآخر ما استُعمل */
    prompt: "select_account",
    hl: o.locale === "en" ? "en" : "ar",
  });
  return `${GOOGLE_AUTH_URL}?${q.toString()}`;
}

/** ما أعادته Google بعد `#` — رمزٌ أو خطأ، ومعهما `state` */
export function parseGoogleReturn(hash: string): { idToken: string | null; state: string | null; error: string | null } {
  const q = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return { idToken: q.get("id_token") || null, state: q.get("state") || null, error: q.get("error") || null };
}

/**
 * الطلبُ المحفوظُ قبل الذهاب إلى Google — يُقبل فقط إن كان بشكله، وبـ`state` نفسِه، ولم يتقادم. وإلا فلا دخول:
 * عودةٌ لا طلبَ لها من هذا التبويب ليست ردّاً علينا.
 */
export function takeStash(raw: string | null, state: string | null, now = Date.now()): GoogleStash | null {
  if (!raw || !state) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object") return null;
  const s = v as Partial<GoogleStash>;
  if (typeof s.state !== "string" || typeof s.nonce !== "string" || typeof s.next !== "string" || typeof s.at !== "number") return null;
  if (s.state.length < 16 || s.state !== state) return null;
  if (now - s.at > GOOGLE_STASH_MAX_AGE_MS || s.at > now + 60_000) return null;
  return { state: s.state, nonce: s.nonce, next: s.next, at: s.at };
}
