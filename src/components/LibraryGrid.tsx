"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flashError } from "@/lib/toast";
import { runOrQueue } from "@/lib/offline";
import { coalescedRefresh } from "@/lib/refresh";
import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { startRewatch, classifyMyFollows } from "@/lib/actions";
import { tap } from "@/lib/haptics";
import type { UserList } from "@/lib/data";
import type { ArtistShelfItem } from "@/lib/artists";
import { ArtistsGrid } from "./ArtistsGrid";
import { PosterCard } from "./PosterCard";
import { SectionDivider } from "./SectionDivider";
import { LongPressable } from "./LongPressable";
import { ListManager } from "./ListManager";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { posterGrid } from "./ui/controls";
import { PageTabs } from "./ui/PageTabs";
import { FilterIconButton } from "./ui/FilterIconButton";
import { LibraryToolsSheet } from "./LibraryToolsSheet";
import { OneTimeHint } from "./OneTimeHint";
import { normalizeSearch, byTitle } from "@/lib/arabic";
import { applyTabPrefs, type TabPref } from "@/lib/tabPrefs";
import { buttonClass } from "./ui/Button";

export interface GridItem {
  key: string;
  href: string;
  title: string;
  posterPath: string | null;
  progress?: number;
  badge?: string;
  badgeTone?: "neutral" | "progress" | "watched" | "rating" | "dropped";
  count?: number;
  dropped?: boolean;
  /** مكتملٌ — يفتح خيار «أشاهده من جديد» */
  completed?: boolean;
  /** حالة المشاهدة — تغذّي رقائق التقسيم (طلب المالك)؛ الصفحة تحسبها */
  status?: LibraryStatus;
  /** 🆕 **متى أُضيف** (D-350) — لترتيب «الأحدث»؛ الصفحةُ تمرّره من
      `follows.added_at`، **وغيابُه يعني «لا أعرف» فيهبط إلى الذيل** */
  addedAt?: string;
  /** للإجراءات السريعة بالضغطة المطوّلة */
  tmdbId?: number;
  mediaType?: "tv" | "movie";
}

/**
 * المكتبة: تبويبان لا أربعة.
 *
 * «للمشاهدة» و«القادم» انتقلا إلى الرئيسية صفوفاً أفقية، فبقيت المكتبة
 * لما هي له: كل ما تتابعه. تبويبٌ للمسلسلات وتبويبٌ للأفلام، وكلٌّ
 * منهما شبكةُ ملصقاتٍ رأسية — ثلاثة في الصفّ على الجوال وتتّسع مع
 * الشاشة — لأن سؤال المكتبة «ماذا عندي؟» وجوابه يُقرأ بالأغلفة لا
 * بالصفوف.
 *
 * والضغطة المطوّلة على أي بطاقة تفتح لوح إجراءاتٍ سريعة: «+١ الحلقة
 * التالية» و«شفته كله» والبطاقة الحمراء — أقوى عادات TV Time، بلا فتح
 * صفحة العمل.
 */
export type LibraryTab = "shows" | "movies" | "anime" | "artists" | "lists";

/** التبويب ↔ قيمة `?filter=` — جدولٌ واحد بدل ثلاثة شروطٍ ثلاثيّة متفرّقة */
export const TAB_FILTER: Record<LibraryTab, string | null> = {
  shows: "tv",
  movies: "movie",
  anime: "anime",
  artists: "person",
  lists: "list",
};

/** حالات التقسيم — «أشاهدها» للمسلسلات وحدها؛ الفيلم يُشاهد أو لا */
export type LibraryStatus = "watching" | "unstarted" | "completed" | "dropped";

