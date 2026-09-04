import Link from "next/link";
import type { Metadata } from "next";
import { getT, getLocale } from "@/lib/locale";
import { Icon, type IconName } from "@/components/Icon";
import { seoKeywords } from "@/lib/seo";
import { FOUNDER_PLUS_UNTIL } from "@/core/plan";

/* صفحةُ البيع تُفهرَس كأختها `/features`: **الوصفُ هو الإعلانُ الوحيد
   الذي نملكه** في نتيجة البحث، ويُكتب بلغة الزائر لا بالإنجليزية دائماً
   (D-122). و«— Loopz» يُلحَق آلياً بقالب التخطيط. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const ar = locale === "ar";
  return {
    title: ar ? "Loopz+" : "Loopz+",
    description: ar
      ? "Loopz+ — الثيمات الملوّنة، وتنسيق رئيسيتك وملفّك، وشارةٌ بجانب اسمك. والمتابعة والقوائم والمجتمع والبحث تبقى مجّانيةً للجميع دائماً."
      : "Loopz+ — colour themes, a home and profile you shape yourself, and a badge beside your name. Tracking, lists, community and search stay free for everyone, always.",
    keywords: seoKeywords(locale),
    alternates: { canonical: "/plus" },
    openGraph: { type: "article", url: "/plus" },
  };
}

/**
 * صفحةُ Loopz+ — **صفحةُ البيع بقاعدة أحمد الصريحة** (٢٩ أغسطس، D-783
 * §٠‑٢): **«لا يظهر فيها إلّا الجاهزُ فعلاً، والبقيّةُ داخل قريباً».**
 *
 * ⚖️ **وهي قاعدةٌ صحيحةٌ تماماً، ولقطتُه الأولى كانت تخالفها**: سبعةٌ من
 * بنودها الثمانية لم تكن مبنيّة. **وصفحةُ بيعٍ تعرض ما لا يُسلَّم لا
 * تبيع مرّتين** — أوّلُ مشترٍ يكتشف الفرق يكتبه للناس.
 *
 * 🚫 **ولا زرَّ شراءٍ هنا** (D-217): بوّابةُ الدفع لم تُفتح، **وزرٌّ
 * يَعِد بما لا يُسلِّمه أسوأُ من غيابه.** الصفحةُ تقول الثمنَ ومتى،
 * وتصمت عمّا لا تستطيع — **ويومَ تصل البوّابة يصير سطرُ الثمن زرّاً،
 * ولا يتغيّر شيءٌ آخر.**
 *
 * **والنصُّ داخل الملفّ لا في القاموس المشترك** — نمطُ `/features`
 * حرفاً: محتوىً تحريريٌّ طويلٌ كنصّ الشروط، لا مفرداتُ واجهة.
 * **إلّا الثمنَ**: هو وحدَه من القاموس (`t.plusPrice`)، **لأنّه الرقمُ
 * الذي يظهر في أربعة أسطحٍ** — الورقةُ وصفُّ الفوترة و`/features` وهذه
 * الصفحة — **ورقمٌ منسوخٌ في أربعةِ ملفّاتٍ يفترق في الرابع** (D-633 §٥).
 */

interface Perk {
  icon: IconName;
  ar: string;
  en: string;
  arBody: string;
  enBody: string;
  /** بندٌ يشترط تطبيقاً أصليّاً قبل أن يُبنى (`ios-capacitor-plan`) */
  app?: boolean;
}

/**
 * 🟢 **الثمانيةُ الجاهزون — مقفولون حيّاً اليوم.**
 *
 * **كلُّ سطرٍ هنا فُحص في الشيفرة بالاسم لا بالذاكرة** (كشفُ D-783):
 * الثيماتُ في `ThemeSection` · التنسيقان في `HomeCustomize`
 * و`ProfileCustomize` · الشارةُ في `AccountIdentity` · الشعارُ في
 * `Navbar` · صفةُ المؤسِّس في الهجرة ١٤١ · **وأغلفةُ الأعمال أُقفلت في
 * هذه الجولة** (`canUseArt`، D-786).
 */
