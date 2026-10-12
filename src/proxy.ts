import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  decodeAccessToken,
  decodeSessionCookie,
  ownerHash,
  sessionCookieParts,
} from "@/lib/sessionCookie";

/**
 * ترويسةُ «مالك الردّ» — تسميةُ تقسيمٍ لكاش الصفحات في الـsw (D-514).
 *
 * الـService Worker يخزّن HTML شخصيّاً لاحتياط الانقطاع والشبكة
 * الزاحفة، ولا يستطيع قراءة الكوكي ليعرف صاحبَه. فالخادم يسمّي كلَّ
 * ردٍّ ببصمة SHA-256 كاملةٍ من `sub` (أو `anon` للزائر، و`opaque`
 * لكوكي موجودٍ لا يُفكّ) — والـsw يمسح كاشَ الصفحات كلَّه أوّلَ ما
 * يرى التسميةَ تتغيّر. ⚖️ **كانت بادئةَ ثمانية أحرف وصارت بصمةً
 * كاملة** (تشديدُ أحمد): لا احتمالَ تصادمٍ ولو نظريّاً، ولا معرّفَ
 * خامًا في الترويسة. **تسميةٌ لا سرٌّ ولا صلاحية**: تُرى فقط في
 * متصفّح صاحبها، وقيمةٌ مزوَّرة أسوأُ ما تفعله مسحُ كاشِ جهازها
 * نفسِه. والحسابُ محليٌّ خالص — لا `getUser()` ولا رحلةَ شبكةٍ هنا.
 */
const OWNER_HEADER = "x-lz-owner";

/**
 * 🆕 **وبصمةُ البناء على كلِّ ردٍّ كذلك** (D-652).
 *
 * 🔴 **والعلّةُ التي فتحتها**: كاشُ صفحات الـsw اسمُه ثابتٌ بيدٍ
 * (`loopz-v8-pages`) **فيعيش عبر النشرات كلِّها** — **وصفحةُ HTML من
 * نشرةِ أمس تُقلع راوترَ Next ببصمةِ أمس**، فأوّلُ تنقّلٍ يطلب حمولةَ
 * RSC ببناءٍ لم يعد موجوداً **فتسقط الشاشةُ إلى حدِّ الخطأ** — وهو
 * بعينه ما وُصف في D-626 وعاد اليوم بعد ثماني نشرات.
 *
 * 🔑 **والحزامُ حزامُ المالك نفسُه بقارئٍ ثانٍ** (D-514/D-145): تسميةٌ
 * على الردّ، وأوّلُ ردٍّ يخالف المحفوظَ يمسح كاشَ الصفحات قبل أن
 * يُكتب فيه سطر — **ولا آليّةَ ثانيةٌ تُخترع لفكرةٍ قائمة.**
 *
 * ⚠️ **وليست سرّاً**: بصمةُ التزام مستودعٍ عامّ، **وأسوأُ ما تفعله
 * قيمةٌ مزوَّرةٌ مسحُ كاشِ جهازِ صاحبها.**
 */
const BUILD_HEADER = "x-lz-build";
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";

async function ownerLabel(request: NextRequest): Promise<string> {
  try {
    const parts = sessionCookieParts(request.cookies.getAll());
    if (parts.length === 0) return "anon";
    const claims = decodeSessionCookie(parts);
    // كوكي موجودٌ لا يُفكّ: تسميةٌ خاصةٌ به — تخالف أيَّ sub سابقٍ
    // فتمسح، وهي الجهة الآمنة من الخطأ
    return claims ? await ownerHash(claims.sub) : "opaque";
  } catch {
    return "opaque";
  }
}

// Next.js 16 renamed Middleware to Proxy.
// وظيفته الوحيدة هنا: تجديد كوكي جلسة Supabase قبل انتهائها.

/** ثوانٍ قبل انتهاء التوكن نبدأ عندها التجديد */
const REFRESH_WINDOW_SECONDS = 120;

