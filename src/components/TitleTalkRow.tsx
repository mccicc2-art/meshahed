import Link from "next/link";
import type { TalkPost } from "@/lib/data";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import { timeAgoShort } from "@/lib/when";
import { dirOf, alignOf } from "@/lib/dir";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpoilerText } from "./SpoilerText";

/**
 * **صفُّ مشاركةِ النقاش داخل خطّ المجتمع** (D-398).
 *
 * **وهو أخو `TalkReviewRow` لا نسخةٌ منه**: نفسُ التشريح حرفاً (وجهٌ ٤٤
 * يجاور الترويسة، اسمٌ · عمرٌ، متنٌ بعرض العمود، ذيلٌ في القاع) —
 * **والفرقُ في الذيل وحدَه، لأن الفرقَ في الفعل**: للرأي نجمةٌ وإعجابٌ
 * لأنه حكمٌ على عمل، **وللمشاركة ردٌّ وحدَه لأنها كلامٌ في حوار.**
 *
 * ⚠️ **ولا زرَّ إعجابٍ هنا وإن كان في الغرفة**: إعجاباتُ المشاركات
 * (`getPostLikes`) نداءٌ ثانٍ مفاتيحُه هي الخيطُ نفسُه — **ورقمٌ يُقرأ
 * صفراً لأننا لم نسأل أسوأُ من رقمٍ لا يُرسم** (D-222/D-179). **والصفُّ
 * بابٌ إلى الغرفة**، وفيها الزرُّ حيّاً.
 */
export function TitleTalkRow({
  p,
  count,
  href,
  locale,
}: {
  p: TalkPost;
  /** ردودُ هذه المشاركة كلُّها — **تُحسب في الخطّ لا في الصفّ** */
  count: number;
  /** غرفةُ النقاش — الصفُّ بابُها */
  href: string;
  locale: Locale;
}) {
  const t = getDict(locale);
  const who = displayNameOf(p, t.anonymousUser);

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      <Link href={href} prefetch={false} className="shrink-0 active:opacity-80 transition">
        <Avatar src={p.hide_name ? null : p.avatar_url} name={who} size={44} alt="" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={p.username ? `/u/${p.username}` : href}
            prefetch={false}
            className="min-w-0 truncate font-bold text-[14px] leading-tight hover:text-accent transition"
          >
            <bdi>{who}</bdi>
          </Link>
          <span aria-hidden className="shrink-0 text-muted text-[12px]">
            ·
          </span>
          <Link
            href={href}
            prefetch={false}
            className="shrink-0 text-[12px] text-muted tabular-nums hover:text-accent transition"
          >
            {timeAgoShort(p.createdAt, t)}
          </Link>
        </div>

        {/* **إعلانُ الحرق يحجب المتنَ نفسَه** — نفسُ حكم `TalkReviewRow`
            (D-315)، **والحاجبُ خارج الرابط** (D-155). */}
        {p.hasSpoiler ? (
          <SpoilerText text={p.body} locale={locale} />
        ) : (
          <Link
            href={href}
            prefetch={false}
            dir={dirOf(p.body)}
            className={`block mt-2 ${alignOf(p.body)}`}
          >
            <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line line-clamp-6">
              {p.body}
            </p>
          </Link>
        )}

        <div className="mt-2 -mx-0.5 flex items-center gap-1">
          <Link
            href={href}
            prefetch={false}
            aria-label={t.talkReply}
            title={t.talkReply}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] tabular-nums text-muted hover:text-accent transition"
          >
            <Icon name="comment" size={15} />
            {/* **والصفرُ لا يُرسم** (D-222) */}
            {count > 0 && count}
          </Link>
        </div>
      </div>
    </article>
  );
}
