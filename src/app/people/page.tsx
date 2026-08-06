import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser, getCommunityFeed, getFollowLists } from "@/lib/data";
import { getT } from "@/lib/locale";
import { formatDateShort } from "@/lib/when";
import { CommunityBar } from "@/components/CommunityBar";
import { PersonName } from "@/components/PersonRow";
import { posterUrl } from "@/lib/media";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";

export default async function PeoplePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [feed, lists] = await Promise.all([getCommunityFeed(), getFollowLists(user.id)]);

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
              const poster = posterUrl(a.poster_path, "w185");
              return (
                <article
                  key={`${a.person.id}-${a.media_type}-${a.tmdb_id}`}
                  className="py-4 first:pt-0"
                >
                  {/* صاحب الرأي وتقييمه، والعمل على الطرف المقابل: العنوان
                      لا يستحقّ صفّاً كامل العرض بإطار، ومكانه إلى جانب
                      الترويسة يجعل السطر الواحد يقول: مَن، وكم، وفي ماذا */}
                  <div className="flex items-start justify-between gap-3">
                    <PersonName
                      person={a.person}
                      t={t}
                      size={34}
                      sub={formatDateShort(a.updated_at, t)}
                    />

                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                        prefetch={false}
                        className="flex items-center gap-2 group max-w-[11rem]"
                      >
                        <span className="min-w-0 text-end">
                          <span className="block text-[13px] font-semibold truncate group-hover:text-accent transition">
                            {a.title ?? "—"}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                          </span>
                        </span>
                        <span className="w-8 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
                          {poster ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={poster}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
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
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
