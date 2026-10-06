"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { aiStorySearch } from "@/lib/actions";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { SEARCH_FOCUS_EVENT } from "@/lib/searchFocus";
import { chipClass, chipRow } from "./ui/controls";
import { Icon, type IconName } from "./Icon";
import { OneTimeHint } from "./OneTimeHint";
import { PersonName } from "./PersonRow";
import { SettingsHeader } from "./settings/SettingsHeader";
import { buttonClass } from "./ui/Button";
import type {
  SearchArtist,
  SearchList,
  SearchPayload,
  SearchScope,
  SearchTitle,
  SearchTrendingItem,
} from "@/core/searchTypes";

/**
 * **صفحةُ البحث — سطحٌ واحدٌ لكلِّ ما يُبحث عنه في Loopz** (D-534،
 * تصميمُ أحمد بلقطةٍ في ٢٢ أغسطس).
 *
 * ================= ولماذا صفحةٌ بعد أن كانت ورقة =================
 *
 * **كان البحثُ ورقةً تنبثق من الشريط السفليّ** بحجّةٍ مكتوبة: «البحثُ
 * فعلٌ لا وجهة» — **وكانت صحيحةً يومَ كان البحثُ صفّاً واحداً من
 * الأعمال.** **وقد صار أربعةَ أنواعٍ ووضعَ وصفٍ وأقساماً لكلٍّ منها
 * «عرض الكل»** — **وورقةٌ تعلو نصفَ الشاشة لا تحمل هذا**، فتصير كلُّ
 * نتيجةٍ سطراً في نافذةٍ ضيّقة. **والفعلُ حين يكبر يصير وجهة.**
 *
 * ⚖️ **وهذا نقضٌ مسجَّلٌ لقرار الورقة** — **والورقةُ لم تُحذف**: بقيت
 * لالتقاط عملٍ إلى قائمة (`onPick`)، **وذاك سؤالٌ آخر** (تختار ولا
 * تنتقل)، **ولا يصحّ فيه أن تغادر الصفحة التي تبني فيها القائمة.**
 *
 * **والرجوعُ يعيدك إلى حيث كنت** (`SettingsHeader` → `router.back()`)،
 * **ولهذا يُكتب النصُّ في الرابط بـ`replaceState` لا `pushState`**
 * (D-521): **حرفٌ واحدٌ لكلِّ ضغطةِ زرٍّ في التاريخ يجعل زرَّ الرجوع
 * يمسح ما كتبتَه حرفاً حرفاً** بدل أن يخرجك.
 *
 * ================= وخمسُ رقائقَ لا خمسُ صفحات =================
 *
 * **«الكل» ليست تجميعاً لأربع قوائم، هي القائمة** (D-398 بحرفها):
 * ثلاثةُ صفوفٍ لكلِّ قسمٍ ثم «عرض الكل» يقصر الشاشةَ على قسمه.
 * **والرقاقةُ مرشِّحٌ فوق قائمةٍ قائمة** — وهو تعريفُ عائلة `chip` في
 * `ui/controls`، **والمقسَّمُ عمودٌ ثانٍ فلا يُستعمل هنا.**
 *
 * **والبحثُ بالوصف بابٌ لا رقاقة**: يقلب الشاشةَ إلى حقلٍ آخر وزرِّ
 * تشغيل — **ورقاقةٌ بين أنواعٍ تعِد بترشيحٍ لا بوضعٍ ثانٍ.**
 */

/** حرفان — حدُّ `/api/search` نفسُه، فلا يُطلب ما يُردّ فارغاً */
const MIN = 2;

const SCOPES: SearchScope[] = ["all", "titles", "artists", "members", "lists"];

