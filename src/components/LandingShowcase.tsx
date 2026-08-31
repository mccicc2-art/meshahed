import { Suspense } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { PosterCard } from "@/components/PosterCard";
import { ListCardShell } from "@/components/PublicListsRail";
import { Avatar } from "@/components/Avatar";
import { segmentedTrack, segmentedItem, chipClass } from "@/components/ui/controls";
import { trending, type SearchResult } from "@/lib/tmdb";
import { railGuard } from "@/lib/topChart";
import { posterUrl } from "@/lib/media";
import type { Locale } from "@/lib/i18n";

/**
 * ما تحت الشاشة الأولى — **التطبيقُ نفسُه يُرى، لا يُوصَف** (D-844).
 *
 * **حكمُ أحمد بلقطةٍ للصفحة**: «هذي الصفحة كلها كلام، والمفروض فيها خليط
 * من الديسكفري والمكتبة والأعضاء وصور متنوّعة من المميّزات — صورة
 * النقاشات وصورة البروفايل وصورة المكتبة وصورة الهوم، وفيه تابع
 * المشاهدة والليستات، كذا شي الواحد يشوفه نفسُه تنفتح للتطبيق».
 *
 * 🔑 **والسطورُ لم تُحذف، نُقلت**: هذه السبعةُ هي `HIGHLIGHTS` نفسُها
 * التي كانت بطاقاتِ نصٍّ في `LandingContent` — **بنصِّها حرفاً** —
 * **فما كان يُقرأ صار يُرى ومكتوبٌ بجانبه.** ولولا ذلك لسقط من الصفحة
 * كلامٌ يربطها بما يُكتب في مربّع البحث (حجّةُ D-122 التي وُلد ذلك
 * القسمُ لأجلها).
 *
 * 🔑 **ولا رسمَ ثانياً لشيءٍ قائم** (القاعدة ٣): الشاشاتُ مبنيّةٌ
 * بمكوّنات التطبيق نفسِها — `PosterCard` و`ListCardShell` و`Avatar`
 * ووصفاتُ `controls.ts` — **بأعمالٍ حقيقيّةٍ من الكتالوج.** **ولقطةٌ
 * مصوَّرةٌ كانت ستُجمّد التصميمَ في صورة**: لا تترجم، ولا تتبع RTL،
 * ولا السمةَ النهاريّة، وتتقادم عند أوّل تعديل — **وهذه تتبع كلَّ ذلك
 * وحدَها.**
 *
 * ⚠️ **وكلُّ شاشةٍ `inert`**: **صورةٌ لا تُضغط.** أرقامُ التقدّم
 * والمواسمُ عيّناتُ عرضٍ على أعمالٍ حقيقيّة — **ورابطٌ يفتح عملاً
 * يَعِد القارئَ بتقدّمٍ ليس له** (D-217). و`inert` تُخرجها من شجرة
 * الوصول ومن التبويب معاً، **فالقارئُ الضريرُ يسمع الوصفَ المكتوب
 * بجانبها لا شبكةَ ملصقاتٍ بلا معنى.**
 *
 * ⚠️ **وليست في `data-landing-seo`** (D-843): **ذاك القسمُ لمحرّك
 * البحث ويسقط في التطبيق المثبَّت** — **وهذا هو ما يُفترض أن يراه من
 * حمّل التطبيق ولم يسجّل بعد.**
 */

interface Panel {
  icon: IconName;
  ar: string;
  en: string;
  arBody: string;
  enBody: string;
  arScreen: string;
  enScreen: string;
}

/* النصُّ منقولٌ حرفاً من `HIGHLIGHTS` في `LandingContent` — ولا يُحرَّر
   هنا بلا سبب: كلُّ سطرٍ منه كان يُقرأ في نتائج البحث. */
