import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/locale";
import { JsonLd } from "@/components/JsonLd";
import {
  COMPARE_APPS,
  COMPARE_ROWS,
  breadcrumbGraph,
  compareHonesty,
  seoKeywords,
  type Verdict,
} from "@/lib/seo";
import { getLocale } from "@/lib/locale";

/**
 * Loopz مقابل غيره — صفحةٌ عامّة بلا حارس (D-122).
 *
 * لماذا صفحةٌ مستقلّة لا فقرة في الهبوط: «بديل TV Time» و«Trakt
 * alternative» عباراتُ بحثٍ حقيقية بنيّةٍ عالية — من يكتبها يريد أن
 * ينتقل. ولا تُرتَّب صفحةٌ على عبارةٍ إلا إذا كانت الصفحة كلّها عنها.
 *
 * وشرطُ نجاحها الصدق: جدولٌ يمنحنا كل النقاط يُكتشف في دقيقة، ومن نقر ثم
 * عاد خاسراً هو الإشارة الوحيدة التي يقيسها قوقل بدقّة. فتحته قسمٌ صريح
 * بما يتفوّق فيه المنافسون علينا — Trakt في التسجيل التلقائي، Letterboxd
 * في عمق النقد، TV Time في الحجم، Simkl في التكاملات.
 *
 * والنصّ داخل `seo.ts` لا هنا: نفس البيانات تبني الجدول والبيانات
 * المُهيكلة، فلا يفترقان.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ar = locale === "ar";
  return {
    /* `absolute` يتجاوز قالب التخطيط: العنوان يبدأ باسمنا أصلاً، وإلحاق
       «— Loopz» به يكرّر الاسم مرّتين في نتيجة البحث */
    title: {
      absolute: ar
        ? "Loopz مقابل TV Time وTrakt وLetterboxd وSimkl — مقارنة صريحة"
        : "Loopz vs TV Time, Trakt, Letterboxd and Simkl — an honest comparison",
    },
    description: ar
      ? "مقارنة صريحة بين Loopz وTV Time وTrakt وLetterboxd وSimkl لتتبّع المسلسلات والأفلام والأنمي — بما فيها ما يتفوّق فيه غيرنا، وكيف تنقل سجلّك."
      : "An honest comparison of Loopz, TV Time, Trakt, Letterboxd and Simkl for tracking shows, movies and anime — including where the others are better, and how to import your history.",
    keywords: seoKeywords(locale),
    alternates: { canonical: "/compare" },
    openGraph: {
      type: "article",
      url: "/compare",
      title: ar ? "Loopz مقابل TV Time وTrakt وLetterboxd" : "Loopz vs TV Time, Trakt, Letterboxd",
    },
  };
}

