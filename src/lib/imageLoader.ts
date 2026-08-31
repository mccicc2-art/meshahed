/**
 * محمِّل الصور المخصّص (D-841) — من يدفع للمحسِّن ومن لا يدفع.
 *
 * القياس الذي فرض هذا الملف (لوحة Vercel، ٣١ أغسطس ٢٠٢٦): نصفُ تحويلات
 * الصور المدفوعة أعادت الصورةَ الأصلية — ملصقات w185–w342 صغيرةٌ أصلاً
 * (٥–١١ ك.ب) وضغطُها يوفّر أقلَّ من خُمسها، ويُدفع ثمنُ كلِّ تحويل.
 * فالمقاسات الصغيرة تسلك «الممرّ المخزَّن» ‎/i/‎ (انظر route.ts هناك):
 * البايتات نفسُها التي كان المحسِّن يجلبها من TMDB، بلا رسم تحويل.
 *
 * وتبقى w780 وw1280 وoriginal على محسِّن Vercel عمداً: هذه أسطحُ البطل
 * والخلفيات — عنصر LCP — وAVIF يقصّ ثلثَ بايتاتها فيدفع التحويلُ ثمنَه
 * (قاعدة ٢٦: لا توفيرَ على حساب السرعة المحسوسة).
 *
 * ⚠️ ولا يمرّ شيءٌ مباشراً إلى image.tmdb.org من المتصفح: محجوبٌ عند
 * مستخدمينا (مقيسٌ في D-726 وأعيد قياسُه في D-840) — الوساطةُ ركيزة.
 */

const TMDB = "https://image.tmdb.org/t/p/";

// المقاسات التي يجدي تحويلُها — كل ما عداها يمرّ من الممرّ المخزَّن.
const KEEP_OPTIMIZED = new Set(["w780", "w1280", "original"]);

// شكلُ ملفّ TMDB الوحيد المقبول — أي شذوذٍ يعود للمحسِّن لا للممرّ.
const TMDB_FILE = /^[A-Za-z0-9]+\.(?:jpg|png)$/;

export default function imageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  if (src.startsWith(TMDB)) {
    const rest = src.slice(TMDB.length); // "w342/abc.jpg"
    const slash = rest.indexOf("/");
    if (slash > 0) {
      const size = rest.slice(0, slash);
      const file = rest.slice(slash + 1);
      if (!KEEP_OPTIMIZED.has(size) && TMDB_FILE.test(file)) {
        // عرضُ srcset لا يغيّر الرابط عمداً: ملفُّ TMDB بمقاسه المعلن هو
        // ما كان المحسِّن يجلبه أصلاً — رابطٌ واحد = مدخلُ خبيئةٍ واحد.
        return `/i/${size}/${file}`;
      }
    }
  }
  // كلُّ ما ليس TMDB صغيراً — المحلّيّ، الأفاتارات، الأعلام، والأسطح
  // الكبيرة — يسلك مسارَ Next نفسَه الذي كان يُبنى تلقائياً قبل D-841.
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
