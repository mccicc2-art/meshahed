"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { aiStorySearch, findPeople } from "@/lib/actions";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { segmentedItem, segmentedTrack, sheetScroll } from "./ui/controls";

/** أدنى عدد أحرف يُطلق البحث — مطابقٌ لحدّ `/api/suggest` وبحث الأشخاص */
const MIN = 2;

/**
 * أوضاع البحث الثلاثة — **بابٌ واحد للبحث لا ثلاثة** (طلب أحمد 9 Aug
 * مساءً: «إضافة صديق ادمجها مع البحث العام… زرّ بحث عن شخص»).
 *
 * كان في التطبيق ورقتا بحثٍ منفصلتان: هذه للأعمال، وأخرى للأشخاص خلف زرّ
 * «+» في صفحة المجتمع. وهو تقسيمٌ يعرفه الكود ولا يعرفه المستخدم: من
 * يريد صديقاً يضغط «بحث» كما يضغطه لفيلم، فلا يجد ما يريد ولا يخطر له
 * أن يبحث عن زرٍّ ثانٍ في صفحةٍ ثالثة.
 *
 * والوضع مقسّمٌ لا رقائق: خياراتٌ **يستبعد بعضها بعضاً** وعددها قليل
 * ومعروف — وهذا تعريف عائلة `segmented` في `ui/controls`. والرقائق
 * للفلاتر من قائمةٍ مفتوحة.
 */
export type SearchMode = "titles" | "people" | "ai";

interface Suggestion {
  kind: "tv" | "movie" | "person";
  id: number;
  title: string;
  year?: string;
  poster: string | null;
  rating?: number | null;
  /** أشهر أعمال الشخص — سطرٌ ثانٍ تحت الاسم */
  subtitle?: string;
  /** وجهةٌ صريحة تسبق الوجهة المشتقّة من النوع — مستخدمو التطبيق
      معرّفُهم نصّيّ ووجهتُهم `/u/…`، لا `/person/<رقم TMDB>` */
  href?: string;
  /** مسار ملصق TMDB الخام — لا الرابط الجاهز. من يلتقط العمل ليضيفه إلى
      قائمة يحتاج المسار، و`safeImagePath` ترفض الرابط الكامل (D-167).
      **واسمُه بالشرطة السفلية كما يأتي من `/api/suggest` حرفياً:** الصفوف
      تُسنَد من ردّ الشبكة بلا تحويل (`setItems(data.results)`)، فاسمٌ
      مخالفٌ هنا يقرأ `undefined` بصمت — وهو ما وقع فعلاً أوّل مرّة. */
  poster_path?: string | null;
  /** مفتاح صفٍّ فريد حين لا يكفي `kind-id` (مستخدمو التطبيق كلّهم id=0).
      اسمُه ليس `key`: حقلٌ بذلك الاسم داخل كائنٍ يُمرَّر إلى JSX فخٌّ
      يُقرأ خطأً من أول نظرة */
  rowKey?: string;
}

/**
 * البحث عن عملٍ في ورقةٍ منبثقة لا في صفحة.
 *
 * البحث فعلٌ لا وجهة: من يضغط «بحث» يريد أن يكتب الآن، لا أن ينتقل إلى
 * صفحةٍ ثم يجد حقلاً ثم يضغطه ثم تظهر لوحة المفاتيح. الورقة تفتح والحقل
 * مركَّز فتظهر اللوحة في اللحظة نفسها، وإغلاقها يعيده إلى مكانه من
 * التطبيق بلا رجوعٍ في السجلّ — والصفحة `/search` تبقى لمن وصلها برابط.
 *
 * علوية لا سفلية: اللوحة تأكل النصف السفلي، فالنتائج تبقى فوقها ظاهرة.
 */
/** ما يُسلَّم لمن فتح الورقة لاقتطاف عملٍ لا للانتقال إليه */
export interface PickedTitle {
  kind: "tv" | "movie";
  id: number;
  title: string;
  posterPath: string | null;
}

