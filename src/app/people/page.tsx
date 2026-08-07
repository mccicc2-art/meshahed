import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getUser,
  getCommunityFeed,
  getFollowLists,
  getConversations,
  getUnreadShares,
  type ConvShareEvent,
} from "@/lib/data";
import { getT } from "@/lib/locale";
import { localizeRows } from "@/lib/localize";
import { formatDateShort } from "@/lib/when";
import { num } from "@/lib/i18n";
import { CommunityBar } from "@/components/CommunityBar";
import { Inbox } from "@/components/Inbox";
import { PersonName } from "@/components/PersonRow";
import { backdropUrl, posterUrl } from "@/lib/media";
import { getTv, getMovie } from "@/lib/tmdb";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { segmentedItem, segmentedTrack, segmentedTrackFull } from "@/components/ui/controls";

/** كم عملاً نطلب له صورةً عرضية — سقفٌ يمنع موجة طلباتٍ بحجم الخط */
const BACKDROP_LIMIT = 12;

type Tab = "mine" | "all" | "inbox";
function asTab(v: string | undefined): Tab {
  return v === "all" || v === "inbox" ? v : "mine";
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; with?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();

  const { tab: tabParam, sort, with: withParam } = await searchParams;
  const tab = asTab(tabParam);
  const newest = sort === "new";
  const openWith = tab === "inbox" && withParam ? withParam : null;

  /* الخطّان يُبنيان معاً كي يحمل التبويبان عدّادَيهما دائماً — كصفّ شرائح
     المكتبة (١٨ مسلسلاً · ١٨ فيلماً). كلٌّ نداءا definer خفيفان؛ والترجمة
     والصور العرضية للنشِط وحده. والرسائل تُقرأ عند الحاجة فقط. */
  const [followingFeed, allFeed, unread, lists] = await Promise.all([
    getCommunityFeed("following"),
    getCommunityFeed("all"),
    getUnreadShares(),
    getFollowLists(user.id),
  ]);

  const mineCount = followingFeed.length;
  const allCount = allFeed.length;

  // ===== الرسائل — محادثةٌ لكل شخص =====
  // ترجمة عناوين الأعمال المُشارَكة عند العرض (D-048): نجمع أحداث المشاركة
  // من كل المحادثات، نترجمها دفعةً، ثم نعيدها إلى مواضعها بمعرّفاتها
  let conversations = tab === "inbox" ? await getConversations() : [];
  if (conversations.length) {
    const shareEvents = conversations.flatMap((c) =>
      c.events.filter((e): e is ConvShareEvent => e.kind === "share"),
    );
    const localized = await localizeRows(shareEvents, locale);
    const byId = new Map(localized.map((s) => [s.id, s]));
    conversations = conversations.map((c) => ({
      ...c,
      events: c.events.map((e) => (e.kind === "share" ? byId.get(e.id) ?? e : e)),
    }));
  }

  // ===== خطّ الآراء للنشِط (مجتمعي/المجتمع) =====
  const rawFeed = tab === "all" ? allFeed : followingFeed;
  const feed =
    tab === "inbox"
      ? []
      : (await localizeRows(rawFeed, locale)).sort((a, b) =>
          newest
            ? b.updated_at.localeCompare(a.updated_at)
            : b.likes - a.likes || b.updated_at.localeCompare(a.updated_at),
        );

  /* الصورة العرضية ليست في صفّ التقييم — تُطلب من TMDB لأوائل الخط فقط،
     متوازيةً ومخزَّنة ساعةً في طبقة fetch. الأولوية: عرضيّة TMDB، ثم
     ملصقها، ثم الملصق المخزَّن، ثم الأيقونة. */
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

  // روابط التبويبات — الحالة في الرابط كبقيّة التطبيق: قابلةٌ للمشاركة
  // وللرجوع، وتُرسم على الخادم فلا وميض
  const tabs: { key: Tab; href: string; label: string; count?: number; badge?: number }[] = [
    { key: "mine", href: "/people", label: t.communityTabMine, count: mineCount },
    { key: "all", href: "/people?tab=all", label: t.communityTabAll, count: allCount },
    { key: "inbox", href: "/people?tab=inbox", label: t.communityTabInbox, badge: unread },
  ];

  // روابط الفرز تحفظ التبويب الحالي — الفرز لا معنى له في الوارد
  const sortBase = tab === "all" ? "/people?tab=all" : "/people";
  const sortNewHref = tab === "all" ? "/people?tab=all&sort=new" : "/people?sort=new";

  return (
    <div className="space-y-5">
      {/* العنوان مخفيٌّ بصريّاً وباقٍ لقارئ الشاشة — أُزيلت كلمة «المجتمع»
          المرئية، وانتقل عدّادا المتابعة وزرّ الإضافة إلى صفّ الترتيب أسفل
          التبويبات (طلب المالك) */}
      <h1 className="sr-only">{t.peopleTitle}</h1>

      {/* ===== صفّ التبويبات =====
          مقسّمٌ يملأ العرض ويقسّمه بالتساوي بأثلاثٍ متطابقة العرض
          (segmentedTrackFull + flex-1 basis-0 min-w-0) — نفس صفّ شرائح
          المكتبة (D-016، D-042). عدّادٌ على «مجتمعي» و«المجتمع»، وشارة غير
          المقروء على «الرسائل» تختفي عند الصفر. */}
      <nav aria-label={t.communityTabsGroup} className={segmentedTrackFull}>
        {tabs.map((tb) => {
          const active = tb.key === tab;
          return (
            <Link
              key={tb.key}
              href={tb.href}
              aria-current={active ? "page" : undefined}
              className={segmentedItem(active, "flex-1 basis-0 min-w-0 flex items-center justify-center gap-1.5")}
            >
              <span className="truncate">{tb.label}</span>
              {typeof tb.count === "number" && (
                <span className={`tabular-nums text-[12px] ${active ? "text-muted" : "text-muted/70"}`} dir="ltr">
                  {num(tb.count, locale)}
                </span>
              )}
              {typeof tb.badge === "number" && tb.badge > 0 && (
                <span
                  aria-label={t.communityUnreadAria(tb.badge)}
                  className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
                  dir="ltr"
                >
                  {num(tb.badge, locale)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* صفٌّ واحد تحت التبويبات: ترتيب الخطّ على البداية (لتبويبَي الخطّ
          فقط)، وعدّادا المتابعة وزرّ الإضافة على الطرف — نُقلا إلى هنا من
          أعلى الصفحة بطلب المالك. يختفي داخل محادثةٍ مفتوحة لتصفو الدردشة */}
      {!openWith && (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {tab !== "inbox" && feed.length > 0 && (
              <div role="group" aria-label={t.feedSortGroup} className={segmentedTrack}>
                <Link
                  href={sortBase}
                  aria-current={!newest ? "true" : undefined}
                  className={segmentedItem(!newest)}
                >
                  {t.feedSortTop}
                </Link>
                <Link
                  href={sortNewHref}
                  aria-current={newest ? "true" : undefined}
                  className={segmentedItem(newest)}
                >
                  {t.feedSortNew}
                </Link>
              </div>
            )}
          </div>
          <CommunityBar following={lists.following} followers={lists.followers} locale={locale} />
        </div>
      )}

      {/* ===== محتوى التبويب ===== */}
      {tab === "inbox" ? (
        <Inbox conversations={conversations} openWith={openWith} locale={locale} />
      ) : (
        <section>
          {feed.length === 0 ? (
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 text-center">
              {tab === "all" ? t.communityAllEmpty : t.feedEmpty}
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--divider)]">
              {feed.map((a) => {
                const found = artById.get(`${a.media_type}-${a.tmdb_id}`);
                const art =
                  backdropUrl(found?.backdrop ?? null, "w500") ??
                  posterUrl(found?.poster ?? a.poster_path, "w342");
                return (
                  <article
                    key={`${a.person.id}-${a.media_type}-${a.tmdb_id}`}
                    className="py-4 first:pt-0"
                  >
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

                        <div className="mt-2 flex items-center gap-1">
                          <LikeButton
                            reviewUserId={a.person.id}
                            tmdbId={a.tmdb_id}
                            mediaType={a.media_type}
                            likes={a.likes}
                            likedByMe={a.likedByMe}
                            isMine={false}
                            locale={locale}
                          />
                          <ReportButton
                            reviewUserId={a.person.id}
                            tmdbId={a.tmdb_id}
                            mediaType={a.media_type}
                            locale={locale}
                          />
                        </div>
                      </div>

                      <Link
                        href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                        prefetch={false}
                        className="shrink-0 w-28 sm:w-40 group"
                      >
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
      )}
    </div>
  );
}