/**
 * هل التوكن الحالي على وشك الانتهاء؟
 *
 * يفكّ حمولة الـJWT محلياً (بلا أي طلب شبكة) ليقرأ `exp` فقط.
 * هذا ليس تحققاً أمنياً — التحقق الحقيقي يبقى في `getUser()` على الخادم
 * وفي سياسات RLS. الغرض فقط: هل نحتاج نداء تجديد أم لا.
 * عند أي شك (تعذّر الفكّ، لا يوجد exp) نرجع true فنجدّد كالسابق.
 */
function needsRefresh(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false; // زائر غير مسجّل — لا شيء نجدّده

  try {
    // Supabase يخزّن الجلسة كـ JSON (أحياناً مسبوقة بـ base64-) داخل الكوكي
    let raw = cookieValue;
    if (raw.startsWith("base64-")) raw = atob(raw.slice(7));
    const session = JSON.parse(raw);

    const token: string | undefined = session?.access_token;
    if (!token) return true;

    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const exp: number | undefined = payload?.exp;
    if (!exp) return true;

    return exp - Math.floor(Date.now() / 1000) < REFRESH_WINDOW_SECONDS;
  } catch {
    return true;
  }
}

/* 🔴 🆕 D-914 — **الزواحفُ تُردّ عند الباب لا بعد الرسم**: لوحةُ Vercel (٥ سبتمبر)
   قالت ٢٩٩ ألفَ استدعاءٍ في ١٢ ساعة، ثلثاها صفحاتُ أشخاصٍ وأفلامٍ لا يفتحها
   بشرٌ بهذا العدد. صفحةُ عملٍ ترسم برحلاتٍ إلى TMDB وقاعدةٍ وتُسجَّل زمنَ معالجٍ
   يُفوتَر — **و403 من هنا ملّي ثانية بلا رحلة**. القائمةُ الأسماءُ التي تُعلن عن
   نفسها (نسخةُ `robots.txt`)؛ **والمقنَّعُ يوقفه جدارُ Vercel** (حدُّ المعدّل — من اللوحة). */
const BLOCKED_UA =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-Web|anthropic-ai|CCBot|Bytespider|Amazonbot|PerplexityBot|Perplexity-User|meta-externalagent|FacebookBot|Applebot-Extended|cohere-ai|Diffbot|ImagesiftBot|omgili|Timpibot|YouBot|AhrefsBot|SemrushBot|MJ12bot|DotBot|DataForSeoBot|PetalBot|Scrapy|meta-webindexer|meta-externalfetcher/i;

/**
 * ====== 🆕 D-1341 — بوّابةُ الترحيب على الويب (Phase 11-U · U0) ======
 *
 * قرارُ أحمد ١٧ (١٠ أكتوبر، بتسجيلٍ تجاوز فيه الترحيبَ بحسابٍ جديد): «الخطوات اجبارية .. محد يقدر يتصفح
 * الا اذا خلصها». كان الحارسُ في `/` وحدَها (`page.tsx`) — فكلُّ مسارٍ آخرَ بابٌ مفتوح.
 *
 * 🔑 **هنا لأنّه المكانُ الوحيدُ الذي يمرّ به كلُّ طلبِ صفحة** — تحميلُ مستندٍ وتنقّلُ راوترٍ (RSC) معاً؛
 * التخطيطُ لا يُعاد رسمُه في التنقّل الناعم فلا يصلح حارساً.
 *
 * 🔑 **والثمنُ قراءةٌ واحدةٌ لكلِّ عضوٍ لكلِّ نسخةِ خادم، لا لكلِّ طلب** — هذا الملفُّ يتجنّب رحلةَ الشبكة
 * عمداً (انظر `needsRefresh`). الختمُ يُكتب مرّةً ولا يُمحى، فمن ثبت أنّه أتمّ يُحفظ معرّفُه في ذاكرة
 * النسخة ولا يُسأل عنه ثانيةً (الوصفةُ نفسُها في `lib/v1.ts`). لا يُحفظ «لم يُتمّ» — ذاك يتبدّل.
 * ⚖️ **ولا كوكي «أتمّ»**: كوكي بلا توقيعٍ يكتبه العضوُ بيده فيفتح البوّابة (الحارسُ لا يسكن المتصفّح —
 * D-821)، والتوقيعُ يحتاج سرّاً في البيئة — ومفتاحُ الخدمة مسيَّجٌ عن هذا الملفّ (D-898).
 *
 * ⚠️ **يفتح عند الشكّ**: خطأُ قاعدةٍ، مهلة، عمودٌ غائب (شيفرةٌ سبقت هجرتَها)، صفٌّ لم يُقرأ ⇒ يمرّ.
 * حارسٌ لا يعرف لا يقفل عضواً خارج حسابه. والزائرُ (بلا جلسة) يمرّ كما كان — ذاك شأنُ U2.
 */
