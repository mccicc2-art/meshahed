import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem } from "@/lib/data";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export interface WorkTalk {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** كم رأياً مكتوباً على هذا العمل في الخطّ */
  count: number;
  /** آخر رأيين — بهذا الترتيب */
  last: FeedItem[];
  updatedAt: string;
}

/**
 * **«الأعمال» — الصفُّ عملٌ لا رأي** (D-187، طلب أحمد بنصّه: «أبغى يعرض
 * أسماء العمل كشيء أساسي ويعرض آخر تغريدتين فيها، بحيث أمرّر بين الأعمال»).
 *
 * **ولماذا هذا أصحُّ من خطٍّ مسطَّح:** خطُّ الآراء يخلط عشرة أعمالٍ في
 * عشرين بطاقة، فيقرأ المستخدم **أشخاصاً** لا **أعمالاً** — ومن يفتح
 * المجتمع في تطبيق مشاهدةٍ يسأل «عن ماذا يتكلّم الناس؟» لا «من تكلّم؟».
 * فالتجميعُ بالعمل يجيب السؤال المطروح، **ويقصّر الطريق إلى غرفة العمل**
 * (D-140) بدل أن يتركها مخبوءة في تبويبٍ آخر.
 *
 * **وآخرُ رأيين لا ثلاثة ولا واحد:** واحدٌ يبدو اقتباساً منفرداً فلا يوحي
 * بحوار، وثلاثةٌ تجعل الصفَّ شاشةً كاملة فيسقط معنى «أمرّر بين الأعمال».
 * **اثنان أقلُّ ما يُقرأ محادثةً.**
 *
 * والسطرُ كلُّه رابطٌ واحد إلى صفحة العمل: هدفُ لمسٍ واسع، **ولا زرَّ
 * داخل زرّ** — الإعجابُ والبلاغ يبقيان في صفحة العمل حيث الرأي كامل.
 */
export function WorksTalk({ works, locale }: { works: WorkTalk[]; locale: Locale }) {
  const t = getDict(locale);

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {works.map((w) => {
        const href = `/${w.mediaType === "tv" ? "show" : "movie"}/${w.tmdbId}`;
        const poster = posterUrl(w.posterPath, "w185");
        return (
          <Link
            key={`${w.mediaType}-${w.tmdbId}`}
            href={href}
            className="flex gap-3 py-4 first:pt-0 group active:opacity-80 transition"
          >
            {/* الملصق ثابتُ المقاس: شبكةٌ رأسية العينُ تمسحها بسرعة */}
            <div className="relative w-[54px] h-[81px] shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border">
              {poster ? (
                <Image src={poster} alt="" fill sizes="54px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted">
                  <Icon name={w.mediaType === "tv" ? "tv" : "film"} size={18} />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h3 className="font-bold text-[15px] leading-tight line-clamp-1 group-hover:text-accent transition">
                  {w.title}
                </h3>
                <span className="shrink-0 text-[11px] text-muted tabular-nums">
                  {timeAgo(w.updatedAt, t)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold text-accent">
                {t.worksReviewCount(w.count)}
              </p>

              {/* الرأيان: صاحبُه ثم سطرٌ واحد منه. `line-clamp-2` لا
                  `truncate`: الرأي جملةٌ لا عنوان، وقطعُه عند الحرف الأول
                  يجعله بلا معنى */}
              <div className="mt-2 space-y-1.5">
                {w.last.map((r) => (
                  <div
                    key={`${r.person.id}-${r.day}`}
                    className="flex items-start gap-2"
                  >
                    <Avatar
                      src={r.person.avatar_url}
                      name={displayNameOf(r.person, t.anonymousUser)}
                      size={20}
                      alt=""
                    />
                    <p className="min-w-0 text-[13px] leading-snug text-foreground/85 line-clamp-2">
                      {/* الاسمُ من `displayNameOf` لا بشرطٍ محليّ:
                          احترامُ الإخفاء وصفةٌ واحدة في التطبيق كلّه */}
                      <span className="font-semibold text-foreground">
                        {displayNameOf(r.person, t.anonymousUser)}
                      </span>
                      <span className="text-muted"> · </span>
                      {r.review}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * يجمع خطَّ الآراء إلى أعمال — **وفي مكانٍ واحد لا في الصفحة**، فلو
 * قرأه سطحٌ ثانٍ يوماً قرأه بنفس القواعد (D-145).
 *
 * **والمراجعاتُ وحدها تدخل:** «شاهد» و«قيّم بلا نصّ» أحداثٌ بلا كلام،
 * وصفٌّ عنوانُه «ما يتحدّث عنه الناس» لا يُبنى من صمت.
 */
export function groupByWork(feed: FeedItem[]): WorkTalk[] {
  const map = new Map<string, WorkTalk>();
  for (const a of feed) {
    if (!a.review || !a.title) continue;
    const key = `${a.media_type}-${a.tmdb_id}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        tmdbId: a.tmdb_id,
        mediaType: a.media_type,
        title: a.title,
        posterPath: a.poster_path,
        count: 1,
        last: [a],
        updatedAt: a.updated_at,
      });
      continue;
    }
    cur.count += 1;
    if (cur.last.length < 2) cur.last.push(a);
    if (a.updated_at > cur.updatedAt) cur.updatedAt = a.updated_at;
  }
  /* الترتيب بأحدث رأيٍ على العمل: «ما يتحدّث عنه الناس الآن» سؤالُ
     طزاجةٍ لا سؤالُ حجم — وعملٌ بعشرين رأياً قديماً ليس حديثَ اليوم. */
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
