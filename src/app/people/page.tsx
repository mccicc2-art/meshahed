import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getUser, getCommunityFeed, getFollowLists } from "@/lib/data";
import { getT } from "@/lib/locale";
import { formatDateShort } from "@/lib/when";
import { CommunityBar } from "@/components/CommunityBar";
import { PersonName } from "@/components/PersonRow";
import { backdropUrl, posterUrl } from "@/lib/media";
import { getTv, getMovie } from "@/lib/tmdb";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";

/** كم عملاً نطلب له صورةً عرضية — سقفٌ يمنع موجة طلباتٍ بحجم الخط */
const BACKDROP_LIMIT = 12;

export default async function PeoplePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [feed, lists] = await Promise.all([getCommunityFeed(), getFollowLists(user.id)]);

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

      {/* سطرٌ واحد: عدّادا المتابعة وزرّ الإضافة — والقوائم والبحث نوافذ منبثقة */}
      <CommunityBar
        following={lists.following}
        followers={lists.followers}
        locale={locale}
      />

      {/* ===== خطّ الآراء =====
          كخطّ X: رأيٌ فوق رأي، الأكثر إعجاباً أعلى — الإعجاب هو صوت
          المجتمع لا ساعة النشر. والإعجاب من الخط نفسه بلا فتح صفحة. */}
      <section>
        <h2 className="text-lg font-bold mb-4">{t.feedTitle}</h2>

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

                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                        prefetch={false}
                        className="flex items-center gap-2.5 group max-w-[18rem]"
                      >
                        <span className="min-w-0 text-end">
                          <span className="block text-[13px] font-semibold truncate group-hover:text-accent transition">
                            {a.title ?? "—"}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                          </span>
                        </span>
                        {/* `next/image` لا وسمَ صورةٍ خام: بقيةُ صور التطبيق
                            تمرّ به فتُقدَّم من نطاقنا نفسه بحجمٍ مناسب،
                            وكان هذا الموضع وحده يطلب TMDB مباشرةً */}
                        <span className="relative w-28 sm:w-40 shrink-0 aspect-video rounded-lg overflow-hidden bg-surface-2 block">
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
                              <Icon name="film" size={14} />
                            </span>
                          )}
                        </span>
                      </Link>

                      <span
                        className="text-sm font-bold text-accent tabular-nums"
                        title={t.rateOutOf(a.rating)}
                      >
                        ★ <span dir="ltr">{a.rating}/10</span>
                      </span>
                    </div>
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
