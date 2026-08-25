"use client";

import { useState, useTransition } from "react";
import { setProfileSavedLists } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { PlayPill } from "./ListPlayToggle";

/**
 * 🆕 **مفتاحُ قسم «القوائم المحفوظة» في ملفّك** (D-594، حكمُ أحمد
 * بلقطةٍ على القسم: «حتى هذي حطّ لها on off»).
 *
 * **نموذجُ D-559 بعينه**: القسمُ هو سطحُ التحكّم — **صاحبُه يراه دائماً
 * وعليه الرقاقة، والزائرُ يراه حين تقول «تعمل» وحدَها** — ولو اختفى
 * عن صاحبه عند الإطفاء لم يجد بابَ العودة.
 *
 * ⚠️ **والرقاقةُ `PlayPill` نفسُها** (القاعدة ٣): رقاقةُ حالةِ
 * تشغيل/إيقافٍ ثانيةٌ بلونٍ آخرَ هي العطلُ بعينه — **والحالةُ مكتوبةٌ
 * بالكلمة لا باللون** (D-142). **متفائلٌ بارتداد** (D-007) كأخيه
 * `ListPlayToggle` حرفاً — **ولا `router.refresh`**: لا شيءَ آخرُ في
 * صفحة صاحبها يُشتقّ من الراية، وأثرُها على الزائر قراءةُ خادمٍ في
 * زيارته التالية.
 */
export function SavedListsToggle({
  locale,
  initialOn,
}: {
  locale: Locale;
  initialOn: boolean;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(initialOn);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={t.savedListsSection}
      title={t.savedListsSection}
      onClick={() => {
        const next = !on;
        tap(next ? [12, 30] : 8);
        setOn(next);
        start(async () => {
          try {
            await setProfileSavedLists(next);
          } catch (err) {
            setOn(!next);
            flashError((err as Error).message);
          }
        });
      }}
      className="shrink-0 active:scale-95 transition disabled:opacity-60"
    >
      <PlayPill on={on} locale={locale} />
    </button>
  );
}
