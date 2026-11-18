"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { findGifs } from "@/lib/actions";
import type { GifHit } from "@/lib/gif";
import { getDict, type Dict, type Locale } from "@/core/i18n";
import { GIF_ID_RE, gifUrl } from "@/core/media";
import { chipClass } from "./ui/controls";
import { Icon } from "./Icon";
import { tap } from "@/lib/haptics";

/**
 * **ورقةُ اختيار GIF** (D-362، طلبُ أحمد: «خيار جنب الصور، سريع وبديل عن
 * الصور»).
 *
 * ================= ولا سطحَ جديد =================
 *
 * **ورقتُنا الواحدة منذ D-018** بحاجبها وقفلِ تمريرها ومصيدةِ تركيزها
 * وEscape — **والسؤال قبل «أيَّ منتقٍ أبني؟» هو «أيُّ سطحٍ عندي هو
 * ورقةٌ أصلاً؟»** (D-002/D-302). **وورقةٌ لأنها تحمل حقلَ بحثٍ ولوحةَ
 * مفاتيح** (حجّةُ `ListRateStar` حرفاً).
 *
 * ================= والبحثُ بعد سكونِ الإصبع =================
 *
 * **نداءٌ لكلِّ حرفٍ يُحرق به المفتاح** (D-006/D-164): ٣٥٠ms سكوناً قبل
 * السؤال، **والرائجُ جوابُ الحقل الفارغ** — **فورقةٌ تُفتح فارغةً ليست
 * باب بحثٍ، هي بابٌ مغلق** (D-181).
 *
 * ⚠️ **والمعرّفُ وحدَه يخرج من هنا** (D-362): `onPick(id)` — **ولا رابطَ
 * يعبر إلى الفعل ولا إلى القاعدة.**
 *
 * ⚠️ **و`<img>` عارٍ لا `next/image`**: نسبةٌ مجهولةٌ يملكها مزوّدٌ خارجيّ،
 * **وهو استثناءُ D-034 نفسُه المسجَّل لصور النقاش** (D-046/D-298).
 * **والنسبةُ تصل مع الصفّ فيُحجز مكانُها قبل الرسم** (D-046).
 */
/* 🆕 R255 — **تصنيفاتُ التطبيق الثمانية و«استعملته مؤخّراً»** (`apps/mobile/src/thread/GifPicker.tsx` حرفاً): كان منتقي الويب حقلَ
   بحثٍ ورائجاً فقط، فيكتب عضوُ الحاسوب «ضحك» بنفسه كلَّ مرّة. المصطلحُ الإنجليزيُّ ثابتٌ عمداً (Giphy أغنى به) والرقاقةُ تقول
   معناه بلغة القارئ؛ والأخيرةُ اثنا عشر معرّفاً في هذا المتصفّح (المفتاحُ نفسُه في التطبيق، والذاكرتان منفصلتان) */
const RECENT_KEY = "loopz.gif.recent";
const RECENT_MAX = 12;
const GIF_CATS: { term: string; label: (t: Dict) => string }[] = [
  { term: "lol", label: (t) => t.gifCatLaugh },
  { term: "shocked", label: (t) => t.gifCatShock },
  { term: "sad", label: (t) => t.gifCatSad },
  { term: "applause", label: (t) => t.gifCatClap },
  { term: "love", label: (t) => t.gifCatLove },
  { term: "angry", label: (t) => t.gifCatAngry },
  { term: "congratulations", label: (t) => t.gifCatCongrats },
  { term: "nope", label: (t) => t.gifCatNo },
];

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && GIF_ID_RE.test(x)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX)));
  } catch {
    /* راحةٌ لا شرط */
  }
}

