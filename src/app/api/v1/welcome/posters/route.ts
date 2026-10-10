import { handle } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { welcomeSeeds } from "@/lib/welcomeSeeds";

/**
 * `GET /api/v1/welcome/posters` — ملصقاتُ أشهر الأعمال لجدار شاشة الدخول الأصليّة (D-1344).
 *
 * قرارُ أحمد (١٠ أكتوبر): خلفيّةٌ متحرّكةٌ ببطءٍ خلف شاشة الدخول «مثل الويب»، وملصقاتُها «اشهر الاعمال» —
 * القائمةُ نفسُها التي يختار منها الوافدُ في الترحيب (`welcomeSeeds`)، لا «رائج الأسبوع» الذي يعرضه جدارُ الويب.
 *
 * 🔑 **عامٌّ ومخبَّأ**: يُطلب قبل الدخول فلا جلسةَ معه، وجوابُه واحدٌ للجميع (مساراتُ ملصقاتٍ لا أسماء —
 * فلا لغةَ فيه) ⇒ ساعةٌ في الكاش. و`open`: لا يُسأل عن ختم الترحيب (لا صاحبَ له أصلاً).
 *
 * ⚠️ **زينةٌ لا شرط**: الشاشةُ تُرسم وزرُّها يعمل قبل أن يصل هذا الجواب، وسقوطُه يتركها بلا خلفيّة.
 */
export async function GET() {
  return handle(
    async () => {
      const seeds = await welcomeSeeds();
      return ok({ posters: seeds.map((s) => s.posterPath).filter((p): p is string => !!p) }, []);
    },
    { cacheControl: "public, max-age=3600, s-maxage=3600", open: true },
  );
}
