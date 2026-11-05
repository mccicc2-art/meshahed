import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { applyRevenueCatEvent } from "@/lib/billing";
import { parseRcBody } from "@/core/billing";

export const dynamic = "force-dynamic";

/**
 * 🆕 `POST /api/v1/billing/revenuecat` — **ويبهوكُ RevenueCat** (خطّةُ Loopz+ v2 المرحلة ١، هجرة ٢٣٨).
 *
 * 🔑 **السرُّ في ترويسة `Authorization`** كما يضبطها RevenueCat في لوحته، ويُقارن بمتغيّر البيئة
 * `REVENUECAT_WEBHOOK_SECRET` (يضعه أحمد في Vercel — لا يُكتب في الكود). بلا متغيّر ⇒ ٥٠٣: لا يُقبل حدثٌ لا نعرف مصدرَه.
 * 🔑 **الردودُ**: ٢٠٠ لما أُخذ (كُتب · مكرَّر · لا يخصّنا · لا صاحبَ له) فلا يعيده RevenueCat، و٥٠٠ لعطلٍ عندنا فيعيده هو
 * (يعيد خمس مرّاتٍ بمُهَلٍ متزايدة). ٤٠١ لسرٍّ خاطئ.
 * ⚠️ جدارُ Vercel قد يتحدّى الطلبات الآليّة: المسارُ يحتاج استثناءً في لوحته (خطوةُ أحمد في المرحلة ٣).
 */
function authorized(header: string | null): boolean {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const got = header.startsWith("Bearer ") ? header.slice(7) : header;
  /* مقارنةٌ بزمنٍ ثابت على بصمتين بطولٍ واحد — لا يُعرف من زمن الردّ كم حرفاً صحّ */
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!process.env.REVENUECAT_WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 503 });
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  let raw: unknown = null;
  try {
    const text = await req.text();
    if (text.length > 64_000) return NextResponse.json({ ok: false }, { status: 413 });
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const ev = parseRcBody(raw);
  if (!ev) return NextResponse.json({ ok: true });
  const out = await applyRevenueCatEvent(ev).catch(() => "unavailable" as const);
  if (out === "unavailable") return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, result: out });
}
