"use client";

import { createContext, useContext } from "react";
import { Icon } from "./Icon";
import { tap } from "@/lib/haptics";

/**
 * 🆕 **قلبُ المكتبة صار مِصفاةً لا باباً** (D-671، حكمُ أحمد بلقطةٍ حوّط
 * فيها القلب: «هذا إذا ضغطته ما أبغاه يفتح صفحة — أبغاه يكون مثل الفلتر
 * ويفلتر الصفحة الي أنا فيها بس»).
 *
 * ⚖️ **نقضٌ لوجهةِ D-654 لا لموضعه**: ذاك جعله **باباً إلى
 * `‎/lists/<favorites>`** — **وبابٌ يغادر بك الصفحةَ ليريك تصفيةً لها
 * سفرٌ لأجل شرط.** **والمِصفاةُ تريك المطلوبَ في مكانك**، **وتُلغى
 * برقاقتها كبقيّة المحاور** (D-576).
 *
 * 🔑 **والحالةُ تسكن `LibraryGrid` وحدَه** — **وهذا الزرُّ يقرؤها ولا
 * يملكها**: **حقلٌ واحدٌ لا يملك كاتبَين** (D-462). ولذلك سياقٌ لا
 * حدثُ نافذة: الزرُّ يُرسَم **داخل شجرة `LibraryGrid`** (خانة
 * `underTabs`) **فيصله السياقُ بلا وسيط**، **والرسمُ يبقى في الصفحة
 * حيث تُقرأ ترجمتُه** (حجّةُ `underTabs` كما كُتبت في D-453).
 *
 * ⚠️ **ولا يُرسم في تبويبٍ لا يُصفّيه**: القوائمُ والفنّانون ليسوا
 * أعمالاً تُفضَّل — **وزرٌّ لا يفعل شيئاً وعدٌ فارغ** (D-217).
 */
export interface FavFilterCtx {
  /** هل المِصفاة مفعَّلةٌ الآن */
  on: boolean;
  /** يقلبها — والمالكُ `LibraryGrid` */
  toggle: () => void;
  /** التبويبُ الحاليُّ يقبل التصفية (مسلسلات · أفلام · أنمي) */
  enabled: boolean;
}

export const FavFilterContext = createContext<FavFilterCtx | null>(null);

export function FavFilterToggle({ label }: { label: string }) {
  const ctx = useContext(FavFilterContext);
  /* **وغيابُ السياق غيابُ الزرّ**: يُرفع هذا الملفّ قبل الصفحة (D-028)،
     **وزرٌّ بلا مالكٍ يُضغط ولا يُصفّي أسوأُ من زرٍّ غائب.** */
  if (!ctx || !ctx.enabled) return null;
  return (
    <button
      type="button"
      aria-pressed={ctx.on}
      aria-label={label}
      title={label}
      onClick={() => {
        tap(6);
        ctx.toggle();
      }}
      className={`flex items-center justify-center px-4 rounded-2xl border transition active:scale-[0.99] ${
        ctx.on
          ? "border-accent bg-accent/10"
          : "border-border bg-surface hover:border-accent/40"
      }`}
    >
      <Icon
        name={ctx.on ? "heart-filled" : "heart"}
        size={19}
        style={{ color: "var(--accent)" }}
      />
    </button>
  );
}
