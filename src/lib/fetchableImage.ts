import "server-only";

/*
 * A-80 (المدقّق ٢٤ نوفمبر) — نُقلتا كما هما من `src/app/api/share/route.tsx` لتخدما بطاقةَ المراجعة أيضاً:
 * نسخةٌ واحدةٌ لقائمة المضيفين، لا نسختان تختلفان.
 */

/** **صورةٌ بعيدةٌ تصير `data:`** — أو `null` إن تعذّرت، بلا رمي */
export async function dataUrl(url: string | null): Promise<string | null> {
  if (!url || !fetchableImage(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    /* ⚠️ **وسقفُ الحجم حارسٌ لا زينة**: `data:` تدخل في ذاكرة الرسم،
       وثلاثُ صورٍ ضخمةٍ تُوقف التوليد بلا رسالةٍ مفهومة. */
    if (buf.byteLength > 900_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}


/**
 * 🔴 A-13 (المدقّق ٢٢ أكتوبر) — **الخادمُ لا يجلب إلّا من مضيفي صورنا الثلاثة**.
 *
 * `profiles.avatar_url` يكتبه صاحبُه مباشرةً عبر REST (صلاحيةُ العمود منذ الهجرة ١٥٦) فيتخطّى `safeImageUrl`
 * في `actions.ts` — ورابطٌ يختاره المستخدم ثمّ يجلبه خادمُنا بابُ SSRF (عنوانٌ داخليّ، أو منفذٌ مفتوح يُستطلع).
 * القائمةُ قائمةُ `safeImageUrl` نفسُها + ملصقاتُ TMDB، والقاعدةُ تحرسها أيضاً (قيدا `profiles_*_url_safe`).
 * ⚠️ **غيّرها مع أختها**: مضيفٌ يُقبل هناك ويُرفض هنا ⇒ صورةٌ تظهر في الصفحة وتغيب عن البطاقة.
 */
export function fetchableImage(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    if (u.host === "image.tmdb.org") return u.pathname.startsWith("/t/p/");
    if (u.host === "lh3.googleusercontent.com") return true;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return !!base && u.host === new URL(base).host && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}
