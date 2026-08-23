"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";

/**
 * «تمّ» في ترويسة الإعداد — **مخرجٌ لا حفظ** (D-557، تصميمُ أحمد).
 *
 * ⚠️ **والاسمُ يقول الحقيقةَ لأن الحفظَ وقع أصلاً**: كلُّ ما في هذه
 * الصفحة يُحفظ لحظةَ الاختيار — **فلا «تغييرٌ معلَّق» ينتظر ضغطة.**
 * **و«تمّ» هنا تعني «انتهيت» لا «احفظ»**، وهو عرفُ iOS في شاشةٍ
 * تُفتح لتُضبط ثمّ تُغلق.
 *
 * ⚖️ **وهذا يخالف سطراً في مواصفة أحمد المكتوبة** («تمّ تظهر فقط عند
 * وجود تغييرات معلّقة») **ويطابق صورتَه** — **والصورةُ هي المرجع في
 * الشكل** (القاعدة ٤). **والسطرُ المكتوب يبقى صحيحاً حيث وُلد**:
 * الصفحاتُ متعدّدةُ الحقول التي لها شريطُ حفظٍ سفليّ (الرئيسيةُ
 * والملفّ) — **وهناك لا يستيقظ الشريطُ بلا تغيير.**
 *
 * **ورجوعٌ لا `router.back()` بشرط**: هو نفسُ ما يفعله زرُّ الرجوع في
 * `SettingsHeader` — **وبابان للخروج يجب أن يخرجا إلى المكان نفسِه.**
 */
export function SettingsDoneAction({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        tap(8);
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/profile/settings");
      }}
      className="h-11 px-2 -me-2 text-15 font-bold text-accent hover:brightness-110 transition active:scale-95"
    >
      {t.doneLabel}
    </button>
  );
}
