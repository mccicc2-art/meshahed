import Link from "next/link";
import { Avatar } from "./Avatar";
import { displayNameOf, type PersonLite } from "@/lib/data";
import type { Dict } from "@/lib/i18n";

/**
 * سطر شخص: صورة + اسم قابل للضغط.
 * من أخفى اسمه لا يُعرض اسمه ولا يُفتح ملفه من هنا — الإخفاء يعني الإخفاء.
 */
export function PersonName({
  person,
  t,
  size = 28,
  sub,
}: {
  person: PersonLite;
  t: Dict;
  size?: number;
  sub?: string;
}) {
  const name = displayNameOf(person, t.anonymousUser);
  const linkable = !person.hide_name && !!person.username;

  const inner = (
    <>
      <Avatar
        src={person.hide_name ? null : person.avatar_url}
        name={name}
        size={size}
        alt={t.avatarAlt}
        className="shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold truncate">{name}</span>
        {sub && <span className="block text-[11px] text-muted truncate">{sub}</span>}
      </span>
    </>
  );

  if (!linkable) {
    return <span className="flex items-center gap-2 min-w-0">{inner}</span>;
  }

  return (
    <Link
      href={`/u/${person.username}`}
      prefetch={false}
      title={t.viewProfileOf(name)}
      className="flex items-center gap-2 min-w-0 hover:text-accent transition"
    >
      {inner}
    </Link>
  );
}
