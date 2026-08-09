import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { faqs } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";

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

interface Highlight {
  icon: IconName;
  ar: string;
  en: string;
  arBody: string;
  enBody: string;
}

const HIGHLIGHTS: Highlight[] = [
  {
    icon: "tv",
    ar: "تتبّع المسلسلات حلقةً حلقة",
    en: "Track shows episode by episode",
    arBody:
      "علّم الحلقة التي وصلتها — أو موسماً كاملاً بضغطة — ويحسب Loopz تقدّمك ويضع حلقتك القادمة في رئيسيتك.",
    enBody:
      "Tick the episode you reached — or a whole season in one tap — and Loopz works out your progress and puts your next episode on your home screen.",
  },
  {
    icon: "film",
    ar: "الأفلام بموضع توقّفك",
    en: "Movies, down to where you stopped",
    arBody:
      "علّم الفيلم مُشاهداً، أو احفظ الدقيقة التي توقّفت عندها وكمّله متى عدت. وإعادة المشاهدة لها عدّادها المستقل.",
    enBody:
      "Mark a film watched, or save the exact minute you stopped and finish it later. Rewatches get their own counter.",
  },
  {
    icon: "sparkles",
    ar: "الأنمي في نفس المكان",
    en: "Anime in the same place",
    arBody:
      "لا تطبيق ثانٍ للأنمي: مواسمه وحلقاته وترتيب مشاهدته داخل مكتبتك مع كل شيء آخر.",
    enBody:
      "No second app for anime: its seasons, episodes and watch order sit in your library beside everything else.",
  },
  {
    icon: "settings",
    ar: "رئيسيةٌ تبنيها أنت",
    en: "A home screen you build",
    arBody:
      "رتّب صفحتك الرئيسية كما تريدها: أظهِر الأقسام التي تهمّك وأخفِ ما لا يهمّك، واختَر الإحصاءات التي تراها وشكل البطاقة نفسها.",
    enBody:
      "Arrange your home page exactly as you want it: show the sections you care about, hide the ones you do not, and choose which stats you see and how cards look.",
  },
  {
    icon: "calendar",
    ar: "يوميات وإحصاءات",
    en: "A diary and real numbers",
    arBody:
      "سجلٌّ يوميّ لما شاهدت، وساعاتك وأنواعك المفضّلة بالأرقام — وبطاقة إحصاءات تشاركها.",
    enBody:
      "A day-by-day log of what you watched, your hours and favourite genres in numbers — and a stats card you can share.",
  },
  {
    icon: "list",
    ar: "قوائم وجوائز وترتيب أحداث",
    en: "Lists, awards and story order",
    arBody:
      "ابنِ قوائمك، أو افتح قوائم جاهزة: مارفل وهاري بوتر بترتيب الأحداث، أفضل 250، والفائزون بالأوسكار والإيمي منذ 1990.",
    enBody:
      "Build your own lists, or open ready-made ones: Marvel and Harry Potter in story order, the Top 250, and Oscar and Emmy winners since 1990.",
  },
  {
    icon: "people",
    ar: "أصدقاؤك ورأيهم",
    en: "Your friends and their taste",
    arBody:
      "تابع أصدقاءك، اقرأ تقييماتهم، تحدّث معهم في المنصّة نفسها — وقرّر أنت من يرى مكتبتك.",
    enBody:
      "Follow friends, read their ratings and talk to them inside the platform — and you decide who sees your library.",
  },
];

