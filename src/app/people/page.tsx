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
      <div>
        <h1 className="text-xl font-bold">{t.peopleTitle}</h1>
        <p className="text-xs text-muted mt-0.5">{t.communitySub}</p>
      </div>

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
          <div className="space-y-3">
            {feed.map((a) => {
              const poster = posterUrl(a.poster_path, "w185");
              return (
                <article
                  key={`${a.person.id}-${a.media_type}-${a.tmdb_id}`}
                  className="bg-surface border border-border rounded-poster p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <PersonName
                      person={a.person}
                      t={t}
                      size={34}
                      sub={formatDateShort(a.updated_at, t)}
                    />
                    <span
                      className="text-sm shrink-0 font-bold text-accent tabular-nums"
                      title={t.rateOutOf(a.rating)}
                    >
                      ★ <span dir="ltr">{a.rating}/10</span>
                    </span>
                  </div>

                  <p className="text-[15px] leading-relaxed whitespace-pre-line mt-3">
                    {a.review}
                  </p>

                  <Link
                    href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                    prefetch={false}
                    className="flex items-center gap-3 mt-3 rounded-xl border border-border bg-surface-2/50 p-2 group"
                  >
                    <span className="w-9 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 block">
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
                          <Icon name="film" size={16} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold truncate group-hover:text-accent transition">
                        {a.title ?? "—"}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                      </span>
                    </span>
                  </Link>

                  <div className="mt-3 pt-2.5 border-t border-[color:var(--divider)]">
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
