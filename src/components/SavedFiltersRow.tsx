"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { buttonClass } from "@/components/ui/Button";
import { chipClass, chipRow } from "@/components/ui/controls";
import { openPlusGate } from "@/lib/plusGate";
import { updateUiState } from "@/lib/actions";
import {
  FILTERS_CAP,
  FILTER_NAME_MAX,
  newFilterId,
  removeFilter,
  sanitizeFilterName,
  sanitizeQuery,
  upsertFilter,
  filtersOf,
  type SavedFilter,
} from "@/lib/savedFilters";

/**
 * ============ الفلاترُ المحفوظة — الصفُّ (D-816) ============
 *
 * **بندا خطّة الـ٢٤ الأوّلان**: حفظُ تركيبةِ فلاترٍ باسم · وافتراضيٌّ
 * لكلِّ قسم.
 *
 * 🔑 **والمحفوظُ نصُّ الاستعلام لا حالةٌ ثانية** (D-816): **«اكتشف»
 * تكتب فلاترَها في الرابط**، **فالحفظُ نسخُ الرابط والاستدعاءُ لصقُه.**
 *
 * ⚠️ **ولا تُعاد وصفةُ `ActiveFilterChips`** رغم التشابه (القاعدة ٣):
 * **تلك «×» تنزع فلتراً من العرض الحاليّ**، **وهذه لو حملت «×» لعنَت
 * حذفاً دائماً** — **وشكلٌ واحدٌ لفعلين أحدُهما يمحو أثراً أبديّاً هو
 * العطل.** **فالرقاقةُ هنا تستدعي وحدَها، والحذفُ سطرٌ مكتوبٌ تحتها
 * يظهر للمستدعى وحدَه.**
 *
 * 🔒 **وبلس** (قاعدةُ D-783 §٣: الجديدُ كلُّه بلس) — **والقفلُ عند
 * الحفظ لا عند العرض**: **من رأى الميزةَ اشتراها، ومن مُنع من رؤيتها
 * انصرف** (حجّةُ مربّعات الثيمات في D-633).
 *
 * ⚠️ **والكتابةُ متفائلةٌ بارتداد**: **`ui_state` عمودٌ واحدٌ كاتبُه
 * `updateUiState` وحدَه** (D-462)، **وفشلُ الشبكة يعيد القائمة كما
 * كانت** فلا يظنّ القارئُ أنّه حفظ.
 */
export function SavedFiltersRow({
  locale,
  section,
  saved,
  plus,
}: {
  locale: Locale;
  /** التبويبُ الحاليّ — هو القسمُ الذي يُحفظ فيه ويُستدعى منه */
  section: string;
  saved: SavedFilter[];
  plus: boolean;
}) {
  const ar = locale !== "en";
  const router = useRouter();
  const sp = useSearchParams();
  const [, start] = useTransition();
  const [list, setList] = useState<SavedFilter[]>(saved);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  /* **الاستعلامُ الحاليُّ مطهَّراً** — **والمطهِّرُ نفسُه في الطرفين**
     فلا يقارَن نصٌّ خامٌ بنصٍّ مطهَّر ولا يُكتشف التطابق (D-145). */
  const current = useMemo(() => sanitizeQuery(sp.toString()), [sp]);
  const mine = useMemo(() => filtersOf(list, section), [list, section]);
  const applied = useMemo(
    () => mine.find((f) => f.q === current) ?? null,
    [mine, current],
  );

  /* **ولا صفَّ بلا شيءٍ يقوله** (D-280/D-219): **لا محفوظاتٍ ولا فلترَ
     قائمٌ يُحفظ = لا يُرسم شيء** — **وصفٌّ فارغٌ يأخذ ارتفاعاً ويعطي
     صفراً.** */
  if (mine.length === 0 && !current) return null;

  function persist(next: SavedFilter[]) {
    const before = list;
    setList(next);
    void updateUiState({ filters: next }).catch(() => setList(before));
  }

  function apply(f: SavedFilter) {
    /* **والتبويبُ يُعاد إلى الرابط** — هو القسمُ ولا يُحفظ داخل الاستعلام */
    const p = new URLSearchParams(f.q);
    p.set("tab", f.section);
    start(() => router.replace(`/news?${p.toString()}`, { scroll: false }));
  }

  function save() {
    if (!plus) {
      openPlusGate();
      return;
    }
    const clean = sanitizeFilterName(name);
    if (!clean || !current) return;
    persist(
      upsertFilter(list, { id: newFilterId(), name: clean, section, q: current }),
    );
    setName("");
    setNaming(false);
  }

  return (
    <div className="pt-3 pb-1">
      <div className={`${chipRow} flex items-center gap-2`}>
        {mine.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => apply(f)}
            className={chipClass(applied?.id === f.id, "sm", "shrink-0")}
          >
            {f.name}
          </button>
        ))}

        {/* **ولا زرَّ حفظٍ لِما هو محفوظ** (D-217): زرٌّ لا يفعل شيئاً وعد */}
        {current && !applied && !naming && (
          <button
            type="button"
            onClick={() => (plus ? setNaming(true) : openPlusGate())}
            className={chipClass(false, "sm", "shrink-0")}
          >
            {ar ? "＋ احفظ الفلتر" : "＋ Save filter"}
          </button>
        )}
      </div>

      {naming && (
        <div className="flex items-center gap-2 mt-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setNaming(false);
            }}
            maxLength={FILTER_NAME_MAX}
            placeholder={ar ? "سمِّ الفلتر" : "Name this filter"}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-14 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={save}
            disabled={!sanitizeFilterName(name)}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {ar ? "حفظ" : "Save"}
          </button>
        </div>
      )}

      {/* ⚠️ **وفعلُ المحفوظ تحت الصفِّ لا داخل الرقاقة**: **رقاقةٌ فيها
          فعلان تُضغط بالخطأ**، **والمستدعى وحدَه هو الذي يُدار.**

          🔴 **ولا «اجعله الافتراضيّ» في هذه الدفعة — وهو نصفُ البند
          الثاني، أُسقط عمداً** (D-816): **«امسح الكل» تُنزل القارئَ على
          رابطٍ عارٍ**، **وتطبيقُ الافتراضيّ على الرابط العاري في الخادم
          يعيد الفلترَ الذي مسحه للتوّ** — **فعلٌ يُلغي فعلَ القارئ
          صامتاً.** **ونجمةٌ تُرسم لحكمٍ لا يُطبَّق وعدٌ فارغ** (D-217).
          **فالبندُ يُشحن كاملاً بقاعدةٍ تفرّق بين «لم أختر» و«مسحتُ
          اختياري»، لا نصفَين.** **والمحرّكُ يحمله جاهزاً ومختبَراً.** */}
      {applied && (
        <div className="flex items-center gap-4 mt-2 text-12">
          <button
            type="button"
            onClick={() => persist(removeFilter(list, applied.id))}
            className="text-[color:var(--error)] hover:opacity-80 transition"
          >
            {ar ? "احذف" : "Delete"}
          </button>
        </div>
      )}

      {/* **والسقفُ يُقال عند بلوغه لا قبله** (D-063) */}
      {mine.length >= FILTERS_CAP && (
        <p className="text-12 text-muted mt-2">
          {ar ? `بلغتَ الحدّ (${FILTERS_CAP}) — احذف واحداً لتحفظ غيره` : `Limit reached (${FILTERS_CAP})`}
        </p>
      )}
    </div>
  );
}
