import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * أداة الغلاف — زرّ الإعدادات وحده.
 *
 * كانت كبسولةً تجمع ثلاث أدوات: جرسٌ ينسدل تحته الإعدادات والمشاركة.
 * الجرس لم يكن يفتح شيئاً — نقطةُ خبرٍ بلا وجهة — والمشاركة تكرّر ما
 * تفعله مشاركة النظام من المتصفح، فبقي المفيد وحده: مدخلٌ إلى الإعدادات.
 * ومع اختفاء الانسدال اختفت حالته ومستمعو الإغلاق كلّهم — زرٌّ واحد
 * بلا جافاسكربت، يعمل قبل أن تصل حزمة العميل.
 *
 * دائرةٌ لا كبسولة: الشكل يتبع المحتوى بدل أن يترك فراغ أداتين محذوفتين.
 */
export function HeaderTools({ locale }: { locale: Locale }) {
  const t = getDict(locale);

  return (
    <Link
      href="/profile/settings"
      aria-label={t.headerSettings}
      title={t.headerSettings}
      className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] end-3 grid place-items-center w-11 h-11 rounded-full border border-border overflow-hidden text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.55)] hover:border-accent/60 active:scale-95 transition"
    >
      {/* الخلفية طبقةٌ خلف الأيقونة لا خلفيةٌ على الرابط: `backdrop-blur`
          داخل عنصرٍ يتحرّك يعيد أخذ عيّنته فيومض عند الضغط */}
      <span
        className="absolute inset-0 bg-[color:var(--elevated)]/95 backdrop-blur-xl"
        aria-hidden
      />
      <Icon name="settings" size={20} className="relative" />
    </Link>
  );
}
