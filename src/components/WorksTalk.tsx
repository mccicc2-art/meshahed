import Link from "next/link";
import Image from "next/image";
import { posterUrl, backdropUrl } from "@/lib/tmdb";
import { getDict, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { displayNameOf } from "@/lib/people";
import type { TalkRoom } from "@/lib/data";
import { dirOf } from "@/lib/dir";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

/**
 * **بطاقاتُ غرف النقاش** (D-257).
 *
 * ================= ما كان خطأً وصُحّح =================
 *
 * **تصحيحُ أحمد بنصّه: «عندك لبس — النقاش ليس الريفيو، يختلف».** كانت
 * هذه البطاقاتُ تُبنى من خطّ الآراء (`groupByWork`): **عملٌ كتب فيه
 * ثلاثةٌ آراءً يصير «غرفةَ نقاشٍ بثلاث مشاركات»** — وذلك ليس نقاشاً، هو
 * ثلاثةُ أحكامٍ متجاورة لم يخاطب أحدُها الآخر. **وغرفةٌ مبنيّةٌ من آراءٍ
 * تعِد بحوارٍ لا تجده حين تُفتح.**
 *
 * **فالمصدرُ صار `title_talk_rooms`** (الهجرة ٧٨): غرفةٌ لا تولد إلا
 * بمشاركةٍ كُتبت فيها قصداً، **وعدّادُها مشاركاتٌ حقيقيّة ووقتُها وقتُ
 * آخرها.**
 *
 * ================= وثلاثةٌ من لقطة أحمد حرفاً =================
 *
 * **١ · الملصقُ في البداية** (طلبُه: «البوستر يسار» ثم تصحيحُه «يسار في
 * الإنجليزية ويمين في العربية» = `start`). **وكان في النهاية** بحجّة
 * D-222 — «الهويّةُ في البداية والملصقُ في النهاية» على وزن صفّ النشاط.
 * **والحجّةُ سقطت هنا لأن الصفَّ ليس صفَّ إنسان:** لا وجهَ في بدايته،
 * **فالملصقُ هو هويّةُ البطاقة** — ومن أزاحه إلى النهاية ترك البدايةَ
 * لنصٍّ وحده.
 *
 * **٢ · الخلفيّةُ من غلاف العمل** (طلبُه: «والخلفية تكون من غلاف الفلم»).
 * **وهي ١٤٪ لا أكثر**: الغلافُ صورةٌ عريضةٌ عاليةُ التباين، **وفوق ٢٠٪
 * يصير النصُّ عليها مقروءاً على نصفِ البطاقة وضائعاً على نصفها** — وطبقةُ
 * التدرّج فوقها تضمن القاع.
 *
 * **٣ · وجوهُ من يتكلّم** متراكبةً بحلقةِ فصل — **أشخاصٌ لا مشاركات**:
 * من كتب خمسَ مشاركاتٍ وجهٌ واحد.
 *
 * **ولا نجمةَ في البطاقة** (كانت في D-216): **النجمةُ حكمٌ، والغرفةُ
 * ليست حكماً** — ورقمُ التقييم يعيش في صفحة العمل وفي `/review` حيث
 * معناه واضح. **وعنصرٌ يبقى بعد أن سقط سببُه هو كيف تتراكم الفوضى.**
 */
export function WorksTalk({ rooms, locale }: { rooms: TalkRoom[]; locale: Locale }) {
  const t = getDict(locale);

  return (
    /* **بطاقاتٌ متباعدة لا صفوفٌ يفصلها خطّ**: الخطُّ الفاصل يقول «هذه
       عناصرُ قائمةٍ تُمسح» — وهو صوابُ خطّ النشاط حيث الصفُّ جملةٌ تُقرأ
       ثم تُترك. **والبطاقةُ تقول «هذا مكانٌ يُدخَل»**، وغرفةُ نقاشٍ مكانٌ
       لا جملة. */
    <div className="space-y-2.5">
      {rooms.map((r) => {
        const key = `${r.mediaType}-${r.tmdbId}`;
        const poster = posterUrl(r.posterPath, "w185");
        /* ⚠️ **والمقاسُ تبع الظهور** (بلاغُ أحمد: «الغلاف ماهو واضح»):
           كان `w300` **لأن الطبقة كانت ١٤٪ فلا تكاد تُرى** — ومنطقُ ذلك
           سليمٌ لتلك الشفافية. **ولمّا صارت ٤٠٪ صار `w300` ممدوداً على
           ٦٨٠px يُقرأ ضبابياً**، فالحجّةُ التي اشترت الصغَر ماتت بموت
           سببها (D-250). */
        const backdrop = backdropUrl(r.backdropPath, "w780");
        const title = r.title?.trim() || t.talkFallbackTitle;

        return (
          <Link
            key={key}
            href={`/talk/${r.mediaType}/${r.tmdbId}`}
            className="relative overflow-hidden flex gap-3.5 p-3.5 rounded-2xl bg-surface border border-border group active:scale-[0.99] hover:border-[color:var(--divider)] transition"
          >
            {/* ============ خلفيّةُ الغلاف ============ */}
            {backdrop && (
              <>
                <Image
                  src={backdrop}
                  alt=""
                  fill
                  sizes="680px"
                  className="object-cover opacity-[0.40] pointer-events-none"
                />
                {/* **طبقةٌ من لون السطح إلى الشفّاف باتّجاه البداية**:
                    النصُّ والملصقُ كلاهما في البداية، **فالحمايةُ حيث
                    يُقرأ لا على البطاقة كلِّها**.
                    ⚠️ **وهنا كان نصفُ العطل** (بلاغُ أحمد): الوسَطُ كان
                    `‎/85` **بلا موضعٍ محدَّد، فيمتدّ الغطاءُ الكثيفُ إلى
                    نحو ٨٥٪ من العرض** — فيجتمع على الغلاف خفوتان:
                    شفافيّتُه، والغطاءُ فوقه. **وطبقتان تخفتان معاً حاصلُهما
                    الغياب.**
                    **والآن الكثافةُ تنتهي عند ٥٥٪** (`via-[55%]`) بقيمةٍ
                    أخفّ (`‎/70`)، **فالنصفُ الأوّل محميٌّ كما كان والنصفُ
                    الثاني يُرى فيه العمل** — وهو ما طلبه أحمد أصلاً. */}
                <span
                  aria-hidden
                  className="absolute inset-0 pointer-events-none bg-gradient-to-l rtl:bg-gradient-to-r from-[color:var(--surface)] via-[color:var(--surface)]/70 via-[55%] to-transparent"
                />
              </>
            )}

            {/* ============ الملصقُ في البداية ============ */}
            <div className="relative w-16 h-24 shrink-0 self-start rounded-xl overflow-hidden bg-surface-2 border border-border">
              {poster ? (
                <Image src={poster} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center text-muted">
                  <Icon name={r.mediaType === "tv" ? "tv" : "film"} size={18} />
                </span>
              )}
            </div>

            <div className="relative min-w-0 flex-1 flex flex-col">
              {/* **العنوانُ المولَّد هو البطاقة** — وأكبرُ نصٍّ فيها لأنه
                  سببُ الضغط. و`line-clamp-2` لا `truncate`: عنوانٌ مقصوصٌ
                  عند الحرف يفقد اسمَ العمل وهو أهمُّ ما فيه. */}
              <h3
                dir={dirOf(title)}
                className="font-bold text-[16px] leading-snug line-clamp-2 group-hover:text-accent transition"
              >
                {t.talkRoomTitle(title, r.mediaType === "tv")}
              </h3>

              <div className="mt-1.5 flex items-center flex-wrap gap-x-2 gap-y-1 text-[12px] text-muted">
                <span className="shrink-0 tabular-nums">{t.talkRoomPosts(r.posts)}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{t.talkRoomLastAt(timeAgo(r.lastAt, t))}</span>
              </div>

              {/* **`mt-auto` يُنزل الوجوهَ إلى القاع** فيثبت موضعُها بين
                  البطاقات مهما طال العنوان (D-224) */}
              {r.faces.length > 0 && (
                <div className="mt-auto pt-2.5 flex items-center">
                  {r.faces.map((p, i) => (
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
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
