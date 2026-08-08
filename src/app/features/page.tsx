import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/locale";
import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Features — Loopz",
  description: "Everything Loopz can do, in one honest page.",
};

/**
 * مميزات Loopz — الحصر الذي طلبه أحمد (تدقيق 8 Aug، القسم ٢): الميزات
 * كثرت ولا صفحة واحدة تعرضها، فالمستخدم لا يعرف ما المتاح له.
 *
 * صفحةٌ عامّة بلا حارس (نمط صفحة الشروط): تعريفٌ بالمنتج يصلح أن يفتحه
 * زائرٌ قبل أن يسجّل. والنصّ داخل الملف لا في القاموس المشترك — محتوىً
 * تحريريّ طويل كنصّ الشروط، لا مفردات واجهة.
 *
 * كل ميزة تحمل وسم «مجاني» — الصفحة صادقة: كل شيء مجاني اليوم
 * (settingsBillingHint). حين يأتي الاشتراك يتغيّر وسم بنودٍ بعينها إلى
 * «بريميوم» في نفس البنية، فلا يُعاد بناء شيء.
 */

interface Feature {
  icon: IconName;
  ar: string;
  en: string;
  arBody: string;
  enBody: string;
}

interface Section {
  icon: IconName;
  ar: string;
  en: string;
  items: Feature[];
}

const SECTIONS: Section[] = [
  {
    icon: "tv",
    ar: "المتابعة",
    en: "Tracking",
    items: [
      {
        icon: "check",
        ar: "تتبّع الحلقات",
        en: "Episode tracking",
        arBody: "علّم حلقةً أو موسماً كاملاً أو «شاهدتُ حتى هنا» — وتقدّمك يُحسب تلقائياً.",
        enBody: "Tick an episode, a whole season, or “watched up to here” — progress is computed for you.",
      },
      {
        icon: "film",
        ar: "الأفلام",
        en: "Movies",
        arBody: "علّمه مُشاهداً، أو احفظ موضع توقّفك بالدقيقة وكمّله لاحقاً.",
        enBody: "Mark it watched, or save where you stopped — to the minute.",
      },
      {
        icon: "repeat",
        ar: "إعادة المشاهدة",
        en: "Rewatches",
        arBody: "دورات إعادةٍ كاملة لأعمالك المفضلة، بعدّادها المستقل.",
        enBody: "Full rewatch cycles for your favourites, counted separately.",
      },
      {
        icon: "pause",
        ar: "أوقفتُه",
        en: "Dropped",
        arBody: "عملٌ اكتفيتَ منه يبقى في مكتبتك بعلامته ويختفي من صفوف رئيسيتك.",
        enBody: "A dropped title stays in your library, out of your home rows.",
      },
      {
        icon: "calendar",
        ar: "اليوميات",
        en: "Diary",
        arBody: "سجلٌّ يوميّ لما شاهدت، يوماً بيوم.",
        enBody: "A day-by-day log of everything you watched.",
      },
      {
        icon: "chart",
        ar: "الإحصاءات",
        en: "Stats",
        arBody: "ساعاتك وأنواعك وأرقامك — وبطاقة إحصاءات أنيقة تشاركها.",
        enBody: "Your hours, genres and numbers — with a shareable stats card.",
      },
    ],
  },
  {
    icon: "compass",
    ar: "الاكتشاف",
    en: "Discovery",
    items: [
      {
        icon: "trending",
        ar: "ديسكفري",
        en: "Discover",
        arBody: "صفوف مرتّبة بنوافذ زمنية (أسبوع/سنة/كل الأوقات) وفلاتر نوعٍ ولغةٍ وحقبةٍ ومنصّة.",
        enBody: "Ranked rails across time windows (week / year / all-time) with genre, language, era and provider filters.",
      },
      {
        icon: "star",
        ar: "تقييمات IMDb وطماطم",
        en: "IMDb & Rotten Tomatoes",
        arBody: "الترتيب والأرقام من IMDb وRotten Tomatoes بشعاريهما — لا مصدر غيرهما.",
        enBody: "Rankings and numbers come from IMDb and Rotten Tomatoes, with their marks — no other source.",
      },
      {
        icon: "sparkle-star",
        ar: "أفضل ٥٠ على الإطلاق",
        en: "Top 50 of all time",
        arBody: "أفضل ٥٠ فيلماً وأفضل ٥٠ مسلسلاً، مرجعٌ ثابت في ذيل ديسكفري.",
        enBody: "The 50 greatest movies and shows, a fixed reference at the foot of Discover.",
      },
      {
        icon: "sparkles",
        ar: "مقترحٌ لك",
        en: "Picked for you",
        arBody: "ترشيحات من ذوقك أنت لا من العموم، بزرّ تحديثٍ وزرّ «غير مهتم».",
        enBody: "Suggestions built from your own taste, with refresh and “not interested”.",
      },
      {
        icon: "person-check",
        ar: "فنّانوك",
        en: "Your artists",
        arBody: "تابع ممثلاً أو مخرجاً، وجديده يصلك في صفٍّ خاص.",
        enBody: "Follow an actor or director and see their newest work in its own rail.",
      },
      {
        icon: "search",
        ar: "بحث الذكاء",
        en: "AI search",
        arBody: "صِف قصةً تذكرها بكلماتك — والذكاء يجد لك العمل.",
        enBody: "Describe a story in your own words — AI finds the title.",
      },
    ],
  },
  {
    icon: "list",
    ar: "القوائم",
    en: "Lists",
    items: [
      {
        icon: "plus",
        ar: "قوائم بلا حدود",
        en: "Unlimited lists",
        arBody: "خاصةٌ أو معلنة، بأنواعٍ وإعادة ترتيبٍ يدوية.",
        enBody: "Private or public, with kinds and manual reordering.",
      },
      {
        icon: "book",
        ar: "عوالم جاهزة",
        en: "Ready-made universes",
        arBody: "مارفل وDC وهاري بوتر وحرب النجوم بترتيب الأحداث — قائمة كاملة بضغطة.",
        enBody: "Marvel, DC, Harry Potter and Star Wars in story order — a full list in one tap.",
      },
      {
        icon: "share",
        ar: "مشاركة وحفظ",
        en: "Share & save",
        arBody: "شارك قائمتك برابط، واحفظ قوائم غيرك مرجعاً حيّاً يتحدّث مع صاحبه.",
        enBody: "Share a list by link, and save other people’s lists as live references that stay in sync.",
      },
    ],
  },
  {
    icon: "people",
    ar: "المجتمع",
    en: "Community",
    items: [
      {
        icon: "people-filled",
        ar: "أصدقاء",
        en: "Friends",
        arBody: "تابع أصدقاءك، وشاهد مكتباتهم وقوائمهم المعلنة وما يتفرجون عليه.",
        enBody: "Follow friends and see their libraries, public lists and what they’re watching.",
      },
      {
        icon: "comment",
        ar: "رسائل فورية",
        en: "Instant messages",
        arBody: "محادثات تصل لحظياً، تشارك فيها عملاً أو قائمة وتبدأ النقاش منها.",
        enBody: "Real-time conversations — share a title or a list and talk about it.",
      },
      {
        icon: "home",
        ar: "مجتمعات",
        en: "Communities",
        arBody: "غرفٌ جماعية بصورها ودعواتها، لك ولأصحابك.",
        enBody: "Group rooms with photos and invites, for you and your people.",
      },
      {
        icon: "like",
        ar: "آراء وتقييمات",
        en: "Reviews & ratings",
        arBody: "قيّم من ١ إلى ١٠، اكتب رأيك، وتفاعل مع آراء الآخرين.",
        enBody: "Rate 1–10, write reviews, and react to everyone else’s.",
      },
    ],
  },
  {
    icon: "shield",
    ar: "الخصوصية والبيانات",
    en: "Privacy & data",
    items: [
      {
        icon: "eye-off",
        ar: "حسابٌ خاص",
        en: "Private account",
        arBody: "متابعةٌ بموافقتك، وتحكّمٌ بمن يرى مكتبتك، وحظرٌ لمن تريد.",
        enBody: "Follows need your approval, you choose who sees your library, and blocking is one tap away.",
      },
      {
        icon: "download",
        ar: "استيراد تاريخك",
        en: "Import your history",
        arBody: "انقل مشاهداتك من Trakt وTV Time بملفٍّ واحد.",
        enBody: "Bring your history over from Trakt and TV Time.",
      },
      {
        icon: "settings",
        ar: "بياناتك لك",
        en: "Your data is yours",
        arBody: "صدّر كل بياناتك JSON متى شئت، أو احذف حسابك نهائياً بضغطة.",
        enBody: "Export everything as JSON any time, or delete your account for good.",
      },
    ],
  },
];

