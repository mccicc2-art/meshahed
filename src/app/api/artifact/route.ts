/**
 * جسرُ الرفع — ممرٌّ مؤقّتٌ يسلّم حزمةَ EAS إلى Play Console بيدِ الوكيل.
 *
 * 🔴 **العلّة**: رفعُ الـ`.aab` إلى مسار الاختبار يحتاج ملفاً في
 * `input[type=file]`، وحوارُ ويندوز لفتح الملفّات خارجَ متناولي
 * (صلاحيّةُ المتصفّح على الجهاز «قراءةٌ» فقط). وحقنُ الملفّ من
 * الصفحة نفسها يفشل لأن `expo.dev` لا يرسل `Access-Control-Allow-Origin`
 * — والفشلُ **CORS لا CSP** (لا انتهاكَ في السجلّ)، فالعلاجُ ترويسةٌ
 * لا حيلةُ نافذة.
 *
 * 🔑 **فهذا المسار يعيد بثَّ الملفّ من نطاقنا مع `ACAO: *`**، فتقدر
 * صفحةُ Play أن تجلبَه وتبنيَ منه `File` وتضعَه في الحقل.
 *
 * ⚖️ **وقيودُه ثلاثة لأنه بابٌ مفتوح**: مفتاحٌ ثابت، ومضيفٌ واحدٌ
 * مسموح (`expo.dev/artifacts/eas/**`)، **وبثٌّ لا تخزين** — لا يلمس
 * كاشَ الـCDN فلا يضيف قرشاً إلى فاتورة D-914.
 *
 * ⏳ **مؤقّتٌ بالقصد**: يُحذف حالما ينتقل الإرسال إلى `eas submit` في
 * CI. لا تبنِ عليه شيئاً.
 */
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// حزمةٌ من ٦٧ ميغابايت تحتاج مهلةً أطولَ من الافتراضيّة
export const maxDuration = 300;

/** مفتاحٌ في مستودعٍ خاصّ — ليس سرّاً بل مانعُ فضولٍ عابر */
const KEY = "lz-aab-bridge-2026-09-05";

/** لا وسيطَ عامّاً: مضيفٌ واحدٌ ومسارٌ واحد */
function allowed(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "expo.dev") return null;
    if (!u.pathname.startsWith("/artifacts/eas/")) return null;
    return u;
  } catch {
    return null;
  }
}

/** اسمُ ملفٍّ لا ترويسةَ فيه: حروفٌ آمنةٌ فقط، وإلا فالافتراضيّ */
function safeName(raw: string | null): string {
  const n = (raw ?? "").trim();
  return /^[A-Za-z0-9._-]{1,80}\.aab$/.test(n) ? n : "artifact.aab";
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "*",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("k") !== KEY) {
    return new NextResponse("no", { status: 404, headers: CORS });
  }
  const target = allowed(params.get("u") ?? "");
  if (!target) {
    return new NextResponse("bad target", { status: 400, headers: CORS });
  }

  const upstream = await fetch(target, { redirect: "follow" });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(`upstream ${upstream.status}`, {
      status: 502,
      headers: CORS,
    });
  }

  // بثٌّ مباشر: حمولةٌ غيرُ مبثوثةٍ تصطدم بسقف ٤٫٥ ميغابايت للردّ
  return new NextResponse(upstream.body, {
    headers: {
      ...CORS,
      "content-type": "application/octet-stream",
      // اسمٌ صريحٌ عند التنزيل: المتصفّح وحده لا يشتقّ اسماً من مسارٍ بمعاملات.
      // ومصفّاةٌ لأن المعامل من الخارج: حرفٌ شارد في ترويسةٍ يفتح حقناً
      "content-disposition": `attachment; filename="${safeName(params.get("n"))}"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
