import Image from "next/image";

function initialOf(name: string | null | undefined) {
  const n = (name ?? "").trim();
  return n ? n[0].toUpperCase() : "?";
}

export function Avatar({
  src,
  name,
  size = 36,
  className = "",
  boxClass = "",
  alt = "Profile photo",
  posY = null,
}: {
  src: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
  /**
   * 🆕 **صندوقٌ يملكه المُنادي** (D-836) — **ومقاسٌ واحدٌ لا يتغيّر
   * بعرض الشاشة كان يصغّر الترويسةَ على المتصفّح.**
   *
   * **و`size` رقمٌ يُكتب في `style` سطراً** — **والسطرُ يغلب كلَّ صنف**،
   * فلا `sm:` ولا `lg:` تصل إليه. **فمن أراد دائرةً تكبر مع الشاشة
   * يكتب صندوقَها أصنافاً هنا**، **ويتنحّى السطرُ كلَّه**: العرضُ
   * والارتفاعُ ومقاسُ الحرف.
   *
   * ⚠️ **و`size` يبقى مطلوباً حتى معه**: هو المقاسُ الجوهريُّ الذي
   * يطلب به `next/image` الصورةَ من الخادم (`width`/`sizes`) — **لا
   * المساحةُ التي تُرسم فيها.** **فيُكتب بالمقاس الأكبر** كي لا تُطلب
   * صورةٌ أصغرُ مما يُعرض.
   */
  boxClass?: string;
  alt?: string;
  /** التموضع الرأسي داخل الدائرة (٠ أعلى — ١٠٠ أسفل) — يضبطه صاحب
      الصورة من الإعدادات؛ غيابه يُبقي التوسيط القديم كما هو */
  posY?: number | null;
}) {
  /* **والصندوقُ للمُنادي إن كتبه** — ولا سطرَ يغلب أصنافَه (أعلاه) */
  const style: React.CSSProperties = boxClass ? {} : { width: size, height: size };
  if (posY != null) style.objectPosition = `50% ${posY}%`;

  if (src) {
    // next/image يقلّص الصورة لحجم العرض ويحوّلها WebP — كانت تُحمَّل بحجمها الأصلي
    return (
      <Image
        src={src}
        alt={name ?? alt}
        width={size}
        height={size}
        sizes={`${size}px`}
        className={`rounded-full object-cover border border-border bg-surface-2 ${boxClass} ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      /* **والحرفُ جزءٌ من الصندوق لا خارجَه**: من ملك العرضَ والارتفاعَ
         ملك مقاسَ حرفِه — **وإلّا كبرت الدائرةُ وبقي الحرفُ في قاعها.** */
      style={
        boxClass ? {} : { width: size, height: size, fontSize: Math.max(12, size * 0.42) }
      }
      className={`rounded-full grid place-items-center font-bold bg-accent text-[color:var(--on-accent)] border border-border select-none ${boxClass} ${className}`}
      aria-label={name ?? alt}
    >
      {initialOf(name)}
    </span>
  );
}
