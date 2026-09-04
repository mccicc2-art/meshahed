"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/core/arabic";
import { tap } from "@/lib/haptics";
import { Icon } from "../Icon";
import { chipOutline } from "../ui/controls";

/**
 * لوحُ الاختيار في المكان — **جسدُ ورقة الاختيار نفسُه بلا ورقة**
 * (D-590، طلبُ أحمد بلقطتين: صحٌّ على «حجم الواجهة» المتوسّع في مكانه،
 * وشطبٌ على ورقة «أظهر لي أقلّ» — «كل الإعدادات خلّها مثل كذا: تضغط
 * وتنزل مكانها»).
 *
 * ================= لماذا سقطت الورقةُ هنا أيضاً =================
 *
 * ⚖️ **هذا نقضٌ لشطر قاعدة D-569 بحكمه**: كانت القاعدةُ «المتعدّدُ
 * الذي يُبحث فيه يبقى ورقةً» — **وأحمد شطب الورقةَ نفسَها.** والحجّةُ
 * التي حملت التوسّعَ هناك تحمله هنا: **الورقةُ كانت تحجب الصفَّ الذي
 * جئتَ تغيّره**، فلا ترى قيمتَه تتبدّل في طرفه وأنت تختار — **واللوحُ
 * يُبقيه فوق الخيارات وقيمتُه تتبدّل تحت عينك.**
 *
 * ⚠️ **وما بقي من الورقة بقي لعلّته لا عادةً**: البحثُ بالمطبِّع
 * العربيّ (D-350) · «المختار · ٣» و«مسح» · البلاطاتُ في عمودين بقرصِ
 * اختيار · وصفوفُ الأولويّة المرقَّمة للُّغات المفضّلة — **الشكلُ الذي
 * طابقه على تصميمه في D-557 لم يُمسّ، تغيّر مسكنُه وحدَه.**
 *
 * ⚠️ **ولا مسوّدةَ ولا «تمّ»**: المسوّدةُ كانت ابنةَ الورقة — ورقةٌ
 * تملك «إلغاء» تحتاج ما تُلغيه. **واللوحُ في الصفحة، والصفحةُ تحفظ
 * لحظةَ التغيير ككلِّ الإعدادات** — **وجمعُ الضغطات المتتابعة في
 * كتابةٍ واحدةٍ شأنُ المستدعي** (`ContentPrefsSection` يؤجّل الكتابةَ
 * لا اللوح)، **فيبقى للوحِ سؤالٌ واحد: ماذا اختار.**
 *
 * ⚠️ **والبحثُ يموت مع اللوح**: اللوحُ يُفكَّك عند الطيّ
 * (`SettingsExpandRow` لا يرسم المطويّ)، **فكلُّ فتحةٍ تبدأ بحقلٍ
 * نظيف** — وهو ما كانت الورقةُ تصنعه ببذر المسوّدة عند الفتح.
 */
export function SettingsPickerPanel({
  options,
  value,
  onChange,
  multi = true,
  ordered = false,
  max,
  labels,
}: {
  /** كلُّ ما يمكن اختياره — **بعد طرح ما اختاره في الحقل المقابل** */
  options: { key: string; label: string }[];
  value: string[];
  /** تُنادى بكلِّ ضغطة — **الحفظُ لحظةَ التغيير شأنُ المستدعي** */
  onChange: (next: string[]) => void;
  /** خيارٌ واحد — قائمةُ الدول: الضغطةُ اختيارٌ والمستدعي يطوي اللوح */
  multi?: boolean;
  /** يعرض المختار كقائمة أولوية قابلة للرفع والخفض. */
  ordered?: boolean;
  max?: number;
  labels: {
    search: string;
    /** عنوانُ صفِّ المختار — يليه «· ٣» حين يوجد مختار */
    selected: string;
    /** يمسح المختارَ كلَّه بضغطة */
    clear: string;
    /** عنوانُ الشبكة — «كل الفئات» */
    all: string;
    /** لا شيءَ مختارٌ بعد */
    empty: string;
    /** لا نتيجةَ للبحث */
    noMatch: string;
    remove: (name: string) => string;
    add: (name: string) => string;
    moveUp?: (name: string) => string;
    moveDown?: (name: string) => string;
  };
}) {
  const [q, setQ] = useState("");

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

  const full = max !== undefined && value.length >= max;

  function toggle(key: string) {
    tap(6);
    if (!multi) {
      onChange([key]);
      return;
    }
    if (value.includes(key)) {
      onChange(value.filter((x) => x !== key));
      return;
    }
    if (max !== undefined && value.length >= max) return;
    onChange([...value, key]);
  }

  function move(key: string, delta: -1 | 1) {
    const from = value.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= value.length) return;
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  const clearable = multi && value.length > 0;

  return (
    <div>
      {/* ===== البحث — **عدسةٌ في الصدر** ===== */}
      <div className="pb-3">
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

      {/* ===== المختارُ الآن ===== */}
      {multi && (
        <section className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <h4 className="min-w-0 flex-1 text-15 font-bold truncate">
              {value.length > 0
                ? `${labels.selected} · ${value.length}`
                : labels.selected}
            </h4>
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  tap(8);
                  onChange([]);
                }}
                className="shrink-0 h-11 px-2 -me-2 text-14 font-bold text-accent hover:brightness-110 transition active:scale-95"
              >
                {labels.clear}
              </button>
            )}
          </div>
          {value.length === 0 ? (
            <p className="text-12 text-muted">{labels.empty}</p>
          ) : ordered ? (
            <div className="divide-y divide-[color:var(--divider)] rounded-lg bg-surface-2 px-2">
              {value.map((key, index) => {
                const name = label.get(key) ?? key;
                return (
                  <div key={key} className="flex items-center min-h-12 gap-1.5">
                    <span className="grid place-items-center w-7 h-7 rounded-full bg-surface text-12 font-bold text-muted">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-14 font-semibold truncate" dir="auto">
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(key, -1)}
                      disabled={index === 0}
                      aria-label={labels.moveUp?.(name)}
                      className="grid place-items-center w-10 h-10 text-muted disabled:opacity-25"
                    >
                      <Icon name="chevron-up" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(key, 1)}
                      disabled={index === value.length - 1}
                      aria-label={labels.moveDown?.(name)}
                      className="grid place-items-center w-10 h-10 text-muted disabled:opacity-25"
                    >
                      <Icon name="chevron-down" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-label={labels.remove(name)}
                      className="grid place-items-center w-10 h-10 text-muted hover:text-[color:var(--error)]"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {value.map((k) => (
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

      {/* ===== القائمةُ بلاطاتٌ في عمودين ===== */}
      {multi && <h4 className="text-15 font-bold mb-2.5">{labels.all}</h4>}
      {shown.length === 0 ? (
        <p className="text-12 text-muted">{labels.noMatch}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((o) => {
            const on = value.includes(o.key);
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
  );
}
