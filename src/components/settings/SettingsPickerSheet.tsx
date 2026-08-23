"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/arabic";
import { tap } from "@/lib/haptics";
import { Icon } from "../Icon";
import { chipOutline, sheetScroll } from "../ui/controls";
import { SettingsBottomSheet } from "./SettingsBottomSheet";

/**
 * ورقةُ الاختيار — **قائمةٌ طويلةٌ تُدار في ورقةٍ لا في الصفحة**
 * (D-555، تصميمُ أحمد).
 *
 * ================= لماذا خرجت القائمةُ من الصفحة =================
 *
 * **«تفضيلاتُ المحتوى» كانت أربعَ قوائمَ مفتوحةً فوق بعضها**: خمسةَ
 * عشرَ نوعاً، ثمّ خمسةَ عشرَ آخر، ثمّ ثلاثين لغةً، ثمّ ثلاثين —
 * **تسعون رقاقةً في صفحةٍ واحدة** — **وصفحةٌ تُمرَّر خمسَ شاشاتٍ قبل
 * أن يُرى آخرُ إعداد.** **والصفحةُ الآن تعرض ما اخترتَه وحدَه، و«إدارة»
 * تفتح الباقي.**
 *
 * ⚠️ **والتعديلُ مسوّدةٌ حتى «تمّ»** (شرطُ المواصفة): **الحفظُ الفوريُّ
 * صحيحٌ لمفتاحٍ واحد وخاطئٌ لعشر ضغطات** — **عشرُ كتاباتٍ إلى الخادم
 * وعشرُ إعاداتِ رسمٍ لقائمةٍ ما زلتَ تحرّرها.** **و«إلغاء» يرمي
 * العشرَ جميعاً**، وهو الذي لا يستطيعه الحفظُ الفوريّ أصلاً.
 *
 * ⚠️ **والمسوّدةُ تُبذَر عند كلِّ فتحة** لا عند التركيب وحده: الورقةُ
 * تبقى مركَّبةً بعد الإغلاق، **ولو بُذرت مرّةً لعادت في الفتحة الثانية
 * تحمل مسوّدةً ألغاها صاحبُها.** والبذرُ أثناء الرسم لا في `useEffect`
 * — **وهو نمطُ هذا المستودع** (`ListContinueCard`): `useEffect` يرسم
 * رسمةً بالقديم ثمّ يصحّح، **فتُرى القائمةُ الخطأ لإطارٍ واحد.**
 *
 * ⚠️ **و`variant="top"`**: فيها حقلُ بحث، **ولوحةُ المفاتيح تأكل نصفَ
 * الشاشة السفليّ** (D-018).
 *
 * ================= 🆕 وشكلُها من تصميم أحمد (D-557) =================
 *
 * **بُنيت في D-555 من نصِّ المواصفة وحدَه لأن صورتَي التصميم خرجتا من
 * ذاكرة الجلسة** — **وقد وصلتا، فطُوبقت عليهما:**
 * - **حقلُ البحث بعدسةٍ في صدره** لا حقلٌ عارٍ بنصٍّ نائب.
 * - **«المختار · ٣» وبجانبه «مسح»** — **والعددُ في العنوان يقول ما
 *   تقوله الرقائقُ تحته بلا أن تُعدَّ**، **و«مسح» يوفّر ثلاثَ ضغطاتِ
 *   × لمن يريد أن يبدأ من جديد.**
 * - **رقائقُ المختار محدَّدةٌ لا ممتلئة** (`chipOutline`) — **الحجّةُ
 *   مكتوبةٌ عند الوصفة نفسِها**: القرصُ الأصفرُ الممتلئُ محجوزٌ لعلامةِ
 *   البلاطة في الشبكة، **ولا يعني الأصفرُ الممتلئُ شيئين في شاشةٍ
 *   واحدة.**
 * - **والقائمةُ بلاطاتٌ في عمودين**، في كلِّ بلاطةٍ اسمٌ وقرصُ اختيار
 *   في الطرف: **ممتلئٌ بصحٍّ أسودَ للمختار، وحلقةٌ فارغةٌ لغيره.**
 *   ⚖️ **وهذا نقضٌ لِما بنيتُه في D-555**: جعلتُ البلاطاتِ رقائقَ من
 *   عائلة الرقاقة تجنّباً لعائلةٍ ثالثة — **وتصميمُه يجعلها صفوفاً
 *   بقرص.** **وهو أصحُّ**: **الرقاقةُ عرضُها عرضُ كلمتها**، وشبكةٌ من
 *   رقائقَ متفاوتةِ العرض في عمودين تُقرأ درجاً؛ **والبلاطةُ تملأ
 *   خانتَها فيصير العمودان عمودين.**
 */