/** علامةٌ واحدة لكل حكم — لونٌ ورمزٌ ووصفٌ للقارئ الصوتي */
function Mark({ v, ar }: { v: Verdict; ar: boolean }) {
  const label =
    v === "yes" ? (ar ? "نعم" : "Yes") : v === "part" ? (ar ? "جزئياً" : "Partly") : ar ? "لا" : "No";
  const cls =
    v === "yes"
      ? "text-[color:var(--success)]"
      : v === "part"
        ? "text-muted"
        : "text-muted/35";
  return (
    <span className={`font-bold ${cls}`} title={label}>
      <span aria-hidden>{v === "yes" ? "✓" : v === "part" ? "~" : "—"}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default async function ComparePage() {
  const { locale } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-3xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <JsonLd
        data={breadcrumbGraph([
          { name: "Loopz", path: "/" },
          { name: ar ? "المقارنة" : "Compare", path: "/compare" },
        ])}
      />

      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3 leading-snug">
        {ar
          ? "Loopz مقابل TV Time وTrakt وLetterboxd وSimkl"
          : "Loopz vs TV Time, Trakt, Letterboxd and Simkl"}
      </h1>
      <p className="text-sm text-muted mt-2 leading-relaxed">
        {ar
          ? "كلها تطبيقات تتبّع مشاهدة، ولكلٍّ منها ما يجيده. هذه مقارنةٌ نكتبها نحن — فاقرأها على هذا الأساس، وتحتها قسمٌ يذكر بصراحة ما يتفوّقون فيه علينا."
          : "These are all watch-tracking apps, and each is good at something. We wrote this comparison, so read it on that basis — and below it is a section that states plainly where the others beat us."}
      </p>

      {/* الجدول: يُمرَّر أفقياً على الجوال بدل أن ينضغط حتى يصير غير مقروء */}
      <div className="mt-7 overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[560px] text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="text-start font-bold pb-2.5 pe-3">{ar ? "الميزة" : "Feature"}</th>
              {COMPARE_APPS.map((app) => (
                <th
                  key={app}
                  className={`pb-2.5 px-2 text-center text-[12px] font-bold whitespace-nowrap ${
                    app === "Loopz" ? "text-accent" : "text-muted"
                  }`}
                  dir="ltr"
                >
                  {app}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((r) => (
              <tr key={r.en}>
                <td className="py-2.5 pe-3 border-t border-border text-[13px] leading-snug">
                  {ar ? r.ar : r.en}
                </td>
                {([r.loopz, r.tvtime, r.trakt, r.letterboxd, r.simkl] as Verdict[]).map((v, i) => (
                  <td
                    key={i}
                    className={`py-2.5 px-2 border-t border-border text-center ${
                      i === 0 ? "bg-surface-2/50" : ""
                    }`}
                  >
                    <Mark v={v} ar={ar} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted/60 mt-2.5">
        {ar
          ? "✓ متوفّر · ~ جزئي أو بشروط · — غير متوفّر. المعلومات عن التطبيقات الأخرى من نسخها العامة وقت الكتابة، وقد تتغيّر."
          : "✓ available · ~ partial or conditional · — not available. Details about other apps reflect their public versions at the time of writing and may change."}
      </p>

      {/* الاعتراف — القسم الذي يجعل الجدول أعلاه قابلاً للتصديق */}
      <h2 className="text-lg font-bold mt-10">
        {ar ? "أين يتفوّقون علينا" : "Where they beat us"}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {compareHonesty(locale).map((line) => (
          <li
            key={line}
            className="text-[13px] text-muted leading-relaxed bg-surface-2/60 border border-border rounded-2xl px-4 py-3"
          >
            {line}
          </li>
        ))}
      </ul>

      {/* الانتقال — نيّة الباحث عن «بديل» هي هذه الفقرة تحديداً */}
      <h2 className="text-lg font-bold mt-10">
        {ar ? "كيف تنقل سجلّك إلى Loopz" : "How to bring your history over"}
      </h2>
      <ol className="mt-3 space-y-2 text-[13px] text-muted leading-relaxed list-decimal ms-5">
        <li>
          {ar
            ? "صدّر بياناتك من التطبيق القديم — TV Time وTrakt يوفّران تصديراً لسجلّ المشاهدة."
            : "Export your data from the old app — both TV Time and Trakt offer a watch-history export."}
        </li>
        <li>
          {ar
            ? "سجّل دخولك في Loopz بحساب Google، ثم افتح الإعدادات."
            : "Sign in to Loopz with your Google account, then open Settings."}
        </li>
        <li>
          {ar
            ? "ارفع الملف في قسم الاستيراد — تُطابَق أعمالك مع الكتالوج وتُسجَّل مشاهداتك دفعةً واحدة."
            : "Upload the file in the import section — your titles are matched against the catalogue and your watches land in one go."}
        </li>
      </ol>

      <div className="mt-10 text-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-[color:var(--on-accent)]"
          style={{ background: "var(--gradient-brand-x)" }}
        >
          {ar ? "جرّب Loopz مجاناً" : "Try Loopz free"}
        </Link>
        <p className="mt-3 text-[12px] text-muted/70">
          <Link href="/features" className="hover:text-muted transition">
            {ar ? "كل المميزات" : "All features"}
          </Link>
          <span aria-hidden className="mx-2">
            ·
          </span>
          <Link href="/privacy" className="hover:text-muted transition">
            {ar ? "الخصوصية" : "Privacy"}
          </Link>
        </p>
      </div>
    </article>
  );
}
