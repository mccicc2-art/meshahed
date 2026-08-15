"use client";

import { useRouter } from "next/navigation";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";

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
          ? "relative w-6 h-6 grid place-items-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)] active:scale-90 transition before:content-[''] before:absolute before:-inset-[10px] before:rounded-full"
          : "w-11 h-11 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition") +
        ` ${className}`
      }
    >
      <Icon
        name="chevron-down"
        size={bare ? 24 : 18}
        className="rotate-90 rtl:-rotate-90"
        strokeWidth={bare ? 2.5 : undefined}
      />
    </button>
  );
}