const READY: Perk[] = [
  {
    icon: "palette",
    ar: "خمسة ثيمات ملوّنة",
    en: "Five colour themes",
    arBody:
      "لوبز والمحيط والبنفسجي والقرمزي والغابة — تبدّل مظهر التطبيق كاملاً. والوضع النهاري وحجم الخط يبقيان مجّانيين للجميع.",
    enBody:
      "Loopz, Ocean, Violet, Crimson and Forest — each changes the whole look. Daylight mode and text size stay free for everyone.",
  },
  {
    icon: "grid",
    ar: "رئيسيةٌ تبنيها أنت",
    en: "A home screen you build",
    arBody:
      "رتّب الأقسام وأظهِر ما يهمّك وأخفِ ما لا يهمّك، واختر الكثافة ومقاسات البوسترات.",
    enBody:
      "Order your sections, show what matters and hide what does not, and choose density and poster sizes.",
  },
  {
    icon: "sliders",
    ar: "ملفٌّ شخصيٌّ تنسّقه",
    en: "A profile you shape",
    arBody: "ترتيب أقسام ملفّك وإظهارها، وما يراه زوّارك أوّلاً.",
    enBody: "Order and show the sections of your profile, and what visitors see first.",
  },
  {
    icon: "card",
    ar: "شكل البطاقة وإحصاءات ترويستك",
    en: "Card layout and header stats",
    arBody: "اختر ما يظهر على بطاقة العمل، وأيّ أرقامٍ تراها في ترويسة رئيسيتك.",
    enBody: "Choose what appears on a title card, and which numbers sit in your home header.",
  },
  {
    icon: "image",
    ar: "بوستر وخلفية لكلّ عمل",
    en: "Your own poster and backdrop",
    arBody:
      "اختر ملصق العمل وخلفيته كما تحبّ — والأثر لا يتعدّى أسطحك أنت: مكتبتك وصفحة العمل عندك وملفّك.",
    enBody:
      "Pick the poster and backdrop you want for a title — and it only ever changes your surfaces: your library, your title page, your profile.",
  },
  {
    icon: "sparkles",
    ar: "شارةٌ بجانب اسمك",
    en: "A badge beside your name",
    arBody: "علامة Loopz+ تظهر مع اسمك في كل سطحٍ يحمله — رمزٌ بلا كلمة.",
    enBody: "The Loopz+ mark appears with your name on every surface that carries it — a mark, not a label.",
  },
  {
    icon: "star",
    ar: "شعار Loopz+ في تجربتك",
    en: "The Loopz+ wordmark",
    arBody: "شعار التطبيق في شريطك العلوي يصير Loopz+ ما دمت مشتركاً.",
    enBody: "The wordmark in your top bar becomes Loopz+ for as long as you subscribe.",
  },
  {
    icon: "sparkle-star",
    ar: "شارة «مؤسِّس» للأوائل",
    en: "A Founder badge for the first members",
    /* ⚖️ 🆕 **وجملةُ «لا خدمةَ تُنتزع من عضوٍ قائم» سقطت معها** (D-833):
       **مدّةُ البلس صارت محدودةً بحكم صاحبها** — **وجملةٌ تنفي ما وقع
       تكذب مرّتين: مرّةً بالوعد ومرّةً بالمبدأ.** **والباقي صدقٌ يُقال:
       الصفةُ لا تُنتزع.** */
    arBody: `من سجّل قبل إعلان الاشتراك يحمل شارة مؤسِّس دائماً — والصفة لا تنتهي — ومعها Loopz+ حتى ${FOUNDER_PLUS_UNTIL.ar}.`,
    enBody: `Everyone who joined before subscriptions were announced keeps a Founder badge for good — the status never expires — with Loopz+ until ${FOUNDER_PLUS_UNTIL.en}.`,
  },
];

/**
 * ⬜ **قريباً — والصفحةُ تفصلها عن الأعلى بحدٍّ صريح.**
 *
 * **ولا بندَ هنا يُباع اليوم**: هذا هو الفرقُ بين صفحةِ بيعٍ صادقةٍ
 * وقائمةِ أمنيات. **وما يشترط تطبيقاً موسومٌ بذلك** — فمن يشتري لأجل
 * ودجتٍ على شاشة قفله يستحقّ أن يعرف أنّها تنتظر تطبيقاً لم يُبنَ.
 */
