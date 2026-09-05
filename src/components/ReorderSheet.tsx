"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { posterUrl } from "@/core/media";
import { tap } from "@/lib/haptics";
import { getDict } from "@/core/i18n";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { segmentedItem, segmentedTrackFull, sheetScroll } from "./ui/controls";

type Dict = ReturnType<typeof getDict>;

/**
 * 🆕 **عنصرُ ترتيبٍ بأقلِّ ما يلزم** (D-567) — **لا `ListItem` كاملاً**:
 * الورقةُ ترسم ملصقاً واسماً ونوعاً، **وصفوفُ المفضّلة تصل من دالّةٍ
 * أخرى بلا `added_at` ولا `sort_order`** — **ونوعٌ يطلب ما لا يرسمه
 * يمنع قارئاً صحيحاً بلا سبب.** و`ListItem` يوافقه بنيويّاً فلا يتغيّر
 * مستدعٍ قائم.
 */
export interface ReorderItem {
  tmdb_id?: number;
  media_type?: "tv" | "movie";
  title: string | null;
  poster_path: string | null;
  /**
   * 🆕 **مفتاحٌ صريحٌ لما ليس عملاً** (D-581): صفوفُ الأقسام صارت
   * تُرتَّب أيضاً — **وفنّانٌ أو قائمةٌ لا نوعَ وسائطَ له** فيسمّي
   * مفتاحَه بنفسه (`p-789` · `l-<uuid>`). **والعملُ يبقى بلا مفتاحٍ
   * صريح** فيشتقّه `listItemKey` كما كان — **لا مستدعٍ قائمٌ يتغيّر.**
   */
  key?: string;
  /** أيقونةُ الغياب حين لا صورة — فنّانٌ `people` وقائمةٌ `list` */
  fallbackIcon?: "film" | "tv" | "people" | "list";
}

/** مفتاحُ صفٍّ — الصريحُ أوّلاً، وإلّا نوعٌ ومعرّف، **ولا نصَّ حرّ** */
export const listItemKey = (i: ReorderItem) =>
  i.key ?? `${i.media_type ?? "movie"}-${i.tmdb_id ?? 0}`;

const ROW = 68;

/**
 * ورقة إعادة الترتيب.
 *
 * السحب بأحداث المؤشّر لا بـ HTML5 drag-and-drop: الأخير لا يعمل باللمس على
 * الجوال أصلاً، وهو الجهاز الذي تُستعمل فيه هذه الميزة. وبلا مكتبة سحبٍ
 * خارجية: صفٌّ رأسيّ متساوي الارتفاع رياضياتُه سطرٌ واحد، والمكتبة كانت
 * ستضيف وزناً للحزمة مقابل ما لا نحتاجه (D-036).
 *
 * الصفوف بينهما تنزاح بانتقالٍ ناعم بينما يتبع المسحوبُ الإصبع بلا انتقال —
 * وهذا وحده ما يصنع إحساس iOS: الصفوف تُفسح الطريق قبل أن تُفلت.
 */