export default async function FeaturesPage() {
  const { locale } = await getT();
  const ar = locale === "ar";

  return (
    <article className="max-w-2xl mx-auto pb-16" dir={ar ? "rtl" : "ltr"}>
      <Link href="/" className="text-xs text-muted hover:text-foreground transition">
        ‹ Loopz
      </Link>

      <h1 className="text-2xl font-bold mt-3">{ar ? "مميزات Loopz" : "Loopz features"}</h1>
      <p className="text-sm text-muted mt-1.5 leading-relaxed">
        {ar
          ? "كل ما يقدر عليه التطبيق، في صفحة واحدة صادقة — وكل شيء فيها مجاني اليوم."
          : "Everything the app can do, on one honest page — and all of it is free today."}
      </p>

      <div className="mt-8 space-y-9">
        {SECTIONS.map((s) => (
          <section key={s.en}>
            <h2 className="flex items-center gap-2 text-base font-bold mb-3">
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
                    <p className="text-[13px] text-muted leading-relaxed mt-0.5">
                      {ar ? f.arBody : f.enBody}
                    </p>
                  </div>
                  {/* وسم «مجاني» — لون النجاح الواحد (D-003)؛ يوم يأتي الاشتراك
                      يتبدّل وسم بنودٍ بعينها إلى «بريميوم» في نفس الخانة */}
                  <span className="shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 border text-[color:var(--success)] border-[color:var(--success)]/35 bg-[color:var(--success)]/10">
                    {ar ? "مجاني" : "Free"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted mt-10 leading-relaxed">
        {ar
          ? "لا توجد اشتراكات مدفوعة في Loopz حالياً. إن أُضيفت مستقبلاً، ستجد هنا بوضوح ما هو مجاني وما يتطلب اشتراكاً."
          : "Loopz has no paid subscription today. If one arrives, this page will show clearly what stays free and what needs it."}
      </p>
    </article>
  );
}
