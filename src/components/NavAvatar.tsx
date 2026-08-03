"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

/**
 * صورة الشريط العلوي.
 *
 * تختفي في الرئيسية وحدها، لأن الرئيسية تعرض الصورة كبيرةً في ترويستها —
 * ووجهان متطابقان في شاشة واحدة تكرار لا فائدة منه. وفي بقية الصفحات تبقى
 * كما هي، فلا يفقد المستخدم مدخله إلى ملفه الشخصي.
 */
export function NavAvatar({
  src,
  name,
  title,
  alt,
  ariaLabel,
}: {
  src: string | null | undefined;
  name: string;
  title: string;
  alt: string;
  ariaLabel: string;
}) {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Link
      href="/profile/edit"
      title={title}
      aria-label={ariaLabel}
      className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-accent transition"
    >
      <Avatar src={src} name={name} size={36} alt={alt} />
    </Link>
  );
}
