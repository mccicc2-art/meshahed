"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { aiStorySearch } from "@/lib/actions";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";

/** أدنى عدد أحرف يُطلق البحث — مطابقٌ لحدّ `/api/suggest` وبحث الأشخاص */
const MIN = 2;

interface Suggestion {
  kind: "tv" | "movie" | "person";
  id: number;
  title: string;
  year?: string;
  poster: string | null;
  rating?: number | null;
  /** أشهر أعمال الشخص — سطرٌ ثانٍ تحت الاسم */
  subtitle?: string;
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
export function TitleSearchSheet({
  onClose,
  locale,
}: {
  onClose: () => void;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
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
  const [ai, setAi] = useState(false);
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

  // اقتراحات من حرفين مع تأخيرٍ يسير — نفس حدّ `/api/suggest`
  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setItems(data.results ?? []);
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
  }, [q]);

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
        title={t.navSearch}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />

      <div className="px-5 pt-4 pb-3 space-y-3">
        {!ai ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (term) go(`/search?q=${encodeURIComponent(term)}`);
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
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
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

        {/* التبديل بين الوضعين — سطرٌ واحد لا عائلة تحكّمٍ جديدة */}
        <button
          type="button"
          onClick={() => {
            tap(8);
            setAi((v) => !v);
          }}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted hover:text-accent transition py-1"
        >
          <Icon name={ai ? "search" : "sparkles"} size={15} strokeWidth={2} />
          {ai ? t.aiSearchBack : t.aiSearchBtn}
        </button>
      </div>

      <div className="overflow-y-auto overscroll-contain divide-y divide-[color:var(--divider)] min-h-[6rem]">
        {ai ? (
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
          <p className="text-xs text-muted text-center py-8 px-5">{t.searchStart}</p>
        ) : items.length === 0 && touched ? (
          <p className="text-sm text-muted text-center py-8 px-5">{t.searchNoResults}</p>
        ) : (
          items.map((s) => <ResultRow key={`${s.kind}-${s.id}`} s={s} t={t} onGo={go} />)
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
}: {
  s: Suggestion;
  t: ReturnType<typeof getDict>;
  onGo: (href: string) => void;
}) {
  const person = s.kind === "person";
  const href = person
    ? `/person/${s.id}`
    : `/${s.kind === "tv" ? "show" : "movie"}/${s.id}`;
  return (
    <button
      type="button"
      onClick={() => onGo(href)}
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
        <span className="block text-[11px] text-muted truncate">
          {person
            ? s.subtitle || t.searchPeopleTitle
            : s.subtitle
              ? s.subtitle
              : `${s.kind === "tv" ? t.typeSeries : t.typeMovie}${s.year ? ` · ${s.year}` : ""}`}
        </span>
      </span>

      {!person && s.rating != null && s.rating > 0 && (
        <span className="text-[11px] font-bold text-accent tabular-nums shrink-0" dir="ltr">
          ★ {s.rating}
        </span>
      )}
    </button>
  );
}