const PANELS: Panel[] = [
  {
    icon: "tv",
    ar: "تتبّع المسلسلات حلقةً حلقة",
    en: "Track shows episode by episode",
    arBody:
      "علّم الحلقة التي وصلتها — أو موسماً كاملاً بضغطة — ويحسب Loopz تقدّمك ويضع حلقتك القادمة في رئيسيتك.",
    enBody:
      "Tick the episode you reached — or a whole season in one tap — and Loopz works out your progress and puts your next episode on your home screen.",
    arScreen: "تابِع المشاهدة",
    enScreen: "Continue watching",
  },
  {
    icon: "film",
    ar: "الأفلام بموضع توقّفك",
    en: "Movies, down to where you stopped",
    arBody:
      "علّم الفيلم مُشاهداً، أو احفظ الدقيقة التي توقّفت عندها وكمّله متى عدت. وإعادة المشاهدة لها عدّادها المستقل.",
    enBody:
      "Mark a film watched, or save the exact minute you stopped and finish it later. Rewatches get their own counter.",
    arScreen: "أفلامك",
    enScreen: "Your movies",
  },
  {
    icon: "sparkles",
    ar: "الأنمي في نفس المكان",
    en: "Anime in the same place",
    arBody:
      "لا تطبيق ثانٍ للأنمي: مواسمه وحلقاته وترتيب مشاهدته داخل مكتبتك مع كل شيء آخر.",
    enBody:
      "No second app for anime: its seasons, episodes and watch order sit in your library beside everything else.",
    arScreen: "مكتبتي",
    enScreen: "My library",
  },
  {
    icon: "settings",
    ar: "رئيسيةٌ تبنيها أنت",
    en: "A home screen you build",
    arBody:
      "رتّب صفحتك الرئيسية كما تريدها: أظهِر الأقسام التي تهمّك وأخفِ ما لا يهمّك، واختَر الإحصاءات التي تراها وشكل البطاقة نفسها.",
    enBody:
      "Arrange your home page exactly as you want it: show the sections you care about, hide the ones you do not, and choose which stats you see and how cards look.",
    arScreen: "تخصيص الرئيسية",
    enScreen: "Customize home",
  },
  {
    icon: "calendar",
    ar: "يوميات وإحصاءات",
    en: "A diary and real numbers",
    arBody:
      "سجلٌّ يوميّ لما شاهدت، وساعاتك وأنواعك المفضّلة بالأرقام — وبطاقة إحصاءات تشاركها.",
    enBody:
      "A day-by-day log of what you watched, your hours and favourite genres in numbers — and a stats card you can share.",
    arScreen: "إحصائياتك",
    enScreen: "Your stats",
  },
  {
    icon: "list",
    ar: "قوائم وجوائز وترتيب أحداث",
    en: "Lists, awards and story order",
    arBody:
      "ابنِ قوائمك، أو افتح قوائم جاهزة: مارفل وهاري بوتر بترتيب الأحداث، أفضل 250، والفائزون بالأوسكار والإيمي منذ 1990.",
    enBody:
      "Build your own lists, or open ready-made ones: Marvel and Harry Potter in story order, the Top 250, and Oscar and Emmy winners since 1990.",
    arScreen: "القوائم",
    enScreen: "Lists",
  },
  {
    icon: "people",
    ar: "أصدقاؤك ورأيهم",
    en: "Your friends and their taste",
    arBody:
      "تابع أصدقاءك، اقرأ تقييماتهم، تحدّث معهم في المنصّة نفسها — وقرّر أنت من يرى مكتبتك.",
    enBody:
      "Follow friends, read their ratings and talk to them inside the platform — and you decide who sees your library.",
    arScreen: "المجتمع",
    enScreen: "Community",
  },
];

export function LandingShowcase({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  return (
    <section className="pt-16 pb-2" dir={ar ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
          {ar ? "شوف لوبز قبل ما تدخل" : "See Loopz before you sign in"}
        </h2>
        <p className="mt-3 text-sm sm:text-15 text-muted leading-relaxed">
          {ar
            ? "هذه شاشات التطبيق نفسها، بأعمالٍ حقيقية من الكتالوج — لا صور مرسومة."
            : "These are the app's own screens, with real titles from the catalogue — not drawings."}
        </p>
      </div>

      {/* الشاشاتُ خلف `Suspense`: نداءُ TMDB زينةٌ لا يحقّ له تأخيرَ ما
          فوقه (حجّةُ جدار الملصقات في `LandingHero`) — والبديلُ صندوقٌ
          بارتفاعٍ قريبٍ لا `null`، فلا يقفز ما تحته حين تصل. */}
      <Suspense fallback={<ShowcaseFallback />}>
        <Screens locale={locale} />
      </Suspense>
    </section>
  );
}

function ShowcaseFallback() {
  return (
    <div className="mt-10 space-y-14" aria-hidden>
      {PANELS.map((_, i) => (
        <div key={i} className="h-[15rem] rounded-[1.5rem] bg-surface/50" />
      ))}
    </div>
  );
}

/* ───────────────────────── الإطار ───────────────────────── */

/** إطارُ شاشة: شريطُ اسمٍ ثمّ جسمٌ خامل — **صورةٌ لا تُضغط.** */
function Screen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-surface overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[color:var(--divider)]">
        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden />
        <span className="text-12 font-semibold text-muted truncate">{label}</span>
      </div>
      {/* `inert` تكفي وحدَها: تُلغي الضغط والتبويب وتُخرج ما بداخلها من
          شجرة الوصول — فلا يلزم `aria-hidden` معها ولا `tabIndex`. */}
      <div inert className="p-3 select-none">
        {children}
      </div>
    </div>
  );
}

