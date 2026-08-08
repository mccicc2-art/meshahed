import { NextResponse } from "next/server";
import { getUser, getPublicList } from "@/lib/data";
import { getLocale } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { posterUrl } from "@/lib/tmdb";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * معاينة قائمةِ مستخدمٍ عامة — لورقة المعاينة المنبثقة (دفعة أحمد الثالثة).
 *
 * لماذا مسار لا تمريرٌ مع الصفحة: المعاينة تُفتح بضغطةٍ على بطاقةٍ واحدة
 * من عشرات المعروضة — جلبُ عناصر كل القوائم مع الصفحة يدفع ثمنه الجميع
 * ليستفيد قليل (منطق /api/franchise نفسه). القراءة عبر `public_list`
 * الموجودة (بابُ D-053 الواحد) فلا مسار قراءةٍ جديداً يُفتح، والعناوين
 * تُترجم عند القراءة (D-048).
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ items: [] }, { status: 401 });

  const key = `listpeek:${user.id}`;
  if (!allow(key, 30, 60_000)) {
    return NextResponse.json(
      { items: [] },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const list = await getPublicList(id);
  if (!list) return NextResponse.json({ items: [] });

  const locale = await getLocale();
  const items = await localizeRows(list.items, locale).catch(() => list.items);

  return NextResponse.json({
    name: list.name,
    items: items.map((i) => ({
      id: i.tmdb_id,
      mediaType: i.media_type,
      title: i.title,
      poster: posterUrl(i.poster_path, "w342"),
    })),
  });
}
