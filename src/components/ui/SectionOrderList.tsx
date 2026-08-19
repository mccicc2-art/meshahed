"use client";

import { useRef, useState } from "react";
import { claimGesture, releaseGesture } from "@/lib/tabDrag";
import { tap } from "@/lib/haptics";
import { Icon, type IconName } from "../Icon";
import { CARD_COUNTS, type CardCount } from "@/lib/cardCount";
import { DENSITIES, type Density } from "@/lib/density";
import { chipClass, pillTrack } from "./controls";

/**
 * قائمة ترتيبٍ وإخفاء — **محرّك واحد لشاشتَي التخصيص** (D-129).
 *
 * كانت هذه الحلقة مكتوبةً مرّتين داخل `HomeCustomize` (الأقسام وخانات
 * بطاقة الأرقام)، وكانت شاشة البروفايل ستكتبها ثالثة. هي الآن مكوّنٌ
 * واحد يقبل سجلّ أسماءٍ: `HOME_SECTIONS` أو `HEADER_STATS` أو
 * `PROFILE_SECTIONS` — سجلّاتٌ ثلاثة، مصنعٌ واحد (قاعدة `06`).
 *
 * **الترتيب بأسهمٍ لا سحبٍ:** السحب على الجوال يتعارك مع تمرير الصفحة
 * ويحتاج مكتبة، والسهمان يؤدّيان الغرض بلا كليهما. والإخفاء من القائمة
 * نفسها — عينٌ مفتوحة أو مغلقة — فالمكان الذي تُرتّب فيه هو المكان الذي
 * تُخفي فيه.
 */
