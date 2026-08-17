import Link from "next/link";
import { RailScroll } from "./RailScroll";
import { Icon, type IconName } from "./Icon";
import Image from "next/image";
import { posterUrl, titleOf, type SearchResult } from "@/lib/tmdb";
import { ImdbMark, TmdbMark } from "./RatingMarks";
import { PosterHold } from "./PosterHold";
import type { LibState } from "@/lib/libState";
import type { Locale } from "@/lib/i18n";

/**
 * صفّ أفقي مرقّم — قائمة «أفضل ١٠».
 *
 * الرقم داخل الملصق لا فوقه: خارجه كان يضيف سطراً لكل بطاقة ويطيل الصفّ.
 * وحجم البطاقة نفسه المستخدم في بقية صفوف التطبيق، حتى يبقى الإيقاع واحداً
 * مهما تنقّل المستخدم بين الشاشات.
 */
export function RankedRail({
  title,
  icon,
  items,
  note,
  ranked = true,
  control,
  emptyText,
  href,
  seeAllLabel,
  lib,
}: {
  title: string;
  icon?: IconName;
  items: SearchResult[];
  /** نصّ صغير تحت العنوان — يشرح مصدر الترتيب أو نطاقه */
  note?: string;
  /**
   * 🆕 **حالةُ المكتبة على كل ملصق: الضغطُ المطوَّل والخيط** (D-322،
   * طلبُ أحمد: «أخفِ العلامات التي على البوستر، وفعّل الضغط المطوّل،
   * والخط السماوي والأخضر تحت البوستر والأحمر كذلك — نفس المكتبة»).
   *
   * **⚖️ ويحلّ محلَّ `quickAdd` ولا يجاوره** — نقضٌ لموضع زرِّ D-205/D-207
   * لا لفعله: **الزرُّ كان يشغل زاويةَ الملصق دائماً**، **والضغطُ المطوَّل
   * يعطي الفعلَ نفسَه ومعه «شاهدته» و«ريفيو» بلا أن يأكل بكسلاً من وجه
   * العمل** — **والتعرّفُ على العمل أغلى ما تملكه البطاقة** (D-131).
   *
   * ⚠️ **والحالةُ تُقرأ مرّةً للصفحة لا مرّةً لكل بطاقة** (D-205) —
   * `getLibState` ثلاثةُ نداءاتٍ مغلَّفةٍ بـ`cache` للطلب كلِّه.
   */
  lib?: { locale: Locale; state: LibState };
  /**
   * ⏳ **معاملٌ مقبولٌ ومُهمَلٌ يسقط في الدفعة التالية** (D-028): الصفحةُ
   * التي تنادي هذا الرفَّ تُرفع في دفعةٍ **بعد** هذه، **وحذفُ المعامل هنا
   * يكسر بناءها في النافذة بينهما** — **ومفتاحٌ يُحذف يُرفع ملفُّه مرّتين.**
   */
  quickAdd?: unknown;
  /** إخفاء الأرقام: بعض الصفوف قائمة لا ترتيب */
  ranked?: boolean;
  /** أداةٌ في طرف العنوان — رقائق نافذة الصفّ (D-099) */
  control?: React.ReactNode;
  /** صفٌّ له أداة لا يختفي فارغاً — رسالة بدل البطاقات، وإلا ضاعت
      الأداة ومعها طريق العودة لنافذةٍ فيها نتائج */
  emptyText?: string;
  /**
   * **العنوانُ بابٌ حين توجد وجهة** (D-198، مواصفةُ أحمد: «Every section
   * title should be clickable»).
   *
   * **ونفسُ نمط `PosterRail` حرفاً بحرف** — رابطٌ على النصّ ورابطٌ «الكل»
   * في الطرف. **ولا نمطَ ثانٍ لبابٍ واحد** (قاعدة ٦): لو رُسم هنا زرٌّ أو
   * سهمٌ لصار للقارئ إيماءتان لنفس الفعل في صفحةٍ واحدة.
   */
  href?: string;
  seeAllLabel?: string;
}) {
  if (!items.length && !control) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold mb-1">
        {icon && <Icon name={icon} size={18} className="text-muted" />}
        {href ? (
          <Link href={href} className="truncate hover:text-accent transition">
            {title}
          </Link>
        ) : (
          <span className="truncate">{title}</span>
        )}
        {/* الأداةُ تُقدَّم على «الكل» في الطرف: رقائقُ النافذة تُلمس أكثر،
            **ولا يجتمعان** — طرفٌ فيه شيئان على ٣٦٠px يتزاحمان */}
        {control ? (
          <span className="ms-auto shrink-0">{control}</span>
        ) : (
          href &&
          seeAllLabel && (
            <Link
              href={href}
              className="ms-auto shrink-0 text-[13px] text-muted hover:text-accent transition font-normal"
            >
              {seeAllLabel}
            </Link>
          )
        )}
      </h2>
      {/* السطر الفرعي اختياري: مصدر التقييمات كان يتكرّر فوق كل صفّ فيزحم
          الصفحة بسطر يعرفه القارئ من أول مرة. يبقى حيث يضيف معلومة —
          كالمنطقة فوق «يعرض الآن في السينما». */}
      {note ? <p className="text-[11px] text-muted mb-3">{note}</p> : <div className="mb-3" />}

      {!items.length && emptyText && (
        <p className="text-xs text-muted py-8 text-center bg-surface-2/40 border border-border rounded-2xl">
          {emptyText}
        </p>
      )}

      {/* حاوية التمرير المشتركة (`RailScroll`) لا حاويةٌ خاصّة: كان هذا
          الصفّ يكتب `overflow-x-auto` بيده فلم يكن له سهما سطح المكتب —
          وأحمد رأى ذلك قبل أن نراه («حتى السلاسل الطويلة ما فيها سهم»).
          صفٌّ يُمرَّر بلا أداة تمريرٍ ظاهرة يبدو للمستخدم صفّاً مبتوراً. */}
      {items.length > 0 && (
      <RailScroll prevLabel="السابق / Previous" nextLabel="التالي / Next">
          {items.map((r, i) => {
            const img = posterUrl(r.poster_path, "w342");
            const href = `/${r.media_type === "tv" ? "show" : "movie"}/${r.id}`;
            /* 🆕 **حالةُ العمل عندك** (D-322) — تُسأل هنا لأن الرفَّ يعرف
               صفَّه، **والسؤالُ قراءةُ خريطةٍ في الذاكرة لا نداء.** */
            const st =
              lib && (r.media_type === "tv" || r.media_type === "movie")
                ? lib.state.of(r.id, r.media_type)
                : null;
            const card = (
              <>
                <div className="relative aspect-[2/3] rounded-poster overflow-hidden bg-surface-2 border border-border">
                  {img ? (
                    <Image
                      src={img}
                      alt={titleOf(r)}
                      fill
                      sizes="132px"
                      className="object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-muted"><Icon name="film" size={22} /></div>
                  )}

                  {/* ⚖️ **زرُّ «+» غادر وجهَ الملصق** (D-322، طلبُ أحمد:
                      «أخفِ العلامات التي على البوستر») — **والفعلُ لم
                      يغادر**: هو أوّلُ صفٍّ في قائمة الضغط المطوَّل.
                      **وحجّةُ «داخل الملصق لا تحته» كانت تختار بين موضعين
                      سيّئين، والثالثُ ألّا يُرسم شيءٌ أصلاً.** */}

                  {/* الرقم على تعتيم سفلي حتى يُقرأ فوق أي ملصق */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/90 to-transparent" />
                  {/* الاتجاه على العنصر الداخلي لا الخارجي: وضعه على الخارجي
                      يقلب معنى start/end فينتقل الرقم للطرف المعاكس */}
                  {ranked && (
                    <span
                      className={`absolute bottom-1 start-1.5 font-extrabold leading-none drop-shadow ${
                        i < 3 ? "text-accent text-3xl" : "text-foreground/85 text-2xl"
                      }`}
                    >
                      <span dir="ltr">{i + 1}</span>
                    </span>
                  )}

                  {/* تقييمٌ واحد بشعاره: IMDb إن وُجد، **وTMDB إن لم يوجد**
                      — أيّاً كان السبب (D-181، طلب أحمد الصريح: «قلنا نحط
                      شارة TMDB»).

                      **وهذا يوسّع D-172 ويُقال صراحةً لا يُخفى.** كان الشرط
                      `imdb_absent` وحده — أي «سألنا فتأكّدنا أن لا تقييم» —
                      وتبقى حالةٌ واحدة بلا شارة: من أخفق سؤالُه (شبكةٌ ساقطة
                      أو حصةُ OMDb محروقة). فكانت البطاقة تخرج بلا رقمٍ إطلاقاً
                      وهي في رفٍّ كلُّ جيرانها مرقَّمون — **فراغٌ يُقرأ عطلاً**.

                      **وثمنُه مكتوبٌ هنا لمن يقرأ بعدنا:** أثناء إخفاق السؤال
                      قد يظهر رقمُ TMDB لعملٍ **له تقييم IMDb حقيقي** — وهو
                      نصفُ ما أسقط المحاولة الأولى (D-132). والفرق عن ٱلمرّة
                      الأولى أن الحال اليوم **عابرة**: أوّلُ سؤالٍ ينجح يخزّن
                      الرقم الحقيقي فيحلّ محلّه، والشعار مختلفٌ بيّن. */}
                  {typeof r.imdb_rating === "number" ? (
                    <span className="absolute bottom-1.5 end-1.5 flex items-center gap-1 text-[11px] font-bold text-white bg-black/55 backdrop-blur rounded-md px-1.5 py-0.5">
                      <ImdbMark className="text-[8px]" />
                      <span dir="ltr">{r.imdb_rating.toFixed(1)}</span>
                    </span>
                  ) : r.vote_average > 0 ? (
                    <span className="absolute bottom-1.5 end-1.5 flex items-center gap-1 text-[11px] font-bold text-white bg-black/55 backdrop-blur rounded-md px-1.5 py-0.5">
                      <TmdbMark className="text-[8px]" />
                      <span dir="ltr">{r.vote_average.toFixed(1)}</span>
                    </span>
                  ) : null}
                </div>
              </>
            );

            /* **بلا حالةٍ: البطاقةُ كما كانت حرفاً** — رابطٌ واحدٌ يلفّ
               الملصقَ واسمَه، ولا عقدةَ زائدةً في الشجرة (D-229). */
            if (!st || !lib) {
              return (
                <Link
                  key={`${r.media_type}-${r.id}`}
                  href={href}
                  prefetch={false}
                  className="group w-[112px] sm:w-[132px] shrink-0"
                >
                  {card}
                  <p className="text-xs font-medium leading-tight line-clamp-2 mt-1.5 group-hover:text-accent transition">
                    {titleOf(r)}
                  </p>
                </Link>
              );
            }

            /* 🔴 **ورابطان لا رابطٌ واحد حين يوجد الضغطُ المطوَّل** —
               والسببُ فحصٌ من فحوصنا الخضراء: **قائمةُ `PosterHold` أزرارٌ،
               وزرٌّ داخل رابطٍ عطلٌ يمسكه `button.closest('a')`** (D-155/
               D-301). فالحاملُ يلفّ الملصقَ وحدَه، **والاسمُ تحته رابطٌ
               ثانٍ إلى الوجهة نفسِها** — والوجهةُ واحدةٌ فلا لبس.
               **و`group` صعد إلى الحاوية** فبقي التكبيرُ عند المرور
               وتلوينُ الاسم يعملان كما كانا. */
            return (
              <div
                key={`${r.media_type}-${r.id}`}
                className="group w-[112px] sm:w-[132px] shrink-0"
              >
                <PosterHold
                  tmdbId={r.id}
                  mediaType={r.media_type === "tv" ? "tv" : "movie"}
                  title={titleOf(r)}
                  posterPath={r.poster_path}
                  added={st.added}
                  watched={st.watched}
                  progress={st.progress}
                  dropped={st.dropped}
                  locale={lib.locale}
                >
                  <Link href={href} prefetch={false} className="block">
                    {card}
                  </Link>
                </PosterHold>
                <Link href={href} prefetch={false} className="block">
                  <p className="text-xs font-medium leading-tight line-clamp-2 mt-1.5 group-hover:text-accent transition">
                    {titleOf(r)}
                  </p>
                </Link>
              </div>
            );
          })}
      </RailScroll>
      )}
    </section>
  );
}