export function TitleSearchSheet({
  onClose,
  locale,
  initialMode = "titles",
  onPick,
}: {
  onClose: () => void;
  locale: Locale;
  /** يُفتح على وضعٍ بعينه — حالة الفيد الفارغة تفتحه على «أشخاص» */
  initialMode?: SearchMode;
  /**
   * ورقةٌ واحدة، بابان (نمط D-054): بلا هذه الدالّة الصفُّ **ينتقل** إلى
   * العمل — وهو البحث كما نعرفه. ومعها الصفُّ **يُسلّم العمل** لمن فتح
   * الورقة ولا ينتقل: صفحةُ القائمة تفتحها لتضيف، لا لتغادر.
   *
   * ولا ورقةَ بحثٍ ثانية لهذا: نسخُها كان سيعني محرّكَي اقتراحاتٍ
   * ينحرفان عند أوّل إصلاح (قاعدة D-145).
   *
   * **ووضعُ الأعمال وحده حين تُمرَّر:** شخصٌ لا يدخل قائمة أعمال، ووصفُ
   * قصةٍ بابٌ إلى صفحة عملٍ لا إلى التقاطه — ومقسّمٌ بخيارٍ واحد ليس
   * مقسّماً، فيغيب كلُّه.
   */
  onPick?: (item: PickedTitle) => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [mode, setMode] = useState<SearchMode>(onPick ? "titles" : initialMode);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ===== وضع الذكاء (D-076) =====
     وضعان في ورقةٍ واحدة لا ورقتان: البحث فعلٌ واحد عند المستخدم سواء
     كتب اسماً أو وصف قصةً — والتبديل يحفظ مصيدة التركيز (منطق D-066).
     نتائج الذكاء تُطلب بزرٍّ لا مع الكتابة: النداء يكلّف نموذجاً وعشرة
     طلبات TMDB، ووصفُ قصةٍ يُكتب كاملاً ثم يُسأل عنه. */
  const [aiText, setAiText] = useState("");
  const [aiItems, setAiItems] = useState<Suggestion[] | null>(null);
  const [aiPending, startAi] = useTransition();

  function runAi() {
    const desc = aiText.trim();
    if (desc.length < 8 || aiPending) return;
    tap([12, 30]);
    startAi(async () => {
      try {
        const res = await aiStorySearch(desc);
        if (!res.ok) {
          // «غير مفعّل» سقطت: غياب مفتاح النموذج له الآن مسارٌ بديل
          // يُجيب بما يملكه التطبيق (إصلاح 9 Aug)
          setAiItems([]);
          return;
        }
        /* سبب الترشيح يسكن `subtitle` — الصفّ الواحد يعرضه بلا فرعٍ
           جديد في هندسته (نفس خانة مهنة الشخص) */
        setAiItems(
          res.results.map((r) => ({
            kind: r.kind,
            id: r.id,
            title: r.title,
            year: r.year,
            poster: r.poster,
            rating: r.rating,
            subtitle: r.reason,
          })),
        );
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  /* التركيز بعد إطارٍ واحد: الورقة تنقل التركيز إلى لوحها عند الفتح،
     فالتركيز الفوري يُسلب منه قبل أن تظهر لوحة المفاتيح.
     ولا تفريغَ للحالة عند الإغلاق: المكوّن يُركَّب عند الفتح ويُفكّ عند
     الإغلاق، فيبدأ نظيفاً بطبعه بلا مؤثّرٍ يُصفّر. */
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  /* التفريغ عند الكتابة لا داخل المؤثّر — كما في `SearchBox`: ضبط الحالة
     داخل جسم المؤثّر يُطلق تصييراً متتالياً */
  function changeQ(value: string) {
    setQ(value);
    if (value.trim().length < MIN) {
      setItems([]);
      setTouched(false);
      setLoading(false);
    }
  }

  /* اقتراحات من حرفين مع تأخيرٍ يسير — نفس حدّ `/api/suggest`.
     والوضع في قائمة اعتماديّاته: تبديلُه بنصٍّ مكتوبٍ أصلاً يجب أن يعيد
     السؤال إلى المصدر الآخر فوراً، لا أن يترك نتائج الوضع السابق معروضة
     تحت عنوانٍ صار يعني شيئاً آخر. */
  useEffect(() => {
    if (mode === "ai") return;
    const term = q.trim();
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (mode === "people") {
          /* بحث الأشخاص فعلُ خادمٍ لا مسار API: يمرّ بحدّ المعدّل
             (`requireUser("search")`) وبدالّة SQL تُهرّب أحرف البحث */
          const rows = await findPeople(term);
          setItems(
            rows.map((p) => ({
              kind: "person" as const,
              /* `ResultRow` يبني الرابط من الرقم للأشخاص (TMDB)، وهؤلاء
                 مستخدمو التطبيق — فالمعرّف نصّي والوجهة `/u/…`. لذلك
                 يحمل الصفّ `href` صريحاً هنا. */
              id: 0,
              href: `/u/${p.username ?? p.id}`,
              title: p.hide_name ? t.anonymousUser : p.nickname || p.username || "—",
              poster: p.hide_name ? null : p.avatar_url,
              subtitle: p.username ? `@${p.username}` : undefined,
              rowKey: p.id,
            })),
          );
        } else {
          const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
            signal: ctrl.signal,
          });
          const data = await res.json();
          setItems(data.results ?? []);
        }
        setTouched(true);
      } catch {
        /* أُلغي الطلب أو فشل — تُتجاهل بصمت */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, mode, t]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  const term = q.trim();

  return (
    <Sheet
      open
      variant="top"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="title-search-title"
    >
      <SheetHeader
        id="title-search-title"
        title={onPick ? t.listAddTitles : t.navSearch}
        closeLabel={t.closeLabel}
        onClose={onClose}
      >
        {/* محور «فيمَ أبحث؟» في الترويسة نفسها (طلب أحمد): يُقرأ قبل أن
            تلمس الحقل، لا بعد أن تكتب فيه وتجد نتائج النوع الخطأ.
            وتبديل الوضع يُصفّر النتائج والنصّ — كتابةٌ لنوعٍ لا تصلح
            لغيره، وإبقاؤها يجعل الشاشة تكذب لثلث ثانية. */}
        {!onPick && (
        /* **`segmentedTrack` لا `Bare` (D-201):** كان بلا خطٍّ سفليّ —
           **ولا صفَّ أوسع يحمله هنا** (`-mb-3` يسحب ما بعده فوقه). ولمّا
           صار شريطُ الاختيار ثلاثةَ بكسلات (طلب أحمد ١٢ أغسطس) وجد نفسه
           **يطفو بلا خطٍّ يجلس عليه** — وهي بعينها شكوى ٩ أغسطس: «لا تحط
           خط ثاني». **فالنقصُ كان في الخطّ لا في الشريط**، والعلاجُ إعادةُ
           الخطّ لا استثناءُ هذا السطح بشريطٍ أنحف (وإلا صار للاختيار
           شكلان — وهو ما تمنعه القاعدة ٦). */
        <div className={`${segmentedTrack} mt-2 -mb-3`} role="tablist" aria-label={t.navSearch}>
          {(
            [
              ["titles", t.searchModeTitles],
              ["people", t.searchModePeople],
              ["ai", t.searchModeAi],
            ] as [SearchMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                if (m === mode) return;
                tap(8);
                setMode(m);
                setQ("");
                setItems([]);
                setTouched(false);
                inputRef.current?.focus();
              }}
              className={segmentedItem(mode === m, "px-3 pt-1.5 pb-2.5 text-14", false)}
            >
              {label}
            </button>
          ))}
        </div>
        )}
      </SheetHeader>

      <div className="px-5 pt-4 pb-3 space-y-3">
        {mode !== "ai" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              /* «كل النتائج» صفحةٌ للأعمال وحدها — وضعُ الأشخاص نتائجُه
                 كاملةٌ في الورقة، فلا وجهةَ للإرسال فيه */
              if (term && mode === "titles") go(`/search?q=${encodeURIComponent(term)}`);
            }}
          >
            <div className="relative">
              <span className="absolute inset-y-0 start-3.5 grid place-items-center text-muted pointer-events-none">
                <Icon name="search" size={18} />
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => changeQ(e.target.value)}
                placeholder={mode === "people" ? t.peopleSearchPlaceholder : t.searchPlaceholder}
                aria-label={mode === "people" ? t.peopleSearchPlaceholder : t.searchPlaceholder}
                /* ١٦ بكسلاً لا ١٤: سفاري iOS يكبّر الصفحة تلقائياً عند
                   التركيز على أي حقلٍ خطُّه أصغر من ١٦، فتقفز الشاشة عند
                   فتح البحث. الحجم هنا يمنع القفزة من أصلها بلا
                   `maximum-scale` الذي يمنع تكبير المستخدم أيضاً */
                className="w-full rounded-xl bg-surface-2 border border-border ps-10 pe-4 py-3 text-base outline-none focus:border-accent transition"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
              />
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value.slice(0, 600))}
              placeholder={t.aiSearchPlaceholder}
              aria-label={t.aiSearchPlaceholder}
              rows={3}
              /* نفس قاعدة الـ١٦ بكسلاً — الحقل حقلُ كتابةٍ كسائرها */
              className="w-full rounded-xl bg-surface-2 border border-border px-4 py-3 text-base outline-none focus:border-accent transition resize-none"
            />
            <button
              type="button"
              onClick={runAi}
              disabled={aiPending || aiText.trim().length < 8}
              className={buttonClass({ variant: "primary", size: "md", className: "w-full" })}
            >
              {aiPending ? t.peopleSearching : t.aiSearchRun}
            </button>
          </div>
        )}

        {/* سطر «صف قصة» حُذف: صار وضعاً ثالثاً في مقسّم الترويسة، وزرٌّ
            يفعل ما يفعله المقسّم فوقه محورٌ ثانٍ لمعنًى واحد */}
      </div>

      <div className={`${sheetScroll} divide-y divide-[color:var(--divider)] min-h-[6rem]`}>
        {mode === "ai" ? (
          aiPending ? (
            <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
          ) : aiItems === null ? (
            <p className="text-xs text-muted text-center py-8 px-5">{t.aiSearchHint}</p>
          ) : aiItems.length === 0 ? (
            <p className="text-sm text-muted text-center py-8 px-5">{t.aiSearchEmpty}</p>
          ) : (
            aiItems.map((s) => <ResultRow key={`${s.kind}-${s.id}`} s={s} t={t} onGo={go} />)
          )
        ) : loading ? (
          <p className="text-sm text-muted text-center py-8">{t.peopleSearching}</p>
        ) : term.length < MIN ? (
          <p className="text-xs text-muted text-center py-8 px-5">
            {mode === "people" ? t.peopleSearchHint : t.searchStart}
          </p>
        ) : items.length === 0 && touched ? (
          <p className="text-sm text-muted text-center py-8 px-5">
            {mode === "people" ? t.peopleNoResults : t.searchNoResults}
          </p>
        ) : (
          items.map((s) => (
            <ResultRow
              key={s.rowKey ?? `${s.kind}-${s.id}`}
              s={s}
              t={t}
              onGo={go}
              onPick={onPick}
            />
          ))
        )}
      </div>
    </Sheet>
  );
}