export function SectionOrderList<K extends string>({
  all,
  picked,
  meta,
  labels,
  min,
  max,
  onChange,
}: {
  /** السجلّ كاملاً — ما ليس في `picked` يُرسم مشطوباً في الذيل */
  all: readonly K[];
  /** المختار بترتيب عرضه */
  picked: readonly K[];
  meta: Record<K, { icon: IconName; label: string }>;
  labels: { up: string; down: string; hide: string; show: string; drag?: string };
  /** أقلّ ما يبقى مختاراً — دونه يُعطَّل زرّ الإخفاء (خانات الأرقام) */
  min?: number;
  /** أكثر ما يُختار — فوقه يُعطَّل زرّ الإظهار */
  max?: number;
  onChange: (next: K[]) => void;
}) {
  const hidden = all.filter((k) => !picked.includes(k));
  const atMin = min !== undefined && picked.length <= min;
  const atMax = max !== undefined && picked.length >= max;

  /* ===== السحبُ بمقبض (D-441، خطّةُ أحمد: «ترتيب الأقسام بالسحب Drag &
     Drop، استخدم Drag Handle وليس أسهم أعلى وأسفل») =====

     **ولماذا `PointerEvent` لا `dragstart`**: السحبُ الأصليُّ في HTML
     **لا يعمل باللمس أصلاً** — فيصير الترتيبُ حكراً على الفأرة، **وهذه
     شاشةٌ تُستعمل من الجوّال قبل غيره.**

     **والقياسُ من ارتفاع الصفّ لا من موضع كلِّ صفّ**: الصفوفُ متساويةُ
     الارتفاع هنا، **فإزاحةُ الإصبع مقسومةً على ارتفاع الصفّ هي عددُ
     المواضع التي عبرها** — **ولا حاجةَ لقياس عشرة صناديقَ في كلِّ
     إطار.**

     ⚠️ **و`claimGesture("y")` شرطٌ لا زينة** (D-277/D-440): بدونه يقرأ
     «السحبُ للتحديث» الإصبعَ نفسَه فتُحدَّث الصفحةُ وأنت ترتّب.
     ⚠️ **و`touch-action: none` على المقبض وحدَه** — لو وُضع على الصفّ
     كلِّه لَما استطاع القارئُ تمريرَ الشاشة بإصبعه فوق القائمة.
     **والترتيبُ يُطبَّق أثناء السحب** فيرى يدَه تعمل، **ولا يُحفظ إلّا
     بزرِّ الحفظ** كبقيّة الشاشة. */
  const [dragKey, setDragKey] = useState<K | null>(null);
  const drag = useRef<{ y: number; from: number; rowH: number } | null>(null);

  function onHandleDown(e: React.PointerEvent, k: K) {
    const row = (e.currentTarget as HTMLElement).closest("[data-row]") as HTMLElement | null;
    if (!row || !claimGesture("y")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      y: e.clientY,
      from: picked.indexOf(k),
      rowH: row.offsetHeight || 48,
    };
    setDragKey(k);
    tap(6);
  }

  function onHandleMove(e: React.PointerEvent, k: K) {
    const d = drag.current;
    if (!d) return;
    const steps = Math.round((e.clientY - d.y) / d.rowH);
    const to = Math.max(0, Math.min(picked.length - 1, d.from + steps));
    const at = picked.indexOf(k);
    if (to === at) return;
    const next = [...picked];
    next.splice(at, 1);
    next.splice(to, 0, k);
    onChange(next);
  }

  function endDrag() {
    if (!drag.current) return;
    drag.current = null;
    setDragKey(null);
    releaseGesture("y");
  }

  /* 🆕 **الصفُّ ٥٦ بكسلاً كصفِّ الإعدادات** (D-465، تصميمُ أحمد):
     **رمزٌ فاسمٌ فعينٌ فمقبض** — **والمقبضُ في الطرف لا في الصدر**،
     **لأن العينَ هي الفعلُ الأكثرُ استعمالاً** وقد كانت خلف المقبض. */
  const rowCls =
    "flex items-center gap-3 min-h-14 px-4 py-2.5 border-b border-[color:var(--divider)] last:border-b-0";
  const iconBtn =
    "grid place-items-center w-9 h-9 rounded-lg hover:bg-surface-2 disabled:opacity-30 disabled:pointer-events-none transition";

  function move(k: K, dir: -1 | 1) {
    const next = [...picked];
    const i = next.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function toggle(k: K) {
    if (picked.includes(k)) {
      if (atMin) return;
      onChange(picked.filter((s) => s !== k));
    } else {
      if (atMax) return;
      onChange([...picked, k]);
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {picked.map((k) => (
        <div
          key={k}
          data-row
          className={`${rowCls} ${
            dragKey === k ? "bg-surface-2 relative z-10 shadow-lg" : ""
          } transition-colors`}
        >
          <Icon name={meta[k].icon} size={20} className="shrink-0 text-foreground" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
            {meta[k].label}
          </span>
          {/* **العينُ مضاءةٌ حين يكون القسمُ ظاهراً** — **حالةٌ تُقرأ من
              لونها قبل شكلها**، والمخفيُّ عينٌ مشطوبةٌ خافتة. */}
          <button
            type="button"
            onClick={() => toggle(k)}
            disabled={atMin}
            aria-label={labels.hide}
            title={labels.hide}
            className={`${iconBtn} shrink-0 text-accent`}
          >
            <Icon name="eye" size={18} />
          </button>
          {/* **والمقبضُ آخرُ الصفّ** — **ولوحةُ المفاتيح تحرّكه بالأسهم**
              فلا يُحرم من الترتيب من لا يسحب (D-177/D-441). */}
          <button
            type="button"
            aria-label={labels.drag ?? labels.up}
            title={labels.drag ?? labels.up}
            onPointerDown={(e) => onHandleDown(e, k)}
            onPointerMove={(e) => onHandleMove(e, k)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                move(k, -1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                move(k, 1);
              }
            }}
            className="grid place-items-center w-9 h-9 -me-1 shrink-0 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition touch-none cursor-grab active:cursor-grabbing"
          >
            <Icon name="grip" size={18} />
          </button>
        </div>
      ))}

      {hidden.map((k) => (
        <div key={k} className={rowCls}>
          <Icon name={meta[k].icon} size={20} className="shrink-0 text-[color:var(--disabled)]" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[color:var(--disabled)]">
            {meta[k].label}
          </span>
          <button
            type="button"
            onClick={() => toggle(k)}
            disabled={atMax}
            aria-label={labels.show}
            title={labels.show}
            className={`${iconBtn} shrink-0 text-[color:var(--disabled)] hover:text-foreground`}
          >
            <Icon name="eye-off" size={18} />
          </button>
          {/* ⚠️ **خانةٌ فارغةٌ بعرض المقبض لا مقبضٌ معطَّل**: المخفيُّ
              خارجَ الترتيب فلا شيءَ يُسحب — **ومقبضٌ لا يسحب يَعِد بفعلٍ
              لا يقع** (D-217)، **والخانةُ تحفظ استقامةَ العمود.** */}
          <span aria-hidden className="w-9 h-9 -me-1 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * عددُ بطاقات الصفّ — **مقسّمٌ من ثلاث خانات، لا حقلُ رقم** (D-152).
 *
 * ثلاثة خياراتٍ ظاهرة لمسةٌ واحدة بلا قائمةٍ تُفتح، وهي الحالة التي
 * بقيت فيها عائلةُ `segmented` بعد D-076. وحقلُ الرقم الحرّ مرفوض:
 * العدد **كلفةٌ** لا شكلٌ فقط، والقصّ في اتجاهٍ واحد (انظر `cardCount.ts`).
 *
 * وهو هنا لا في كل شاشةٍ على حدة: الرئيسية والبروفايل يستدعيانه كما
 * يستدعيان `SectionOrderList` — مصنعٌ واحد، سجلّان (D-129).
 */
export function CardCountRow({
  value,
  labels,
  onChange,
}: {
  value: CardCount;
  /** نصُّ كل درجة بلغة الواجهة، بترتيب `CARD_COUNTS` */
  labels: Record<CardCount, string>;
  onChange: (next: CardCount) => void;
}) {
  /* 🆕 **رقائقُ ممتلئةٌ في مسار** (D-466) — **لا مقسَّمٌ بخطٍّ سفليّ**:
     **الخطُّ السفليُّ يقول «هذه تبويبةٌ تُبدّل ما تحتها»**، **وهذا خيارُ
     إعدادٍ داخل بطاقةٍ لا شيءَ تحته يتبدّل.** */
  return (
    <div className={pillTrack}>
      {CARD_COUNTS.map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={value === k}
          onClick={() => onChange(k)}
          className={chipClass(value === k, "sm", "flex-1 basis-0 min-w-0 h-8")}
        >
          {labels[k]}
        </button>
      ))}
    </div>
  );
}

/**
 * مفتاح إظهار/إخفاء — نفس مفتاح iOS في شاشتَي التخصيص.
 *
 * كان مكتوباً داخل `HomeCustomize` وحدها؛ استخراجُه هنا يمنع أن ترسم
 * شاشة البروفايل مفتاحاً ثانياً يختلف عنه بأربعة بكسلات.
 */
export function ToggleRow({
  label,
  icon,
  trailing,
  checked,
  onChange,
}: {
  label: string;
  /** رمزُ الصدر — يغيب فلا يُحجَز له مكان (D-044) */
  icon?: IconName;
  /**
   * 🆕 **ما يجلس قبل المفتاح** (D-465) — قائمةُ «من يراه» بجانب مفتاح
   * الزيارات. **⚠️ خارج الـ`label`**: عنصرُ تحكّمٍ داخل `label` يقلب
   * المفتاحَ عند كلِّ ضغطةٍ عليه.
   */
  trailing?: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 min-h-14 px-4 py-2.5 border-b border-[color:var(--divider)] last:border-b-0">
      {icon && <Icon name={icon} size={20} className="shrink-0 text-foreground" />}
      <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
      <span className="flex-1 min-w-0 truncate text-[15px] font-medium">{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      {/* مفتاح iOS: المسار يتلوّن والقرص ينزلق */}
      <span
        aria-hidden
        className="relative w-11 h-6.5 shrink-0 rounded-full transition peer-focus-visible:outline-2 peer-focus-visible:outline-accent bg-surface-2 peer-checked:bg-accent"
      >
        <span
          className={`absolute top-0.5 start-0.5 w-5.5 h-5.5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : ""
          }`}
        />
      </span>
      </label>
      {trailing}
    </div>
  );
}

/**
 * 🆕 **حجمُ الملصق — ثلاثةُ مستطيلاتٍ لا ثلاثُ كلمات** (D-465، تصميمُ
 * أحمد: صفُّ «Poster size» بثلاثة رموز).
 *
 * **والرمزُ هنا أصدقُ من الكلمة**: السؤالُ «كم يكبر الملصق»، **والجوابُ
 * مقاسٌ يُرى لا صفةٌ تُقرأ** — **و«مضغوط» تعني شيئاً مختلفاً في كلِّ
 * تطبيقٍ استعمله القارئ.**
 *
 * ⚠️ **وهو غيرُ صفِّ «التنسيق» فوقه**: ذاك **كم بطاقةً يُظهر الصفّ**
 * (`cards` — سقفٌ يقصّ)، وهذا **كم تكبر الواحدة** (`density` — عرضٌ).
 * **⚖️ ونقضُ D-441 مسجَّلٌ باسمه**: جمعتُهما هناك في مفتاحٍ واحد لأنهما
 * بدَوا سؤالاً واحداً، **وهما سؤالان يجيبهما رقمان مخزَّنان أصلاً.**
 */
export function PosterSizeRow({
  value,
  labels,
  onChange,
}: {
  value: Density;
  labels: Record<Density, string>;
  onChange: (next: Density) => void;
}) {
  /** ارتفاعٌ ثابتٌ وعرضٌ يتدرّج — **الفرقُ يُقاس بالعين لا بالتخمين** */
  const W: Record<Density, string> = { compact: "w-3", comfortable: "w-4", large: "w-5" };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {DENSITIES.map((k) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            aria-label={labels[k]}
            title={labels[k]}
            onClick={() => onChange(k)}
            className={`grid place-items-center w-11 h-10 rounded-xl border transition active:scale-95 ${
              on
                ? "border-accent bg-accent/10"
                : "border-border bg-surface-2 hover:border-accent/40"
            }`}
          >
            <span
              aria-hidden
              className={`${W[k]} h-6 rounded-[3px] border ${
                on ? "border-accent" : "border-[color:var(--disabled)]"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
