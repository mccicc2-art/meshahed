"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { dirOf } from "@/lib/dir";
import { Icon } from "./Icon";

/**
 * **حاجبُ الحرق** (D-261، قرارُ أحمد: «وصفُ TMDB خلف حاجب حرق»).
 *
 * **ولماذا زرٌّ يكشف، لا ضبابٌ يُمسح:** التمويهُ البصريّ (`blur`) يعِد
 * بما لا يفي — النصُّ في المستند، **يقرؤه المحدِّد ونسخُ الصفحة وقارئُ
 * الشاشة**، ومن مرّر إصبعَه فوقه لمحه. **وحاجبٌ يُرى منه شيءٌ ليس
 * حاجباً** (D-063: الغيابُ أصدق من البديل). فالنصُّ **غيرُ مُصيَّرٍ
 * أصلاً** حتى تُطلب رؤيتُه.
 *
 * **والزرُّ يقول فعلَه لا خوفَه** («اعرض الحرق» لا «تحذير: حرق») —
 * D-181: جملةُ الحالة فعلٌ لا اعتذار. **وسببُه سطرٌ صغيرٌ بجانبه** يُقال
 * مرّةً ولا يُكرَّر.
 *
 * ⚠️ **ولا كشفَ يعود مغلقاً بنفسه**: من كشف فقد قرّر — **و«تراجَع بعد»
 * لا «أكِّد قبل»** (D-047)، فزرُّ الإخفاء يبقى في مكانه.
 */
export function SpoilerText({
  text,
  locale,
  note,
}: {
  text: string;
  locale: Locale;
  /**
   * **سببُ الحجب — ويختلف باختلاف من حجب** (D-271): نشرةُ Loopz تحجب
   * **وصفَ الحلقة** فسببُها «يكشف أحداثَ الحلقة»، **ومشاركةُ عضوٍ تُحجب
   * لأنه هو أعلنها** — **وسطرٌ يقول «يكشف أحداث الحلقة» فوق كلام إنسانٍ
   * يعِد بما لا يعرفه أحد** (D-216). **والافتراضيُّ يبقى للنشرة** فلا
   * يتغيّر قارئُها القائم.
   */
  note?: string;
}) {
  const t = getDict(locale);
  const [shown, setShown] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-expanded={shown}
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--divider)] px-3 py-1.5 text-[12px] text-muted transition hover:text-accent hover:border-[color:var(--accent)] active:bg-surface-2"
      >
        <Icon name={shown ? "eye-off" : "eye"} size={14} className="shrink-0" />
        <span>{shown ? t.spoilerHide : t.spoilerShow}</span>
      </button>

      {/* **السببُ بجانب الزرّ لا فوق النصّ** — ويسقط متى ظهر النصّ */}
      {!shown && (
        <span className="ms-2 align-middle text-[11px] text-muted/70">{note ?? t.spoilerNote}</span>
      )}

      {/* ⚠️ **غيرُ مُصيَّرٍ حتى يُطلب** — لا `hidden` ولا `blur` */}
      {shown && (
        <p
          dir={dirOf(text)}
          className="mt-2 border-s-2 border-[color:var(--divider)] ps-3 text-[14px] leading-relaxed text-foreground/80 whitespace-pre-line"
        >
          {text}
        </p>
      )}
    </div>
  );
}
