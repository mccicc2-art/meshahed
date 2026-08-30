"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { buttonClass } from "@/components/ui/Button";
import { chipClass, chipRow } from "@/components/ui/controls";
import { openPlusGate } from "@/lib/plusGate";
import { updateUiState, createSmartList } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { sectionToRuleType } from "@/lib/smartListKeys";
import {
  FILTERS_CAP,
  FILTER_NAME_MAX,
  newFilterId,
  removeFilter,
  setDefaultFilter,
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
  /**
   * 🆕 **وضعُ التسمية — لأيِّهما؟** (D-823): **مدخلٌ واحدٌ لفعلين**،
   * **ورقاقتان تفتحان حقلين متطابقين تُقرآن حقلاً معطوباً.**
   * `"filter"` = فلترٌ محفوظ · `"smart"` = قائمةٌ ذكيّة.
   */
  const [naming, setNaming] = useState<null | "filter" | "smart">(null);
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

  /* 🔑 **والرجوعُ يُلتقط قبل التفاؤل لا بعده** (درسُ `TabsPrefs`):
     `list` داخل السهم هو الجديدُ بعد `setList`، **فالمحفوظُ في متغيّرٍ
     قبلَها هو وحدَه القديم.**
     🔴 **والخادمُ يردّ `needsPlus` فتُردّ القائمةُ وتُفتح البوّابة** —
     **الحارسُ أدناه لا يُغني عنه** (D-819): **هذا يرسم، وذاك يمنع.** */
  function persist(next: SavedFilter[]) {
    const before = list;
    setList(next);
    void updateUiState({ filters: next })
      .then((res) => {
        if (res?.needsPlus) {
          setList(before);
          openPlusGate();
        }
      })
      .catch(() => setList(before));
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
    setNaming(null);
  }

  /**
   * 🆕 **الشرطُ إلى قائمةٍ ذكيّة** (D-823) — **وبابُها هنا لأنّ الشرطَ
   * هنا**: **شاشةُ إنشاءٍ تسأل عن نوعٍ ولغةٍ وسنةٍ هي ورقةُ فلاترَ
   * ثانيةٌ بلغةٍ ثانية** (D-145).
   * ⚠️ **ولا كتابةَ متفائلةً هنا**: **صفٌّ يُنشأ في جدولٍ آخر لا يُرسم
   * قبل أن يُخلَق** — **ورقاقةٌ تظهر ثمّ تختفي أسوأُ من انتظارٍ قصير.**
   */
  function saveSmart() {
    if (!plus) {
      openPlusGate();
      return;
    }
    const clean = sanitizeFilterName(name);
    const type = sectionToRuleType(section);
    /* 🔴 **والجهةُ تُكتب في الشرط عند إنشائه** — **لأنّ `tab` ليست من
       `FILTER_KEYS` عمداً** (D-816: التبويبُ هو القسمُ نفسُه) —
       **فشرطٌ بلا `type` يُقرأ لاحقاً أفلاماً** (D-179) **ويعرض غيرَ
       الفلتر الذي صنعه.** **والقسمُ الذي لا جهةَ له (القوائم) لا
       يُصنع منه شرطٌ أصلاً.** */
    if (!clean || !current || !type) return;
    const rule = { ...Object.fromEntries(new URLSearchParams(current)), type };
    setName("");
    setNaming(null);
    start(async () => {
      try {
        const res = await createSmartList(clean, rule);
        if (res.needsPlus) {
          openPlusGate();
          return;
        }
        toast(ar ? "أُنشئت القائمة الذكيّة" : "Smart list created", { tone: "success" });
        if (res.id) router.push(`/lists/${res.id}`);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className="pt-3 pb-1">
      <div className={`${chipRow} flex items-center gap-2`}>
        {mine.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => apply(f)}
            className={chipClass(
              applied?.id === f.id,
              "sm",
              "shrink-0 inline-flex items-center gap-1.5",
            )}
          >
            {/* **والنجمةُ علامةُ الافتراضيّ لا زرُّه** — الزرُّ سطرٌ تحت */}
            {f.def ? <Icon name="sparkle-star" size={12} /> : null}
            {f.name}
          </button>
        ))}

        {/* **ولا زرَّ حفظٍ لِما هو محفوظ** (D-217): زرٌّ لا يفعل شيئاً وعد */}
        {current && !applied && !naming && (
          <button
            type="button"
            onClick={() => (plus ? setNaming("filter") : openPlusGate())}
            className={chipClass(false, "sm", "shrink-0")}
          >
            {ar ? "＋ احفظ الفلتر" : "＋ Save filter"}
          </button>
        )}

        {/* 🆕 **والبابُ الثاني: قائمةٌ ذكيّةٌ من الشرط نفسِه** (D-823).
            **وهو يظهر مع فلترٍ قائمٍ سواءٌ أكان محفوظاً أم لا**: **فلترٌ
            محفوظٌ يُستدعى، والقائمةُ الذكيّةُ تسكن مكتبتَك** — **فعلان
            مختلفان لا بديلان.** */}
        {current && !naming && sectionToRuleType(section) && (
          <button
            type="button"
            onClick={() => (plus ? setNaming("smart") : openPlusGate())}
            className={chipClass(false, "sm", "shrink-0 inline-flex items-center gap-1.5")}
          >
            <Icon name="sparkle-star" size={12} />
            {ar ? "قائمة ذكيّة" : "Smart list"}
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
              if (e.key === "Enter") (naming === "smart" ? saveSmart : save)();
              if (e.key === "Escape") setNaming(null);
            }}
            maxLength={FILTER_NAME_MAX}
            placeholder={
              naming === "smart"
                ? ar
                  ? "سمِّ القائمة الذكيّة"
                  : "Name this smart list"
                : ar
                  ? "سمِّ الفلتر"
                  : "Name this filter"
            }
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-14 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={naming === "smart" ? saveSmart : save}
            disabled={!sanitizeFilterName(name)}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {ar ? "حفظ" : "Save"}
          </button>
        </div>
      )}

      {/* ⚠️ **وأفعالُ المحفوظ تحت الصفِّ لا داخل الرقاقة**: **رقاقةٌ فيها
          ثلاثةُ أفعالٍ تُضغط بالخطأ**، **والمستدعى وحدَه هو الذي يُدار.**

          ✅ 🆕 **و«اجعله الافتراضيّ» عاد** (D-817 — تمامُ ما أُسقط في
          D-816): **صار وراءه فعلٌ حقيقيّ** — **الخادمُ يحوّل الرابطَ
          العاريَ إليه**، **و«امسح الكل» تكتب `nf` فلا يُعاد ما مُسح.**
          **وما أُسقط لأنّه وعدٌ فارغٌ يعود يومَ يصير وعداً يُسلَّم.** */}
      {applied && (
        <div className="flex items-center gap-4 mt-2 text-12">
          <button
            type="button"
            onClick={() => persist(setDefaultFilter(list, applied.id, !applied.def))}
            className="text-muted hover:text-foreground transition"
          >
            {applied.def
              ? ar
                ? "أزل الافتراضيّ"
                : "Unset default"
              : ar
                ? "اجعله الافتراضيّ"
                : "Make default"}
          </button>
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