export function GifPicker({
  open,
  onClose,
  onPick,
  locale,
  variant = "sheet",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  locale: Locale;
  /** 🆕 R255 — `pop`: **لوحٌ فوق خانة الكتابة على الحاسوب** (أحمد ١٨ نوفمبر: «شكل ب بس حسنه»، ثمّ «دامه متصفح مو الافضل تاخذ
      المساحة كاملة اللي فوق الكتابة»، ثمّ «نفس الارتفاع السابق بس العرض كمله»): بعرض الخانة كلِّها وارتفاعٍ ثابت (شبكةٌ ٣٤٠px)
      فلا يغطّي المحادثة، والعرضُ يتّسع لأربعة أعمدةٍ أو خمسة — والجوّالُ
      ورقتُه كما كانت. المستدعي يضعه داخل غلافٍ `relative` يحمل الخانة، فيقف فوقها بلا حساب موضع */
  variant?: "sheet" | "pop";
}) {
  const t = getDict(locale);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const term = (cat ?? q).trim();
  const [rows, setRows] = useState<GifHit[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, start] = useTransition();
  /* النافذةُ الصغيرة للحاسوب وحده (≥ 1024 — عتبةُ قائمة المحادثات بجانب الخيط)؛ تحتها الورقةُ كما كانت */
  const wide = useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
  const pop = variant === "pop" && wide;
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  /* النافذةُ تُغلق بـEsc وبضغطةٍ خارجها — والمحادثةُ تحتها تبقى ظاهرةً حيّة (لا تعتيم: هذا فرقُ «ب» عن الورقة) */
  /* المستدعي يمرّر `onClose` سهماً جديداً في كلِّ رسمة (والخيطُ يُستطلع كلَّ ٦ ثوانٍ) — فالمرجعُ يحمله، والتركيزُ مرّةً عند الفتح */
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!pop || !open) return;
    /* التركيزُ في البحث فوراً — بلا حلقة التركيز الصفراء (الفتحُ بالفأرة لا بلوحة المفاتيح) */
    search.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const onDown = (e: PointerEvent) => {
      const el = e.target as Node | null;
      if (el && panel.current && !panel.current.contains(el) && !(el instanceof Element && el.closest("[data-gif-toggle]"))) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [pop, open]);

  /* الأخيرةُ تُقرأ مرّةً لكلِّ فتح — مزامنةٌ أثناء الرسم لا داخل effect (توصيةُ React، ونهجُ `Inbox`) */
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRecent(readRecent());
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    /* **سكونُ الإصبع لا كلُّ حرف** — ومهلةٌ واحدةٌ تُلغى في التنظيف
       (D-278: مؤقّتٌ ينجو من صاحبه يفعل باسمه ما لا يريد) */
    const timer = setTimeout(() => {
      start(async () => {
        const hits = await findGifs(term).catch(() => [] as GifHit[]);
        if (!alive) return;
        setRows(hits);
        setLoaded(true);
      });
    }, term && !cat ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [term, cat, open]);

  const pick = (id: string) => {
    tap(8);
    pushRecent(id);
    onPick(id);
    onClose();
  };

  const cats = (
    <>
      {GIF_CATS.map((c) => (
        <button
          key={c.term}
          type="button"
          aria-pressed={cat === c.term}
          className={chipClass(cat === c.term, "sm", pop ? "shrink-0" : "")}
          onClick={() => {
            tap(8);
            setQ("");
            setCat(cat === c.term ? null : c.term);
          }}
        >
          {c.label(t)}
        </button>
      ))}
    </>
  );
  const recentRow =
    !term && recent.length ? (
      <div className={pop ? "pb-2" : "mt-3"}>
        <p className="text-12 font-bold text-muted">{t.gifRecent}</p>
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {recent.map((id) => (
            <button key={id} type="button" onClick={() => pick(id)} className={`${pop ? "h-20 w-20" : "h-[72px] w-[72px]"} shrink-0 overflow-hidden rounded-xl bg-surface-2 active:scale-95 hover:opacity-85 transition`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gifUrl(id, "small") ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    ) : null;
  const status =
    loaded && rows.length === 0 ? (
      <p className="py-6 text-12 text-muted text-center">{term ? t.gifNone : t.gifOff}</p>
    ) : !loaded ? (
      <p className="py-6 text-12 text-muted text-center">{t.gifLoading}</p>
    ) : null;

  if (pop) {
    if (!open) return null;
    return (
      <div
        ref={panel}
        role="dialog"
        aria-label={t.gifTitle}
        className="absolute bottom-full inset-x-0 z-30 mb-3 flex flex-col rounded-2xl border border-border bg-[color:var(--elevated)] shadow-2xl"
      >
        {/* السهمُ يشير إلى زرّ GIF (الثاني من بداية الخانة: ٣٦ + ٦ + نصفُ ٣٦) — حدّان فيزيائيّان فلا ينقلب في RTL */}
        <span aria-hidden className="absolute -bottom-[7px] start-[54px] h-3 w-3 rotate-45 border-b border-r border-border bg-[color:var(--elevated)]" />
        <div className="flex items-center gap-2 p-3 pb-2">
          <span className="relative min-w-0 flex-1">
            <Icon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={search}
              value={q}
              onChange={(e) => {
                setCat(null);
                setQ(e.target.value.slice(0, 60));
              }}
              placeholder={t.gifSearch}
              aria-label={t.gifSearch}
              dir="auto"
              className="w-full rounded-full border border-border bg-surface-2 py-2 pe-3 ps-9 text-sm outline-none focus:border-accent/60"
            />
          </span>
          <button type="button" onClick={onClose} aria-label={t.closeLabel} title={t.closeLabel} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition">
            <Icon name="close" size={14} />
          </button>
        </div>
        {/* الثمانيةُ في صفٍّ واحدٍ ينزلق — لا سطرَ ثانٍ تبقى فيه رقاقةٌ يتيمة */}
        {/* وحافّتُه الأخيرة تذوب: من يرى رقاقةً نصفُها ظاهرٌ يعرف أن الصفَّ يُسحب */}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] after:w-1 after:shrink-0 after:content-[''] ltr:[mask-image:linear-gradient(to_right,black_88%,transparent)] rtl:[mask-image:linear-gradient(to_left,black_88%,transparent)]">
          {cats}
        </div>
        <div className="h-[340px] overflow-y-auto border-t border-[color:var(--divider)] px-3 pt-2.5">
          {recentRow}
          {term ? <p className="pb-1.5 text-12 font-bold text-muted">{cat ? GIF_CATS.find((c) => c.term === cat)?.label(t) : q.trim()}</p> : null}
          {/* أعمدةٌ لا شبكة: صورُ GIF بنسبٍ شتّى، والأعمدةُ تحفظ نسبةَ كلٍّ منها بلا فراغاتٍ بين الصفوف */}
          <div className="columns-4 xl:columns-5 gap-2 pb-2">
            {rows.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => pick(g.id)}
                title={g.alt}
                className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-lg bg-surface-2 hover:opacity-85 active:scale-[.97] transition"
                style={{ aspectRatio: String(g.ratio || 1) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt={g.alt} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          {status}
        </div>
        <p className="border-t border-[color:var(--divider)] py-1.5 text-center text-[10px] text-muted">{t.gifCredit}</p>
      </div>
    );
  }

  return (
    <Sheet
      open={open}
      variant="bottom"
      onClose={onClose}
      closeLabel={t.closeLabel}
      labelledBy="gif-pick-title"
    >
      <SheetHeader id="gif-pick-title" title={t.gifTitle} closeLabel={t.closeLabel} onClose={onClose} />
      <div className="px-5 pb-5">
        <input
          value={q}
          onChange={(e) => {
            setCat(null);
            setQ(e.target.value.slice(0, 60));
          }}
          placeholder={t.gifSearch}
          aria-label={t.gifSearch}
          dir="auto"
          className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base outline-none focus:border-accent/60"
        />
        {/* **شبكةُ عمودين على الجوال وثلاثةٍ فوقه** — والملصقُ هنا صورةٌ
            عريضةٌ لا ملصقُ عمل، فلا `posterGrid` (D-002 بحدّها: وصفةٌ
            لمعنًى آخر ليست العائلةَ نفسَها). */}
        <div className="mt-3 flex flex-wrap gap-1.5">{cats}</div>
        {recentRow}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46svh] overflow-y-auto">
          {rows.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => pick(g.id)}
              className="relative w-full overflow-hidden rounded-xl border border-border bg-surface-2 active:scale-95 transition"
              style={{ aspectRatio: String(g.ratio || 1) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.preview} alt={g.alt} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        {/* **ولكلِّ فراغٍ نصُّه** (D-350): «لا نتيجة» غيرُ «الخدمةُ
            معطَّلة» — **وغيابُ المفتاح تعطيلٌ صامتٌ لا عطل** (D-077). */}
        {loaded && rows.length === 0 && (
          <p className="mt-4 text-12 text-muted text-center">{term ? t.gifNone : t.gifOff}</p>
        )}
        {!loaded && <p className="mt-4 text-12 text-muted text-center">{t.gifLoading}</p>}
        {/* **والإسنادُ شرطٌ تعاقديّ** كإسناد TMDB — **ومن يعطينا محتوًى
            يُذكر** (a01). */}
        <p className="mt-3 text-[10px] text-muted text-center">{t.gifCredit}</p>
      </div>
    </Sheet>
  );
}