const OB_READ_TIMEOUT_MS = 2500;
const OB_DONE = new Set<string>();
const OB_DONE_MAX = 20_000;
/* 🆕 D-1354 — خُتم له ولم يُسمَّ: يكفي غلافاً قديماً (يُحكم له بالختم وحدَه) ولا يكفي غيرَه */
const OB_STAMPED = new Set<string>();

/**
 * 🆕 D-1354 — **اسمُ المستخدم شرطٌ ثانٍ في البوّابة** (حكمُ أحمد ١١ أكتوبر: «أيّ شخص ما عنده يوزر إذا دخل اجبره
 * يحطّ يوزر» — `lib/data.ts` → `getOnboardInfo`). **والغلافُ القديمُ يُستثنى**: صفحةُ الويب داخل تطبيقٍ لم يأخذ
 * التحديثَ لو حُوّلت إلى `/welcome` لرفع غلافُها الترحيبَ الأصليَّ بخطواته الخمس فوق مكتبةٍ قائمة. الغلافُ الذي
 * يفهم الشرطَ يزيد على وسمه `LoopzGate/2` (`apps/mobile/src/WebLayer.tsx`)؛ ما سواه من داخل التطبيق يُحكم له
 * بالختم وحدَه كما كان. المتصفّحُ (بلا وسم `LoopzApp/`) يُحكم له بالشرطين.
 */
function gateAware(ua: string): boolean {
  if (!ua.includes("LoopzApp/")) return true;
  const m = /LoopzGate\/(\d+)/.exec(ua);
  return !!m && Number(m[1]) >= 2;
}

/**
 * ما يبقى مفتوحاً لمن دخل ولم يُتمّ: الترحيبُ نفسُه · الدخولُ والخروجُ و«بدّل الحساب» (`/auth/*`) ·
 * الصفحاتُ العامّةُ التي تفتحها Google وApple والمتجران بلا حساب (`18_Project_Context.md`) · حذفُ الحساب ·
 * مساراتُ الـAPI (حارسُها في `lib/v1.ts`، والترحيبُ نفسُه ينادي بعضَها) · صفحةُ إقلاع التطبيق (تسلّم
 * الرمزَ للغلاف ثمّ تنتقل إلى `/` فتُحرس هناك) · وكلُّ ملفٍّ بامتداد (`sw.js` · `manifest` · الأيقونات).
 */
