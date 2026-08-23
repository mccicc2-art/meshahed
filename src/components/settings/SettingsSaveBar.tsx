"use client";

import { buttonClass } from "../ui/Button";

/**
 * شريطُ الحفظ — **يظهر حين يوجد ما يُحفظ، ولا يظهر قبله** (D-555،
 * مواصفةُ أحمد).
 *
 * ================= ما الذي كان خطأً =================
 *
 * **زرُّ «حفظ التغييرات» كان مقيماً في آخر الصفحة** — **فيُقرأ نهايةَ
 * الصفحة لا فعلاً معلَّقاً**، **ويُضغط على صفحةٍ لم يتغيّر فيها شيء
 * فيكتب في القاعدة بلا سبب.** **وكان تحته سطرٌ أخضرُ «حُفظ» يبقى
 * مكانه** — **ورسالةُ نجاحٍ دائمةٌ تصير جزءاً من الصفحة فيُنسى ما
 * تشير إليه.** **والآن رشّةٌ (Toast) تقول ثمّ تمضي.**
 *
 * **والشريطُ ثابتٌ في أسفل الشاشة لا في أسفل الصفحة**: صفحةُ «الرئيسية
 * والملفّ» ثلاثُ شاشاتٍ طولاً — **وحفظٌ يتطلّب رحلةَ تمريرٍ إلى القاع
 * يُنسي المستخدمَ ما غيّره.**
 *
 * ⚠️ **ولا شريطَ سفليَّ في الإعدادات** (`SettingsPageLayout`)، **فلا
 * شيءَ يزاحمه** — **والفراغُ المحجوز يمنعه أن يغطّي آخرَ صفّ.**
 *
 * ⚠️ **وحركتُه `sheet-pop` نفسُها لا حركةٌ جديدة**: ارتفاعٌ من ٣٢
 * بكسلاً بارتدادٍ خفيف — **وهي مكتوبةٌ مرّةً في `globals.css`
 * ومُطفأةٌ هناك لمن طلب سكونَ الحركة** (سطرُ `prefers-reduced-motion`)،
 * **فحركةٌ ثانيةٌ تعني قاعدةَ إطفاءٍ ثانيةً تُنسى.**
 */
export function SettingsSaveBar({
  visible,
  pending,
  onSave,
  saveLabel,
  savingLabel,
  onReset,
  resetLabel,
}: {
  /** **هل يوجد ما يُحفظ فعلاً** — لا «هل الصفحة مفتوحة» */
  visible: boolean;
  pending: boolean;
  onSave: () => void;
  saveLabel: string;
  savingLabel: string;
  /** «تجاهل» — يعيد الحقولَ إلى ما كانت عليه، ولا يكتب شيئاً */
  onReset?: () => void;
  resetLabel?: string;
}) {
  if (!visible) return null;

  return (
    <>
      {/* الفراغُ المحجوز: ارتفاعُ الشريط + هامشُ الإيماءة */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[color:var(--background)] sheet-pop">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {onReset && resetLabel && (
            <button
              type="button"
              onClick={onReset}
              disabled={pending}
              className="h-11 px-3 rounded-control text-14 font-medium text-muted hover:text-foreground transition active:scale-95 disabled:opacity-50"
            >
              {resetLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className={buttonClass({ size: "md", className: "flex-1 h-11" })}
          >
            {pending ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </>
  );
}
