"use client";

import { useState, useTransition } from "react";
import { setFontPrefs } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { FONT_SIZES, type FontSize } from "@/lib/fontPrefs";
import { chipClass, pillTrack } from "../ui/controls";

/**
 * «العرض وحجم الخط» — تحكّمان مستقلّان (طلب أحمد ١٩ أغسطس): حجم واجهة
 * النظام (القوائم، العناوين، الأزرار، التبويبات) وحجم محتوى المستخدم
 * (المنشورات، المراجعات، التعليقات، الردود).
 *
 * المعاينة مباشرةٌ على التطبيق كلِّه لا في صندوقٍ معزول: الضغط يكتب
 * `data-fs-*` على جذر الصفحة فوراً — فالشاشة التي تقف فيها هي المعاينة
 * — ثم يثبَّت الاختيار في الكوكي (وللمسجَّل في حسابه) عبر `setFontPrefs`.
 * لا زرَّ حفظ: تفضيلُ عرضٍ يُطبَّق لحظةَ اختياره كالثيم واللغة، وزرُّ
 * حفظٍ بينهما كان سيجعل لفعلٍ واحدٍ خطوتين (D-462: زرُّ حفظٍ لا يستيقظ
 * بلا تغيير — وهنا لا «تغييرَ معلَّق» أصلاً).
 *
 * الرقاقات الممتلئة في مسارٍ (D-466): خيارُ إعدادٍ داخل بطاقة، لا
 * تبويبٌ يغيّر الصفحة.
 */
export function FontSizeSection({
  locale,
  initialUi,
  initialContent,
}: {
  locale: Locale;
  initialUi: FontSize;
  initialContent: FontSize;
}) {
  const t = getDict(locale);
  const [ui, setUi] = useState<FontSize>(initialUi);
  const [content, setContent] = useState<FontSize>(initialContent);
  const [, start] = useTransition();

  const labels: Record<FontSize, string> = {
    sm: t.fontSizeSm,
    md: t.fontSizeMd,
    lg: t.fontSizeLg,
    xl: t.fontSizeXl,
  };

  function apply(nextUi: FontSize, nextContent: FontSize) {
    /* المعاينة الفورية: السمة على الجذر تُحرّك متغيّري CSS فيتبدّل
       التطبيق كلُّه في الإطار نفسه — والافتراضي يحذف السمة (html نظيف) */
    const root = document.documentElement;
    if (nextUi === "md") root.removeAttribute("data-fs-ui");
    else root.setAttribute("data-fs-ui", nextUi);
    if (nextContent === "md") root.removeAttribute("data-fs-content");
    else root.setAttribute("data-fs-content", nextContent);
    start(() => setFontPrefs(nextUi, nextContent).catch(() => {}));
  }

  function group(
    label: string,
    hint: string,
    value: FontSize,
    pick: (s: FontSize) => void,
  ) {
    return (
      <div>
        <h3 className="text-14 font-bold">{label}</h3>
        <p className="text-12 text-muted leading-relaxed mt-0.5 mb-2">{hint}</p>
        <div role="group" aria-label={label} className={`${pillTrack} w-fit max-w-full`}>
          {FONT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === value}
              onClick={() => pick(s)}
              className={chipClass(s === value, "md")}
            >
              {labels[s]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5 space-y-5">
      <div>
        <h2 className="text-15 font-bold mb-1">{t.fontSection}</h2>
        <p className="text-12 text-muted leading-relaxed">{t.fontSectionHint}</p>
      </div>

      {group(t.fontContentLabel, t.fontContentHint, content, (s) => {
        setContent(s);
        apply(ui, s);
      })}
      {group(t.fontUiLabel, t.fontUiHint, ui, (s) => {
        setUi(s);
        apply(s, content);
      })}

      {/* معاينةٌ تلخّص الفرق بين المعاملين في بطاقةٍ واحدة: سطرُ واجهةٍ
          يتبع معامل الواجهة، وفقرةُ «كلام الناس» تحمل `fs-content`
          فتتبع معامل المحتوى — نفس الآلية التي تعمل في الصفحات فعلاً */}
      <div className="rounded-control border border-border bg-surface-2 p-3">
        <p className="text-12 font-semibold text-muted mb-1.5">{t.fontPreviewUi}</p>
        <p className="fs-content text-14 leading-relaxed" dir="auto">
          {t.fontPreviewContent}
        </p>
      </div>
    </section>
  );
}
