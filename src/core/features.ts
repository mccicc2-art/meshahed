import type { IconName } from "./iconNames";
import { FOUNDER_PLUS_UNTIL } from "@/core/plan";

/**
 * 🆕 **سجلُّ ميزات لوبز — بيتٌ واحدٌ لقارئَيه** (D-851).
 *
 * **وُلد داخل `app/features/page.tsx` وعاش فيها وحدَها** (D-122) —
 * **وخرج يومَ صار له قارئٌ ثانٍ**: **صفحةُ الاشتراك تعرض «ما الذي يشمله
 * اشتراكُك»** (بلاغُ أحمد: «داخله مو مكتوب بلس أو لا ولا مميّزات البلس
 * ولا أي كلمة مفيدة») — **وهي بالضبط بنودُ `plus` من هذا السجلّ.**
 * **والاستخراجُ عند القارئ الثاني لا قبله** (D-376/D-002).
 *
 * 🔑 **ولماذا لا تُكتب القائمةُ في صفحة الاشتراك بيدها**: **قائمةُ
 * مزايا مكتوبةٌ مرّتين تفترق عند أوّل ميزةٍ تُشحن** — **فتَعِد صفحةُ
 * البيع بما لا تعرفه صفحةُ الاشتراك والعكس** (D-145)، **ووعدٌ يُخلَف
 * أسوأُ من غيابٍ صريح** (D-217).
 *
 * ⚠️ **والنصُّ هنا لا في القاموس** (حجّةُ D-122 كما هي): **محتوًى
 * تحريريٌّ طويلٌ كنصِّ الشروط، لا مفرداتُ واجهة** — **واللغتان في
 * الصفِّ نفسِه فلا تفترقان.**
 *
 * ⚠️ **ووسمٌ واحدٌ لكلِّ بند**: `soon` أو `plus` أو لا شيءَ فهو مجّانيّ
 * — **ولا بندَ يحمل الاثنين**: **ميزةٌ «قريباً» و«بلس» معاً تَعِد بما
 * لم يُبنَ وتطلب ثمنَه.**
 */
export interface Feature {
  icon: IconName;
  ar: string;
  en: string;
  arBody: string;
  enBody: string;
  /** ميزةٌ لم تُشحن بعد — تحمل وسم «قريباً» بدل «مجاني» (D-122) */
  soon?: boolean;
  /* 🆕 **وسمُ Loopz+** (D-633): **الخانةُ نفسُها والوسمُ الثالث** — كما
     وُعد في تعليق الوسمين أدناه حرفاً: «يوم يأتي الاشتراك يتبدّل وسم
     بنودٍ بعينها في نفس الخانة، فلا يُعاد بناء شيء». */
  plus?: boolean;
}

export interface Section {
  icon: IconName;
  ar: string;
  en: string;
  items: Feature[];
}

