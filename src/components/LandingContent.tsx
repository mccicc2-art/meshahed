import Link from "next/link";
import { faqs } from "@/lib/seo";
import type { Locale } from "@/core/i18n";

/**
 * ما تحت الشاشة الأولى في الجذر — المحتوى الذي لم يكن موجوداً (D-122).
 *
 * السبب بلا تجميل: محرّك البحث لا يرتّب صفحةً على معنىً غير مكتوبٍ فيها.
 * كانت واجهتنا للعالم عنواناً من سطرين وجدار ملصقاتٍ بلا نص، فلم يكن
 * أمام قوقل ما يربطنا به بـ«تتبّع المسلسلات» أو «watchlist app». هنا نصٌّ
 * حقيقي يشرح المنتج ويجيب أسئلةً تُكتب فعلاً في مربّع البحث.
 *
 * والشاشة الأولى لم تُمَسّ: هذا القسم يبدأ بعدها، فمن جاء ليسجّل الدخول
 * يرى ما كان يراه بالضبط، ومن جاء ليقرأ يمرّر.
 *
 * الأسئلة مصدرها `seo.ts` نفسه الذي يبني `FAQPage` المُهيكل — نصٌّ واحد
 * على الشاشة وفي البيانات المهيكلة. اختلافهما يُعدّ تمويهاً (cloaking)
 * وعقوبته إسقاط النتيجة الغنيّة كلّها.
 */