export function LibraryGrid({
  shows,
  movies,
  /* اختياريّتان بقيمتين محايدتين — **لا تهاوناً بل لأن الدفعة تُصرَّف
     وحدها** (D-028/D-155): هذا الملفّ يُرفع في دفعةٍ وصفحةُ المكتبة في
     أخرى، وبينهما كوميتٌ تبنيه Vercel. والافتراضُ يبقي التبويب فارغاً
     لا مكسوراً حتى تصل الصفحة (نمط `onPick?` في D-167). */
  anime = [],
  animeUnknown = 0,
  artists,
  artistCount,
  lists,
  listStats,
  locale,
  initialTab = "shows", tabPrefs,
  listsExtra,
}: {
  shows: GridItem[];
  movies: GridItem[];
  /** أنميك — **مسلسلاتٌ وأفلامٌ معاً**، ولا يُنزع أيٌّ منها من تبويبه
      الأصليّ. تبويبٌ يجمع لا يقتطع: علَمُ `is_anime` يُملأ من TMDB وقد
      يُخطئ أو يتأخّر، **وعملٌ يختفي من «مسلسلاتي» يُقرأ فقداناً لا
      تصنيفاً**. (وهذا يخالف D-170 في اكتشف عن قصد: هناك رفّان على شاشةٍ
      واحدة فالتكرار ضجيج، وهنا تبويبان لا يُريان معاً.) */
  anime?: GridItem[];
  /** كم صفّاً لم يُصنَّف بعد — يُطلق تصنيفةً واحدة عند أوّل فتحٍ للتبويب */
  animeUnknown?: number;
  /** رفُّ الفنانين — يصل **محسوباً** حين يكون تبويبَه المفتوح وحده (D-128) */
  artists: ArtistShelfItem[];
  /** عدّاد التبويب: نداءُ Supabase خفيفٌ يجري دائماً، بلا نداءات TMDB */
  artistCount: number;
  lists: UserList[];
  /** 🆕 **أرقامُ قوائمي العامّة** (D-350) — تُقرأ في الصفحة مرّةً لا لكلِّ
      بطاقة (D-206)، **وغيابُها يعيد البطاقةَ كما كانت** (D-152) */
  listStats?: Map<string, { saves: number; rating: number | null }>;
  locale: Locale;
  initialTab?: LibraryTab; /** ترتيبُ تبويبات المكتبة وإظهارها — من الكوكي (D-179) */ tabPrefs: TabPref[];
  /** ما يلي قوائمي في اللوح (القوائم المحفوظة — طلب أحمد: بيتها
      المكتبة لا صفحة منفصلة): يُرسم على الخادم ويُمرَّر عقدةً جاهزة،
      فيبقى PublicListsRail مكوّن خادمٍ بلا JS كما وُلد (D-063) */
  listsExtra?: React.ReactNode;
}) {
  const t = getDict(locale);
  const router = useRouter();
  /* التبويب يسكن الرابط لا الحالة وحدها (ذاكرة التنقل — تدقيق 8 Aug م١):
     useState وحده كان ينسى التبويب عند الرجوع من عملٍ مفتوح، فيهبط
     العائد على تبويبٍ غير الذي غادر منه. الآن: تفاؤلٌ محليّ فوريّ +
     push يكتب `?filter=` في التاريخ — فالرجوع يرجع للتبويب نفسه،
     والرابط يُشارك فيفتح على حالته. */
  const [pendingTab, setPendingTab] = useState<LibraryTab | null>(null);
  /* تصفير التفاؤل أثناء الرسم لا في effect (نمط React الموثّق لضبط
     الحالة عند تغيّر prop) — الرابط وصل فصار هو الحقيقة */
  const [lastInitial, setLastInitial] = useState(initialTab);
  if (lastInitial !== initialTab) {
    setLastInitial(initialTab);
    setPendingTab(null);
  }
  const tab = pendingTab ?? initialTab;
  function goTab(id: LibraryTab) {
    if (id === tab) return;
    setPendingTab(id);
    const f = TAB_FILTER[id];
    router.push(f ? `/library?filter=${f}` : "/library", { scroll: false });
  }
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"smart" | "title" | "progress" | "added">("smart");
  /* ورقةُ الأدوات (D-177): البحث والترتيب وإنشاء القائمة خلف رمزٍ واحد */
  const [tools, setTools] = useState(false);
  /* رقاقة الحالة (طلب المالك): «الكل» افتراضاً، والترشيح محليّ كالبحث */
  const [sheet, setSheet] = useState<GridItem | null>(null);

  /* البحث والفرز في الذاكرة: القائمة وصلت كاملةً من الخادم، فالحرف
     الواحد يصفّي فوراً بلا رحلة شبكة */
  const items = useMemo(() => {
    const base = tab === "anime" ? anime : tab === "movies" ? movies : shows;
    /* صفُّ رقائق الحالة حُذف بطلب المالك (نقض جزئي لـ D-078) —
       الفواصل المسمّاة بقيت، والشبكة تعرض الكل دائماً */
    const byStatus = base;
    /* 🆕 **البحثُ يعرف العربية** (D-350): «الاب» تجد «الأب» و«قصه» تجد
       «قصّة» — **والمقارنةُ على مفتاحٍ مطبَّعٍ لا على النصّ المعروض**،
       فالعنوانُ يبقى كما كتبه أهلُه (D-048). */
    const needle = normalizeSearch(q);
    const filtered = needle
      ? byStatus.filter((x) => normalizeSearch(x.title).includes(needle))
      : byStatus;
    /* 🆕 **الأحدثُ إضافةً** (D-350) — **وما لا تاريخَ له يهبط** لا يتصدّر
       (D-063: الغيابُ لا يُقرأ «اليوم»). */
    if (sort === "added")
      return [...filtered].sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
    /* **والترتيبُ بلغة الواجهة لا بلغة الجهاز** (القاعدة ١٧) */
    if (sort === "title") {
      const cmp = byTitle(locale === "en" ? "en" : "ar");
      return [...filtered].sort((a, b) => cmp(a.title, b.title));
    }
    if (sort === "progress")
      /* غير المكتمل أولاً (طلب أحمد 9 Aug): من يفرز بالتقدم يبحث عمّا
         يُكمله لا عمّا أنهاه — المكتمل ١٠٠٪ ذيلٌ، والباقي أعلاه تنازلياً */
      return [...filtered].sort((a, b) => {
        const ap = a.progress ?? 0;
        const bp = b.progress ?? 0;
        const aDone = ap >= 100 ? 1 : 0;
        const bDone = bp >= 100 ? 1 : 0;
        return aDone - bDone || bp - ap;
      });
    return filtered;
  }, [tab, shows, movies, anime, q, sort, locale]);

  /* عدّاد كل رقاقةٍ من التبويب الحاليّ — الرقم يجيب «كم عندي؟» قبل الضغط */


  const tabs = [
    { key: "shows" as const, icon: "tv" as const, label: t.shortShows, n: shows.length },
    { key: "movies" as const, icon: "film" as const, label: t.shortMovies, n: movies.length },
    /* والتسميةُ تسميةُ اكتشف نفسها (`discoverTabAnime`) لا كلمةٌ ثانية:
       تبويبٌ واحد باسمين في سطحين يُقرأ شيئين. والأيقونة `sparkles`
       موضعياً — لا مِيكا في العُدّة، ورسمُ واحدةٍ بندٌ لا ذريعةُ تأخير. */
    { key: "anime" as const, icon: "sparkles" as const, label: t.discoverTabAnime, n: anime.length },
    { key: "artists" as const, icon: "people" as const, label: t.shortArtists, n: artistCount },
    { key: "lists" as const, icon: "list" as const, label: t.listsTitle, n: lists.length },
  ];

  /* الترتيب والإخفاء من الكوكي — والتبويب المفتوح لا يُخفى من نفسه */
  const shownTabs = applyTabPrefs(tabs, tabPrefs, tab);
  const tabLabels = Object.fromEntries(tabs.map((x) => [x.key, x.label]));

  /* رفُّ الفنانين يُحسب على الخادم، والتفاؤل المحليّ يسبقه: بلا هذا
     العلم يومض «ما تتابع أي فنان» في الطريق — وهي كذبةٌ لا حالةٌ فارغة */
  const artistsPending = tab === "artists" && initialTab !== "artists";
  /* البحث لغةُ عناوين، وشبكةُ الفنانين ليست عناوين — ورقائق الفرز
     (الاسم/التقدّم) بلا معنى فيها: ترتيبُها **بعدد ما شاهدتَه** وهو
     معناها. فالصفّ كلّه يغيب في تبويبها كما يغيب في القوائم. */
  const showSearchRow = tab === "shows" || tab === "movies" || tab === "anime";

  /* **تصنيفُ ما لم يُصنَّف — مرّةً، عند من فتح التبويب** (D-182).
     ولماذا من المتصفّح لا من الخادم: الصفحة تُرسم على الخادم، والكتابةُ
     أثناء الرسم تنقض نقاء React (قاعدة الصحّة) وتُبطئ أوّل بايت **لكل
     زائر** لأجل تبويبٍ قد لا يفتحه. فالثمن يدفعه من طلبه، مرّةً. */
  const [classifying, setClassifying] = useState(false);
  const askedRef = useRef(false);
  useEffect(() => {
    if (tab !== "anime" || animeUnknown <= 0 || askedRef.current) return;
    askedRef.current = true;
    setClassifying(true);
    classifyMyFollows()
      .then((n) => {
        if (n > 0) coalescedRefresh(router);
      })
      .catch(() => {
        /* أخفق؟ لا شاشةَ خطأ: التبويب يعرض ما صُنّف، والباقي يُسأل عنه
           في الفتحة القادمة — نمط D-113. */
      })
      .finally(() => setClassifying(false));
  }, [tab, animeUnknown, router]);

  return (
    <div>
      {/* ثلاثة تبويبات في مقسّمٍ واحد — نفس عائلة تبويبات صفحة العمل
          ومقسّم «اكتشف»: خطٌّ سفليّ بلون التمييز تحت المختار، والأيقونة
          والعدّاد يأخذان اللون نفسه.

          «القوائم» تبويبٌ حقيقيّ لا رابط: تبدّل اللوح في مكانه ولا تغادر
          الصفحة، فيبقى التبويبان الآخران ظاهرين ويظلّ التنقّل الثلاثيّ
          بنفس سلاسة التنقّل بين المسلسلات والأفلام — بلا تحميل مسارٍ جديد
          ولا وميض. وبما أن القوائم تُقرأ مع الصفحة صار عدّادُها مجّانيّاً،
          فاستوت الخانات الثلاث شكلاً ووزناً: `segmentedTrackFull` يقسّم
          العرض بالتساوي و`flex-1 basis-0` يمنع النصّ الأطول من توسيع خانته. */}
      {/* رأسٌ لاصق (طلب أحمد 9 Aug): التبويبات وصفّ البحث والفرز يبقيان
          تحت الترويسة والشبكة تمرّ تحتهما. خلفية صمّاء لا شفافة —
          الملصقات تمرّ خلفها. وصفّ البحث خرج من `tabpanel` إلى هنا: هو
          تحكّمٌ في اللوح لا محتواه، ويظهر لغير تبويب القوائم وحده. */}
      {/* الرأس اللاصق من `PageTabs` المشترك (D-134): نفس موضع تبويبات
          المجتمع واكتشف بالبكسل، وخطٌّ فاصلٌ واحد لا اثنان. وصفُّ البحث
          والفرز يُمرَّر `extra` فيسكن داخل الرأس لا تحته. */}
      <PageTabs
        items={shownTabs.map(({ key, icon, label, n }) => ({ key, label, count: n, icon, onClick: () => goTab(key) }))}
        active={tab}
        ariaLabel={t.libraryTitle}
        /* **الصفُّ الذي كان هنا انتقل خلف الرمز (D-177).** كان يحمل صندوق
           البحث وثلاث رقائق ترتيب، ويأكل أوّل ما تراه العين قبل أن يظهر
           ملصقٌ واحد — والمكتبة سؤالُها «ماذا عندي؟» وجوابُه بالأغلفة
           (D-006). ورقاقةُ الحالة المفعَّلة تُغني عن العنوان: البحثُ يظهر
           في نقطة الزرّ، والترتيبُ غيرُ الافتراضيّ كذلك. */
        action={
          <FilterIconButton
            onClick={() => setTools(true)}
            label={t.libraryToolsTitle}
            active={q.trim().length > 0 || (showSearchRow && sort !== "smart")}
            expanded={tools}
          />
        }
      />

      {tools && (
        <LibraryToolsSheet
          locale={locale}
          onClose={() => setTools(false)}
          sort={sort}
          onSort={setSort}
          q={q}
          onQ={setQ}
          showFilters={showSearchRow} tabPrefs={tabPrefs} tabLabels={tabLabels}
        />
      )}

      <div className="mt-3" />

      {/* سطرٌ يقول الحقّ بدل تبويبٍ يدّعي الاكتمال وهو نصفُ ممتلئ */}
      {tab === "anime" && classifying && (
        <p className="text-center text-xs text-muted py-2">{t.animeClassifying}</p>
      )}

      <div id="lib-panel" role="tabpanel" aria-labelledby={`lib-tab-${tab}`}>
      {tab === "lists" ? (
        /* نفس تركيبة صفحة `/lists` حرفياً — لا نسخة ثانية منها: المسار
           يبقى قائماً للروابط المباشرة، وهذا اللوح يعرض المكوّنين
           نفسيهما (قوائمي ثم القوائم المحفوظة) */
        <div className="space-y-8">
          <ListManager lists={lists} stats={listStats} locale={locale} />
          {listsExtra}
        </div>
      ) : tab === "artists" ? (
        /* الفنانون: نفس الشبكة ونفس البطاقة — تبويبٌ رابع لا لغةٌ ثانية.
           والفرز بعدد ما شاهدتَه له يقع في `getArtistShelf` على الخادم
           (وهناك شرحُ كلفته وسقفه)، فلا حساب هنا. */
        artistsPending ? (
          <div className={posterGrid} aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="aspect-[2/3] rounded-poster bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted">{t.artistsEmpty}</p>
            <button
              type="button"
              onClick={() => router.push("/search")}
              className={buttonClass({ size: "sm" })}
            >
              {t.artistsEmptyCta}
            </button>
          </div>
        ) : (
          <ArtistsGrid artists={artists} t={t} />
        )
      ) : (
      <>
      {/* 🔧 **تلميحٌ يُعلّم ثم يختفي** (D-350، بند ٦): كان سطراً دائماً فوق
          الشبكة **في كلِّ زيارةٍ إلى الأبد** — **وسطرٌ لا يُقرأ بعد
          الثالثة يصير ضجيجاً فوق جواب الصفحة** (D-006). والمكوّنُ مبنيٌّ
          لهذا بالضبط منذ م٣، **ولا ثالثَ يُخترع** (القاعدة ٦). */}
      <div className="mb-4">
        <OneTimeHint id="library-hold" text={t.longPressHint} closeLabel={t.closeLabel} />
      </div>

      {items.length === 0 ? (
        /* 🔴 **ثلاثُ حالاتٍ لا حالة** (D-350، بند ١): الشرطُ واحدٌ
            **والأسبابُ ثلاثة** — بحثٌ لا يطابق · تبويبُ أنمي لم يُصنَّف
            فيه شيء · مكتبةٌ فارغةٌ حقّاً. **وكان يقول «مكتبتك فارغة»
            للثلاثة**، فيكذب على اثنين (D-063).
            **والزرُّ يحمل أوّلَ خطوةٍ لكلِّ حالةٍ بابَها** (D-106):
            مسحُ البحث · تصفّحُ الأنمي · اكتشف. */
        <div className="text-center py-16 space-y-4">
          <p className="text-muted">
            {q.trim()
              ? t.libSearchEmpty(q.trim())
              : tab === "anime"
                ? t.libAnimeEmpty
                : t.libraryEmpty}
          </p>
          <button
            type="button"
            onClick={() => {
              if (q.trim()) {
                setQ("");
                return;
              }
              router.push(tab === "anime" ? "/news?tab=anime" : "/news");
            }}
            className={buttonClass({ size: "sm" })}
          >
            {q.trim()
              ? t.libSearchEmptyCta
              : tab === "anime"
                ? t.libAnimeEmptyCta
                : t.libraryEmptyCta}
          </button>
        </div>
      ) : (
        /* الشبكة وصفتُها في `ui/controls` منذ صار للمكتبة شبكتان (D-128) */
        <div className={posterGrid}>
          {items.map((x, i) => (
            <Fragment key={x.key}>
              {/* فاصلٌ مسمّى عند تبدّل المجموعة (طلب المالك): الترتيب الذكي
                  يرصف الحالات متجاورةً أصلاً، فالحدّ بينها سطرُ عنوانٍ
                  بعرض الشبكة. يظهر في «الكل» بالترتيب الذكي وحده — الفرز
                  بالاسم أو التقدّم يخلط المجموعات فيصير الفاصل كذبة */}
              {sort === "smart" &&
                i > 0 &&
                x.status !== items[i - 1].status &&
                x.status && (
                  /* الكلمة في منتصف السطر لا في أوّله (طلب المالك) — المكوّن
                     المشترك SectionDivider. ويُستثنى من content-visibility
                     الموروثة: حجزُ ٢٤٠ بكسل لفاصلٍ ارتفاعه ٢٠ يجعل شريط
                     التمرير يقفز */
                  <SectionDivider
                    label={statusLabel(x.status, t)}
                    className="col-span-full pt-1"
                    style={{ contentVisibility: "visible", containIntrinsicSize: "auto" }}
                  />
                )}
              <LongPressable onLongPress={() => setSheet(x)}>
                <PosterCard
                  href={x.href}
                  title={x.title}
                  posterPath={x.posterPath}
                  progress={x.progress}
                  badge={x.badge}
                  badgeTone={x.badgeTone}
                  count={x.count}
                  dropped={x.dropped}
                />
              </LongPressable>
            </Fragment>
          ))}
        </div>
      )}
      </>
      )}
      </div>

      {sheet && (
        <QuickActions
          item={sheet}
          t={t}
          onClose={() => setSheet(null)}
          onDone={() => coalescedRefresh(router)}
        />
      )}
    </div>
  );
}

