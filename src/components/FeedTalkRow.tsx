import Link from "next/link";
import { getDict, type Locale } from "@/core/i18n";
import { timeAgoShort } from "@/core/when";
import { profileHref } from "@/core/people";
import { gifUrl } from "@/core/media";
import { displayNameOf, type TalkFeedPost } from "@/lib/data";
import type { TitleState } from "@/lib/libState";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { Icon, type IconName } from "./Icon";
import { FeedReviewText } from "./FeedReviewText";
import { SpoilerText } from "./SpoilerText";
import { ShareTitleButton } from "./ShareTitleButton";
import { LikeButton } from "./LikeButton";
import { RowPoster } from "./ActivityFeed";
import { actionTailItem } from "./ui/controls";

/**
 * 🆕 R255 — **منشورُ نقاشٍ في خطّ «النشاط» على الويب** — توأمُ `TalkRow` في التطبيق (`apps/mobile/src/community/CommunityCards.tsx`).
 *
 * كان الويبُ يُسقط منشوراتِ النقاش من الخطّ («التطبيقُ وحدَه» — R58)، فيرى عضوُ الحاسوب خطّاً أفقرَ من خطّ جوّاله:
 * لا جذورَ القلم ولا الغرفَ النشطة. والآن الصفُّ نفسُه بهيكل صفّ الرأي — الوجه · الاسم · العمر · الكلام · الذيل · الملصق —
 * والفارقُ وسمٌ واحدٌ بعد اسم العمل كما في التطبيق حرفاً: «م·ح» للحلقة · «نقاش» · «النقاش العام» بلا ملصق · و«نشط · N ردّاً»
 * برتقاليّاً لما جاء من غرفةٍ نشطة. **وكلُّ لمسةٍ تفتح مكانَه في غرفته** (`?r=` — `ThreadReplies` يقف عنده) — الردُّ هناك لا هنا.
 * والحرقُ محجوبٌ حتى يُضغط، وحرقُ الحلقة يقول «لم تشاهد هذه الحلقة» (`epSpoilerUnwatched`) كالتطبيق.
 */