export function SearchScreen({
  locale,
  initialQ = "",
  initialScope = "all",
  trending = [],
}: {
  locale: Locale;
  /** نصُّ رابطٍ عميق (`?q=`) — والصفحةُ تُفتح به مكتوباً ومبحوثاً */
  initialQ?: string;
  initialScope?: SearchScope;
  /** 🆕 «رائج اليوم» — عشرةٌ من الخادم، تُرسم قبل أن يُكتب حرف وتغيب عند الحرف الثاني */
  trending?: SearchTrendingItem[];
}) {
  const t = getDict(locale);
  const [q, setQ] = useState(initialQ);
  const [scope, setScope] = useState<SearchScope>(initialScope);
  const [data, setData] = useState<SearchPayload | null>(null);
  const [loading, setLoading] = useState(false);
  /** وضعُ الوصف — شاشةٌ ثانيةٌ لا رقاقةٌ سادسة */
  const [desc, setDesc] = useState(false);
  const [descText, setDescText] = useState("");
  const [descItems, setDescItems] = useState<DescHit[] | null>(null);
  /* 🆕 D-1259 — النتائجُ من المسار البديل (بلا نموذج) تُسمّى فوقها */
  const [descFallback, setDescFallback] = useState(false);
  const [descPending, startDesc] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  /* ⚖️ 🆕 **لا لوحةَ مفاتيحٍ عند الدخول** (D-1250، قرارُ أحمد ٣ أكتوبر ٢٠٢٦: «بلا لوحة في الويب أيضاً» —
     ينقض «من فتح البحث جاء ليكتب» وتركيزَ D-711 الفوريّ). الصفحةُ تُفتح اليومَ على «رائج اليوم»،
     واللوحةُ كانت تغطّيها. **الحقلُ يُركَّز بلمسه، أو بضغطةٍ ثانيةٍ على «بحث» في الشريط السفليّ**
     (`SEARCH_FOCUS_EVENT` — يُطلَق داخل `click` فيقع التركيزُ داخل الإيماءة ويفتح iOS لوحتَه).

     **وسطحُ المكتب باقٍ على تركيزه**: لا لوحةَ هناك تغطّي شيئاً، ومن فتح الصفحةَ بفأرٍ يكتب فوراً —
     والحارسُ نوعُ المؤشّر (`hover` + `fine`) لا عرضُ الشاشة. */
  useEffect(() => {
    if (initialQ) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [initialQ]);
  useEffect(() => {
    const onFocus = () => inputRef.current?.focus({ preventScroll: true });
    window.addEventListener(SEARCH_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(SEARCH_FOCUS_EVENT, onFocus);
  }, []);

  /* **والتفريغُ عند الكتابة لا في جسد المؤثّر** (D-434، وسابقةُ
     `SearchBox`): ضبطُ الحالة داخل المؤثّر يُطلق تصييراً متتالياً. */
  function changeQ(value: string) {
    setQ(value);
    if (value.trim().length < MIN) {
      setData(null);
      setLoading(false);
    }
  }

  /* **نداءٌ واحدٌ للأنواع الأربعة** — والنطاقُ في اعتماديّاته: تبديلُ
     الرقاقة يعيد السؤالَ بسقفٍ أوسع، **ونتائجُ «الكل» تحت رقاقةٍ صارت
     تعني شيئاً آخر تكذب على القارئ.** */
  useEffect(() => {
    if (desc) return;
    const term = q.trim();
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}&type=${scope}`,
          { signal: ctrl.signal },
        );
        setData((await res.json()) as SearchPayload);
      } catch {
        /* أُلغي الطلب أو فشل — تُتجاهل بصمت كسائر البحث الحيّ */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, scope, desc]);

  /* **والعنوانُ يصف حالةً محلّيّة، فيُكتب بـHistory API لا بتنقّل**
     (D-521) — **ولا رحلةَ خادمٍ لحرفٍ يُكتب.** */
  useEffect(() => {
    const term = q.trim();
    const sp = new URLSearchParams();
    if (term) sp.set("q", term);
    if (scope !== "all") sp.set("type", scope);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `/search?${qs}` : "/search");
  }, [q, scope]);

  function runDesc() {
    const text = descText.trim();
    if (text.length < 8) return;
    tap([12, 30]);
    startDesc(async () => {
      try {
        const res = await aiStorySearch(text);
        if (!res.ok) {
          setDescItems([]);
          setDescFallback(false);
          return;
        }
        setDescFallback(!!res.fallback);
        setDescItems(
          res.results.map((r) => ({
            id: r.id,
            mediaType: r.kind === "tv" ? "tv" : "movie",
            title: r.title,
            titleSecondary: r.titleSecondary,
            year: r.year ?? null,
            poster: r.poster,
            reason: r.reason,
          })),
        );
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  const term = q.trim();
  const short = term.length < MIN;
  const nothing =
    !!data &&
    !data.titles.length &&
    !data.artists.length &&
    !data.members.length &&
    !data.lists.length;
  /* 🆕 D-1309 (طلبُ خالد بلقطة، ٦ أكتوبر: «اذا ما جات نتائج يجيه جرب البحث بالوصف مع ضغط يودي عليه»): الفراغُ كان
     طريقاً مسدوداً والبابُ الآخر نجمةٌ بلا كلمة. عند «لا نتائج»: النجمةُ تُحاط وتحتها تلميحٌ يسمّيها، وتحت الفراغ سطرٌ
     ينتهي برابط — والثلاثةُ تفتح وضعَ الوصف **حاملةً ما كُتب** (لا يُعاد كتابتُه) ولا تشغّل البحثَ: كلمتان اسمٌ لا
     وصف، وصاحبُهما يزيد عليهما ثمّ يضغط. التلميحُ يغيب بعد خمس ثوانٍ (يغطّي آخرَ الرقاقات) والإطارُ والرابطُ باقيان. */
  const empty = !short && nothing && !(loading && !data);
  const [tipFor, setTipFor] = useState<string | null>(null);
  const tip = empty && tipFor !== term;
  useEffect(() => {
    if (!tip) return;
    const id = window.setTimeout(() => setTipFor(term), 5000);
    return () => window.clearTimeout(id);
  }, [tip, term]);
  const openDesc = () => {
    tap(8);
    if (empty && !descText.trim()) setDescText(term.slice(0, 600));
    setDesc(true);
  };

  return (
    <div>
      <SettingsHeader title={t.navSearch} fallbackHref="/" />

      {desc ? (
        /* ================= وضعُ الوصف ================= */
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setDesc(false)}
            className="inline-flex items-center gap-1 text-12 font-semibold text-muted hover:text-foreground transition"
          >
            <Icon name="chevron-down" size={14} className="rotate-90 rtl:-rotate-90" />
            {t.aiSearchBack}
          </button>

          <textarea
            value={descText}
            onChange={(e) => setDescText(e.target.value.slice(0, 600))}
            placeholder={t.aiSearchPlaceholder}
            aria-label={t.aiSearchPlaceholder}
            rows={3}
            /* ١٦ بكسلاً: أصغرُ منها يكبّر سفاري الصفحةَ عند التركيز */
            className="no-focus-ring w-full rounded-xl bg-surface-2 border border-border px-4 py-3 text-base outline-none transition resize-none"
          />
          <button
            type="button"
            onClick={runDesc}
            disabled={descPending || descText.trim().length < 8}
            className={buttonClass({ variant: "primary", size: "md", className: "w-full" })}
          >
            {descPending ? t.peopleSearching : t.aiSearchRun}
          </button>

          <div className="divide-y divide-[color:var(--divider)]">
            {descPending ? (
              <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
            ) : descItems === null ? (
              <p className="text-xs text-muted text-center py-8">{t.aiSearchHint}</p>
            ) : descItems.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">{t.aiSearchEmpty}</p>
            ) : (
              <>
                {descFallback && <p className="text-xs text-muted py-2">{t.aiSearchFallback}</p>}
                {descItems.map((r) => (
                  <TitleRow key={`${r.mediaType}-${r.id}`} r={r} t={t} note={r.reason} />
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ================= البحثُ بالاسم ================= */
        <div className="space-y-4">
          {/* ⚖️ 🆕 D-1252 — **بابُ «بحث بالوصف» صار زرّاً بجانب الحقل** (أحمد: «أحسّه ماخذ مساحة كبيرة»، اختار
              «ب» من صورتين). كان بطاقةً بسطرين تحت الرقاقات تأخذ صفّاً كاملاً من «رائج اليوم». الوصفُ طريقةٌ
              ثانيةٌ للبحث فمكانُها بجانب حقله؛ **وما زال باباً لا رقاقة** (D-534: رقاقةٌ بين أنواعٍ تعِد بترشيح).
              ⚠️ **الثمن**: نجمةٌ بلا كلمة — اسمُها في `aria-label`/`title`، وتلميحُ المرّة الواحدة تحتها
              (D-1259، بعد تفعيل مفتاح Gemini). */}
          <form onSubmit={(e) => e.preventDefault()} className="flex items-stretch gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="absolute inset-y-0 start-3.5 grid place-items-center text-muted pointer-events-none">
                <Icon name="search" size={18} />
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => changeQ(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                /* 🆕 **ولا حدَّ ذهبيّاً عند التركيز** (D-539، بلاغُ أحمد):
                  **حلقةُ المتصفّح وحدُّ الحقل كانا ذهبيَّين معاً** —
                  **إطارٌ داخل إطار** — **والحقلُ يُركَّز برمجيّاً عند
                  فتح الصفحة فيومضان بلا أن يلمس أحد.** **والمؤشّرُ
                  النابضُ يقول ما كانا يقولانه.** */
                className="no-focus-ring w-full rounded-xl bg-surface-2 border border-border ps-10 pe-11 py-3 text-base outline-none transition"
              />
              {/* **والمسحُ لا يُرسم على حقلٍ فارغ** (D-222) — وهدفُ اللمس
                  ٤٤ وإن كان الرمزُ ١٨ (D-033/D-168). */}
              {!!q && (
                <button
                  type="button"
                  onClick={() => {
                    changeQ("");
                    inputRef.current?.focus();
                  }}
                  aria-label={t.searchClear}
                  className="absolute inset-y-0 end-0 w-11 grid place-items-center text-muted hover:text-foreground transition"
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
            <div className="relative shrink-0 flex">
              <button
                type="button"
                onClick={openDesc}
                aria-label={t.searchByDesc}
                title={t.searchByDesc}
                className={`w-12 grid place-items-center rounded-xl border bg-surface-2 text-accent transition ${
                  empty ? "border-accent ring-4 ring-accent/20" : "border-border hover:border-accent/50"
                }`}
              >
                <Icon name="sparkles" size={18} />
              </button>
              {tip ? (
                <button
                  type="button"
                  onClick={openDesc}
                  className="absolute end-0 top-[calc(100%+10px)] z-20 whitespace-nowrap rounded-xl bg-accent px-3.5 py-2 text-12 font-bold text-[color:var(--on-accent)] shadow-lg"
                >
                  <span aria-hidden className="absolute -top-1 end-[18px] h-2.5 w-2.5 rotate-45 bg-accent" />
                  {t.searchTryDesc}
                </button>
              ) : null}
            </div>
          </form>

          {/* 🆕 D-1259 — **تلميحُ المرّة الواحدة للنجمة** (كان مؤجَّلاً مع المفتاح، D-1252): زرٌّ بلا كلمةٍ
              يحتاج من يسمّيه مرّةً. `OneTimeHint` القائم — يُقرأ عند الإغلاق أو عند دخول وضع الوصف. */}
          <OneTimeHint id="search-desc" text={t.hintSearchDesc} closeLabel={t.closeLabel} />

          <div className={chipRow}>
            <div className="flex items-center gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => {
                    if (s === scope) return;
                    tap(8);
                    setScope(s);
                  }}
                  className={chipClass(scope === s)}
                >
                  {scopeLabel(s, t)}
                </button>
              ))}
            </div>
          </div>

          {short ? (
            /* 🆕 **الفراغُ قبل الكتابة صار «رائج اليوم»** (قرارُ أحمد ٣ أكتوبر ٢٠٢٦ — ينقض «لا رائج» في
               خطّة 11-G): الصفُّ صفُّ النتيجة نفسُه برقم ترتيبه، فلا تقفز الشاشةُ حين تحلّ النتائجُ محلَّه.
               **وبلا علامةِ «عندك»** («ما يحتاج تقله عندك، هذا ترند»). وإن غابت القائمةُ عاد النصُّ القديم. */
            trending.length ? (
              <Section title={t.searchTrendingToday} show seeAll={null} t={t}>
                {trending.map((r, i) => (
                  <TitleRow
                    key={`${r.mediaType}-${r.id}`}
                    r={r}
                    t={t}
                    rank={i + 1}
                    kind={r.anime ? t.animeBadge : undefined}
                  />
                ))}
              </Section>
            ) : (
              <p className="text-center text-muted py-16">{t.searchStart}</p>
            )
          ) : loading && !data ? (
            <Skeleton />
          ) : nothing ? (
            <div className="py-16 text-center">
              <p className="text-muted">{t.searchNoResults}</p>
              <p className="mt-2 text-14 text-muted">
                {t.searchNoName}{" "}
                <button type="button" onClick={openDesc} className="font-semibold text-accent underline underline-offset-4">
                  {t.searchByDesc}
                </button>
              </p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              <Section
                title={t.searchModeTitles}
                show={data.titles.length > 0}
                seeAll={scope === "all" && data.more.titles ? () => setScope("titles") : null}
                t={t}
              >
                {data.titles.map((r) => (
                  <TitleRow key={`${r.mediaType}-${r.id}`} r={r} t={t} />
                ))}
              </Section>

              <Section
                title={t.searchTabArtists}
                show={data.artists.length > 0}
                seeAll={scope === "all" && data.more.artists ? () => setScope("artists") : null}
                t={t}
              >
                {data.artists.map((a) => (
                  <ArtistRow key={a.id} a={a} />
                ))}
              </Section>

              <Section
                title={t.searchTabMembers}
                show={data.members.length > 0}
                seeAll={scope === "all" && data.more.members ? () => setScope("members") : null}
                t={t}
              >
                {data.members.map((m) => (
                  <div key={m.id} className="py-2.5">
                    <PersonName person={m} t={t} size={40} sub={t.searchMemberRole} />
                  </div>
                ))}
              </Section>

              <Section
                title={t.searchTabLists}
                show={data.lists.length > 0}
                seeAll={scope === "all" && data.more.lists ? () => setScope("lists") : null}
                t={t}
              >
                {data.lists.map((l) => (
                  <ListRow key={l.id} l={l} t={t} />
                ))}
              </Section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

type Dict = ReturnType<typeof getDict>;
type DescHit = SearchTitle & { reason?: string };

function scopeLabel(s: SearchScope, t: Dict): string {
  return s === "all"
    ? t.searchTabAll
    : s === "titles"
      ? t.searchModeTitles
      : s === "artists"
        ? t.searchTabArtists
        : s === "members"
          ? t.searchTabMembers
          : t.searchTabLists;
}

/**
 * قسمٌ من أقسام «الكل» — **عنوانٌ و«عرض الكل» ثم صفوفُه.**
 *
 * **وقسمٌ بلا صفٍّ لا يُرسم** (D-222): عنوانٌ فوق فراغٍ يقول «بحثنا ولم
 * نجد» أربعَ مرّاتٍ في شاشةٍ واحدة. **و«عرض الكل» لا يُرسم إلا وخلفه
 * مزيد** — وعدٌ يفتح القائمةَ نفسَها كذبةٌ صغيرة.
 */
function Section({
  title,
  show,
  seeAll,
  t,
  children,
}: {
  title: string;
  show: boolean;
  seeAll: (() => void) | null;
  t: Dict;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-15 font-bold">{title}</h2>
        {seeAll && (
          <button
            type="button"
            onClick={() => {
              tap(6);
              seeAll();
            }}
            className="ms-auto shrink-0 text-12 font-bold text-accent hover:opacity-80 transition"
          >
            {t.searchSeeAll}
          </button>
        )}
      </div>
      <div className="divide-y divide-[color:var(--divider)]">{children}</div>
    </section>
  );
}

/** ذيلُ الصفّ — سهمٌ يقول «هذا بابٌ يُفتح»، مُدارٌ مع الاتّجاه */
function Tail() {
  return (
    <Icon
      name="chevron-down"
      size={16}
      className="shrink-0 text-muted -rotate-90 rtl:rotate-90"
    />
  );
}

/**
 * صورةُ الصفّ — **ملصقٌ رأسيٌّ للأعمال ودائرةٌ للأشخاص** (سابقةُ
 * `ResultRow`): **الشكلُ يقول النوعَ قبل أن يُقرأ السطرُ تحته.**
 */
function Thumb({
  src,
  shape,
  icon,
}: {
  src: string | null;
  shape: "poster" | "circle" | "square";
  icon: IconName;
}) {
  const box =
    shape === "circle"
      ? "w-10 h-10 rounded-full"
      : shape === "square"
        ? "w-11 h-11 rounded-lg"
        : "w-11 aspect-[2/3] rounded-md";
  return (
    <span className={`relative shrink-0 overflow-hidden bg-surface-2 block ${box}`}>
      {src ? (
        <Image src={src} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
          <Icon name={icon} size={16} />
        </span>
      )}
    </span>
  );
}

function Row({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center gap-3 py-2.5 hover:bg-surface-2 transition rounded-lg"
    >
      {children}
      <Tail />
    </Link>
  );
}

function TitleRow({
  r,
  t,
  note,
  rank,
  kind,
}: {
  r: SearchTitle;
  t: Dict;
  note?: string;
  /** 🆕 رقمُ الترتيب في «رائج اليوم» — يسبق الملصق؛ الثلاثةُ الأولى بلون الهويّة */
  rank?: number;
  /** 🆕 كلمةُ النوع حين لا تكفي «مسلسل/فيلم» (الأنمي) — الصفُّ نفسُه لا صفٌّ ثانٍ */
  kind?: string;
}) {
  return (
    <Row href={`/${r.mediaType === "tv" ? "show" : "movie"}/${r.id}`}>
      {rank !== undefined && (
        <span
          className={`w-5 shrink-0 text-center text-15 font-bold tabular-nums ${rank <= 3 ? "text-accent" : "text-muted"}`}
        >
          {rank}
        </span>
      )}
      <Thumb src={r.poster} shape="poster" icon={r.mediaType === "tv" ? "tv" : "film"} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate" dir="auto">
          {r.title}
        </span>
        {/* 🆕 **الاسمُ الأصليُّ تحته** (D-544) — **قبل سطرِ السنةِ
            والنوع** لأنه اسمٌ لا وصف. */}
        {r.titleSecondary && (
          <span className="block text-[10px] text-muted truncate" dir="auto">
            {r.titleSecondary}
          </span>
        )}
        <span className="block text-12 text-muted truncate">
          {note ??
            `${r.year ? `${r.year} · ` : ""}${kind ?? (r.mediaType === "tv" ? t.typeSeries : t.typeMovie)}`}
        </span>
      </span>
    </Row>
  );
}

function ArtistRow({ a }: { a: SearchArtist }) {
  return (
    <Row href={`/person/${a.id}`}>
      <Thumb src={a.photo} shape="circle" icon="people" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{a.name}</span>
        <span className="block text-12 text-muted truncate">{a.role}</span>
      </span>
    </Row>
  );
}

function ListRow({ l, t }: { l: SearchList; t: Dict }) {
  return (
    <Row href={`/lists/${l.id}`}>
      <Thumb src={l.poster} shape="square" icon="list" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{l.name}</span>
        <span className="block text-12 text-muted truncate">{t.listCount(l.count)}</span>
      </span>
    </Row>
  );
}

/** هيكلُ الانتظار — بإيقاع الصفّ نفسِه فلا تقفز الشاشةُ عند الوصول (D-046) */
function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="skeleton w-11 aspect-[2/3] rounded-md" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5 rounded" />
            <div className="skeleton h-3 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
