import type { ReactNode } from "react";
import { SettingsHeader } from "./SettingsHeader";

/**
 * قالبُ صفحةِ إعدادٍ داخليّة — **ترويسةٌ واحدةٌ ومسافةٌ واحدة** (D-462).
 *
 * **وهو الذي يجعل الصفحاتِ الإحدى عشرةَ تُقرأ سطحاً واحداً**: نفسُ
 * الترويسة ونفسُ عرضِ العمود ونفسُ الفراغ بين المجموعات — **وأحدَ عشرَ
 * قالباً منسوخاً تنحرف عند أوّل تعديل** (القاعدة ٦).
 *
 * **والعمودُ ضيّقٌ على الشاشة الواسعة** (`max-w-2xl`): صفوفُ الإعدادات
 * سطرٌ واحد، **وسطرٌ بعرض ألفِ بكسلٍ يجعل القيمةَ في الطرف الآخر من
 * الشاشة عن اسمها** — **فالعينُ تقطع المسافةَ في كلِّ صفّ.**
 */
export function SettingsPageLayout({
  title,
  fallbackHref = "/profile/settings",
  action,
  onBack,
  children,
}: {
  title: string;
  fallbackHref?: string;
  action?: ReactNode;
  onBack?: () => boolean | void;
  children: ReactNode;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <SettingsHeader title={title} fallbackHref={fallbackHref} action={action} onBack={onBack} />
      {/* المسافةُ السفليّة تعوّض غيابَ الشريط السفليّ هنا (D-462): بلا
          شريطٍ لا حاجةَ لحجزِ ارتفاعه، **ويبقى هامشُ الإيماءة وحده.** */}
      <div className="space-y-6 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