export function ReorderSheet({
  items,
  t,
  onClose,
  onDone,
  tabs,
  panel,
}: {
  items: ReorderItem[];
  t: Dict;
  onClose: () => void;
  onDone: (keys: string[]) => void;
  /**
   * 🆕 **تبويبٌ ثانٍ اختياريّ** (D-918، طلبُ أحمد: «زرّ All إذا فتحته يكون
   * فيه تبويب اسمه view وفيه arrange sections»). **الأوّلُ دائماً
   * العناصر** وهذه الورقةُ نفسُها؛ والثاني يرسم `panel` مكانَ القائمة.
   * **اختياريٌّ بسقوطٍ إلى الورقة كما كانت** (D-028): قارئُ المفضّلة
   * (D-567) لا يمرّره فلا يتغيّر عنده حرف.
   */
  tabs?: { items: string; view: string };
  panel?: React.ReactNode;
}) {
  const [order, setOrder] = useState<ReorderItem[]>(items);
  const [tab, setTab] = useState<"items" | "view">("items");
  const [from, setFrom] = useState<number | null>(null);
  const [dy, setDy] = useState(0);
  const startY = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const auto = useRef<number | null>(null);
  const edge = useRef(0);

  const to =
    from === null ? null : Math.max(0, Math.min(order.length - 1, from + Math.round(dy / ROW)));

  /* تمريرٌ ذاتيّ عند الحافّة: بدونه لا يمكن نقل عملٍ من آخر قائمةٍ طويلة
     إلى أوّلها إلا بعشر سحباتٍ متتالية */
  useEffect(() => {
    if (from === null) return;
    const step = () => {
      const el = body.current;
      if (el && edge.current) {
        const before = el.scrollTop;
        el.scrollTop += edge.current;
        // ما تحرّك فعلاً يُضاف إلى الإزاحة حتى لا يقفز الصفّ المسحوب
        startY.current -= el.scrollTop - before;
        if (el.scrollTop !== before) setDy((d) => d + (el.scrollTop - before));
      }
      auto.current = requestAnimationFrame(step);
    };
    auto.current = requestAnimationFrame(step);
    return () => {
      if (auto.current) cancelAnimationFrame(auto.current);
      auto.current = null;
    };
  }, [from]);

  function down(e: React.PointerEvent, i: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    edge.current = 0;
    setFrom(i);
    setDy(0);
    tap(10);
  }

  function move(e: React.PointerEvent) {
    if (from === null) return;
    setDy(e.clientY - startY.current);
    const el = body.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = e.clientY - r.top;
    const bottom = r.bottom - e.clientY;
    edge.current = top < 56 ? -8 : bottom < 56 ? 8 : 0;
  }

  function up() {
    if (from !== null && to !== null && to !== from) {
      setOrder((prev) => {
        const next = [...prev];
        const [x] = next.splice(from, 1);
        next.splice(to, 0, x);
        return next;
      });
      tap(8);
    }
    edge.current = 0;
    setFrom(null);
    setDy(0);
  }

  /** كم ينزاح الصفّ i بينما يُسحب صفٌّ آخر */
  function shift(i: number) {
    if (from === null || to === null) return 0;
    if (i === from) return dy;
    if (from < to && i > from && i <= to) return -ROW;
    if (from > to && i >= to && i < from) return ROW;
    return 0;
  }

  /** بديلُ السحب للوحة المفاتيح — السهمان يحرّكان الصفّ المركَّز عليه */
  function nudge(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [x] = next.splice(i, 1);
      next.splice(j, 0, x);
      return next;
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-ro-title">
      <SheetHeader
        id="list-ro-title"
        title={t.listReorder}
        closeLabel={t.closeLabel}
        onClose={onClose}
        action={
          tab === "items" ? (
            <button
              type="button"
              onClick={() => onDone(order.map(listItemKey))}
              className={buttonClass({ size: "sm", className: "shrink-0" })}
            >
              {t.listDone}
            </button>
          ) : undefined
        }
      >
        <p className="text-12 text-muted mt-0.5">
          {tab === "items" ? t.listReorderHint : t.queueViewHint}
        </p>
      </SheetHeader>

      {tabs && (
        /* **المقسّمُ من العائلة نفسِها** (القاعدة ٣) — لا تبويبَ ثانٍ يُخترع */
        <div className={`${segmentedTrackFull} px-2`} role="tablist">
          {(["items", "view"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                tap(4);
                setTab(k);
              }}
              className={segmentedItem(tab === k, "flex-1")}
            >
              {tabs[k]}
            </button>
          ))}
        </div>
      )}

      {tab === "view" ? (
        <div className={`${sheetScroll} px-4 py-4`}>{panel}</div>
      ) : null}

      {/* `min-h-0` ليست زينة: ابنُ الفليكس لا ينكمش تحت ارتفاع محتواه بلا
          هذه، فقائمةٌ من ثلاثين عملاً كانت تتجاوز سقف الورقة (85vh) وتُقصّ
          بلا إمكانية تمرير — أي لا يمكن الوصول إلى آخرها أصلاً */}
      <div ref={body} className={`${sheetScroll} px-2 py-2`} hidden={tab !== "items"}>
        <ul className="relative" style={{ height: order.length * ROW }}>
          {order.map((it, i) => {
            const dragging = from === i;
            const url = posterUrl(it.poster_path, "w185");
            return (
              <li
                key={listItemKey(it)}
                className={`absolute inset-x-0 flex items-center gap-3 px-2 rounded-card ${
                  dragging
                    ? "z-10 bg-surface-2 shadow-2xl scale-[1.02]"
                    : "transition-transform duration-200 ease-out"
                }`}
                style={{
                  top: i * ROW,
                  height: ROW - 8,
                  transform: `translateY(${shift(i)}px)`,
                }}
              >
                <span className="relative w-9 h-[54px] shrink-0 rounded-md overflow-hidden bg-surface border border-border">
                  {url ? (
                    <Image src={url} alt="" fill sizes="36px" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-muted">
                      <Icon
                        name={it.fallbackIcon ?? (it.media_type === "movie" ? "film" : "tv")}
                        size={14}
                      />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-14 font-semibold leading-tight line-clamp-2">
                    {it.title ?? (it.tmdb_id ? `#${it.tmdb_id}` : "—")}
                  </span>
                  <span className="block text-12 text-muted tabular-nums mt-0.5" dir="ltr">
                    {i + 1}
                  </span>
                </span>

                {/* المقبض وحده يمسك السحب: لو أمسكه الصفّ كلّه لتنازع مع
                    تمرير الورقة، و`touch-none` تمنع المتصفّح من ابتلاع
                    الحركة تمريراً قبل أن تصلنا */}
                <button
                  type="button"
                  aria-label={`${it.title ?? ""} — ${t.listPositionOf(i + 1, order.length)}`}
                  onPointerDown={(e) => down(e, i)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      nudge(i, -1);
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      nudge(i, 1);
                    }
                  }}
                  className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-muted touch-none select-none transition active:text-accent active:bg-surface-2"
                >
                  <Icon name="grip" size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
