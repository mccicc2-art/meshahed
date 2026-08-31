import "server-only";

/**
 * **هل مزوّدُ X مفعَّلٌ في المشروع الآن؟** (D-839)
 *
 * 🔑 **زرٌّ يَعِد بربطٍ ولا مزوّدَ خلفه أسوأُ من غيابه** (D-217) —
 * **والبديلُ عن هذا الفحص أن يضغط العضوُ فيرى خطأً من GoTrue بلغةٍ
 * لا يفهمها.** **فالصفُّ لا يُرسم حتّى يوجد ما يفتحه.**
 *
 * 🔑 **ولا متغيّرَ بيئةٍ ثانٍ يُضاف ليُنسى**: **GoTrue نفسُها تعلن ما
 * لديها** على `/auth/v1/settings` — **فمصدرُ الحقيقة هو المشروع لا
 * راية نكتبها بيدنا**، **والزرُّ يظهر في اللحظة التي يُفعَّل فيها
 * المزوّد بلا نشرٍ جديد** (وهي قاعدةُ D-570: **الحالةُ تُقاس ولا
 * تُفترض**).
 *
 * ⚠️ **والافتراضُ عند أيِّ فشلٍ «مطفأ»**: شبكةٌ تعثّرت أو شكلٌ تغيّر —
 * **والغيابُ أهونُ من بابٍ يُفتح على خطأ** (D-179: الافتراضُ الآمن
 * أقلُّ سلوكاً).
 *
 * ⚠️ **ومهلةٌ في الذاكرة عشرُ دقائق**: **هذه القيمةُ تتغيّر مرّةً في
 * عمر المشروع** — **ونداءُ شبكةٍ مع كلِّ فتحةِ صفحةِ تعديلٍ ثمنٌ بلا
 * مقابل** (D-470). **وذاكرةُ العمليّة تكفي**: خطأُ قراءةٍ عمرُه عشرُ
 * دقائق بعد التفعيل، **ولا شيءَ يُكسر.**
 */

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; on: boolean } | null = null;

export async function xLinkEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.on;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  let on = false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      /* **لا كاشَ لطبقة Next هنا**: المهلةُ أعلاه هي الكاش،
         **وكاشان لقيمةٍ واحدةٍ يفترقان** (D-145). */
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { external?: Record<string, unknown> };
      /* 🔴 **والمفتاحُ `x` لا `twitter` — وقد كتبتُها `twitter` تخميناً**:
     **`twitter` مزوّدُ OAuth 1.0a المهجور** («Twitter (Deprecated)» في
     اللوحة)، **و`x` مزوّدُ OAuth 2.0** («X / Twitter (OAuth 2.0)»).
     **والدليلُ من اللوحة نفسِها لا من الوثائق**: حقلا استمارتِه
     `EXTERNAL_X_CLIENT_ID` و`EXTERNAL_X_SECRET` — **و`auth-js` تفصل
     بينهما في نوعها بتعليقين: الأوّلُ OAuth 1.0a والثاني OAuth 2.0.**
     ⚠️ **فمن فعّل «Twitter (Deprecated)» لن يعمل عنده شيء** — **والصوابُ
     تفعيلُ الثاني.** 🔑 **والدرس: اسمُ المفتاح يُقرأ من الاستمارة لا
     يُشتقّ من اسم العلامة.** */
      on = body.external?.x === true;
    }
  } catch {
    on = false;
  }

  cache = { at: now, on };
  return on;
}