export const SECTIONS: Section[] = [
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
    icon: "sliders",
    ar: "التخصيص",
    en: "Make it yours",
    items: [
      {
        icon: "grid",
        ar: "رئيسيةٌ تبنيها أنت",
        en: "A home screen you build",
        arBody:
          "أظهِر الأقسام التي تهمّك وأخفِ ما لا يهمّك ورتّبها كما تحب: أكمل المشاهدة، للمشاهدة، تقييماتي، قوائمي، ملخّص أسبوعك…",
        enBody:
          "Show the sections you care about, hide the ones you do not, and order them your way: continue watching, to watch, my ratings, my lists, your week…",
        plus: true,
      },
      {
        icon: "card",
        ar: "شكل البطاقة وإحصاءات ترويستك",
        en: "Card layout and header stats",
        arBody: "اختر ما يظهر على بطاقة العمل، وأي أرقامٍ تراها في ترويسة رئيسيتك.",
        enBody: "Choose what appears on a title card, and which numbers sit in your home header.",
        plus: true,
      },
      {
        icon: "palette",
        ar: "ثيمات ملوّنة",
        en: "Colour themes",
        arBody: "خمسة ثيمات تبدّل مظهر التطبيق كاملاً — لوبز، المحيط، البنفسجي، القرمزي، الغابة.",
        enBody: "Five themes that change the whole look — Loopz, Ocean, Violet, Crimson, Forest.",
        plus: true,
      },
      /* ⚖️ **والنهاريُّ وحجمُ الخطّ خارج البلس** (D-633، بموافقة أحمد على
         الإتاحة): **من يكبّر الخطّ يفعلها لعينه لا لذوقه**، ومن يقرأ في
         الشمس قارئٌ محبوسٌ لا مشترٍ محتمل — **وبيعُ الإتاحة يُقرأ ضدّ
         المنتج لا معه.** */
      /* 🆕 **وأربعةُ بنودٍ مبنيّةٍ ومقفولةٍ لم تكن مكتوبةً في هذه الصفحة**
         (كشفُ D-783 §١): **الصفحةُ كانت تعرض ثلاثةَ بنودِ بلس من ثمانية**
         — **وصفحةٌ تُخفي نصفَ ما تبيعه تخسر مرّتين**: لا هي أقنعت، ولا
         هي صدقت. */
      {
        icon: "image",
        ar: "بوستر وخلفية لكلّ عمل",
        en: "Your own poster and backdrop",
        arBody: "اختر ملصق العمل وخلفيته كما تحبّ — والأثر لا يتعدّى أسطحك أنت.",
        enBody: "Pick the poster and backdrop you want — it only ever changes your own surfaces.",
        plus: true,
      },
      {
        icon: "sparkles",
        ar: "شارةٌ بجانب اسمك",
        en: "A badge beside your name",
        arBody: "علامة Loopz+ تظهر مع اسمك في كل سطحٍ يحمله، وشعار شريطك العلوي يصير Loopz+.",
        enBody: "The Loopz+ mark appears with your name everywhere it shows, and your top-bar wordmark becomes Loopz+.",
        plus: true,
      },
      {
        icon: "sparkle-star",
        ar: "شارة «مؤسِّس»",
        en: "Founder badge",
        /* ⚖️ 🆕 **«مدى الحياة» سقطت بحكمه** (D-833): **المدّةُ صارت
           ثلاثةَ أشهرٍ والصفةُ باقية** — **وصفحةٌ اسمُها «صادقة» تَعِد
           بما نقضته القاعدةُ أسوأُ من صفحةٍ لا تعد** (D-217، وهو عطلُ
           `9cbe3ae` نفسُه في جولة D-633). */
        arBody: `من سجّل قبل إعلان الاشتراك يحمل شارة مؤسِّس دائماً — والصفة لا تنتهي — ومعها Loopz+ حتى ${FOUNDER_PLUS_UNTIL.ar}.`,
        enBody: `Anyone who joined before subscriptions were announced keeps a Founder badge for good — the status never expires — with Loopz+ until ${FOUNDER_PLUS_UNTIL.en}.`,
        plus: true,
      },
      /* 🆕 **وثلاثُ ميزاتٍ مجّانيّةٍ قائمةٍ لم تُوثَّق قطّ** (D-793،
         تكملةُ كشف D-783 §٢): **ميزةٌ لا يعرف بها أحدٌ لم تُشحن،
         شُحنت شيفرتُها فقط.** */
      {
        icon: "list",
        ar: "ترتيب التبويبات وإخفاؤها",
        en: "Reorder and hide tabs",
        arBody: "رتّب تبويبات المكتبة والمجتمع والاكتشاف كما تحبّ، وأخفِ ما لا تستعمله — مجّاناً للجميع.",
        enBody: "Order the tabs in Library, Community and Discover the way you like, and hide the ones you never use — free for everyone.",
      },
      {
        icon: "globe",
        ar: "منطقة المشاهدة ولغات المحتوى",
        en: "Watch region and content languages",
        arBody: "اختر بلد التوفّر لتعرف أين يُعرض العمل عندك، واستبعِد لغاتٍ لا تشاهدها من الاكتشاف.",
        enBody: "Pick your availability region to see where a title streams for you, and exclude languages you never watch from Discover.",
      },
      {
        icon: "eye",
        ar: "الوضع النهاري وحجم الخط",
        en: "Daylight mode and text size",
        arBody: "ثيمٌ فاتحٌ للقراءة تحت الشمس، وحجمُ خطٍّ تختاره للواجهة وللنصوص — مجّاناً للجميع دائماً.",
        enBody: "A light theme for reading in the sun, and your own text size for the interface and for content — free for everyone, always.",
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
        icon: "star",
        ar: "الجوائز وأفضل الأعمال",
        en: "Awards and the greats",
        arBody: "رفوف الحائزين على الجوائز، وTop 250، وأفضل ٥٠ أنمي — مرجعٌ ثابتٌ لا يتغيّر بالموضة.",
        enBody: "Award-winner rails, the Top 250, and the 50 greatest anime — a fixed reference that fashion does not move.",
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
        /* 🆕 **القلبُ لا الإبهام** — رمزٌ واحدٌ للإعجاب في التطبيق كلِّه (D-294) */
        icon: "heart",
        ar: "آراء وتقييمات",
        en: "Reviews & ratings",
        arBody: "قيّم من ١ إلى ١٠، اكتب رأيك، وتفاعل مع آراء الآخرين.",
        enBody: "Rate 1–10, write reviews, and react to everyone else’s.",
      },
      {
        icon: "comment",
        ar: "غرف نقاش الحلقة والأسبوع",
        en: "Episode and week rooms",
        arBody: "لكل عمل غرفُه: نقاشٌ لكل حلقة ونقاشٌ للأسبوع، مع تثبيت أهمّ ما قيل.",
        enBody: "Every title has its rooms: one per episode and one for the week, with the best replies pinned.",
      },
      {
        icon: "bell",
        ar: "إشعارات داخل التطبيق",
        en: "In-app notifications",
        arBody: "جرسٌ يجمع المتابعات والردود والإعجابات وما شُورك معك.",
        enBody: "A bell that gathers follows, replies, likes and everything shared with you.",
      },
      {
        icon: "people",
        ar: "تصفّحٌ بلا حساب",
        en: "Browse without an account",
        arBody: "المجتمع والاكتشاف وملفّات الأعضاء تُقرأ كلّها بلا تسجيل — والحساب يُطلب عند أوّل تفاعل فقط.",
        enBody: "Community, Discover and member profiles are all readable without signing in — an account is only asked for at your first interaction.",
      },
      {
        /* 🆕 D-768: الدعوةُ مجّانيّةٌ للجميع — آلةُ نموٍّ لا ميزةَ طبقة:
           بوّابةٌ عليها كانت ستقتل غرضَها. المكافأةُ وحدَها Loopz+ */
        icon: "share",
        ar: "دعوة الأصدقاء",
        en: "Invite friends",
        arBody:
          "لكل عضو رابط دعوة دائم يرى منه كم صديقاً انضم ومَن هم. صديقك يبدأ بشهر Loopz+ هدية، وكل ٥ أصدقاء محتسبين يمنحونك شهر Loopz+.",
        enBody:
          "Every member gets a permanent invite link, with a live count of who joined through it. Your friend starts with a free month of Loopz+, and every 5 counted invites earn you a month of Loopz+.",
      },
      {
        icon: "people",
        ar: "برنامج شركاء Loopz",
        en: "Loopz Partners",
        arBody:
          "قدّم طلب انضمام، وخذ رابط إحالتك وإحصاءاته، وعمولة ٢٥٪ من صافي كل دفعة خلال السنة الأولى لمن اشترك عبرك.",
        enBody:
          "Apply to join, get your referral link and its live stats, and earn 25% of the net on every payment during the first year from anyone who subscribes through you.",
      },
    ],
  },
  {
    icon: "shield",
    ar: "الخصوصية والبيانات",
    en: "Privacy & data",
    items: [
      /* 🆕 **وميزةٌ مجّانيّةٌ قائمةٌ لم تُكتب قطّ** (D-783 §٢): التوثيقُ
         شُحن في D-773/775 **ولم يُذكر في أيِّ صفحةٍ يقرأها مستخدم** —
         **وميزةٌ لا يعرف بها أحدٌ لم تُشحن، شُحنت شيفرتُها فقط.** */
      {
        icon: "shield",
        ar: "توثيق الحساب",
        en: "Account verification",
        arBody:
          "علامةٌ تقول إنّ هذا الحساب يمثّل الشخص أو الجهة المذكورة. تُطلب من الإعدادات وتُراجَع يدوياً — ولا تُباع ولا تأتي مع Loopz+.",
        enBody:
          "A mark saying this account represents the stated person or organisation. Requested from settings and reviewed by hand — never sold, and it does not come with Loopz+.",
      },
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
        arBody: "انقل مشاهداتك من تطبيقك السابق بملفٍّ واحد — يُطابَق مع الكتالوج وتنتقل مشاهداتك دفعةً واحدة.",
        enBody: "Bring your history over from your previous app in one file — matched against the catalogue and imported in one go.",
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
  {
    icon: "sparkle-star",
    ar: "قريباً",
    en: "Coming soon",
    items: [
      {
        icon: "repeat",
        plus: true,
        ar: "تسجيلٌ تلقائي لما تشاهده",
        en: "Automatic watch tracking",
        arBody:
          "لن تحتاج أن تعلّم شيئاً بيدك: يُسجَّل ما تشاهده تلقائياً أوّلاً بأوّل، ويبقى التعليم اليدوي متاحاً لمن يفضّله.",
        enBody:
          "No more ticking by hand: what you watch is logged automatically as you watch it, with manual ticking still there if you prefer it.",
        soon: true,
      },
      {
        icon: "tv",
        plus: true,
        ar: "ربط منصّات البثّ",
        en: "Streaming platform linking",
        arBody:
          "اربط حساباتك على منصّات البثّ الكبرى مرّةً واحدة، وتتدفّق مشاهداتك إلى مكتبتك بلا خطوةٍ إضافية.",
        enBody:
          "Connect your accounts on the major streaming platforms once, and your watches flow into your library with no extra step.",
        soon: true,
      },
      {
        icon: "newspaper",
        /* 🆕 **وسمُ بلس** (D-783 §٢): كانت الصفحةُ تقول «قريباً» بلا وسم
           خطّة **وقائمةُ أحمد تضعه في Loopz+** — **وسمٌ ناقصٌ في صفحةٍ
           اسمُها «صادقة» يبيع مجّاناً ما سيُطلب ثمنُه.** */
        plus: true,
        ar: "دعم اشتراكات IPTV",
        en: "IPTV support",
        arBody:
          "من يشاهد عبر IPTV له مكانٌ هنا أيضاً — ربطٌ يقرأ ما تُشاهده ويضعه في سجلّك.",
        enBody:
          "If you watch over IPTV you are covered too — a link that reads what you are watching and files it in your log.",
        soon: true,
      },
      {
        icon: "download",
        ar: "تطبيقا iOS وأندرويد",
        en: "iOS and Android apps",
        arBody:
          "تطبيقان أصليّان على App Store وGoogle Play. وحتى ذلك الحين، ثبّت Loopz من متصفّحك على شاشتك الرئيسية ويعمل كتطبيق.",
        enBody:
          "Native apps on the App Store and Google Play. Until then, install Loopz from your browser to your home screen — it already behaves like an app.",
        soon: true,
      },
      {
        icon: "compass",
        ar: "لغاتٌ أكثر",
        en: "More languages",
        arBody:
          "العربية والإنجليزية كاملتان اليوم، وأهمّ لغات العالم في الطريق — Loopz ليس مبنياً لمنطقةٍ واحدة.",
        enBody:
          "Arabic and English are complete today, with the world's major languages on the way — Loopz is not built for one region.",
        soon: true,
      },
    ],
  },
];