const COMING: Perk[] = [
  {
    icon: "chart",
    ar: "تقارير أسبوعية وشهرية وسنوية",
    en: "Weekly, monthly and yearly reports",
    arBody: "ملخّصٌ يصلك بما شاهدته وكيف تغيّر ذوقك. وإحصاءاتك الحالية تبقى مجّانيةً كما هي.",
    enBody: "A recap of what you watched and how your taste shifted. Your current stats stay free exactly as they are.",
  },
  {
    icon: "calendar",
    ar: "Loopz Rewind",
    en: "Loopz Rewind",
    arBody: "سنتك في Loopz بصفحةٍ واحدةٍ تشاركها.",
    enBody: "Your year on Loopz, in one page worth sharing.",
  },
  {
    icon: "list",
    ar: "قوائم ذكيّة ومجموعات تلقائية",
    en: "Smart lists and automatic collections",
    arBody: "قوائم تتحدّث بنفسها بشروطٍ تضعها، ومجموعاتٌ تُبنى تلقائياً حول سلسلةٍ أو عالمٍ أو مخرج.",
    enBody: "Lists that update themselves from rules you set, and collections built automatically around a saga, a universe or a director.",
  },
  {
    icon: "search",
    ar: "حفظ الفلاتر وتسميتها",
    en: "Saved, named filters",
    arBody: "احفظ تركيبة فلاترك باسمٍ تختاره، واجعل لكلّ قسمٍ فلتراً افتراضياً.",
    enBody: "Save a filter combination under your own name, and give each section a default.",
  },
  {
    icon: "people",
    ar: "مقارنة الذوق مع أصدقائك",
    en: "Compare taste with friends",
    arBody: "ما تتّفقان عليه وما تختلفان فيه، ونسبة التقارب.",
    enBody: "What you agree on, what you do not, and how close your taste really is.",
  },
  {
    icon: "globe",
    ar: "تحليل الدول واللغات",
    en: "Countries and languages",
    arBody: "من أين تأتي الأعمال التي تحبّها فعلاً، وبأيّ لغةٍ تشاهد أكثر.",
    enBody: "Where the work you actually love comes from, and which languages you watch most.",
  },
  {
    icon: "comment",
    ar: "أدوات المجتمع",
    en: "Community tools",
    arBody: "إبراز منشوراتك، وتمييز ردّ صاحب المنشور، وتثبيت ردٍّ داخل منشوراتك، وتخصيص بطاقات مراجعاتك.",
    enBody: "Highlight your posts, mark the author’s own reply, pin a reply inside your posts, and style your review cards.",
  },
  {
    icon: "bookmark",
    ar: "شارة مدّة العضوية",
    en: "Membership-length badge",
    arBody: "«Plus منذ ٢٠٢٦» — وأنت تتحكّم في إظهار شاراتك من الأساس.",
    enBody: "“Plus since 2026” — and you control which of your badges show at all.",
  },
  {
    icon: "bell",
    ar: "ودجت وتنبيهات الحلقات",
    en: "Widgets and episode alerts",
    arBody: "ودجت للشاشة الرئيسية وشاشة القفل، وتنبيهٌ فوريّ حين تنزل حلقةٌ تتابعها.",
    enBody: "Home-screen and lock-screen widgets, and an instant alert the moment an episode you follow lands.",
    app: true,
  },
  {
    icon: "tv",
    ar: "تسجيلٌ تلقائي وربط المنصّات",
    en: "Automatic tracking and platform linking",
    arBody: "اربط منصّات البثّ واشتراك IPTV مرّةً واحدة، وتتدفّق مشاهداتك بلا تعليمٍ يدوي.",
    enBody: "Link your streaming platforms and IPTV once, and your watches flow in with no manual ticking.",
    app: true,
  },
];

