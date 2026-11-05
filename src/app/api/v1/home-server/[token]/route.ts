import { after, NextResponse, type NextRequest } from "next/server";
import { homeServerOwner, recordHomeSignal, resolveHomeEvent } from "@/lib/homeServer";
import { allow } from "@/core/ratelimit";
import { HOME_SERVER_TOKEN_RE, KODI_TOKEN_RE, parseHomeEvent } from "@/core/homeServer";

export const dynamic = "force-dynamic";

/**
 * `POST /api/v1/home-server/{token}` — **Webhook سيرفرات البيت** (Plex · Jellyfin · Emby، هجرة ٢٣٥).
 *
 * 🔑 **لا يُعلَّم شيءٌ هنا**: «أنهاها في سيرفره» يُسجَّل سؤالاً («شفتها؟») يجيب عنه العضوُ في الرئيسيّة («٢ أ»).
 * ⚖️ **ردٌّ واحدٌ لكلِّ ما ليس لنا** (`{ok:true}` بـ٢٠٠): رمزٌ مجهول، غيرُ مشترك، حدثُ بدءٍ أو إيقافٍ مؤقّت، موسيقى، شكلٌ لا
 * نعرفه — السيرفرُ لا يحتاج أن يعرف، ومن يجرّب الرموزَ لا يتعلّم منها شيئاً. والمطابقةُ والتسجيلُ بعد الردّ (`after`):
 * Plex يقطع الطلبَ الذي يتأخّر.
 * ⚖️ **الجسم**: JSON (Jellyfin · Emby)، أو `multipart/form-data` بحقل `payload` (Plex) أو `data` (Emby الأقدم) —
 * وصورةُ Plex المرفقة (`thumb`) لا تُقرأ.
 */
const OK = () => NextResponse.json({ ok: true });

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  /* 🆕 هجرة ٢٣٦ — ورابطُ إضافة Kodi (`lk_`) يصل البابَ نفسَه */
  if (!HOME_SERVER_TOKEN_RE.test(token) && !KODI_TOKEN_RE.test(token)) return OK();
  /* السيرفرُ يرسل مع كلِّ تشغيلٍ وإيقاف — ستّون في الدقيقة فوق أيِّ مشاهدةٍ بشريّة */
  if (!allow(`home-server:${token.slice(0, 16)}`, 60, 60_000)) return OK();

  let body: unknown = null;
  try {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      const raw = form.get("payload") ?? form.get("data");
      body = typeof raw === "string" ? JSON.parse(raw) : null;
    } else {
      body = JSON.parse(await req.text());
    }
  } catch {
    return OK();
  }
  const ev = parseHomeEvent(body);
  if (!ev?.finished) return OK();
  /* حدثُ Kodi لا يُقبل إلّا برابط Kodi، ولا حدثُ سيرفرٍ آخر برابطه — مصدرُ السؤال يصدق صاحبَ الرابط */
  if ((ev.server === "kodi") !== KODI_TOKEN_RE.test(token)) return OK();

  /* المالكُ قبل TMDB (درسُ A-17 في Stremio): رمزٌ مجهولٌ لا يكلّفنا طلباً خارجيّاً */
  /* 🆕 هجرة ٢٣٧ — «داخل خانات العضو» بدل «بلس»، ونوعُ المرسِل يطابق رابطَ نوعه (ويُربط به الرابطُ القديمُ أوّلَ مرّة) */
  const owner = await homeServerOwner(token, ev.server);
  if (!owner?.active) return OK();
  after(async () => {
    try {
      const hit = await resolveHomeEvent(ev);
      if (hit) await recordHomeSignal(owner, ev, hit);
    } catch {
      /* لا سؤالَ هذه المرّة — الحلقةُ التالية تصل */
    }
  });
  return OK();
}

/** فتحُ الرابط في متصفّح (أو اختبارُ اتّصال) — يقول إنه رابطُ Loopz ولا شيء غيرَه */
export async function GET() {
  return NextResponse.json({ ok: true, service: "Loopz home server webhook" });
}