export function FeedTalkRow({
  p,
  meId,
  added,
  state,
  locale,
}: {
  p: TalkFeedPost;
  meId: string;
  added: boolean;
  state?: TitleState;
  locale: Locale;
}) {
  const t = getDict(locale);
  const general = p.mediaType === "general";
  const room = general ? "/talk/general/0" : `/talk/${p.mediaType}/${p.tmdbId}`;
  const open = `${room}?r=${encodeURIComponent(p.id)}`;
  const titleHref = general ? room : `/${p.mediaType === "tv" ? "show" : "movie"}/${p.tmdbId}`;
  const who = displayNameOf(p.person, t.anonymousUser);
  const whoHref = profileHref(p.person) ?? open;
  const ep = p.season != null && p.episode != null;
  const image = p.imagePath && p.imagePath.startsWith("https://") ? p.imagePath : gifUrl(p.gifId, "small");
  const body = p.body?.trim() ?? "";

  return (
    <article className="py-4 first:pt-0 flex gap-3">
      <div className="min-w-0 flex-1 flex flex-col min-h-[138px]">
        <div className="flex items-center gap-2.5">
          <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
            <Avatar src={p.person.hide_name ? null : p.person.avatar_url} name={who} size={44} alt="" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="flex items-center min-w-0" style={{ gap: 4 }}>
                <Link href={whoHref} prefetch={false} className="min-w-0 truncate font-bold text-14 leading-tight text-foreground hover:text-accent transition">
                  <bdi>{who}</bdi>
                </Link>
                {p.person.hide_name ? null : <AccountBadges profile={p.person} t={t} />}
              </span>
              <Link href={open} prefetch={false} className="ms-auto shrink-0 text-12 text-muted tabular-nums hover:text-accent transition">
                {timeAgoShort(p.createdAt, t)}
              </Link>
            </div>
            <div className="mt-px flex flex-wrap items-center gap-1.5">
              {general ? (
                <TalkTag href={room} label={t.talkGeneralTitle} icon="people" tone="accent" />
              ) : (
                <>
                  <Link href={titleHref} prefetch={false} className="min-w-0 truncate text-12 text-muted hover:text-accent transition">
                    <bdi className="truncate">{p.title ?? ""}</bdi>
                  </Link>
                  {ep ? (
                    <TalkTag href={open} label={t.epChip(p.season as number, p.episode as number, 0)} tone="plain" />
                  ) : p.hot ? null : (
                    <TalkTag href={open} label={t.feedTalkTag} icon="comment" tone="accent" />
                  )}
                </>
              )}
              {p.hot ? <TalkTag href={open} label={t.feedHotTag(p.replies)} icon="trending" tone="hot" /> : null}
            </div>
          </div>
        </div>

        {p.hasSpoiler ? (
          <SpoilerText text={body} locale={locale} note={ep ? t.epSpoilerUnwatched : undefined}>
            {image && !body ? <TalkImage src={image} href={open} /> : null}
          </SpoilerText>
        ) : body ? (
          <FeedReviewText href={open} review={body} locale={locale} />
        ) : image ? (
          <TalkImage src={image} href={open} />
        ) : null}

        {/* الذيلُ بتوزيع ذيل صفِّ الرأي (`RowComment`: قلب · ردود · مشاهدات · مشاركة) — ولا مشاهداتِ لمنشور النقاش (التطبيق:
            `views: null`)، فخانتُها فراغٌ يُبقي الرموزَ على أعمدة الصفوف الأخرى بدل أن تنزاح */}
        <div className="mt-auto pt-2 -mx-0.5 flex items-center justify-between">
          <LikeButton target="talk" postId={p.id} likes={p.likes} likedByMe={p.likedByMe} isMine={p.person.id === meId} locale={locale} />
          <Link href={open} prefetch={false} aria-label={t.talkReply} title={t.talkReply} className={actionTailItem(false)}>
            <Icon name="comment" size={15} />
            {p.replies > 0 ? <span className="tabular-nums">{p.replies}</span> : null}
          </Link>
          <span aria-hidden className="w-8" />
          <ShareTitleButton path={room} title={general ? t.talkGeneralTitle : p.title ?? ""} locale={locale} />
        </div>
      </div>
      {p.mediaType === "general" ? null : (
        <RowPoster tmdbId={p.tmdbId} mediaType={p.mediaType} title={p.title ?? ""} posterPath={p.posterPath} added={added} state={state} locale={locale} />
      )}
    </article>
  );
}

/** وسمُ الصفّ — حبّةٌ صغيرةٌ بلون معناها (عادي · ذهبيّ للنقاش · برتقاليّ للنشط)، ولونُ «نشط» من التطبيق حرفاً (#ff9a3c) */
function TalkTag({ href, label, icon, tone }: { href: string; label: string; icon?: IconName; tone: "plain" | "accent" | "hot" }) {
  const color =
    tone === "hot"
      ? "text-[#ff9a3c] border-[#ff9a3c]/35"
      : tone === "accent"
        ? "text-accent border-[color:var(--accent)]/35"
        : "text-foreground border-border";
  return (
    <Link href={href} prefetch={false} className={`shrink-0 inline-flex items-center gap-1 rounded-full border bg-surface-2 px-2 py-px text-[11px] font-semibold tabular-nums hover:opacity-80 transition ${color}`}>
      {icon ? <Icon name={icon} size={11} className="shrink-0" /> : null}
      <span>{label}</span>
    </Link>
  );
}

function TalkImage({ src, href }: { src: string; href: string }) {
  return (
    <Link href={href} prefetch={false} className="mt-2 block w-40 aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
      {/* صورةُ المنشور من مخزننا أو GIF من Giphy — لا `next/image`: نطاقان خارج محمِّل الموقع، ومقاسٌ صغيرٌ ثابت */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </Link>
  );
}
