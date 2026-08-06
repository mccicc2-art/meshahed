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
  alt = "Profile photo",
  posY = null,
}: {
  src: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
  alt?: string;
  /** التموضع الرأسي داخل الدائرة (٠ أعلى — ١٠٠ أسفل) — يضبطه صاحب
      الصورة من الإعدادات؛ غيابه يُبقي التوسيط القديم كما هو */
  posY?: number | null;
}) {
  const style: React.CSSProperties = { width: size, height: size };
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
        className={`rounded-full object-cover border border-border bg-surface-2 ${className}`}
        style={style}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.42) }}
      className={`rounded-full grid place-items-center font-bold bg-accent text-[color:var(--on-accent)] border border-border select-none ${className}`}
      aria-label={name ?? alt}
    >
      {initialOf(name)}
    </span>
  );
}