export function LandingContent({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const items = faqs(locale);

  return (
    /* الاتجاه صريحٌ هنا لا موروث: هذا القسم نصٌّ طويل، وقلبُ اتجاهه
       يكسر ترقيمه ونقاطه — بينما البطل فوقه متوسّطٌ لا يتأثّر */
    <section className="pt-14 pb-4" dir={ar ? "rtl" : "ltr"}>
      {/* ما هو Loopz — الفقرة التي يقرؤها المحرّك والزائر معاً */}
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {ar ? "ما هو Loopz؟" : "What is Loopz?"}
        </h2>
        <p className="mt-3 text-sm sm:text-[15px] text-muted leading-relaxed">
          {ar
            ? "Loopz منصّة لتتبّع كل ما تشاهده: المسلسلات والأفلام والأنمي في مكانٍ واحد. بدل أن تحاول تذكّر أين توقّفت في كل عمل، تعلّم ما شاهدته فيتولّى Loopz الباقي — يحسب تقدّمك، ويذكّرك بحلقتك القادمة، ويحفظ تقييماتك ويومياتك وقوائمك، ويريك ما يشاهده أصدقاؤك."
            : "Loopz is a platform for tracking everything you watch: shows, movies and anime in one place. Instead of trying to remember where you stopped in each title, you tick what you watched and Loopz does the rest — it computes your progress, surfaces your next episode, keeps your ratings, diary and lists, and shows you what your friends are watching."}
        </p>
        <p className="mt-2.5 text-sm sm:text-[15px] text-muted leading-relaxed">
          {ar
            ? "يعمل في المتصفّح على الجوال والحاسوب بلا تنزيل، ويمكن تثبيته على شاشتك الرئيسية. الكتالوج من TMDB وأرقام التقييم من IMDb وRotten Tomatoes. يعمل بالعربية والإنجليزية بالكامل — بواجهةٍ من اليمين إلى اليسار حين تلزم — ولغاتٌ أخرى في الطريق. وكل شيء فيه مجاني اليوم بلا إعلانات."
            : "It runs in the browser on phone and desktop with nothing to download, and installs to your home screen if you want it there. The catalogue comes from TMDB and the rating numbers from IMDb and Rotten Tomatoes. It runs fully in English and Arabic — right-to-left included — with more languages on the way. Everything is free today, with no ads."}
        </p>
      </div>

      {/* الميزات الست — لكلٍّ عنوانٌ فرعيّ ونصّ، لا أيقونةٌ وكلمة */}
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HIGHLIGHTS.map((h) => (
          <div
            key={h.en}
            className="bg-surface-2/60 border border-border rounded-2xl px-4 py-3.5 flex items-start gap-3"
          >
            <Icon name={h.icon} size={18} className="text-accent shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-tight">{ar ? h.ar : h.en}</h3>
              <p className="text-[13px] text-muted leading-relaxed mt-1">
                {ar ? h.arBody : h.enBody}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[13px]">
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
        <p className="mt-3 text-sm sm:text-[15px] text-muted leading-relaxed">
          {ar
            ? "لا تبدأ من الصفر: صدّر سجلّ مشاهدتك من TV Time أو Trakt وارفع الملف في إعدادات Loopz — تُطابَق أعمالك مع الكتالوج وتنتقل مشاهداتك دفعةً واحدة، بحلقاتها وتواريخها."
            : "You do not start from zero: export your watch history from TV Time or Trakt, upload the file in Loopz settings, and your titles are matched against the catalogue — episodes, dates and all — in one go."}
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
              <p className="text-[13px] text-muted leading-relaxed mt-1.5">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* نداءٌ أخير — من قرأ حتى هنا لا ينبغي أن يبحث عن الزرّ في الأعلى */}
      <div className="mt-12 text-center">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-2xl px-6 py-3 text-sm font-bold text-[color:var(--on-accent)]"
          style={{ background: "var(--gradient-brand-x)" }}
        >
          {ar ? "ابدأ مجاناً" : "Start free"}
        </Link>
        <p className="mt-2.5 text-[12px] text-muted/70">
          {ar
            ? "بحساب Google، بلا كلمة مرور — وبياناتك قابلة للتصدير أو الحذف متى شئت."
            : "With your Google account, no password — and your data can be exported or deleted whenever you want."}
        </p>
      </div>
    </section>
  );
}