/**
 * صفّ نتيجةٍ واحد — يخدم بحث الاسم وبحث الذكاء معاً (D-076).
 * استُخرج من جسم القائمة لمّا صار للورقة مصدران للنتائج: صفٌّ واحد يعني
 * هندسةً واحدة مهما اختلف الطريق إليها.
 */
function ResultRow({
  s,
  t,
  onGo,
  onPick,
}: {
  s: Suggestion;
  t: ReturnType<typeof getDict>;
  onGo: (href: string) => void;
  onPick?: (item: PickedTitle) => void;
}) {
  const person = s.kind === "person";
  const href =
    s.href ??
    (person ? `/person/${s.id}` : `/${s.kind === "tv" ? "show" : "movie"}/${s.id}`);
  /* الالتقاط للأعمال وحدها: شخصٌ لا يدخل قائمة أعمال، فصفُّه يبقى انتقالاً
     حتى لو فُتحت الورقة للالتقاط */
  const pick = onPick && !person ? onPick : null;
  return (
    <button
      type="button"
      onClick={() =>
        pick
          ? pick({
              kind: s.kind as "tv" | "movie",
              id: s.id,
              title: s.title,
              posterPath: s.poster_path ?? null,
            })
          : onGo(href)
      }
      className="w-full flex items-center gap-3 px-5 py-2.5 text-start hover:bg-surface-2 transition"
    >
      {/* الشخص صورةٌ دائرية والعمل ملصقٌ رأسيّ — الشكل يقول النوع */}
      <span
        className={`relative shrink-0 overflow-hidden bg-surface-2 block ${
          person ? "w-9 h-9 rounded-full" : "w-9 aspect-[2/3] rounded-md"
        }`}
      >
        {s.poster ? (
          <Image src={s.poster} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
            <Icon name={person ? "people" : s.kind === "tv" ? "tv" : "film"} size={14} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{s.title}</span>
        <span className="block text-12 text-muted truncate">
          {person
            ? s.subtitle || t.searchPeopleTitle
            : s.subtitle
              ? s.subtitle
              : `${s.kind === "tv" ? t.typeSeries : t.typeMovie}${s.year ? ` · ${s.year}` : ""}`}
        </span>
      </span>

      {!person && s.rating != null && s.rating > 0 && (
        <span className="text-12 font-bold text-accent tabular-nums shrink-0" dir="ltr">
          ★ {s.rating}
        </span>
      )}
    </button>
  );
}
