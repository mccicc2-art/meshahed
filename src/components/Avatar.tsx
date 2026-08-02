/* eslint-disable @next/next/no-img-element */

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
}: {
  src: string | null | undefined;
  name?: string | null;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const style = { width: size, height: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? alt}
        style={style}
        className={`rounded-full object-cover border border-border bg-surface-2 ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: Math.max(12, size * 0.42) }}
      className={`rounded-full grid place-items-center font-bold bg-accent text-[color:var(--on-accent)] border border-border select-none ${className}`}
      aria-label={name ?? alt}
    >
      {initialOf(name)}
    </span>
  );
}
