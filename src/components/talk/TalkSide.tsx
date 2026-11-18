import Image from "next/image";
import Link from "next/link";
import type { IconName } from "@/core/iconNames";
import { posterUrl } from "@/core/media";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";

/**
 * 🆕 R264 — **عمودُ صفحات النقاش الجانبيّ على الحاسوب** (أحمد ١٨ نوفمبر: الغرفة «أ»، والمنشورُ والرأيُ بشكلها).
 *
 * الغرفةُ والمنشورُ والرأيُ ثلاثُ صفحاتٍ بهيكلٍ واحد: الخيطُ في عمودٍ عريض، وبجانبه «عن العمل» وقائمةٌ قصيرة
 * (غرفٌ من مكتبتك · أيضاً في الغرفة · آراءٌ أخرى). **قطعتان تُركَّبان لا ثلاثةُ أعمدةٍ منسوخة** — ما يتغيّر هو
 * الصفوفُ والرابط، والشكلُ واحد (القاعدة ٣). وتحت ١٢٨٠ لا يُرسم أصلاً (`hidden desk:flex`).
 */
export function TalkSide({ children }: { children: React.ReactNode }) {
  return <aside className="hidden desk:flex flex-col gap-3 sticky top-6 self-start">{children}</aside>;
}

export function TalkSideCard({
  icon,
  title,
  rows,
  link,
  children,
}: {
  icon: IconName;
  title: string;
  rows?: { label: string; value: React.ReactNode }[];
  link?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-3.5">
      <h2 className="mb-2 flex items-center gap-1.5 text-12 font-bold text-muted">
        <Icon name={icon} size={14} className="shrink-0" />
        {title}
      </h2>
      {rows?.length ? (
        <dl className="divide-y divide-[color:var(--divider)]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <dt className="text-muted">{r.label}</dt>
              <dd className="min-w-0 truncate font-bold">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {link ? (
        <Link
          href={link.href}
          prefetch={false}
          className="mt-2.5 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-2 text-[13px] font-bold text-accent hover:bg-accent/10 transition"
        >
          {link.label}
          <Icon name="chevron-down" size={14} className="shrink-0 rotate-90 ltr:-rotate-90" />
        </Link>
      ) : null}
    </section>
  );
}

/** صفٌّ قصيرٌ في قائمة العمود: ملصقٌ (أو وجهٌ) · عنوانٌ وسطرٌ تحته · رقمٌ في الطرف */
export function TalkSideRow({
  href,
  title,
  sub,
  poster,
  avatar,
  count,
}: {
  href: string;
  title: string;
  sub?: string | null;
  poster?: string | null;
  avatar?: { src: string | null; name: string };
  count?: number;
}) {
  const img = poster !== undefined ? posterUrl(poster, "w185") : null;
  return (
    <li>
      <Link href={href} prefetch={false} className="group flex items-center gap-3 rounded-xl p-1.5 -mx-1.5 hover:bg-surface-2 transition">
        {avatar ? (
          <Avatar src={avatar.src} name={avatar.name} size={34} alt="" />
        ) : (
          <span className="relative block h-[50px] w-[34px] shrink-0 overflow-hidden rounded-md bg-surface-2">
            {img ? <Image src={img} alt="" fill sizes="34px" className="object-cover" /> : null}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <bdi className="block truncate text-14 font-bold group-hover:text-accent transition">{title}</bdi>
          {sub ? <span className="block truncate text-12 text-muted" dir="auto">{sub}</span> : null}
        </span>
        {count ? (
          <span className="flex shrink-0 items-center gap-1 text-12 font-bold tabular-nums text-accent">
            <Icon name="comment" size={13} />
            {count}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
