import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf, type FeedItem, type TalkStat } from "@/lib/data";
import { dirOf } from "@/lib/dir";
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
  /**
   * **وجوهُ من يتكلّم** (D-254) — **أشخاصٌ لا آراء**: من كتب رأيين في
   * العمل وجهٌ واحد. **وخمسةٌ سقفاً** لأن الصفَّ يُقرأ بالمَسح، والسادسُ
   * لا يُقرأ ويأكل عرضاً.
   */
  faces: FeedItem["person"][];
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
    /* **بطاقاتٌ متباعدة لا صفوفٌ يفصلها خطّ** (D-254، لقطةُ أحمد):
       **وهذا فرقٌ في المعنى لا في الزينة.** الخطُّ الفاصل يقول «هذه
       عناصرُ قائمةٍ واحدة تُمسح» — وهو صوابُ خطّ النشاط حيث الصفُّ جملةٌ
       تُقرأ ثم تُترك. **والبطاقةُ تقول «هذا مكانٌ يُدخَل»**، وغرفةُ نقاشٍ
       مكانٌ لا جملة. */
    <div className="space-y-2.5">
      {works.map((w) => {
        const key = `${w.mediaType}-${w.tmdbId}`;
        const s = stats?.get(key);
        const poster = posterUrl(w.posterPath, "w185");
        /* **المشاركاتُ رأيٌ وردّ معاً**: الغرفةُ تحمل الاثنين — وعدٌّ
           يسمّي أحدَهما وحده يكذب على الآخر (نصُّ `talkRoomPosts`) */
        const posts = w.count + (s?.replies ?? 0);
        return (
          <Link
            key={key}
            href={`/talk/${w.mediaType}/${w.tmdbId}`}
            className="flex gap-3.5 p-3.5 rounded-2xl bg-surface border border-border group active:scale-[0.99] hover:border-[color:var(--divider)] transition"
          >
            <div className="min-w-0 flex-1 flex flex-col">
              {/* ============ العنوانُ المولَّد — هو البطاقة ============
                  **وهو أكبرُ نصٍّ فيها** لأنه سببُ الضغط. `line-clamp-2`
                  لا `truncate`: عنوانٌ مقصوصٌ عند الحرف يفقد اسمَ العمل
                  وهو أهمُّ ما فيه. */}
              <h3
                dir={dirOf(w.title)}
                className="font-bold text-[16px] leading-snug line-clamp-2 group-hover:text-accent transition"
              >
                {t.talkRoomTitle(w.title, w.mediaType === "tv")}
              </h3>

              {/* ============ سطرُ الحال ============
                  **★ نزلت إلى هنا من جوار الاسم** (كانت في D-216 ملتصقةً
                  بعنوان العمل): **العنوانُ صار جملةً لا اسماً**، ونجمةٌ
                  داخل جملةٍ تُقرأ جزءاً منها. **ومقامُها يبقى معها** —
                  «١٠٫٠» من واحدٍ ليست «١٠٫٠» من مئة. */}
              <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-muted">
                {w.avg != null && (
                  <span
                    className="shrink-0 font-bold text-accent tabular-nums"
                    title={t.worksRatedByHint(w.ratedBy)}
                  >
                    ★{" "}
                    <span dir="ltr">
                      {w.avg.toFixed(1)}
                      <span className="font-normal text-muted"> ({w.ratedBy})</span>
                    </span>
                  </span>
                )}
                {w.avg != null && <span aria-hidden>·</span>}
                <span className="shrink-0 tabular-nums">{t.talkRoomPosts(posts)}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{t.talkRoomLastAt(timeAgo(w.updatedAt, t))}</span>
              </div>

              {/* ============ أحدثُ رأيٍ سطراً واحداً ============
                  ⚠️ **وهو زيادةٌ على اللقطة، بحجّة:** لقطتُك بطاقاتُها
                  بلا نصّ لأن عناوينَها **أسئلةٌ يكتبها الناس** فتحمل
                  المحتوى بنفسها. **وعنوانُنا مولَّد**، فبطاقةٌ بلا سطرِ
                  كلامٍ تصير دليلَ غرفٍ لا يُعرف أيُّها حيّ.
                  **وسطرٌ واحد لا اثنان** (كانا اثنين في D-187): البطاقةُ
                  تقول «هنا حديث» ولا تنقله — والنقلُ عملُ الغرفة. */}
              {w.last[0]?.review && (
                <p
                  dir={dirOf(w.last[0].review)}
                  className="mt-2 text-[13px] leading-snug text-foreground/70 line-clamp-1"
                >
                  <span className="font-semibold text-foreground/85">
                    {displayNameOf(w.last[0].person, t.anonymousUser)}
                  </span>
                  <span className="text-muted"> · </span>
                  {w.last[0].review}
                </p>
              )}

              {/* ============ وجوهُ من يتكلّم ============
                  **متراكبةٌ بحلقةِ خلفيةٍ تفصل الوجهَ عن جاره** — نفسُ
                  حيلة لقطتك. **و`mt-auto` يُنزلها إلى القاع** فيثبت
                  موضعُها بين البطاقات مهما طال العنوان (D-224). */}
              {w.faces.length > 0 && (
                <div className="mt-auto pt-2.5 flex items-center">
                  {w.faces.map((p, i) => (
                    <span
                      key={p.id}
                      className="rounded-full ring-2 ring-[color:var(--surface)]"
                      style={{ marginInlineStart: i === 0 ? 0 : -8 }}
                    >
                      <Avatar
                        src={p.avatar_url}
                        name={displayNameOf(p, t.anonymousUser)}
                        size={22}
                        alt=""
                      />
                    </span>
                  ))}
                  {/* عدّاداتُ العمل تبقى — لكنها ذيلٌ لا ترويسة، والصفرُ
                      يُخفى كما كان (D-216/D-222) */}
                  <span className="ms-auto flex items-center gap-3 text-[11px] text-muted tabular-nums">
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
                  </span>
                </div>
              )}
            </div>

            {/* **الملصقُ في النهاية لا البداية** (D-222، ولقطةُ أحمد
                معه): **الهويّةُ في البداية والملصقُ في النهاية** — وهو
                موضعُه في صفّ النشاط حرفاً، **فالسطحان يُقرآن تطبيقاً
                واحداً.** ومقاسُه ٦٤×٩٦ يتبع كثافةَ البطاقة الجديدة. */}
            <div className="relative w-16 h-24 shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border">
              {poster ? (
                <Image src={poster} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted">
                  <Icon name={w.mediaType === "tv" ? "tv" : "film"} size={18} />
                </span>
              )}
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
        faces: [a.person],
        updatedAt: a.updated_at,
      });
      continue;
    }
    cur.count += 1;
    if (cur.last.length < 2) cur.last.push(a);
    /* **الوجوهُ أشخاصٌ لا آراء** (D-254): من كتب رأيين وجهٌ واحد —
       **وصفٌّ يعرض الوجهَ نفسَه مرّتين يقول «شخصان» وهو واحد.** */
    if (cur.faces.length < 5 && !cur.faces.some((p) => p.id === a.person.id)) {
      cur.faces.push(a.person);
    }
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
