import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUser, getCommunityFeed, getFollowLists } from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { formatDateShort } from "@/lib/when";
import { CommunityBar } from "@/components/CommunityBar";
import { PersonName } from "@/components/PersonRow";
import { backdropUrl, posterUrl } from "@/lib/media";
import { getTv, getMovie } from "@/lib/tmdb";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";
import { segmentedItem, segmentedTrack } from "@/components/ui/controls";

/** كم عملاً نطلب له صورةً عرضية — سقفٌ يمنع موجة طلباتٍ بحجم الخط */
const BACKDROP_LIMIT = 12;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  /* الترتيب في الرابط لا في الذاكرة — كبقيّة التطبيق (اكتشف، التقييمات):
     قابلٌ للمشاركة وللرجوع، ويُرسم على الخادم فلا وميض ترتيبٍ قديم ولا
     جافاسكربت إضافية على صفحةٍ ثقيلة الصور أصلاً */
  const { sort } = await searchParams;
  const newest = sort === "new";

  const [rawFeed, lists] = await Promise.all([getCommunityFeed(), getFollowLists(user.id)]);

  /* عناوين الأعمال محفوظة مع التقييم بلغة يوم كتابته — وخطّ الآراء يجمع
     آراء أشخاص كتبوا بلغاتٍ مختلفة، فكان الخطّ الواحد يخلط الخطّين.
     الترجمة عند العرض (D-048)، وطلباتها هي نفسها المخبَّأة التي يطلبها
     صفّ الصور العرضية أسفله — فلا تكلفة مضاعفة */
  const feed = (await localizeRows(rawFeed, locale)).sort((a, b) =>
    newest
      ? b.updated_at.localeCompare(a.updated_at)
      : b.likes - a.likes || b.updated_at.localeCompare(a.updated_at),
  );

  /* الصورة العرضية ليست في صفّ التقييم — الجدول يحفظ الملصق وحده —
     فتُطلب من TMDB لأوائل الخط فقط، متوازيةً ومخزَّنة ساعةً في طبقة
     fetch. ونأخذ الملصق من الطلب نفسه أيضاً: `safeImagePath` يكتب `null`
     متى وصل المسار بصيغةٍ لا تطابق نمطه، فصفوفٌ قديمة ملصقها فارغ
     وكانت تظهر خانةً بلا صورة. الأولوية: عرضيّة TMDB، ثم ملصقها، ثم
     الملصق المخزَّن، ثم الأيقونة. الحلّ الأرخص لاحقاً: عمود
     `backdrop_path` في الجدول يُكتب وقت التقييم فتسقط هذه الطلبات. */
  const artTargets = feed.slice(0, BACKDROP_LIMIT);
  const artPairs = await Promise.all(
    artTargets.map(async (a) => {
      const key = `${a.media_type}-${a.tmdb_id}`;
      try {
        const d =
          a.media_type === "tv" ? await getTv(a.tmdb_id) : await getMovie(a.tmdb_id);
        return [key, { backdrop: d.backdrop_path, poster: d.poster_path }] as const;
      } catch {
        return [key, { backdrop: null, poster: null }] as const;
      }
    }),
  );
  const artById = new Map(artPairs);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.peopleTitle}</h1>

      {/* ===== خطّ الآراء =====
          كخطّ X: رأيٌ فوق رأي. والافتراض «الأكثر إعجاباً» لا «الأحدث» —
          الإعجاب صوتُ المجتمع، وساعةُ النشر تُصعّد آخر من كتب لا أفضل من
          كتب. ومن أراد الجديد فله المقسّم فوق الخطّ. والإعجاب من الخطّ
          نفسه بلا فتح صفحة. */}
      <section>
        {/* سطرٌ واحد يجمع عنوان الخطّ وعدّادَي المتابعة وزرّ الإضافة:
            كانا سطرين متتاليين، والعدّادان وحدهما يتركان نصف السطر
            فارغاً — فيبدو الفراغ مقصوداً وليس كذلك. العنوان يملأ البداية
            والأدوات تجلس في الطرف، فيُقرأ رأسُ الصفحة سطراً واحداً. */}
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* أصغر قليلاً على الشاشات الضيّقة: العنوان الإنجليزي أطول من
              العربي، وبحجم `lg` يُقصّ عند ٣٩٠ بكسلاً */}
          <h2 className="text-base sm:text-lg font-bold min-w-0 truncate">
            {t.feedTitle}
          </h2>
          <CommunityBar
            following={lists.following}
            followers={lists.followers}
            locale={locale}
          />
        </div>

        {/* ===== ترتيب الخطّ =====
            خياران يستبعد أحدهما الآخر وعددهما معروف — فالمقسّم لا الرقائق.
            ورابطان لا زرّان: الحالة في الرابط، والصفحة تُرسم على الخادم.
            ولا يظهر الصفّ على خطٍّ فارغ: أداةٌ فوق لا شيء زينة */}
        {feed.length > 0 && (
          <div className="mb-4">
            <div role="group" aria-label={t.feedSortGroup} className={segmentedTrack}>
              <Link
                href="/people"
                aria-current={!newest ? "true" : undefined}
                className={segmentedItem(!newest)}
              >
                {t.feedSortTop}
              </Link>
              <Link
                href="/people?sort=new"
                aria-current={newest ? "true" : undefined}
                className={segmentedItem(newest)}
              >
                {t.feedSortNew}
              </Link>
            </div>
          </div>
        )}

        {feed.length === 0 ? (
          <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 text-center">
            {t.feedEmpty}
          </p>
        ) : (
          /* بلا بطاقاتٍ ولا إطارات: الآراء خطٌّ متّصل كخطوط التواصل، يفصل
             بين الرأي والرأي خطٌّ رفيع لا فجوةٌ وحدّان. البطاقة كانت تجعل
             كل رأيٍ جزيرةً، والقراءة المتتابعة تريد نهراً. قرارُ المالك. */
          <div className="divide-y divide-[color:var(--divider)]">
            {feed.map((a) => {
              /* صورةٌ عرضية كصورة «أكمل المشاهدة» لا ملصقاً رأسياً:
                 الصفّ أفقيّ، والعرضيّة تملأ فراغه بدل مربّعٍ صغير */
              const found = artById.get(`${a.media_type}-${a.tmdb_id}`);
              const art =
                backdropUrl(found?.backdrop ?? null, "w500") ??
                posterUrl(found?.poster ?? a.poster_path, "w342");
              return (
                <article
                  key={`${a.person.id}-${a.media_type}-${a.tmdb_id}`}
                  className="py-4 first:pt-0"
                >
                  {/* عمودان لا ثلاثة صفوف: كلّ ما يخصّ الرأي — صاحبه ونصّه
                      وإعجابه — في عمودٍ واحد يبدأ من أعلى، والعمل وتقييمه
                      في عمودٍ مقابل. لو وُضع العمل في صفٍّ علويّ وحده لدفع
                      ارتفاعُ صورته النصَّ إلى أسفل وتركَ فراغاً بعرض
                      الشاشة إلى جانبه. */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <PersonName
                        person={a.person}
                        t={t}
                        size={34}
                        sub={formatDateShort(a.updated_at, t)}
                      />

                      <p className="text-[15px] leading-relaxed whitespace-pre-line mt-3">
                        {a.review}
                      </p>

                      <div className="mt-2">
                        <LikeButton
                          reviewUserId={a.person.id}
                          tmdbId={a.tmdb_id}
                          mediaType={a.media_type}
                          likes={a.likes}
                          likedByMe={a.likedByMe}
                          isMine={false}
                          locale={locale}
                        />
                      </div>
                    </div>

                    {/* العمل بطاقةٌ واحدة لا ثلاثة عناصر متجاورة: صورةٌ
                        فوق، واسمٌ تحتها، والنوع والتقييم سطراً هادئاً
                        أسفلهما. كانت الصورة والاسم والتقييم ثلاث محطّاتٍ
                        بصرية متساوية الصوت إلى جانب صاحب الرأي، فأربع
                        بؤرٍ في صفٍّ واحد لا يعرف معها أين يبدأ. الرأي هو
                        المحتوى، والعمل مرجعه — فليُقرأ مرجعاً. */}
                    <Link
                      href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                      prefetch={false}
                      className="shrink-0 w-28 sm:w-40 group"
                    >
                      {/* `next/image` لا وسمَ صورةٍ خام: بقيةُ صور التطبيق
                          تمرّ به فتُقدَّم من نطاقنا نفسه بحجمٍ مناسب،
                          وكان هذا الموضع وحده يطلب TMDB مباشرةً */}
                      <span className="relative block w-full aspect-video rounded-lg overflow-hidden bg-surface-2">
                        {art ? (
                          <Image
                            src={art}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 112px, 160px"
                            className="object-cover"
                          />
                        ) : (
                          <span
                            className="w-full h-full grid place-items-center text-muted"
                            aria-hidden
                          >
                            <Icon name="film" size={16} />
                          </span>
                        )}
                      </span>

                      <span className="mt-1.5 block text-[13px] font-semibold leading-snug truncate group-hover:text-accent transition">
                        {a.title ?? "—"}
                      </span>

                      <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="truncate">
                          {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                        </span>
                        <span aria-hidden>·</span>
                        <span
                          className="shrink-0 font-semibold text-accent tabular-nums"
                          title={t.rateOutOf(a.rating)}
                        >
                          ★ <span dir="ltr">{a.rating}/10</span>
                        </span>
                      </span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
