import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/core/ratelimit";
import { asScope, emptySearch, runSearch } from "@/lib/searchCore";

/**
 * **بحثٌ واحدٌ لأربعة أنواع** (D-534) — نداءٌ واحدٌ لصفحة البحث.
 *
 * **ولماذا لم يُوسَّع `/api/suggest`:** ذاك يخدم قائمةَ الاقتراحات تحت
 * حقلٍ في شريطٍ علويّ — **صفٌّ واحدٌ مسطَّحٌ بسقف اثني عشر** — **وهذا
 * يعيد أربعةَ أقسامٍ بمفاتيحها.** وشكلا ردٍّ مختلفان في مسارٍ واحدٍ
 * علَمٌ يقلب الردَّ كلَّه (القاعدة ٦). ويبقى `suggest` لقارئه القديم.
 *
 * 🆕 **Phase 11-G (G0)**: المنطقُ انتقل إلى `lib/searchCore.ts` ليقرأه هذا
 * المسارُ (عارياً، للويب) و`/api/v1/search` (بغلاف `{data}`، للتطبيق) —
 * **بحثٌ واحدٌ لا اثنان**. هذا الملفُّ غلافٌ: جلسةٌ، حدٌّ، نداء.
 */
export async function GET(request: Request) {
  /* **البحثُ مفتوحٌ للزائر** (D-627): النتائجُ كتالوجٌ وملفّاتٌ عامّة، فلا سرَّ
     يحرسه الرفض. **والحدُّ للزائر بعنوانه** (أوّلُ `x-forwarded-for`). */
  const user = await getUser();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  /* بحثٌ حيٌّ مع كلِّ ضغطةِ زرّ — والحدُّ حدُّ `suggest` نفسُه */
  const key = `search:${user?.id ?? ip}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(emptySearch(), {
      status: 429,
      headers: { "Retry-After": String(retryAfter(key)) },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const payload = await runSearch(q, asScope(url.searchParams.get("type")));

  /* دقيقةٌ في متصفّح السائل وحدَه (سابقةُ `suggest`) — و`private` لأن النتائج
     بلغة صاحب الكوكي وفيها قوائمُ لا يراها غيرُه. */
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
