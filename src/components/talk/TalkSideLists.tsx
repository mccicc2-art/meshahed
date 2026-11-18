import { getDict, type Locale } from "@/core/i18n";
import { displayNameOf } from "@/core/people";
import { getFollows, getTalkRooms, getTitleReviews, getTitleThread } from "@/lib/data";
import { webWords } from "../webWords";
import { TalkSideCard, TalkSideRow } from "./TalkSide";

/**
 * 🆕 R264 — **قوائمُ العمود الجانبيّ** — كلُّ واحدةٍ نداءٌ مستقلّ يُرسم خلف `Suspense` في صفحته، **فلا يؤخّر الخيطَ
 * لحظةً** (الخيطُ ما جاء القارئُ له، والعمودُ إضافة). وكلُّ نداءٍ هنا مخبَّأٌ في الطلب أو مستعمَلٌ في الصفحة نفسِها
 * (`cache`) — لا رحلةَ ثانيةٌ لما قُرئ. والفشلُ صمت: عمودٌ أقصرُ أهونُ من صفحةٍ تسقط.
 */

/** «غرفٌ من مكتبتك» — الغرفُ الحيّةُ لأعمالٍ تتابعها، غيرَ الغرفة المفتوحة (أحمد ١٨ نوفمبر — «أ») */
export async function LibraryRoomsCard({ exclude, locale }: { exclude: string; locale: Locale }) {
  const w = webWords(locale);
  const [rooms, follows] = await Promise.all([getTalkRooms(40).catch(() => []), getFollows().catch(() => [])]);
  const mine = new Set(follows.map((f) => `${f.media_type}-${f.tmdb_id}`));
  const list = rooms.filter((r) => mine.has(`${r.mediaType}-${r.tmdbId}`) && `${r.mediaType}-${r.tmdbId}` !== exclude).slice(0, 4);
  if (!list.length) return null;
  const t = getDict(locale);
  return (
    <TalkSideCard icon="comment" title={w.talkLibraryRooms}>
      <ul className="space-y-0.5">
        {list.map((r) => (
          <TalkSideRow
            key={`${r.mediaType}-${r.tmdbId}`}
            href={`/talk/${r.mediaType}/${r.tmdbId}`}
            title={r.title ?? t.talkFallbackTitle}
            sub={r.mediaType === "tv" ? t.typeSeries : t.typeMovie}
            poster={r.posterPath}
            count={r.posts}
          />
        ))}
      </ul>
    </TalkSideCard>
  );
}

/** «أيضاً في الغرفة» — أحدثُ كلام الأعضاء في غرفة العمل (لا النشرات)، لصفحة المنشور */
export async function RoomPostsCard({
  tmdbId,
  mediaType,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
}) {
  const w = webWords(locale);
  const t = getDict(locale);
  const thread = await getTitleThread(tmdbId, mediaType).catch(() => []);
  const posts = thread
    .filter((p) => !p.kind && !p.parentId && p.body?.trim() && !p.hasSpoiler)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);
  if (!posts.length) return null;
  return (
    <TalkSideCard icon="comment" title={w.talkAlsoInRoom} link={{ href: `/talk/${mediaType}/${tmdbId}`, label: w.talkEnterRoom }}>
      <ul className="space-y-0.5">
        {posts.map((p) => (
          <TalkSideRow
            key={p.postId}
            href={`/talk/${mediaType}/${tmdbId}?r=${encodeURIComponent(p.postId)}`}
            title={p.hide_name ? t.anonymousUser : displayNameOf(p, t.anonymousUser)}
            sub={p.body.slice(0, 80)}
            avatar={{ src: p.hide_name ? null : p.avatar_url, name: p.nickname ?? p.username ?? "" }}
          />
        ))}
      </ul>
    </TalkSideCard>
  );
}

/** «آراءٌ أخرى» — مراجعاتٌ بنصٍّ على العمل نفسِه غيرَ المفتوحة، لصفحة الرأي */
export async function OtherReviewsCard({
  tmdbId,
  mediaType,
  exclude,
  locale,
}: {
  tmdbId: number;
  mediaType: "tv" | "movie";
  exclude: string;
  locale: Locale;
}) {
  const w = webWords(locale);
  const t = getDict(locale);
  const titleHref = `/${mediaType === "tv" ? "show" : "movie"}/${tmdbId}`;
  const reviews = (await getTitleReviews(tmdbId, mediaType).catch(() => []))
    .filter((r) => r.id !== exclude && r.review?.trim() && !r.has_spoiler)
    .slice(0, 3);
  if (!reviews.length) return null;
  return (
    <TalkSideCard icon="star" title={w.talkOtherReviews} link={{ href: titleHref, label: w.talkAllReviews }}>
      <ul className="space-y-0.5">
        {reviews.map((r) => (
          <TalkSideRow
            key={r.id}
            href={`/review/${mediaType}/${tmdbId}/${r.id}`}
            title={`${r.hide_name ? t.anonymousUser : displayNameOf(r, t.anonymousUser)} · ★ ${r.rating}`}
            sub={(r.review ?? "").slice(0, 80)}
            avatar={{ src: r.hide_name ? null : r.avatar_url, name: r.nickname ?? r.username ?? "" }}
          />
        ))}
      </ul>
    </TalkSideCard>
  );
}