function welcomeExempt(pathname: string): boolean {
  return (
    pathname === "/welcome" ||
    pathname === "/login" ||
    pathname === "/features" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/account/delete" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/_next/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

/** رمزُ الوصول من كوكي الجلسة كما هي الآن في الطلب (بعد التجديد إن وقع) */
function sessionAccessToken(request: NextRequest): string | null {
  try {
    let raw = sessionCookieParts(request.cookies.getAll()).join("");
    if (!raw) return null;
    if (raw.startsWith("base64-")) {
      const b64 = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
      raw = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    }
    const token = (JSON.parse(raw) as { access_token?: unknown } | null)?.access_token;
    return typeof token === "string" && token.split(".").length === 3 ? token : null;
  } catch {
    return null;
  }
}

/** الشرطان كما في القاعدة — أو `null`: لا يُعرف (يُفتح) */
async function readOnboarded(sub: string, token: string): Promise<{ stamped: boolean; named: boolean } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const res = await fetch(`${url}/rest/v1/profiles?select=onboarded_at,username&id=eq.${encodeURIComponent(sub)}&limit=1`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(OB_READ_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    const row = rows[0] as { onboarded_at?: unknown; username?: unknown };
    return { stamped: !!row.onboarded_at, named: typeof row.username === "string" && !!row.username.trim() };
  } catch {
    return null;
  }
}

async function welcomeGate(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  try {
    const pathname = request.nextUrl.pathname;
    if (welcomeExempt(pathname)) return response;
    const token = sessionAccessToken(request);
    if (!token) return response; // زائر — أو كوكي لا يُفكّ: `getUser` في الصفحة يحكم
    const claims = decodeAccessToken(token);
    // رمزٌ منتهٍ ترفضه القاعدةُ فلا يُقرأ به شيء — يمرّ، والطلبُ التالي يحمل المجدَّد
    if (!claims || (claims.exp !== null && claims.exp * 1000 <= Date.now())) return response;

    if (OB_DONE.has(claims.sub)) return response;
    const aware = gateAware(request.headers.get("user-agent") ?? "");
    if (!aware && OB_STAMPED.has(claims.sub)) return response;

    const info = await readOnboarded(claims.sub, token);
    if (!info) return response;
    if (info.stamped) {
      const set = info.named ? OB_DONE : OB_STAMPED;
      if (set.size >= OB_DONE_MAX) set.clear();
      set.add(claims.sub);
    }
    if (aware ? !(info.stamped && info.named) : !info.stamped) {
      const to = NextResponse.redirect(new URL("/welcome", request.url), { status: 307 });
      to.headers.set("cache-control", "private, no-store");
      // تجديدُ الجلسة الذي وقع في هذا الطلب يسافر مع التحويل — وإلّا ضاع الرمزُ المدوَّر
      for (const c of response.cookies.getAll()) to.cookies.set(c);
      return to;
    }
    return response;
  } catch {
    return response;
  }
}

/**
 * ====== 🆕 D-1373 (Phase 11-U · U2) — الدخولُ أوّلاً على الويب ======
 *
 * قرارُ أحمد ٦ (١٠ أكتوبر): «فالتطبيق والويب سجل دخول اول»، ثمّ (١٢ أكتوبر): «يهمني ان اي شخص ما عنده حساب ما يقدر
 * يتصفح». الزائرُ بلا جلسة يُحوَّل إلى `/login?next=<ما طلبه>` من **كلِّ** صفحة — الحارسُ هنا لا في الصفحات، فصفحةٌ
 * جديدةٌ تُحرس بلا سطرٍ يُنسى.
 *
 * **ما يبقى مفتوحاً** (`guestOpen`): `/` (بابُ الدخول نفسُه) · الصفحاتُ التي تفتحها Google وApple والمتجران بلا حساب ·
 * الدخولُ والخروج · الـAPI (حرّاسُه في `lib/v1.ts` والمسارات) · صفحاتُ التطبيق (`/app/*`) · الملفّاتُ والصورُ وصورُ
 * المعاينة · **وروابطُ الدعوة والشراكة** (`/join/*` · `/p/*`، قرارُ أحمد «17 أ»): مكتوبةٌ لمن لا حساب له، تكتب كوكي
 * النَسَب ثمّ تحوّل إلى `/` — وحراستُها كانت ستُضيع النَسَب قبل أن يُكتب.
 * **وبرامجُ معاينة الروابط** تمرّ («16 أ»): واتساب وX وتيليجرام… تقرأ العنوانَ والصورة. **Google ليس منها** — خروجُ
 * صفحات الأعمال من البحث ثمنٌ قُبل في الخطّة.
 *
 * ⚖️ **«زائر» = لا كوكي جلسةٍ أصلاً**: كوكي موجودٌ ورمزُه شاخ يمرّ، والصفحةُ تحكم (`getUser`) — عطلٌ عابرٌ في التجديد لا
 * يُخرج عضواً إلى صفحة الدخول. والتطبيقُ لا يتأثّر: الويبُ فيه يحمل جلسةً دائماً، وصفحتُه الأولى `/app/*`.
 */
const PREVIEW_UA =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|redditbot|Pinterestbot|vkShare|Embedly|SnapchatAds/i;

function guestOpen(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/features" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/account/delete" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/app/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/join/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/i/") ||
    pathname.includes("opengraph-image") ||
    pathname.includes("twitter-image") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function guestGate(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (guestOpen(pathname)) return null;
  if (PREVIEW_UA.test(request.headers.get("user-agent") ?? "")) return null;
  if (sessionCookieParts(request.cookies.getAll()).length > 0) return null;
  const to = new URL("/login", request.url);
  to.searchParams.set("next", pathname + search);
  const res = NextResponse.redirect(to, { status: 307 });
  res.headers.set("cache-control", "private, no-store");
  return res;
}

export async function proxy(request: NextRequest) {
  if (BLOCKED_UA.test(request.headers.get("user-agent") ?? "")) {
    return new NextResponse(null, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const guest = guestGate(request);
  if (guest) return guest;
  return welcomeGate(request, await sessionProxy(request));
}

/** ما كان `proxy` كلَّه قبل D-1341: تسميتا المالك والبناء، وتجديدُ كوكي الجلسة عند اقتراب انتهائها */
async function sessionProxy(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  /* تسميةُ المالك على كلِّ ردٍّ يمرّ بالوسيط — انظر D-514 أعلاه.
     تُكتب هنا وعلى نسخة الردّ التي قد يعيد التجديدُ إنشاءها أدناه. */
  const owner = await ownerLabel(request);
  response.headers.set(OWNER_HEADER, owner);
  response.headers.set(BUILD_HEADER, BUILD_ID);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet (e.g. first deploy before env vars are set):
  // skip session refresh instead of throwing a 500 on every route.
  if (!url || !anonKey) return response;

  // كان هذا الوسيط يستدعي getUser() في كل طلب — رحلة شبكة كاملة لخادم
  // Supabase حتى على طلبات الـprefetch. الآن ننادي فقط عند اقتراب الانتهاء.
  // الكوكي قد تكون مقسّمة إلى أجزاء (‎auth-token.0 و .1) فنعيد تجميعها بالترتيب
  const parts = request.cookies
    .getAll()
    .filter((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (parts.length === 0) return response; // زائر غير مسجّل
  if (!needsRefresh(parts.map((c) => c.value).join(""))) return response;

  const supabase = createServerClient(url, anonKey, {
    // نفس خيارات العميلين الآخرين: هذا هو المكان الذي يعيد كتابة كوكي
    // الجلسة فعلياً عند التجديد، وبدون secure هنا كانت الكوكي المجدَّدة
    // تخرج بلا الحماية التي يفرضها server.ts و client.ts
    cookieOptions: { sameSite: "lax", secure: true, path: "/" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // الردُّ أُعيد إنشاؤه — التسميتان تُعادان معه وإلا سقطتا عن ردود التجديد
        response.headers.set(OWNER_HEADER, owner);
        response.headers.set(BUILD_HEADER, BUILD_ID);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: refreshes the session cookie.
  try {
    await supabase.auth.getUser();
  } catch {
    // Ignore network/config errors so the app still renders.
  }

  return response;
}

export const config = {
  matcher: [
    /* `api/v1` مستثنًى: طلباتُ التطبيق تحمل `Bearer` لا كوكي، فلا جلسةَ
       هنا تُجدَّد — ورحلةُ `getUser` عليها هدرٌ محض (Phase 9 §4.3) */
    "/((?!_next/static|_next/image|favicon.ico|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    /* ⚠️ `_next/image` **لا يصل إلى الوسيط على Vercel أصلاً** (مقيسٌ في D-931:
       تحويلٌ من هنا لم يعمل قطّ في الإنتاج) — حارسُ روابط المحسِّن الميّتة في
       `remotePatterns` بـ`next.config.ts`، لا هنا. */
  ],
};