export function LandingContent({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const items = faqs(locale);

  return (
    /* الاتجاه صريحٌ هنا لا موروث: هذا القسم نصٌّ طويل، وقلبُ اتجاهه
       يكسر ترقيمه ونقاطه — بينما البطل فوقه متوسّطٌ لا يتأثّر */
    /* 🆕 **و`data-landing-seo` ليس تنسيقاً بل هويّة** (D-843):
       **هذا القسمُ مكتوبٌ لمحرّك بحث** — وقد قاله رأسُ الملفّ بنفسه —
       **وتطبيقٌ مثبَّتٌ لا محرّكَ بحثٍ فيه**، فتُخفيه ورقةُ الأنماط هناك.
       ⚠️ **والسمةُ لا الصنف**: الصنفُ يُنسخ ويُعاد استعمالُه بلا معنًى،
       **والسمةُ تقول «أنا الذيلُ التسويقيّ» وحدَها.** */
    <section data-landing-seo className="pt-14 pb-4" dir={ar ? "rtl" : "ltr"}>
      {/* ما هو Loopz — الفقرة التي يقرؤها المحرّك والزائر معاً */}
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {ar ? "ما هو Loopz؟" : "What is Loopz?"}
        </h2>
        <p className="mt-3 text-sm sm:text-15 text-muted leading-relaxed">
          {ar
            ? "Loopz منصّة لتتبّع كل ما تشاهده: المسلسلات والأفلام والأنمي في مكانٍ واحد. بدل أن تحاول تذكّر أين توقّفت في كل عمل، تعلّم ما شاهدته فيتولّى Loopz الباقي — يحسب تقدّمك، ويذكّرك بحلقتك القادمة، ويحفظ تقييماتك ويومياتك وقوائمك، ويريك ما يشاهده أصدقاؤك."
            : "Loopz is a platform for tracking everything you watch: shows, movies and anime in one place. Instead of trying to remember where you stopped in each title, you tick what you watched and Loopz does the rest — it computes your progress, surfaces your next episode, keeps your ratings, diary and lists, and shows you what your friends are watching."}
        </p>
        <p className="mt-2.5 text-sm sm:text-15 text-muted leading-relaxed">
          {ar
            ? "يعمل في المتصفّح على الجوال والحاسوب بلا تنزيل، ويمكن تثبيته على شاشتك الرئيسية. الكتالوج من TMDB وأرقام التقييم من IMDb وRotten Tomatoes. يعمل بالعربية والإنجليزية بالكامل — بواجهةٍ من اليمين إلى اليسار حين تلزم — ولغاتٌ أخرى في الطريق. وكل شيء فيه مجاني اليوم بلا إعلانات."
            : "It runs in the browser on phone and desktop with nothing to download, and installs to your home screen if you want it there. The catalogue comes from TMDB and the rating numbers from IMDb and Rotten Tomatoes. It runs fully in English and Arabic — right-to-left included — with more languages on the way. Everything is free today, with no ads."}
        </p>
      </div>

      {/* 🔴 🆕 **بطاقاتُ الميزات السبعُ خرجت من هنا إلى `LandingShowcase`**
          (D-844، بحكم أحمد: «هذي الصفحة كلها كلام»): **نصُّها انتقل
          بحرفه** فصار مكتوباً بجانب شاشةٍ حيّةٍ تُريه — **ولم يسقط سطرٌ
          من الصفحة**، فبقي ما يربطها بما يُكتب في مربّع البحث (حجّةُ
          D-122 التي وُلد هذا القسمُ لأجلها).
          ⚠️ **ولا تُعاد كتابتُها هنا**: نسختان من نصٍّ واحدٍ تفترقان عند
          أوّل تحرير (D-145)، **وقارئُ الصفحة يقرؤه مرّتين.** */}
      <p className="mt-8 text-center text-14">
        <Link href="/features" className="text-accent hover:underline font-semibold">
          {ar ? "استعرض كل المميزات ←" : "See every feature →"}
        </Link>
      </p>

      {/* الانتقال من تطبيقٍ آخر — نيّةٌ عالية: من يبحث عن «بديل TV Time»
          يريد أن ينقل سجلّه لا أن يقرأ جدولاً. الجدول حُذف بقرار أحمد
          (لا نُروّج لأسماء المنافسين في صفحتنا)، والاستيراد ميزةٌ عندنا
          فيبقى ذكرُه — تعريفاً بما نقدر عليه لا مقارنة. */}
      <div className="mt-12 max-w-2xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {ar ? "تنقل من تطبيقٍ آخر؟" : "Moving from another app?"}
        </h2>
        <p className="mt-3 text-sm sm:text-15 text-muted leading-relaxed">
          {ar
            ? "لا تبدأ من الصفر: صدّر سجلّ مشاهدتك من Letterboxd أو Simkl أو TV Time وارفع الملف في إعدادات Loopz — تُطابَق أعمالك مع الكتالوج وتنتقل مشاهداتك دفعةً واحدة، بحلقاتها وتواريخها."
            : "You do not start from zero: export your watch history from Letterboxd, Simkl or TV Time, upload the file in Loopz settings, and your titles are matched against the catalogue — episodes, dates and all — in one go."}
        </p>
      </div>

      {/* الأسئلة الشائعة — نصٌّ ظاهر، وهو نفسه الذي يُحقن كـFAQPage */}
      <div className="mt-12">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-center">
          {ar ? "أسئلة شائعة" : "Frequently asked questions"}
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 max-w-4xl mx-auto">
          {items.map((f) => (
            <div key={f.q} className="bg-surface-2/60 border border-border rounded-2xl px-4 py-3.5">
              <h3 className="text-sm font-bold leading-tight">{f.q}</h3>
              <p className="text-12 text-muted leading-relaxed mt-1.5">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* نداءٌ أخير — من قرأ حتى هنا لا ينبغي أن يبحث عن الزرّ في الأعلى */}
      <div className="mt-12 text-center">
        <Link
          href="/login"
          /* 🔴 🆕 **`--on-accent` عقدٌ مع `--accent` لا مع الهويّة**
             (D-846): كان النصُّ `--on-accent` فوق `--gradient-brand-x`
             — 📏 **وفي `daylight` ذلك أبيضُ (#ffffff) فوق أصفرَ ساطع:
             تباينُ ١٫٤٣** — **وهو زرُّ التحويل الوحيدُ في الصفحة.**
             **والسطحُ صار `--gradient-brand-text`** — الهويّةُ بدرجتها
             التي تُقرأ — **والنصُّ `--foreground` عليه**: 🔑 **`--on-accent`
             عقدُ `--accent` وحدَه، ووضعُه فوق سطحٍ آخر يكسر العقد من
             طرفيه.** **والثيماتُ الداكنةُ ترث الثلاثيَّ حرفاً.** */
          className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-[color:var(--background)]"
          style={{ background: "var(--gradient-brand-text)" }}
        >
          {ar ? "ابدأ مجاناً" : "Start free"}
        </Link>
        <p className="mt-2.5 text-12 text-muted/70">
          {ar
            ? "بحساب Google، بلا كلمة مرور — وبياناتك قابلة للتصدير أو الحذف متى شئت."
            : "With your Google account, no password — and your data can be exported or deleted whenever you want."}
        </p>
      </div>
    </section>
  );
}