export default async function PlusPage() {
  const { locale, t } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">Loopz+</h1>
      <p className="text-sm text-muted mt-1.5 leading-relaxed">
        {ar
          ? "Loopz+ زينةٌ وتنسيق، لا وظيفة. المتابعة والقوائم والمجتمع والبحث والترجمة مجّانيةٌ للجميع دائماً — والاشتراك للثيمات ولتنسيق صفحاتك كما تحبّها أنت."
          : "Loopz+ is polish, not function. Tracking, lists, community, search and translation are free for everyone, always — the subscription is for themes and for shaping your pages the way you want them."}
      </p>

      {/* 🚫 **بطاقةُ الثمن بلا زرّ** (D-217): تقول كم، وماذا بعد السنة
          الأولى، وبأيّ عملة، ومتى — **وتصمت عن وعدٍ لا تملك تسليمه.** */}
      <div className="mt-6 rounded-2xl border border-accent/35 bg-accent/10 px-5 py-4">
        <div className="flex items-start gap-3">
          <Icon name="sparkle-star" size={20} className="text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight">{t.plusPrice}</p>
            <p className="text-12 text-muted mt-1 leading-relaxed">{t.plusPriceRenew}</p>
            <p className="text-12 text-muted mt-0.5 leading-relaxed">{t.plusPriceLocal}</p>
            <p className="text-12 font-bold text-accent mt-2 leading-none">{t.plusSoon}</p>
          </div>
        </div>
      </div>

      <section className="mt-9">
        <h2 className="flex items-center gap-2 text-20 font-bold mb-3">
          <Icon name="check" size={18} className="text-muted" />
          {ar ? "ما تحصل عليه اليوم" : "What you get today"}
        </h2>
        <ul className="space-y-2.5">
          {READY.map((f) => (
            <li
              key={f.en}
              className="flex items-start gap-3 bg-surface-2/60 border border-border rounded-2xl px-4 py-3"
            >
              <Icon name={f.icon} size={18} className="text-accent shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{ar ? f.ar : f.en}</p>
                <p className="text-12 text-muted leading-relaxed mt-0.5">{ar ? f.arBody : f.enBody}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-9">
        <h2 className="flex items-center gap-2 text-20 font-bold mb-1.5">
          <Icon name="hourglass" size={18} className="text-muted" />
          {ar ? "قريباً في Loopz+" : "Coming to Loopz+"}
        </h2>
        <p className="text-12 text-muted leading-relaxed mb-3">
          {ar
            ? "هذه لم تُبنَ بعد، ولا يُباع منها شيءٌ اليوم — مكتوبةٌ هنا كي تعرف الاتجاه، لا كي تُحسب ضمن ما تدفع فيه."
            : "None of these are built yet, and none of them are being sold today — they are listed so you know the direction, not so they count as what you are paying for."}
        </p>
        <ul className="space-y-2.5">
          {COMING.map((f) => (
            <li
              key={f.en}
              className="flex items-start gap-3 bg-surface-2/40 border border-border rounded-2xl px-4 py-3"
            >
              <Icon name={f.icon} size={18} className="text-muted shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{ar ? f.ar : f.en}</p>
                <p className="text-12 text-muted leading-relaxed mt-0.5">{ar ? f.arBody : f.enBody}</p>
              </div>
              {f.app && (
                <span className="shrink-0 text-12 font-bold rounded-full px-2.5 py-1 border whitespace-nowrap text-muted border-border">
                  {ar ? "مع التطبيق" : "With the app"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted mt-10 leading-relaxed">
        {ar
          ? "التوثيق لا يُباع ولا يأتي مع Loopz+ — يُقدَّم عليه بشكل مستقلّ ويُراجَع يدوياً. وكلّ ما يقدر عليه Loopz، مجّانيّه ومدفوعه، مكتوبٌ في "
          : "Verification is not sold and does not come with Loopz+ — it is applied for separately and reviewed by hand. Everything Loopz can do, free and paid, is listed on "}
        <Link href="/features" className="text-accent hover:underline">
          {ar ? "صفحة المميزات" : "the features page"}
        </Link>
        {ar ? "." : "."}
      </p>
    </article>
  );
}
