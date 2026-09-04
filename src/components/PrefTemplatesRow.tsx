"use client";

import { useState } from "react";
import { updateUiState } from "@/lib/actions";
import { openPlusGate } from "@/lib/plusGate";
import { chipRow, chipClass } from "./ui/controls";
import { buttonClass } from "@/components/ui/Button";
import { type Locale } from "@/core/i18n";
import {
  TEMPLATES_CAP,
  TEMPLATE_NAME_MAX,
  newTemplateId,
  removeTemplate,
  sanitizeTemplateName,
  templatesOf,
  upsertTemplate,
  type PrefTemplate,
  type TemplateSurface,
} from "@/core/prefTemplates";

/**
 * ====== صفُّ قوالب التخصيص — سطحان، مكوّنٌ واحد (D-822) ======
 *
 * **البندُ السادسُ من خطّة الـ٢٤.** **اليومَ للمستخدم تنسيقٌ واحدٌ لكلِّ
 * سطح** يُدهَس عند كلِّ حفظ — **ومن جرّب شكلاً ثانياً فقد الأوّل.**
 *
 * 🔑 **ومكوّنٌ واحدٌ لِلوحين** (القاعدة ٣ · D-376): **`HomeCustomize`
 * و`ProfileCustomize` توأمان لا نسخة** — **وصفُّ قوالبَ مكتوبٌ مرّتين
 * يفترق عند أوّل تعديل** (درسُ `headerStatMeta` في D-787).
 *
 * 🔑 **والتطبيقُ يُحمِّل ولا يحفظ**: **شريطُ الحفظ هو عقدُ هذه الشاشة**
 * (D-465) — **فالقالبُ يملأ اللوحَ ويُبقي «حفظ التغييرات» ظاهراً**،
 * **ومن طبّق قالباً بالخطأ يخرج بلا أن يفقد شيئاً.** **وفعلٌ لا رجعةَ
 * فيه لا يُطلق برقاقة.**
 *
 * 🔒 **وبلس** — **والحارسُ في `updateUiState` لا هنا** (D-821): **هذا
 * يرسم البوّابة، وذاك يمنع الكتابة.**
 */
export function PrefTemplatesRow({
  locale,
  surface,
  initial,
  current,
  onApply,
  plus,
}: {
  locale: Locale;
  surface: TemplateSurface;
  /** ما في العمود عند فتح الصفحة — تُمرَّر من الخادم */
  initial: PrefTemplate[];
  /** **التفضيلاتُ الحيّةُ في اللوح** — هي ما يُحفظ قالباً */
  current: Record<string, unknown>;
  /** **يملأ اللوحَ ولا يكتب** — والحفظُ بيد صاحبه */
  onApply: (p: Record<string, unknown>) => void;
  plus: boolean;
}) {
  const ar = locale !== "en";
  const [list, setList] = useState<PrefTemplate[]>(initial);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  /** آخرُ مطبَّقٍ — **به وحدَه يظهر سطرُ الحذف** (نمطُ `SavedFiltersRow`) */
  const [picked, setPicked] = useState<string | null>(null);

  const mine = templatesOf(list, surface);
  const full = mine.length >= TEMPLATES_CAP;

  /* 🔑 **والرجوعُ يُلتقط قبل التفاؤل** (درسُ `TabsPrefs`)، **والخادمُ
     يردّ `needsPlus` فتُردّ القائمةُ وتُفتح البوّابة** (D-821). */
  function persist(next: PrefTemplate[]) {
    const before = list;
    setList(next);
    void updateUiState({ tpl: next })
      .then((res) => {
        if (res?.needsPlus) {
          setList(before);
          openPlusGate();
        }
      })
      .catch(() => setList(before));
  }

  function save() {
    if (!plus) {
      openPlusGate();
      return;
    }
    const clean = sanitizeTemplateName(name);
    if (!clean) return;
    const next = upsertTemplate(list, {
      id: newTemplateId(),
      name: clean,
      s: surface,
      p: current,
    });
    /* ⚠️ **والسقفُ يردّ القائمةَ كما هي** — **فلا رشّةَ نجاحٍ لِما لم
       يُحفظ** (D-217): السطرُ تحت يقول لماذا. */
    if (next !== list) persist(next);
    setName("");
    setNaming(false);
  }

  return (
    <div className="pt-1 pb-2">
      <div className={`${chipRow} flex items-center gap-2`}>
        {mine.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              setPicked(x.id);
              onApply(x.p);
            }}
            className={chipClass(picked === x.id, "sm", "shrink-0")}
          >
            {x.name}
          </button>
        ))}

        {/* **ولا زرَّ حفظٍ حين لا مكان** (D-217) — والسببُ مكتوبٌ تحت */}
        {!naming && !full && (
          <button
            type="button"
            onClick={() => (plus ? setNaming(true) : openPlusGate())}
            className={chipClass(false, "sm", "shrink-0")}
          >
            {ar ? "＋ احفظ هذا التنسيق" : "＋ Save this look"}
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
            maxLength={TEMPLATE_NAME_MAX}
            placeholder={ar ? "سمِّ التنسيق" : "Name this look"}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-14 outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={save}
            disabled={!sanitizeTemplateName(name)}
            className={buttonClass({ size: "sm", className: "shrink-0" })}
          >
            {ar ? "حفظ" : "Save"}
          </button>
        </div>
      )}

      {/* ⚠️ **والحذفُ تحت الصفِّ لا داخل الرقاقة** (نصُّ D-816): **رقاقةٌ
          فيها فعلان تُضغط بالخطأ** — **والمستدعى وحدَه هو الذي يُدار.** */}
      {picked && mine.some((x) => x.id === picked) && (
        <div className="flex items-center gap-4 mt-2 text-12">
          <button
            type="button"
            onClick={() => {
              persist(removeTemplate(list, picked));
              setPicked(null);
            }}
            className="text-[color:var(--error)] hover:opacity-80 transition"
          >
            {ar ? "احذف هذا التنسيق" : "Delete this look"}
          </button>
        </div>
      )}

      {/* **والسقفُ يُقال عند بلوغه لا قبله** (D-063) */}
      {full && (
        <p className="text-12 text-muted mt-2">
          {ar
            ? `بلغتَ الحدّ (${TEMPLATES_CAP}) — احذف واحداً لتحفظ غيره`
            : `Limit reached (${TEMPLATES_CAP}) — delete one to save another`}
        </p>
      )}
    </div>
  );
}
