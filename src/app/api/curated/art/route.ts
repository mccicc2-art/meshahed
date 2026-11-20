import { NextResponse } from "next/server";
import { getUser, getAmAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { allow, retryAfter } from "@/core/ratelimit";
import { loopzArtAll } from "@/lib/curatedArt";

/** قائمةُ «أفضل ٢٥٠» بنداءٍ أو اثنين لكلِّ عمل */
export const maxDuration = 60;

/**
 * 🆕 T495 — **مسارٌ مؤقّتٌ للقراءة وحدَها**: يحسب لكلِّ عنصرٍ في قوائم لوبز المنسّقة ملصقَه (واسمَه للعمل العربيّ)
 * بقاعدة لوبز (`loopzArt`) ويُرجع **ما سيتغيّر فقط** — ولا يكتب شيئاً.
 *
 * **لماذا لا يكتب**: القوائمُ ملكُ حساب النظام، وسياساتُ `user_list_items` لا تسمح للإدارة بالتعديل، ومفتاحُ الخدمة
 * مسيَّجٌ بـESLint (D-898) — **فالكتابةُ تُطبَّق مرّةً واحدةً بـSQL** بعد نسخةٍ احتياطيّة، ولا يبقى في الشيفرة بابُ كتابةٍ
 * جديد. وما يُرجعه بياناتُ كتالوجٍ عامّة (معرّفاتُ TMDB ومساراتُ ملصقات) لا صفوفُ أعضاء.
 *
 * **ويُحذف في الرفعة التالية** بعد التشغيل.
 *
 * الاستعمال (من تبويب loopztv مسجَّلٍ بحساب الإدارة):
 *   const { slugs } = await (await fetch('/api/curated/art?list=1')).json();
 *   for (const s of slugs) out.push(await (await fetch(`/api/curated/art?slug=${s}`)).json());
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  if (!(await getAmAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = `curated-art:${user.id}`;
  if (!allow(key, 120, 60_000)) {
    return NextResponse.json({ error: "rate" }, { status: 429, headers: { "Retry-After": String(retryAfter(key)) } });
  }

  const supabase = await createClient();
  const url = new URL(request.url);

  if (url.searchParams.get("list") === "1") {
    const { data, error } = await supabase.from("user_lists").select("source_slug").not("source_slug", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ slugs: (data ?? []).map((r) => String(r.source_slug)) });
  }

  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "slug" }, { status: 400 });

  const { data: list, error: lerr } = await supabase
    .from("user_lists")
    .select("id")
    .eq("source_slug", slug)
    .maybeSingle();
  if (lerr || !list) return NextResponse.json({ slug, error: lerr?.message ?? "not found" }, { status: 404 });

  const { data: items, error: ierr } = await supabase
    .from("user_list_items")
    .select("tmdb_id, media_type, title, poster_path")
    .eq("list_id", list.id);
  if (ierr) return NextResponse.json({ slug, error: ierr.message }, { status: 500 });

  const rows = (items ?? []).map((r) => ({
    tmdbId: Number(r.tmdb_id),
    mediaType: (r.media_type === "tv" ? "tv" : "movie") as "movie" | "tv",
    title: (r.title as string | null) ?? null,
    posterPath: (r.poster_path as string | null) ?? null,
  }));
  const fixed = await loopzArtAll(rows);

  /* ما تغيّر فقط: `n` يُرسل حين يتغيّر الاسمُ (العملُ العربيُّ الأصل)، وإلّا `null` */
  const changes = fixed
    .map((f, i) => ({ before: rows[i], after: f }))
    .filter(({ before, after }) => before.posterPath !== after.posterPath || before.title !== after.title)
    .map(({ before, after }) => ({
      t: after.tmdbId,
      m: after.mediaType,
      p: after.posterPath,
      n: before.title !== after.title ? after.title : null,
    }));

  return NextResponse.json({ slug, list: list.id, items: rows.length, changes });
}
