import Link from "next/link";
import { RailScroll } from "./RailScroll";
import { Icon, type IconName } from "./Icon";
import Image from "next/image";
import { posterUrl, titleOf, type SearchResult } from "@/lib/tmdb";
import { ImdbMark, TmdbMark } from "./RatingMarks";

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
}: {
  title: string;
  icon?: IconName;
  items: SearchResult[];
  /** نصّ صغير تحت العنوان — يشرح مصدر الترتيب أو نطاقه */
  note?: string;
  /** إخفاء الأرقام: بعض الصفوف قائمة لا ترتيب */
  ranked?: boolean;
  /** أداةٌ في طرف العنوان — رقائق نافذة الصفّ (D-099) */
  control?: React.ReactNode;
  /** صفٌّ له أداة لا يختفي فارغاً — رسالة بدل البطاقات، وإلا ضاعت
      الأداة ومعها طريق العودة لنافذةٍ فيها نتائج */
  emptyText?: string;
}) {
  if (!items.length && !control) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold mb-1">
        {icon && <Icon name={icon} size={18} className="text-muted" />}
        <span className="truncate">{title}</span>
        {control && <span className="ms-auto shrink-0">{control}</span>}
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
            return (
              <Link
                key={`${r.media_type}-${r.id}`}
                href={href}
                prefetch={false}
                className="group w-[112px] sm:w-[132px] shrink-0"
              >
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

                <p className="text-xs font-medium leading-tight line-clamp-2 mt-1.5 group-hover:text-accent transition">
                  {titleOf(r)}
                </p>
              </Link>
            );
          })}
      </RailScroll>
      )}
    </section>
  );
}
