"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { coverBareControl, HEADER_ICON } from "./ui/controls";

/**
 * زر الرجوع الموحّد — هيئة زرّ DetailTopBar حرفاً بحرف (نفس القياس
 * والخلفية والسهم)، لأن الرجوع بابٌ واحد في كل صفحة تفصيلية: كان في
 * صفحات الأعمال وغائباً عن ملف الشخص (شكوى أحمد — تدقيق 8 Aug، م٣).
 */
export function BackButton({
  locale,
  className = "",
  variant = "chip",
}: {
  locale: Locale;
  className?: string;
  /**
   * 🆕 **شكلٌ ثانٍ لا مكوّنٌ ثانٍ** (D-288، بلاغُ أحمد بلقطتين: «السهم
   * ما هو واضح — ارفعه فوق وخلّه أبيض وبدون الدائرة الرمادية»).
   *
   * **ولماذا كانت الدائرةُ تُخفيه لا تُظهره:** خلفيّتُها `black/35`
   * **شفّافةٌ لا سوداء**، فعلى غلافٍ فاتح (صحراءُ «Breaking Bad») تصير
   * **رماديّةً باهتة**، **والسهمُ داخلها `white/90`** — **رماديٌّ على
   * رماديّ.** **فحُذفت الطبقةُ وصار السهمُ أبيضَ خالصاً بظلٍّ يفصله عن
   * أيّ صورة** — **والظلُّ هو ما يعمل على الفاتح والداكن معاً.**
   *
   * ⚠️ **وهذا استثناءٌ من D-217** («المطوَّق يُضغط والعاري يُقرأ»):
   * **سهمُ الرجوع في زاوية البداية عُرفٌ نظاميٌّ يعرفه كلُّ من أمسك
   * هاتفاً** (D-150) **فلا يحتاج إطاراً ليُقرأ فعلاً** — **والاستثناءُ
   * له وحدَه، لا لكلِّ زرٍّ على غلاف.**
   *
   * ⚠️ **وهدفُ اللمس ٤٤ والمرئيُّ ٢٤** — بـ`before` كعلامة D-281،
   * **فهدفُ لمسٍ بحجم ما تراه العينُ عطلٌ صامتٌ على الجوال**
   * (D-033/D-168).
   */
  variant?: "chip" | "bare";
}) {
  const router = useRouter();
  const t = getDict(locale);
  const bare = variant === "bare";
  return (
    <button
      onClick={() => router.back()}
      aria-label={t.backAria}
      className={
        (bare
          ? /* 🆕 **والنسخةُ الثالثةُ سقطت** (D-776): كانت هذه السلسلةُ
               مكتوبةً بيدها هنا وفي `coverBareControl` — **ووصفةٌ واحدةٌ
               في موضعين تفترق عند أوّل تعديل** (D-145). */
            coverBareControl
          : "w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition") +
        ` ${className}`
      }
    >
      <Icon
        name="chevron-down"
        size={HEADER_ICON}
        className="rotate-90 rtl:-rotate-90"
        /* **والسُّمكُ يزيد على الفنّ لا المقاس** (D-776): رمزٌ أبيضُ
           فوق صورةٍ يحتاج ثِخَناً لا كِبَراً. */
        strokeWidth={bare ? 2.5 : undefined}
      />
    </button>
  );
}

/**
 * 🆕 **فتاتُ الرجوع النصّية — رجوعٌ حقيقيٌّ لا قفزةٌ ثابتة** (D-336،
 * بلاغُ أحمد: «بعد ما أفتح اللستة وأعمل رجوع، ما يرجعني على ديسكفري —
 * أحصل نفسي في الليست تبع المكتبة»).
 *
 * كانت فتاتُ صفحةِ القائمة رابطاً مسمَّراً إلى `/library?filter=list` —
 * **صحيحاً لبابٍ واحدٍ من ثلاثة**: من جاء من اكتشف أو من ملفِّ شخصٍ
 * يُرمى في المكتبة. **والرجوعُ معناه «من حيث أتيت»** — وهو ما يفعله
 * `router.back()` في هذا الملفّ منذ D-288، **فالبابُ واحدٌ والهيئةُ
 * ثانية** (نصٌّ لا سهمَ غلاف).
 *
 * ⚠️ **والرابطُ المفتوحُ مباشرةً (مشاركة) لا تاريخَ له**: `history.length`
 * واحدٌ في اللسان الجديد، **فيسقط إلى `fallback`** — ولا زرَّ يضغطه
 * المستخدمُ فلا يحدث شيء (D-181).
 */
export function BackCrumb({
  label,
  fallback,
  className = "",
}: {
  label: string;
  /** وجهةُ من لا تاريخَ له — رابطٌ عميقٌ من مشاركة */
  fallback: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={`inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition -ms-1 px-1 py-1 ${className}`}
    >
      <span aria-hidden>‹</span>
      {label}
    </button>
  );
}
