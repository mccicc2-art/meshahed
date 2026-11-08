import { NextResponse, type NextRequest } from "next/server";
import { redeemKodiPairCode } from "@/lib/linkTokens";
import { sharedLimited } from "@/lib/sharedLimit";

export const dynamic = "force-dynamic";

const KODI_PAIR_GLOBAL_PER_MIN = 60;

/**
 * `POST /api/v1/home-server/kodi/pair` `{code, device}` — **إضافةُ Kodi تبدّل رمزَ التطبيق برابطها** (هجرة ٢٣٦، «٢ أ»).
 *
 * 🔑 **بلا جلسة**: الطالبُ تلفزيونٌ لا حسابَ فيه — الرمزُ وحدَه يثبت صاحبه (ستّةُ أرقام، عشرُ دقائق، مرّةً واحدة). والردُّ رابطُ
 * Webhook خاصٌّ بـKodi (`lk_…`) تحفظه الإضافةُ في جهازها، **ويُسقط رابطَ Kodi قبله** (ربطٌ ثانٍ = جهازٌ جديد).
 * ⚖️ **والتخمينُ محدودٌ في القاعدة** (A-14) بعنوان المرسِل: عشرةٌ في الدقيقة، وفوقه سقفٌ مشتركٌ لكلِّ العناوين (A-45) —
 * مليونُ رمزٍ لا يُجرَّب في عشر دقائق.
 * والخطأُ واحدٌ لكلِّ فشل (`invalid_code`): من يجرّب لا يعرف إن كان الرمزُ منتهياً أو لم يوجد.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const rl = await sharedLimited(`kodi-pair:${ip}`, 10, 60_000);
  if (rl) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  // A-45 (المدقّق ٦ نوفمبر) — حدُّ العنوان وحدَه يتجاوزه من يوزّع المحاولات على عناوين كثيرة؛ فسقفٌ مشتركٌ للجميع
  // يُبقي مجموعَ المحاولات في عمر الرمز (عشرُ دقائق) جزءاً صغيراً من مليون. ستّون في الدقيقة تكفي الأجهزةَ الحقيقيّة.
  // ⚖️ ثمنُه مقبول: من يملأ السقفَ يؤخّر ربطاً حقيقيّاً دقيقةً (يعيد المحاولة) ولا يربط شيئاً؛ وإن غابت القاعدةُ صار لكلِّ نسخة.
  const all = await sharedLimited("kodi-pair:all", KODI_PAIR_GLOBAL_PER_MIN, 60_000);
  if (all) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  let body: { code?: unknown; device?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  const code = String(body.code ?? "").replace(/\s+/g, "");
  const device = typeof body.device === "string" ? body.device : null;
  const hit = await redeemKodiPairCode(code, device);
  if (!hit) return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  const origin = new URL(req.url).origin;
  return NextResponse.json({ ok: true, webhook_url: `${origin}/api/v1/home-server/${hit.token}` });
}
