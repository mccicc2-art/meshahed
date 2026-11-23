import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { displayNameOf, profileHref, type PersonLite } from "@/core/people";
import { formatDateShort } from "@/core/when";
import { getDict, num, type Locale } from "@/core/i18n";

/**
 * 🆕 T532 — **صفُّ التقييم وحده في تبويب المراجعات** (أحمد ٢٣ نوفمبر «أ»: المراجعةُ والتقييمُ معاً، ورقاقةٌ تفصلهما). أصغرُ من صفِّ
 * المراجعة: صورةُ صاحبه واسمُه و«قيّمه · التاريخ» ونجمتُه، ويفتح ملفَّه. توأمُ `RatedRow` في التطبيق (`TitleCommunity.tsx`).
 */
export function TitleRatedRow({ r, locale }: { r: PersonLite & { rating: number; updated_at: string }; locale: Locale }) {
  const t = getDict(locale);
  const who = displayNameOf(r, t.anonymousUser);
  const href = profileHref(r);
  const body = (
    <>
      <Avatar src={r.hide_name ? null : r.avatar_url} name={who} size={32} alt="" />
      <span className="min-w-0 flex-1">
        <bdi className="block truncate text-14 font-bold">{who}</bdi>
        <span className="block truncate text-12 text-muted">{t.titleRevRated(formatDateShort(r.updated_at, t))}</span>
      </span>
      <span className="flex items-center gap-1 text-14 font-bold text-accent tabular-nums" dir="ltr">
        <Icon name="star" size={14} className="fill-current" />
        {num(r.rating, locale)}
      </span>
    </>
  );
  return href ? (
    <Link href={href} prefetch={false} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5">{body}</div>
  );
}