function Row({
  panel,
  flip,
  locale,
  children,
}: {
  panel: Panel;
  flip: boolean;
  locale: Locale;
  children: React.ReactNode;
}) {
  const ar = locale === "ar";
  return (
    <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-center">
      <div className={flip ? "md:order-2" : ""}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-surface-2 border border-border grid place-items-center shrink-0 text-accent">
            <Icon name={panel.icon} size={18} />
          </span>
          <h3 className="text-15 sm:text-xl font-extrabold tracking-tight">
            {ar ? panel.ar : panel.en}
          </h3>
        </div>
        <p className="mt-3 text-sm sm:text-15 text-muted leading-relaxed">
          {ar ? panel.arBody : panel.enBody}
        </p>
      </div>
      <div className={flip ? "md:order-1" : ""}>
        <Screen label={ar ? panel.arScreen : panel.enScreen}>{children}</Screen>
      </div>
    </div>
  );
}

/* ───────────────────────── الشاشات ───────────────────────── */

async function Screens({ locale }: { locale: Locale }) {
  const ar = locale === "ar";

  /* `trending` مغلَّفةٌ بـ`cache()` — وجدارُ الملصقات في `LandingHero`
     يناديها في الطلب نفسِه، **فنداءٌ واحدٌ للاثنين** (D-470). */
  const rows = await trending()
    .then((r) => railGuard(r, { anime: "keep" }))
    .catch(() => [] as SearchResult[]);

  const withPoster = rows.filter((r) => r.poster_path);
  /* صفرُ عملٍ يعني صفرَ رسم (D-219/D-280): قسمٌ اسمُه «شوف التطبيق»
     يعرض إطاراتٍ فارغةً أسوأُ من غيابه. */
  if (withPoster.length < 8) return null;

  const shows = withPoster.filter((r) => r.media_type === "tv");
  const movies = withPoster.filter((r) => r.media_type === "movie");
  const pick = (arr: SearchResult[], n: number, from = 0) =>
    (arr.length >= n ? arr : withPoster).slice(from, from + n);

  const nameOf = (r: SearchResult) => r.title || r.name || "";
  const hrefOf = (r: SearchResult) =>
    `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`;

  const S = pick(shows, 3);
  const M = pick(movies, 3);
  const L = withPoster.slice(0, 8);
  const listA = withPoster.slice(0, 3).map((r) => posterUrl(r.poster_path, "w185")!);
  const listB = withPoster.slice(3, 6).map((r) => posterUrl(r.poster_path, "w185")!);

  return (
    <div className="mt-10 space-y-14">
      {/* ١ — تابِع المشاهدة: تقدّمٌ وشارةُ موسمٍ وحلقةٍ وعدّادُ ما بقي */}
      <Row panel={PANELS[0]} flip={false} locale={locale}>
        <div className="grid grid-cols-3 gap-2.5">
          {S.map((r, i) => (
            <PosterCard
              key={r.id}
              href={hrefOf(r)}
              title={nameOf(r)}
              posterPath={r.poster_path}
              posterSize="w185"
              progress={[62, 30, 88][i]}
              count={[4, 11, 2][i]}
              badge={ar ? `م${i + 1} · ح${[5, 3, 9][i]}` : `S${i + 1} · E${[5, 3, 9][i]}`}
              badgeTone="progress"
            />
          ))}
        </div>
      </Row>

      {/* ٢ — الأفلام: مُشاهَدٌ · موضعُ توقّفٍ محفوظ · إعادةُ مشاهدة */}
      <Row panel={PANELS[1]} flip locale={locale}>
        <div className="grid grid-cols-3 gap-2.5">
          {M.map((r, i) => (
            <PosterCard
              key={r.id}
              href={hrefOf(r)}
              title={nameOf(r)}
              posterPath={r.poster_path}
              posterSize="w185"
              watched={i === 0}
              badge={i === 0 ? (ar ? "شوهد" : "Seen") : undefined}
              badgeTone="watched"
              note={i === 1 ? "44:20" : i === 2 ? (ar ? "المرّة ٢" : "2nd time") : undefined}
            />
          ))}
        </div>
      </Row>

      {/* ٣ — المكتبة: التبويباتُ الثلاثة وشبكةُ الملصقات كما هي */}
      <Row panel={PANELS[2]} flip={false} locale={locale}>
        <div className={`${segmentedTrack} mb-3`}>
          {(ar ? ["مسلسلات", "أفلام", "أنمي"] : ["Shows", "Movies", "Anime"]).map((s, i) => (
            <span key={s} className={segmentedItem(i === 2)}>
              {s}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {L.map((r) => (
            <PosterCard
              key={r.id}
              href={hrefOf(r)}
              title={nameOf(r)}
              posterPath={r.poster_path}
              posterSize="w185"
              hideTitle
            />
          ))}
        </div>
      </Row>

      {/* ٤ — تخصيصُ الرئيسية: صفوفُ إظهارٍ وإخفاء، ومقاسُ الملصق */}
      <Row panel={PANELS[3]} flip locale={locale}>
        <div className="rounded-2xl border border-border overflow-hidden">
          {(ar
            ? ["تابِع المشاهدة", "ينزل قريباً", "قوائمك", "مقترح لك"]
            : ["Continue watching", "Coming soon", "Your lists", "Picked for you"]
          ).map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-3 px-3.5 h-14 border-b border-[color:var(--divider)] last:border-0"
            >
              <span className="text-muted shrink-0">
                <Icon name={([ "play", "calendar", "list", "sparkles" ] as IconName[])[i]} size={18} />
              </span>
              <span className="text-14 flex-1 min-w-0 truncate">{s}</span>
              <span className={i === 1 ? "text-muted/40" : "text-accent"}>
                <Icon name={i === 1 ? "eye-off" : "eye"} size={18} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-12 text-muted">{ar ? "حجم الملصق" : "Poster size"}</span>
          <span className={chipClass(false, "sm")}>{ar ? "صغير" : "S"}</span>
          <span className={chipClass(true, "sm")}>{ar ? "وسط" : "M"}</span>
          <span className={chipClass(false, "sm")}>{ar ? "كبير" : "L"}</span>
        </div>
      </Row>

      {/* ٥ — الأرقام: أربعُ خاناتٍ ثمّ سطرُ يوميّاتٍ واحد */}
      <Row panel={PANELS[4]} flip={false} locale={locale}>
        <div className="grid grid-cols-2 gap-2.5">
          {(
            [
              ["play", ar ? "١٬٢٤٠" : "1,240", ar ? "حلقة" : "episodes"],
              ["calendar", ar ? "٣١٨" : "318", ar ? "ساعة" : "hours"],
              ["film", ar ? "١٨٦" : "186", ar ? "فيلماً" : "movies"],
              ["star", ar ? "٨٫٤" : "8.4", ar ? "معدّلك" : "your average"],
            ] as [IconName, string, string][]
          ).map(([icon, value, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-surface-2 px-3.5 py-3">
              <p className="text-20 font-extrabold tracking-tight flex items-center gap-1.5">
                <span className="text-accent">
                  <Icon name={icon} size={16} />
                </span>
                {value}
              </p>
              <p className="text-12 text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </Row>

      {/* ٦ — القوائم: بطاقةُ القائمة الواحدةُ كما تُرسم في كلِّ سطح */}
      <Row panel={PANELS[5]} flip locale={locale}>
        <div className="grid gap-2.5">
          {/* ⚠️ **واسمان محايدان لا «مارفل» ولا «أفضل ٢٥٠»** (D-217):
              **تلك قوائمُ حقيقيّةٌ في المنصّة بمحتوًى معلوم** — **واسمٌ
              يَعِد بمارفل فوق ملصقاتٍ ليست منها كذبةٌ تُرى بالعين.**
              والملصقاتُ هنا رائجُ الأسبوع، فالاسمُ لا يصف محتوًى بعينه. */}
          <ListCardShell
            name={ar ? "قائمتي" : "My list"}
            countText={ar ? "٣٦ عملاً" : "36 titles"}
            posters={listA}
          />
          <ListCardShell
            name={ar ? "مشاهدة لاحقاً" : "Watch later"}
            countText={ar ? "١٢ عملاً" : "12 titles"}
            posters={listB}
          />
        </div>
      </Row>

      {/* ٧ — المجتمع: صفُّ عضوٍ بتقييمه وزرِّ متابعة.
          ⚠️ **ولا اسمَ ولا صورةَ عضوٍ حقيقيّ هنا**: صفحةٌ عامّةٌ تعرض
          أعضاءً بأسمائهم تنشرهم بلا إذنهم — **والحرفُ الأوّلُ في دائرة
          هو ما يرسمه `Avatar` أصلاً لمن لا صورةَ له**، فالشكلُ صادقٌ
          والهويّةُ خالية. */}
      <Row panel={PANELS[6]} flip={false} locale={locale}>
        <div className="grid gap-2">
          {["A", "M", "S"].map((letter, i) => (
            <div
              key={letter}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-3 py-2.5"
            >
              <Avatar src={null} name={letter} size={36} />
              <div className="flex-1 min-w-0">
                <p className="text-14 font-semibold truncate">{ar ? "عضو" : "Member"}</p>
                <p className="text-12 text-muted truncate">
                  {ar ? `قيّم ${["٩٫٠", "٨٫٥", "٧٫٥"][i]}` : `Rated ${["9.0", "8.5", "7.5"][i]}`}
                </p>
              </div>
              <span className={chipClass(i === 0, "sm")}>
                {i === 0 ? (ar ? "تتابعه" : "Following") : ar ? "متابعة" : "Follow"}
              </span>
            </div>
          ))}
        </div>
      </Row>
    </div>
  );
}