export function SettingsPickerSheet({
  open,
  title,
  options,
  picked,
  multi = true,
  max,
  onCancel,
  onDone,
  labels,
}: {
  open: boolean;
  title: string;
  /** كلُّ ما يمكن اختياره — **بعد طرح ما اختاره في الحقل المقابل** */
  options: { key: string; label: string }[];
  picked: string[];
  /** خيارٌ واحدٌ يُغلق الورقةَ فوراً — قائمةُ الدول واللغة */
  multi?: boolean;
  max?: number;
  onCancel: () => void;
  onDone: (next: string[]) => void;
  labels: {
    cancel: string;
    done: string;
    search: string;
    /** عنوانُ صفِّ المختار — يليه «· ٣» حين يوجد مختار */
    selected: string;
    /** يمسح المسوّدةَ كلَّها بضغطة */
    clear: string;
    /** عنوانُ الشبكة — «كل الفئات» */
    all: string;
    /** لا شيءَ مختارٌ بعد */
    empty: string;
    /** لا نتيجةَ للبحث */
    noMatch: string;
    remove: (name: string) => string;
    add: (name: string) => string;
  };
}) {
  const [draft, setDraft] = useState<string[]>(picked);
  const [q, setQ] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  /* بذرُ المسوّدة عند لحظةِ الفتح — انظر التعليقَ أعلاه */
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setDraft(picked);
      setQ("");
    }
  }

  const label = useMemo(
    () => new Map(options.map((o) => [o.key, o.label])),
    [options],
  );

  /* **البحثُ بالمطبِّع العربيّ** (D-350): من كتب «انمي» بلا همزة يجد
     ما فيه همزة، ومن كتب بالحركات يجد ما بلا حركات. */
  const shown = useMemo(() => {
    const needle = normalizeSearch(q.trim());
    if (!needle) return options;
    return options.filter((o) => normalizeSearch(o.label).includes(needle));
  }, [q, options]);

  const full = max !== undefined && draft.length >= max;

  function toggle(key: string) {
    tap(6);
    if (!multi) {
      /* **خيارٌ واحد: الاختيارُ هو «تمّ»** — ضغطتان لفعلٍ واحد احتكاكٌ
         بلا مقابل، **والورقةُ تُغلق بما اختير** */
      onDone([key]);
      return;
    }
    setDraft((d) =>
      d.includes(key)
        ? d.filter((x) => x !== key)
        : max !== undefined && d.length >= max
          ? d
          : [...d, key],
    );
  }

  const clearable = multi && draft.length > 0;

  return (
    <SettingsBottomSheet
      open={open}
      title={title}
      variant="top"
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      cancelLabel={labels.cancel}
      doneLabel={labels.done}
    >
      {/* ===== البحث — **عدسةٌ في الصدر** ===== */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 text-muted">
            <Icon name="search" size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            dir="auto"
            className="no-focus-ring w-full rounded-control bg-surface-2 border border-border ps-10 pe-3 h-12 text-14 outline-none transition"
          />
        </div>
      </div>

      <div className={`${sheetScroll} px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
        {/* ===== المختارُ الآن ===== */}
        {multi && (
          <section className="mb-4">
            <div className="flex items-center gap-2 mb-2.5">
              <h4 className="min-w-0 flex-1 text-15 font-bold truncate">
                {draft.length > 0
                  ? `${labels.selected} · ${draft.length}`
                  : labels.selected}
              </h4>
              {clearable && (
                <button
                  type="button"
                  onClick={() => {
                    tap(8);
                    setDraft([]);
                  }}
                  className="shrink-0 h-11 px-2 -me-2 text-14 font-bold text-accent hover:brightness-110 transition active:scale-95"
                >
                  {labels.clear}
                </button>
              )}
            </div>
            {draft.length === 0 ? (
              <p className="text-12 text-muted">{labels.empty}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draft.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggle(k)}
                    aria-label={labels.remove(label.get(k) ?? k)}
                    className={chipOutline("sm", "inline-flex items-center gap-2 ps-3 pe-2.5 min-h-11 max-w-full")}
                  >
                    <span dir="auto" className="truncate">
                      {label.get(k) ?? k}
                    </span>
                    <Icon name="close" size={13} strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===== القائمةُ بلاطاتٌ في عمودين =====
            **بلاطةٌ تملأ خانتَها لا رقاقةٌ بعرض كلمتها** — **وشبكةٌ من
            رقائقَ متفاوتةِ العرض تُقرأ درجاً لا عمودين.** */}
        {multi && <h4 className="text-15 font-bold mb-2.5">{labels.all}</h4>}
        {shown.length === 0 ? (
          <p className="text-12 text-muted">{labels.noMatch}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shown.map((o) => {
              const on = draft.includes(o.key);
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => toggle(o.key)}
                  aria-pressed={multi ? on : undefined}
                  disabled={!on && full && multi}
                  aria-label={on ? labels.remove(o.label) : labels.add(o.label)}
                  className="flex items-center gap-2 min-h-14 px-3 rounded-control border border-border bg-surface-2 text-start transition hover:border-accent/50 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span dir="auto" className="min-w-0 flex-1 text-14 font-semibold truncate">
                    {o.label}
                  </span>
                  {/* **قرصٌ ممتلئٌ بصحٍّ للمختار، وحلقةٌ فارغةٌ لغيره** */}
                  <span
                    aria-hidden
                    className={`shrink-0 grid place-items-center w-6 h-6 rounded-full border-2 transition ${
                      on
                        ? "bg-accent border-accent text-[color:var(--on-accent)]"
                        : "border-[color:var(--border)]"
                    }`}
                  >
                    {on && <Icon name="check" size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </SettingsBottomSheet>
  );
}