type Dict = ReturnType<typeof getDict>;

/** اسم رقاقة الحالة نفسه يسمّي الفاصل — مفهومٌ واحد، اسمٌ واحد (D-026) */
function statusLabel(s: LibraryStatus, t: Dict): string {
  return s === "watching"
    ? t.libStatusWatching
    : s === "completed"
      ? t.libStatusCompleted
      : s === "unstarted"
        ? t.libStatusUnstarted
        : t.libStatusDropped;
}

/** لوح الإجراءات السريعة — يطفو من الأسفل فوق الشبكة */
function QuickActions({
  item,
  t,
  onClose,
  onDone,
}: {
  item: GridItem;
  t: Dict;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  /**
   * تفاؤلي بالكامل: العلامة تظهر في نفس اللحظة واللوح يُغلق، والخادم
   * يلحق في الخلفية — كانت هذه الواجهة الوحيدة التي تُبقي المستخدم
   * يحدّق في زرٍّ معتم ٤٠٠–١٢٠٠ مللي ثانية، وهي أميز تفاعلٍ في التطبيق.
   * الفشل يظهر توستاً، والتجديد المُجمَّع يصحّح أي تفاؤلٍ كاذب.
   */
  function run(label: string, fn: () => Promise<unknown>) {
    /* 🆕 **والاهتزازةُ نفسُها في السطحين** (D-353): كانت في `PosterHold`
       وحدَها، **فالإيماءةُ الواحدة تُجيب بجوابين على الجهاز نفسِه.** */
    tap([12, 30]);
    setMsg(label);
    onDone();
    setTimeout(onClose, 650);
    start(async () => {
      try {
        await fn();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const isTv = item.mediaType === "tv";
  const btn =
    "flex items-center gap-3 w-full text-start px-5 py-3.5 text-sm font-semibold transition active:bg-surface-2 disabled:opacity-40";

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="quick-actions-title">
      <SheetHeader id="quick-actions-title" title={item.title} closeLabel={t.closeLabel} onClose={onClose}>
        {msg && (
          <p role="status" className="text-xs text-[color:var(--success)] mt-1">
            {msg}
          </p>
        )}
      </SheetHeader>

        {item.dropped ? (
          /* عملٌ موقوف: الإجراء الوحيد المنطقي هو التراجع عن الإيقاف */
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run("✓", () => runOrQueue("setDropped", item.tmdbId!, item.mediaType!, false))
            }
            className={btn}
          >
            <Icon name="play" size={20} className="text-accent shrink-0" />
            {t.undoWatched}
          </button>
        ) : (
          <>
            {isTv && !item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run("✓", () => runOrQueue("markNextEpisode", item.tmdbId!))
                }
                className={btn}
              >
                <Icon name="play" size={20} className="text-accent shrink-0" />
                {t.markNextEp}
              </button>
            )}

            {/* عملٌ مكتمل: بابه «أشاهده من جديد» — دورةٌ جديدة واليوميات سليمة */}
            {isTv && item.completed && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run("✓", () => startRewatch(item.tmdbId!))
                }
                className={btn}
              >
                <Icon name="repeat" size={20} className="text-accent shrink-0" />
                {t.rewatchBtn}
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run("✓", () =>
                  isTv
                    ? runOrQueue("markShowWatched", item.tmdbId!)
                    : runOrQueue("toggleMovieWatched", {
                        movieTmdbId: item.tmdbId!,
                        runtime: null,
                        watched: true,
                      }),
                )
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              {/* **`check-line` كالمنسدلة لا `check`** (D-353): أيقونتان
                  لفعلٍ واحد في سطحين هي ما تمنعه قاعدةُ الأيقونات. */}
              <Icon name="check-line" size={20} className="text-[color:var(--success)] shrink-0" />
              {t.markAllWatched}
            </button>

            {/* 🆕 **«ريفيو» ثالثاً — الصفُّ الذي كان ناقصاً هنا وحدَه**
                (D-353، حكمُ أحمد «ج»): الإيماءةُ واحدةٌ في المكتبة
                واكتشف، **والقائمتان كانتا تختلفان في المعنى لا في الشكل
                وحدَه** — «ريفيو» موجودةٌ هناك وغائبةٌ هنا بلا سبب.
                **وينتقل ولا يفتح**: كتابةُ رأيٍ تحتاج تقييماً ونصّاً
                ومساحة، **وما يستحقّ صفحةً يأخذها** (نصُّ D-229 حرفاً).
                **والترتيبُ صار ترتيبَ المنسدلة**: أفعالُ المشاهدة ثم
                «ريفيو» ثم ما لا رجعةَ سهلةَ فيه. */}
            <button
              type="button"
              onClick={() => {
                tap(8);
                onClose();
                router.push(
                  `/${item.mediaType === "tv" ? "show" : "movie"}/${item.tmdbId}`,
                );
              }}
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="star" size={20} className="text-accent shrink-0" />
              {t.reviewSectionTitle}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run("✓", () => runOrQueue("setDropped", item.tmdbId!, item.mediaType!, true))
              }
              className={`${btn} border-t border-[color:var(--divider)]`}
            >
              <Icon name="card" size={20} className="text-[color:var(--error)] shrink-0" />
              {t.dropTitle}
            </button>
          </>
        )}
    </Sheet>
  );
}
