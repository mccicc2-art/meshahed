import Link from "next/link";
import type { Metadata } from "next";
import { getT, getLocale } from "@/lib/locale";
import { Icon } from "@/components/Icon";
import { seoKeywords } from "@/lib/seo";
import { FOUNDER_PLUS_UNTIL } from "@/lib/plan";
import { SECTIONS } from "@/lib/features";

/* عنوانٌ ووصفٌ بلغة الزائر لا بالإنجليزية دائماً (D-122): هذه صفحةٌ عامّة
   تُفهرَس، وسطرُ الوصف في نتيجة البحث هو الإعلان الوحيد الذي نملكه —
   وأكثر جمهورنا يقرأ العربية. و«— Loopz» يُلحَق آلياً بقالب التخطيط. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ar = locale === "ar";
  return {
    title: ar ? "المميزات" : "Features",
    description: ar
      ? "كل ما يقدر عليه Loopz في صفحة واحدة: تتبّع الحلقات والأفلام والأنمي، اليوميات والإحصاءات، القوائم والجوائز، الأصدقاء والرسائل — مجاناً، وما يخصّ Loopz+ موسومٌ بجانبه."
      : "Everything Loopz can do, in one honest page: episode, movie and anime tracking, diary and stats, lists and awards, friends and messages — free, with anything Loopz+ marked beside it.",
    keywords: seoKeywords(locale),
    alternates: { canonical: "/features" },
    openGraph: { type: "article", url: "/features" },
  };
}

/**
 * مميزات Loopz — الحصر الذي طلبه أحمد (تدقيق 8 Aug، القسم ٢): الميزات
 * كثرت ولا صفحة واحدة تعرضها، فالمستخدم لا يعرف ما المتاح له.
 *
 * صفحةٌ عامّة بلا حارس (نمط صفحة الشروط): تعريفٌ بالمنتج يصلح أن يفتحه
 * زائرٌ قبل أن يسجّل. والنصّ داخل الملف لا في القاموس المشترك — محتوىً
 * تحريريّ طويل كنصّ الشروط، لا مفردات واجهة.
 *
 * كل ميزة تحمل وسمها في خانةٍ واحدة: «مجاني» أو «Loopz+» أو «قريباً».
 * 🆕 **والوعدُ المكتوب هنا وُفِّي** (D-633 ثمّ D-783/786): جاء الاشتراك
 * فتبدّل وسمُ بنودٍ بعينها في البنية نفسِها، **ولم يُعَد بناءُ شيء** —
 * **والثمنُ وحدَه انتقل إلى القاموس** لأنّه يظهر في أربعة أسطح.
 */


export default async function FeaturesPage() {
  const { locale, t } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">{ar ? "مميزات Loopz" : "Loopz features"}</h1>
      <p className="text-sm text-muted mt-1.5 leading-relaxed">
        {/* ⚖️ 🆕 **«كلُّ شيءٍ مجّانيٌّ اليوم» سطرٌ كذب بعد D-633** — والصفحةُ
            اسمُها «صادقة»: **صفحةٌ تعِد بما نقضته وسومُها أسوأُ من صفحةٍ
            بلا مقدّمة.** فصارت المقدّمةُ تشرح الوسومَ الثلاثةَ لا تَعِد
            بمجّانيّةٍ شاملة. */}
        {ar
          ? "كل ما يقدر عليه التطبيق، في صفحة واحدة صادقة — وكلُّ بندٍ موسومٌ بما هو عليه: «مجاني» للجميع، و«Loopz+» لمن اشترك، و«قريباً» لما هو قيد العمل. كي لا يختلط الوعد بالمتاح."
          : "Everything the app can do, on one honest page — and every line is marked for what it is: “Free” for everyone, “Loopz+” for subscribers, “Soon” for what is still being built, so a promise never reads as a feature."}
      </p>

      <div className="mt-8 space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.en}>
            <h2 className="flex items-center gap-2 text-20 font-bold mb-3">
              <Icon name={s.icon} size={18} className="text-muted" />
              {ar ? s.ar : s.en}
            </h2>
            <ul className="space-y-2.5">
              {s.items.map((f) => (
                <li
                  key={f.en}
                  className="flex items-start gap-3 bg-surface-2/60 border border-border rounded-2xl px-4 py-3"
                >
                  <Icon name={f.icon} size={18} className="text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight">{ar ? f.ar : f.en}</p>
                    <p className="text-12 text-muted leading-relaxed mt-0.5">
                      {ar ? f.arBody : f.enBody}
                    </p>
                  </div>
                  {/* وسمان في خانةٍ واحدة: «مجاني» بلون النجاح (D-003)، و«قريباً»
                      بلون الهوية — لونٌ يفرّق الوعد عن المتاح بلا صفٍّ ثانٍ.
                      ويوم يأتي الاشتراك يتبدّل وسم بنودٍ بعينها إلى «بريميوم»
                      في نفس الخانة، فلا يُعاد بناء شيء. */}
                  <span
                    className={`shrink-0 text-12 font-bold rounded-full px-2.5 py-1 border whitespace-nowrap ${
                      f.plus || f.soon
                        ? "text-accent border-accent/35 bg-accent/10"
                        : "text-[color:var(--success)] border-[color:var(--success)]/35 bg-[color:var(--success)]/10"
                    }`}
                  >
                    {f.plus
                      ? f.soon
                        ? ar
                          ? "Loopz+ قريباً"
                          : "Loopz+ soon"
                        : "Loopz+"
                      : f.soon
                        ? ar
                          ? "قريباً"
                          : "Soon"
                        : ar
                          ? "مجاني"
                          : "Free"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted mt-10 leading-relaxed">
        {/* ⚖️ 🆕 **والوعدُ وُفِّي في مكانه** (D-633): كان السطرُ يقول «لا
            اشتراك اليوم، وإن جاء ستقول هذه الصفحةُ بوضوحٍ ما يبقى
            مجّانيّاً» — **وقد جاء، فقالت.** */}
        {ar
          ? `المتابعة والقوائم والمجتمع والبحث والترجمة مجّانيةٌ للجميع دائماً — و Loopz+ (${t.plusPrice}، ${t.plusPriceRenew}) للثيمات الملوّنة وتنسيق صفحاتك. `
          : `Tracking, lists, community, search and translation are free for everyone, always — Loopz+ (${t.plusPrice}, ${t.plusPriceRenew}) covers colour themes and shaping your pages. `}
        <Link href="/plus" className="text-accent hover:underline">
          {t.plusLearnMore}
        </Link>
      </p>
    </article>
  );
}
