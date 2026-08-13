import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem } from "@/lib/data";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LikeButton } from "./LikeButton";

/**
 * **تبويب «تعليقات»** (D-219، طلب أحمد بلوحاته: «الكوميونتي أحتاج يكون ٣
 * تبويب فقط — تعليقات · نقاش · خبر. التعليقات يعرض **كل تعليق شخص
 * منفصل**»).
 *
 * **وهو نقضٌ مقصودٌ لجزءٍ من D-187 لا نسيانٌ له.** يومها جُمّع الخطُّ
 * بالعمل لأن سؤال «عن ماذا يتكلّم الناس؟» أنفعُ من «من تكلّم؟». **والسؤالان
 * كلاهما صحيح**، وقد صارا تبويبين بدل أن يتنافسا على واحد: **«نقاش» يجيب
 * الأوّل، و«تعليقات» يجيب الثاني.**
 *
 * ================= ثلاثةُ قراراتٍ في الرسم =================
 *
 * **١ · بطاقاتٌ مؤطَّرة هنا، وصفوفٌ بلا إطار في الخيط** — **ولا تناقض بين
 * الأمرين.** قاعدةُ D-217: **بطاقةٌ محاطة تُقرأ غرضاً مستقلّاً**، والردودُ
 * في الخيط **أدوارُ حديثٍ واحد** فتُفصل بخطّ. **وهنا كلُّ صفٍّ عملٌ آخرُ
 * وشخصٌ آخر** — أغراضٌ مستقلّةٌ فعلاً. **والإطارُ يصف البنية لا يزيّن.**
 *
 * **٢ · ❤ برقمه، و💬 بلا رقم.** الإعجابُ عددٌ صادقٌ لهذا التعليق بعينه
 * (`review_likes` بمفتاح صاحبِ الرأي والعمل). **أما عددُ الردود فلا نملكه
 * لكل تعليق** — `title_talk_stats` تعدّ ردودَ **العمل** كلِّه، **ووضعُه
 * تحت تعليقٍ بعينه رقمٌ يُقرأ خطأً.** **ورقمٌ يُقرأ خطأً أسوأ من لا رقم**
 * (D-134 حرفاً). فـ💬 بابٌ يفتح الغرفة، لا عدّاد.
 *
 * **٣ · ولا علامةُ حفظٍ على التعليق** — في لوحة أحمد رمزُ حفظٍ بجانب
 * الرقمين، **ولا يوجد عندنا «حفظُ تعليق»**. **ورمزٌ يبدو زرّاً ولا يفعل
 * شيئاً أسوأ من غيابه** (قاعدةُ D-217). يعود يوم يُبنى الفعل.
 */
export function CommentsFeed({
  items,
  meId,
  locale,
}: {
  items: FeedItem[];
  /** لتمييز تعليقي: مراجعتُك تعرض العدد بلا زرّ إعجاب */
  meId: string;
  locale: Locale;
}) {
  const t = getDict(locale);

  /* **المكتوبُ وحده يدخل** — «شاهد» و«قيّم بلا نصّ» أحداثٌ بلا كلام،
     وتبويبٌ اسمُه «تعليقات» لا يُبنى من صمت (نفسُ حارس `groupByWork`) */
  const rows = items.filter((a) => a.review?.trim());

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center leading-relaxed">
        {t.worksEmptyAll}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((a) => {
        const href = `/talk/${a.media_type}/${a.tmdb_id}`;
        const titleHref = `/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`;
        const poster = posterUrl(a.poster_path, "w185");
        const who = displayNameOf(a.person, t.anonymousUser);
        return (
          <article
            key={`${a.person.id}-${a.tmdb_id}-${a.media_type}-${a.day}`}
            className="bg-surface border border-border rounded-2xl p-3.5 flex gap-3"
          >
            {/* الملصقُ يفتح العمل، والباقي يفتح الغرفة — **وجهتان لأن
                السؤالين اثنان**: «ما هذا العمل؟» و«ماذا قالوا فيه؟» */}
            <Link
              href={titleHref}
              prefetch={false}
              className="relative w-[56px] h-[84px] shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border active:opacity-80 transition"
            >
              {poster ? (
                <Image src={poster} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted">
                  <Icon name={a.media_type === "tv" ? "tv" : "film"} size={18} />
                </span>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <Link
                  href={titleHref}
                  prefetch={false}
                  className="font-bold text-[15px] leading-tight line-clamp-1 hover:text-accent transition"
                >
                  {a.title}
                </Link>
                {/* تقييمُ صاحبِ التعليق نفسِه — **لا متوسّطَ أحد**، فلا
                    مقامَ له ولا يحتاجه (قاعدةُ D-216 تخصّ المتوسّطات) */}
                {a.rating != null && (
                  <span
                    className="shrink-0 text-[12px] font-bold text-accent tabular-nums"
                    title={t.rateOutOf(a.rating)}
                  >
                    ★ <span dir="ltr">{a.rating.toFixed(1)}</span>
                  </span>
                )}
              </div>

              <Link
                href={a.person.username ? `/u/${a.person.username}` : href}
                prefetch={false}
                className="mt-1.5 flex items-center gap-2 text-[11px] text-muted active:opacity-80 transition"
              >
                <Avatar
                  src={a.person.hide_name ? null : a.person.avatar_url}
                  name={who}
                  size={20}
                  alt=""
                />
                <span className="font-semibold text-foreground">{who}</span>
                <span aria-hidden>·</span>
                <span>{timeAgo(a.updated_at, t)}</span>
              </Link>

              {/* الضغطُ على النصّ يفتح الغرفة — **حيث يُقرأ كاملاً ويُردّ
                  عليه**، وهو الفعلُ الذي يطلبه من قرأ تعليقاً */}
              <Link href={href} prefetch={false} className="block mt-1.5">
                <p className="text-[13px] leading-relaxed text-foreground/85 line-clamp-3">
                  {a.review}
                </p>
              </Link>

              <div className="mt-2 flex items-center gap-1">
                <LikeButton
                  reviewUserId={a.person.id}
                  tmdbId={a.tmdb_id}
                  mediaType={a.media_type}
                  likes={a.likes}
                  likedByMe={a.likedByMe}
                  isMine={a.person.id === meId}
                  locale={locale}
                />
                <Link
                  href={href}
                  prefetch={false}
                  aria-label={t.newsDiscuss}
                  title={t.newsDiscuss}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-accent transition"
                >
                  <Icon name="comment" size={14} />
                  {t.newsDiscuss}
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
