"use client";

import { useState, useTransition } from "react";
import { setFontPrefs } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { FONT_SIZES, type FontSize } from "@/lib/fontPrefs";
import { SettingsOptionRow, SettingsOptionList } from "./SettingsOptionRow";
import { SettingsExpandRow } from "./SettingsExpandRow";

/**
 * «العرض وحجم الخط» — تحكّمان مستقلّان (طلب أحمد ١٩ أغسطس): حجم واجهة
 * النظام (القوائم، العناوين، الأزرار، التبويبات) وحجم محتوى المستخدم
 * (المنشورات، المراجعات، التعليقات، الردود).
 *
 * المعاينة مباشرةٌ على التطبيق كلِّه لا في صندوقٍ معزول: الضغط يكتب
 * `data-fs-*` على جذر الصفحة فوراً — فالشاشة التي تقف فيها هي المعاينة
 * — ثم يثبَّت الاختيار في الكوكي (وللمسجَّل في حسابه) عبر `setFontPrefs`.
 * لا زرَّ حفظ: تفضيلُ عرضٍ يُطبَّق لحظةَ اختياره كالثيم واللغة.
 *
 * ================= 🆕 والرقائقُ صارت عموداً (D-555) =================
 *
 * **كانت أربعَ رقائقَ في مسارٍ أفقيّ لكلِّ تحكّم.** **و«كبيرٌ جدّاً»
 * و«Very large» في مسارٍ عرضُه نصفُ شاشةِ ٣٩٠ بكسلاً** — **ثمّ تكبر
 * هي نفسُها حين يختار المستخدمُ «كبير»** — **فالمسارُ الذي يضبط حجمَ
 * الخطّ يخرج عن الحافّة بسبب حجمِ الخطّ الذي ضُبط فيه.** **وهو
 * الانفجارُ الذي تحذّر منه المواصفةُ بالاسم** («خيارات قد تتجاوز عرض
 * الجوّال»). **والعمودُ لا يتجاوز عرضاً أبداً مهما كبر الخطّ.**
 *
 * **وبطاقتان بدل بطاقةٍ تضمّ بطاقتين**: كان القسمُ لوحاً واحداً بحدٍّ
 * وانحناء، **وفي داخله مساران وبطاقةُ معاينةٍ لها حدُّها** — **إطارٌ
 * داخل إطار**، وهو ما تشكوه المواصفةُ بالاسم.
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
  const [open, setOpen] = useState<"ui" | "content" | null>(null);
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

  function list(label: string, value: FontSize, pick: (s: FontSize) => void) {
    return (
      <SettingsOptionList label={label}>
        {FONT_SIZES.map((s) => (
          <SettingsOptionRow
            key={s}
            selected={s === value}
            title={labels[s]}
            onSelect={() => pick(s)}
          />
        ))}
      </SettingsOptionList>
    );
  }

  return (
    /* ⚖️ 🆕 **والورقتان السفليّتان صارتا توسّعاً في المكان** (D-569،
       طلبُ أحمد بلقطتين) — **وهذا الصفُّ أحوجُ ما يكون إليه**:
       **الخياراتُ تغيّر حجمَ الخطّ في التطبيق كلِّه لحظةَ اللمس**،
       **والورقةُ كانت تحجب الصفحةَ التي هي المعاينة.** **والآن يتبدّل
       ما حولك وأنت تنظر إليه.** */
    <>
      <SettingsExpandRow
        icon="sliders"
        title={t.fontUiLabel}
        value={labels[ui]}
        open={open === "ui"}
        onToggle={() => setOpen((v) => (v === "ui" ? null : "ui"))}
      >
        {list(t.fontUiLabel, ui, (s) => {
          setUi(s);
          apply(s, content);
        })}
      </SettingsExpandRow>

      <SettingsExpandRow
        icon="comment"
        title={t.fontContentLabel}
        value={labels[content]}
        open={open === "content"}
        onToggle={() => setOpen((v) => (v === "content" ? null : "content"))}
      >
        {list(t.fontContentLabel, content, (s) => {
          setContent(s);
          apply(ui, s);
        })}
      </SettingsExpandRow>
    </>
  );
}
