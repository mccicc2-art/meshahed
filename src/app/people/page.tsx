import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUser,
  getFollowingActivity,
  getFollowLists,
  displayNameOf,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { num } from "@/lib/i18n";
import { formatDateShort } from "@/lib/when";
import { PeopleSearch } from "@/components/PeopleSearch";
import { PersonName } from "@/components/PersonRow";
import { Avatar } from "@/components/Avatar";
import { posterUrl } from "@/lib/media";

export default async function PeoplePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const [activity, lists] = await Promise.all([
    getFollowingActivity(),
    getFollowLists(user.id),
  ]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">{t.peopleTitle}</h1>

      <PeopleSearch locale={locale} />

      {/* من تتابعهم */}
      <section>
        <div className="flex items-baseline gap-2 mb-3">
          <h2 className="text-lg font-bold">{t.peopleFollowingTitle}</h2>
          {lists.following.length > 0 && (
            <span
              className="text-xs text-muted bg-surface-2 border border-border rounded-full px-2 py-0.5"
              dir="ltr"
            >
              {num(lists.following.length, locale)}
            </span>
          )}
        </div>

        {lists.following.length === 0 ? (
          <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-6 text-center">
            {t.peopleNoFollowing}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lists.following.map((p) => (
              <Link
                key={p.id}
                href={p.username ? `/u/${p.username}` : "/people"}
                prefetch={false}
                className="shrink-0 w-20 text-center"
              >
                <Avatar
                  src={p.hide_name ? null : p.avatar_url}
                  name={displayNameOf(p, t.anonymousUser)}
                  size={56}
                  alt={t.avatarAlt}
                  className="mx-auto"
                />
                <span className="block text-[11px] mt-1.5 truncate">
                  {displayNameOf(p, t.anonymousUser)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* من يتابعونك */}
      {lists.followers.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-lg font-bold">{t.peopleFollowersTitle}</h2>
            <span
              className="text-xs text-muted bg-surface-2 border border-border rounded-full px-2 py-0.5"
              dir="ltr"
            >
              {num(lists.followers.length, locale)}
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {lists.followers.map((p) => (
              <Link
                key={p.id}
                href={p.username ? `/u/${p.username}` : "/people"}
                prefetch={false}
                className="shrink-0 w-20 text-center"
              >
                <Avatar
                  src={p.hide_name ? null : p.avatar_url}
                  name={displayNameOf(p, t.anonymousUser)}
                  size={56}
                  alt={t.avatarAlt}
                  className="mx-auto"
                />
                <span className="block text-[11px] mt-1.5 truncate">
                  {displayNameOf(p, t.anonymousUser)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* النشاط: من قيّم أو علّق */}
      <section>
        <h2 className="text-lg font-bold mb-4">{t.activityTitle}</h2>

        {activity.length === 0 ? (
          <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 text-center">
            {t.activityEmpty}
          </p>
        ) : (
          <div className="space-y-3">
            {activity.map((a) => {
              const poster = posterUrl(a.poster_path, "w185");
              return (
                <article
                  key={`${a.id}-${a.media_type}-${a.tmdb_id}`}
                  className="bg-surface border border-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <PersonName
                      person={a}
                      t={t}
                      size={32}
                      sub={formatDateShort(a.updated_at, t)}
                    />
                    <span className="text-sm shrink-0">
                      <span className="text-accent">{"★".repeat(a.rating)}</span>
                      <span className="text-muted/40">{"★".repeat(5 - a.rating)}</span>
                    </span>
                  </div>

                  <Link
                    href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                    prefetch={false}
                    className="flex items-center gap-3 mt-3 group"
                  >
                    <span className="w-11 shrink-0 aspect-[2/3] rounded-md overflow-hidden bg-surface-2 border border-border block">
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
                        <span className="w-full h-full grid place-items-center text-muted" aria-hidden>
                          🎬
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate group-hover:text-accent transition">
                        {a.title ?? "—"}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                      </span>
                    </span>
                  </Link>

                  {a.review?.trim() && (
                    <p className="text-sm text-muted leading-relaxed whitespace-pre-line mt-3 border-t border-border pt-3">
                      {a.review}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
