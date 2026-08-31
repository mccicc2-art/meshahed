/**
 * الممرّ المخزَّن لصور TMDB الصغيرة (D-841) — ‎/i/<size>/<file>‎.
 *
 * لماذا يوجد: المتصفحُ لا يصل إلى image.tmdb.org عند مستخدمينا (D-726،
 * وأعيد قياسُه حيّاً في D-840)، فكلُّ صورةٍ لا بدّ أن تمرّ من نطاقنا.
 * كانت تمرّ كلُّها من محسِّن Vercel المدفوع — وهذا الممرُّ يقدّم المقاسات
 * الصغيرة كما خرجت من TMDB: الجلبُ يقع على الخادم (يصل حيث لا يصل
 * المتصفح)، والردُّ immutable لسنةٍ فتحمله CDN بعد أول طلب — الكلفةُ
 * تنتقل من رسمِ تحويلٍ لكل صورة إلى طلبِ حافةٍ داخل الحصّة المجانية.
 *
 * ومن يبني روابطَه هو imageLoader.ts وحدَه — من هنا يأتي شكلُ المسار.
 * (مقطعان مفردان لا ‎[...p]‎: رفعُ GitHub يرفض مجلّداً في اسمه «..».)
 *
 * ⚠️ التحقّق صارم عمداً كي لا يصير الممرُّ وكيلاً مفتوحاً: قائمةُ مقاسات
 * مغلقة وشكلُ ملفٍّ واحد — وكلُّ ما عداهما 400 قبل أي جلب.
 */

// مقاساتُ TMDB الصغيرة وحدَها — الكبيرة (w780/w1280/original) تبقى على
// المحسِّن (انظر imageLoader.ts) فطلبُها هنا خطأُ منادٍ لا حالةُ استخدام.
const SIZES = new Set(["w45", "w92", "w154", "w185", "w300", "w342", "w500", "h632"]);
const FILE = /^[A-Za-z0-9]+\.(?:jpg|png)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string; file: string }> },
) {
  const { size, file } = await params;
  if (!SIZES.has(size) || !FILE.test(file)) {
    return new Response(null, { status: 400 });
  }

  let upstream: Response;
  try {
    // no-store: خبيئتُنا هي CDN عبر ترويسة الردّ — وكتابةُ Data Cache
    // لكل ملصقٍ بندُ فاتورةٍ ثالثٌ لا نحتاجه.
    upstream = await fetch(`https://image.tmdb.org/t/p/${size}/${file}`, {
      cache: "no-store",
    });
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.status === 404 ? 404 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // سنةٌ ثابتة: روابط TMDB مجزّأةٌ بالمحتوى — تغيّرُ الصورة يغيّر
      // رابطَها (المبدأ نفسُه الذي برّر minimumCacheTTL شهراً في D-8xx).
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}
