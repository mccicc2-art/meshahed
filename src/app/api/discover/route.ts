import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { discoverTitles, titleOf, yearOf } from "@/lib/tmdb";
import { parseBrowse } from "@/lib/browse";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * صفحة إضافية من نتائج التصفّح — يطلبها الزرّ/المراقب في أسفل الشبكة.
 *
 * الصفحة الأولى تأتي مرسومةً من الخادم مع بقية الصفحة، فلا يدفع القارئ
 * كلفة طلبٍ ثانٍ ليرى أول نتيجة. وما بعدها فقط يمرّ من هنا.
 *
 * الحمولة مقصوصة عمداً إلى ما ترسمه البطاقة: TMDB يعيد نصف كيلوبايت من
 * الوصف والشعبية واللغة الأصلية لكل عمل، ولا شيء منها يظهر في الشبكة.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ items: [], hasMore: false }, { status: 401 });

  const key = `discover:${user.id}`;
  if (!allow(key, 40, 60_000)) {
    return NextResponse.json(
      { items: [], hasMore: false },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const query = parseBrowse({
    type: params.get("type") ?? undefined,
    g: params.get("g") ?? undefined,
    sort: params.get("sort") ?? undefined,
  });

  const page = Number(params.get("page") ?? "2");
  if (!Number.isInteger(page) || page < 2 || page > 500) {
    return NextResponse.json({ items: [], hasMore: false }, { status: 400 });
  }

  try {
    const data = await discoverTitles(query, page);
    return NextResponse.json(
      {
        items: data.results.map((r) => ({
          id: r.id,
          mediaType: r.media_type === "tv" ? "tv" : "movie",
          title: titleOf(r),
          poster: r.poster_path,
          year: yearOf(r),
        })),
        hasMore: data.hasMore,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ items: [], hasMore: false }, { status: 502 });
  }
}
