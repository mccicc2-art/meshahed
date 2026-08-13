import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem, type TalkStat } from "@/lib/data";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export interface WorkTalk {
  tmdbId: number;
  mediaType: "tv" | "movie";
  title: string;
  posterPath: string | null;
  /** كم رأياً مكتوباً على هذا العمل في الخطّ — لم يعد يُرسم، انظر أدناه */
  count: number;
  /** متوسّطُ تقييمات من تكلّموا عن العمل هنا — `null` إن لم يقيّم أحد */
  avg: number | null;
  /** **مقامُ `avg`**: كم واحداً من هؤلاء وضع رقماً (D-216) */
  ratedBy: number;
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
 *
 * **وآخرُ رأيين لا ثلاثة ولا واحد:** واحدٌ يبدو اقتباساً منفرداً فلا يوحي
 * بحوار، وثلاثةٌ تجعل الصفَّ شاشةً كاملة فيسقط معنى «أمرّر بين الأعمال».
 * **اثنان أقلُّ ما يُقرأ محادثةً.**
 *
 * ================= ما تغيّر في D-193 =================
 *
 * **١ · لا كلمةَ «رأي» ولا عدّادَها** (طلب أحمد: «بس بدون كلمة ريفيو»).
 * كان السطرُ الثاني «٣ آراء» — تسميةٌ لما تراه بعينك تحته. وحلّ محلّه
 * **رقمان لا يُرى غيرُهما من الصفّ**: عددُ الردود وعددُ من شاهد.
 *
 * **٢ · التقييمُ جنب الاسم بنجمةٍ صفراء** (طلبه حرفياً). والرقمُ
 * **متوسّطُ من تكلّم عن العمل هنا** لا تقييمُ IMDb — لأن الصفَّ بطاقةُ
 * مجتمع: الآراءُ تحته أصحابُ هذه الأرقام، فيتّسق ما تقرأ بما ترى.
 * ولا يُكلّف نداءً: التقييمُ يأتي مع كل صفٍّ في الخطّ أصلاً.
 * **وثمنُه يُقال:** نجمةٌ صفراء في التطبيق تعني «تقييم» في أماكن أخرى
 * منها IMDb — فـ`title` يسمّي المقصود لمن توقّف عندها، **وإن أرادها
 * أحمد تقييمَ IMDb فهي قراءةٌ واحدة من `imdb_ratings` بالمعرّفات**
 * (بندٌ في `05`، لا تخمينٌ هنا).
 *
 * **٣ · «الريتويت» لا وجودَ له** (سأل: «وش المقصد في ريتويت؟»). لم يكن
 * في البطاقة رمزٌ للتكرار قطُّ — والفكرةُ نفسُها لا معنى لها في تطبيق
 * مشاهدة: إعادةُ نشر رأي غيرك ليست فعلاً يريده أحد. **واقتراحُه هو
 * المنفَّذ: مكانَه عددُ من شاهد** (`title_talk_stats`) — رقمٌ يقول «هذا
 * العملُ مُشاهَد» فيدعو من لم يشاهده.
 *
 * **٤ · الضغطُ يفتح صفحة الكلام لا صفحة العمل** (طلبه: «ما أبغاه يوديني
 * صفحة الفيلم، أبغى صفحة تعليقات فقط كأني فاتح مجتمع»). فـ`href` صار
 * `‎/talk/<type>/<id>`. **ومن أراد العمل نفسه يجده هناك في سطرٍ واحد** —
 * فلا طريقٌ انقطع.
 *
 * والسطرُ كلُّه رابطٌ واحد: هدفُ لمسٍ واسع، **ولا زرَّ داخل زرّ** — الردُّ
 * والإعجابُ والبلاغ كلُّها في صفحة الكلام حيث الرأي كامل.
 *
 * ================= ما تغيّر في D-216 =================
 *
 * **طلبُ أحمد:** «هذا الكارد يحتاج تحسين أكثر… عدد المشاهدة وعدد التعليقات
 * وعدد المقيّمين وعدد المفضّلة، كذا أيقونات».
 *
 * **١ · «المقيّمون» مقامٌ لا أيقونة.** البطاقةُ كانت تقول «★ 10.0» وهي
 * **رأيُ شخصٍ واحد** — **رقمٌ يكذب بحسن نيّة.** فصارت `★ 10.0 (1)`
 * ملتصقةً بالاسم. **والعددُ من نفس الآراء التي بُني منها المتوسّط** لا
 * من عدّ كلِّ من قيّم في التطبيق: **بسطٌ ومقامٌ من قومين رقمٌ يبدو دقيقاً
 * وهو غلط.** ولذلك لا يأتي من `title_talk_stats` بل من `groupByWork`.
 *
 * **٢ · والمفضّلةُ ثالثةُ الأيقونات** (هجرة ٧٠). **وهي أضعفُ الأربعة
 * ويُقال:** «مفضَّل» يقع داخل «متابَع» غالباً، **فالعينُ تغطّي محورَه** —
 * لكنه رقمٌ طلبَه أحمد وكلفتُه صفرُ نداءات (نفس الدالّة).
 *
 * **٣ · والصفرُ يبقى مخفيّاً كما كان.** أربعةُ عدّاداتٍ أصفار تجعل الصفَّ
 * **لوحةَ قيادةٍ بأربعة ثقوب** — **ورقمٌ صفريّ يشغل مكاناً ولا يقول شيئاً.**
 */
export function WorksTalk({
  works,
  stats,
  locale,
}: {
  works: WorkTalk[];
  /** `‎${media_type}-${tmdb_id}` → ردودٌ ومشاهدون. غيابُ المفتاح = صفران */
  stats?: Map<string, TalkStat>;
  locale: Locale;
}) {
  const t = getDict(locale);

  return (
    <div className="divide-y divide-[color:var(--divider)]">
      {works.map((w) => {
        const key = `${w.mediaType}-${w.tmdbId}`;
        const s = stats?.get(key);
        const poster = posterUrl(w.posterPath, "w185");
        return (
          <Link
            key={key}
            href={`/talk/${w.mediaType}/${w.tmdbId}`}
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
                {/* التقييمُ ملتصقٌ بالاسم لا في سطرٍ ثانٍ: هو صفةُ العمل
                    لا خبرٌ عنه. و`dir="ltr"` كي لا يُقلب «7.4» في RTL.
                    **والمقامُ بجانبه**: «١٠٫٠» من واحدٍ ليست «١٠٫٠» من
                    مئة، **والبطاقةُ كانت تقولهما بنفس الشكل** (D-216) */}
                {w.avg != null && (
                  <span
                    className="shrink-0 text-[12px] font-bold text-accent tabular-nums"
                    title={t.worksRatedByHint(w.ratedBy)}
                  >
                    ★{" "}
                    <span dir="ltr">
                      {w.avg.toFixed(1)}
                      {/* **ويظهر ولو كان واحداً — بل خاصّةً حينها:**
                          «١٠٫٠» بلا مقامٍ هي الحالةُ التي تكذب */}
                      <span className="font-normal text-muted"> ({w.ratedBy})</span>
                    </span>
                  </span>
                )}
                <span className="ms-auto shrink-0 text-[11px] text-muted tabular-nums">
                  {timeAgo(w.updatedAt, t)}
                </span>
              </div>

              {/* رقمان لا كلمات: الردودُ ومن شاهد. الصفرُ يُخفى — رقمٌ
                  صفريّ يشغل مكاناً ولا يقول شيئاً */}
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted tabular-nums">
                {(s?.replies ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1" title={t.talkRepliesHint}>
                    <Icon name="comment" size={12} />
                    {s!.replies}
                  </span>
                )}
                {(s?.watchers ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1" title={t.talkWatchersHint}>
                    <Icon name="eye" size={12} />
                    {s!.watchers}
                  </span>
                )}
                {(s?.favorites ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1" title={t.talkFavoritesHint}>
                    <Icon name="heart" size={12} />
                    {s!.favorites}
                  </span>
                )}
              </div>

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
  /* مجموعُ التقييمات وعددُها منفصلان عن `count`: الرأيُ المكتوب قد يأتي
     بلا رقم (نظرياً)، فمتوسّطُ ثلاثةٍ لا يُقسم على أربعة */
  const sums = new Map<string, { sum: number; n: number }>();
  for (const a of feed) {
    if (!a.review || !a.title) continue;
    const key = `${a.media_type}-${a.tmdb_id}`;
    if (a.rating != null) {
      const cur = sums.get(key) ?? { sum: 0, n: 0 };
      sums.set(key, { sum: cur.sum + a.rating, n: cur.n + 1 });
    }
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        tmdbId: a.tmdb_id,
        mediaType: a.media_type,
        title: a.title,
        posterPath: a.poster_path,
        count: 1,
        avg: null,
        ratedBy: 0,
        last: [a],
        updatedAt: a.updated_at,
      });
      continue;
    }
    cur.count += 1;
    if (cur.last.length < 2) cur.last.push(a);
    if (a.updated_at > cur.updatedAt) cur.updatedAt = a.updated_at;
  }
  for (const [key, w] of map) {
    const s = sums.get(key);
    w.avg = s && s.n > 0 ? s.sum / s.n : null;
    /* **مقامُ المتوسّط يُحفظ معه** (D-216): من يرسم «١٠٫٠» يجب أن يملك
       «من كم» في نفس الصفّ، وإلّا رسمها بلا مقامٍ لأنه لا يملكه */
    w.ratedBy = s?.n ?? 0;
  }
  /* الترتيب بأحدث رأيٍ على العمل: «ما يتحدّث عنه الناس الآن» سؤالُ
     طزاجةٍ لا سؤالُ حجم — وعملٌ بعشرين رأياً قديماً ليس حديثَ اليوم. */
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
