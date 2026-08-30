"use client";

import { useRouter } from "next/navigation";
import { Icon } from "../Icon";
import { tap } from "@/lib/haptics";

/**
 * ترويسةُ الإعدادات الداخليّة — **رجوعٌ واسمٌ وفعلٌ واحد** (D-462).
 *
 * **ولماذا ترويسةٌ خاصّةٌ بها وليست ترويسةَ التطبيق:** الشريطُ العامّ
 * يحمل البحثَ والجرسَ والصورةَ — **وثلاثةُ أبوابٍ إلى خارج الإعدادات في
 * شاشةٍ جئتَ لتضبط فيها شيئاً واحداً.** **والإعداداتُ رحلةٌ لها بدايةٌ
 * ونهاية**، فترويستُها بابُ رجوعٍ لا لوحةُ تنقّل.
 *
 * ⚠️ **والرجوعُ `router.back()` لا رابطٌ ثابت**: يُفتح هذا السطحُ من
 * الملفّ ومن الرئيسية ومن قائمة «المزيد» — **ورابطٌ ثابتٌ يُعيدك إلى
 * مكانٍ لم تأتِ منه.** **والاحتياطُ وجهةٌ تُمرَّر** حين لا يكون في
 * التاريخ ما يُرجع إليه (فتحةٌ مباشرةٌ من رابطٍ مُشارَك).
 */
export function SettingsHeader({
  title,
  badge,
  fallbackHref = "/",
  action,
  onBack,
}: {
  title: string;
  /**
   * 🆕 **وسمٌ ملاصقٌ للاسم** (D-801) — رقاقةُ «PLUS» في صورة التقرير.
   * **ولمَ إلى جانب `title` لا داخله**: الاسمُ يُقرأ `aria-label` لزرِّ
   * الرجوع، **ووسمٌ داخل نصٍّ يُنطق مع الاسم في قارئ الشاشة.**
   */
  badge?: React.ReactNode;
  /** وجهةُ الرجوع حين لا تاريخَ خلفك */
  fallbackHref?: string;
  /** فعلُ الطرف الآخر — بحثٌ أو «حفظ» */
  action?: React.ReactNode;
  /** يعترض الرجوع — لحوار «تغييراتٌ لم تُحفظ» */
  onBack?: () => boolean | void;
}) {
  const router = useRouter();

  function back() {
    tap(8);
    /* **المعترِضُ يملك القرار**: يُعيد `false` فيبقى المستخدمُ مكانه */
    if (onBack && onBack() === false) return;
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    /* لاصقةٌ فوق المحتوى: صفحةُ الإعدادات تُمرَّر طويلاً، **وبابُ الرجوع
       الذي يغيب عند التمرير يجعل الخروجَ رحلةً ثانية.** */
    /* 🆕 `chrome-top` (D-493): **لا أثرَ لها في الإعدادات** — `ChromeAutoHide`
       لا يُركِّب مستمعاً هناك أصلاً (`chromeRules`) — **وتعمل في `/stats`**
       حيث الكسوةُ الذكيّةُ مطلوبة كبقيّة الصفحات. */
    <header className="chrome-top sticky top-0 z-30 -mx-4 px-4 -mt-6 pt-[calc(var(--safe-top)+0.5rem)] pb-2 bg-[color:var(--background)]">
      <div className="flex items-center gap-2 min-h-11">
        <button
          type="button"
          onClick={back}
          aria-label={title}
          className="shrink-0 grid place-items-center w-11 h-11 -ms-2 rounded-full text-foreground hover:text-accent active:scale-95 transition"
        >
          {/* مُدارةٌ تتبع اتجاه الصفحة فلا تشير في العربية إلى الخارج */}
          <Icon name="chevron-down" size={24} className="rotate-90 rtl:-rotate-90" />
        </button>

        <h1 className="min-w-0 flex-1 flex items-center justify-center gap-1.5 text-15 font-bold">
          <span className="min-w-0 truncate">{title}</span>
          {badge}
        </h1>

        {/* خانةٌ بعرض زرِّ الرجوع نفسِه حين لا فعلَ — **فيبقى الاسمُ في
            المنتصف حقيقةً لا تقريباً** */}
        <span className="shrink-0 min-w-11 flex justify-end">{action}</span>
      </div>
    </header>
  );
}
