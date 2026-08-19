"use client";

import { useEffect, useState } from "react";
import { updateUiState } from "@/lib/actions";
import { Icon } from "./Icon";

/**
 * تلميحٌ لمرة واحدة (م٣ من تقييم 9 Aug) — سطرٌ يكشف قوةً مدفونة ثم
 * يختفي للأبد.
 *
 * ⚖️ **نقضٌ مسجَّل بطلب أحمد (١٩ أغسطس)**: كان القرار هنا «التلميح
 * شأنُ جهازٍ لا حساب — وعمودٌ في قاعدة البيانات لسطرٍ إرشادي إسراف»،
 * **فطلب بنصّه الحفظَ في حساب المستخدم مع localStorage للزائر
 * والمزامنة عند الدخول** — فصار العمود `profiles.ui_state` (هجرة 121).
 *
 * القسمة الآن: **localStorage أولُ ما يُقرأ** (الخادم لا يعرفه، والحالة
 * تبدأ مخفيةً وتُقلب في effect فلا يختلف الترطيب) — **والحسابُ مصدرُ
 * الحقيقة بين الأجهزة**: كل تعليم «مقروء» يُدفع إليه هنا دون انتظار،
 * و`UiStateSync` (في الترويسة، فتجري آثاره قبل آثار هذا المكوّن بترتيب
 * الشجرة) يُنزل المقروءَ في الحساب إلى مفاتيح الجهاز الجديد قبل أن
 * يقرأها هذا المكوّن — فلا وميض على جهازٍ ثانٍ. والزائرُ (إن وُجد سطحٌ
 * يعرض تلميحاً له) يبقى على localStorage: الدفع يفشل صامتاً.
 *
 * يُعلَّم «مقروءاً» عند الإغلاق أو عند مغادرة الصفحة بعد أول عرض —
 * أيهما أسبق — فلا يطارد أحداً.
 */
export function OneTimeHint({
  id,
  text,
  closeLabel,
}: {
  /** مفتاح التلميح — `loopz-hint:<id>` في localStorage و`ui_state.hints` في الحساب */
  id: string;
  text: string;
  closeLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  const key = `loopz-hint:${id}`;

  /** الجهازُ فوراً والحسابُ بلا انتظار — طريقُ التعليم الوحيد */
  function markSeen() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* بلا تخزين سيظهر مجدداً — أهون الشرّين */
    }
    void updateUiState({ addHints: [id] }).catch(() => {});
  }

  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(key);
    } catch {
      /* تخزين معطّل (تصفح خاص) — لا تلميح أفضل من تلميحٍ لا يصمت */
    }
    if (seen) return;
    // إظهارٌ في إطارٍ لاحقٍ لا في جسد الـeffect (قاعدة React نفسها —
    // نفس درس LibraryGrid): لا رسم متتالٍ متزامن
    const raf = requestAnimationFrame(() => setVisible(true));
    // المغادرة بعد أول عرضٍ تكفي إعلاناً بالقراءة — لا يظهر ثانيةً
    return () => {
      cancelAnimationFrame(raf);
      markSeen();
    };
    // markSeen ثابتة المعنى؛ والاعتمادية الحقيقية هي المفتاح
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 text-12 text-muted">
      <Icon name="sparkles" size={14} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1 leading-relaxed">{text}</span>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={() => {
          markSeen();
          setVisible(false);
        }}
        className="shrink-0 grid place-items-center w-7 h-7 rounded-full text-muted hover:text-foreground hover:bg-surface-2 transition"
      >
        <Icon name="close" size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}
