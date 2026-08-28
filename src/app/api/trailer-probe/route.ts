import { NextResponse } from "next/server";
import { getUser } from "@/lib/data";
import { allow, retryAfter } from "@/lib/ratelimit";

/**
 * ⛏️ **مسبارٌ تشخيصيٌّ مؤقّت** (D-758) — يُحذف فورَ قراءة جوابه.
 *
 * سؤالُه الوحيد: **هل يصل خادمُ Vercel إلى بحث iTunes أصلاً؟** —
 * الحقلُ `fileUrl` يخرج فارغاً في الإنتاج ولا سجلَّ منصّةٍ لنا (403
 * سجلّات Vercel، القسم ١٩) — **ومن لا يملك سجلَّ منصّته يبني سجلَّه**
 * (D-668). **قراءةٌ خالصة: لا كتابةَ ولا سرَّ ولا بياناتِ أعضاء.**
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const key = `trailer-probe:${user.id}`;
  if (!allow(key, 10, 60_000)) {
    return NextResponse.json(
      { error: "rate" },
      { status: 429, headers: { "Retry-After": String(retryAfter(key)) } },
    );
  }

  const url = new URL(request.url);
  const term = (url.searchParams.get("t") ?? "Inception").slice(0, 60);
  /* v2: يقبل رابطاً كاملاً `u` (مقيَّداً بمضيف آبل) وترويسةَ UA اختياريّة —
     مصفوفةُ تجارب من التبويب بدل نشرةٍ لكلِّ متغيّر */
  const rawU = url.searchParams.get("u");
  let target = `https://itunes.apple.com/search?media=movie&limit=5&country=US&term=${encodeURIComponent(term)}`;
  if (rawU) {
    try {
      const candidate = new URL(rawU);
      if (candidate.host === "itunes.apple.com") target = candidate.toString();
    } catch {
      /* رابطٌ فاسد — يبقى الافتراضي */
    }
  }
  const withUa = url.searchParams.get("ua") === "1";

  const startedAt = Date.now();
  try {
    const res = await fetch(target, {
      cache: "no-store",
      headers: withUa
        ? { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" }
        : undefined,
    });
    const ms = Date.now() - startedAt;
    const text = await res.text();
    interface ProbeResult {
      trackName?: string;
      releaseDate?: string;
      previewUrl?: string;
    }
    let parsed: { resultCount?: number; results?: ProbeResult[] } | null = null;
    try {
      parsed = JSON.parse(text) as { resultCount?: number; results?: ProbeResult[] };
    } catch {
      parsed = null;
    }
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      ms,
      contentType: res.headers.get("content-type"),
      resultCount: parsed?.resultCount ?? null,
      acao: res.headers.get("access-control-allow-origin"),
      names: (parsed?.results ?? []).slice(0, 30).map((r) => r.trackName ?? "?"),
      sample: (parsed?.results ?? []).slice(0, 3).map((r) => ({
        name: r.trackName,
        year: (r.releaseDate ?? "").slice(0, 4),
        previewHost: r.previewUrl ? new URL(r.previewUrl).host : null,
      })),
      rawHead: parsed ? null : text.slice(0, 200),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - startedAt,
      thrown: String(error).slice(0, 300),
    });
  }
}
