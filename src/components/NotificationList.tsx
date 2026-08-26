import Link from "next/link";
import { Avatar } from "./Avatar";
import type { Signal } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { curatedName } from "@/lib/universes";
import { profileHref } from "@/lib/people";
import { timeAgo } from "@/lib/when";

/**
 * قائمةُ الإشعارات — **لوحٌ في صفحةٍ لا ورقةٌ منبثقة** (D-463، طلبُ
 * أحمد: «ضيّفها مع الرسائل تبويباً ثانياً وألغِ الشاشة المنبثقة»).
 *
 * **ونقضٌ يُسجَّل بالاسم**: D-125 جعلتها ورقةً لأن الأسطرَ «لا تُحمَّل
 * إلا لمن فتح» — **والحجّةُ كانت عن التحميل لا عن الشكل، وقد بقيت
 * قائمةً**: الأسطرُ اليوم تُقرأ في صفحةٍ لا تُفتح إلّا بقصد. **وما مات
 * هو الورقة**: ثلاثون سطراً في صندوقٍ نصفِ شاشةٍ **يُقرآن أسوأَ مما
 * يُقرآن في صفحةٍ كاملة**، **وورقةٌ تُغلق باللمس خارجها تبتلع الخبرَ
 * قبل أن يُقرأ**.
 *
 * **ولا شيءَ في المنطق تبدّل**: نفسُ الجُمَل ونفسُ الوجهات (D-218 ·
 * D-257 · D-259 · D-328 · D-343) — **نقلٌ لا إعادةُ كتابة**، وإلّا
 * صارت نسختان تفترقان.
 *
 * **ومكوّنُ خادمٍ الآن**: لا حالةَ فيه ولا نداءَ من المتصفّح — الصفحةُ
 * تجلب الأسطرَ مع بقيّة بياناتها، **فلا هيكلَ ينتظر ولا قفزةَ بعد
 * الوصول** (D-046).
 */
export function NotificationList({
  rows,
  myUsername,
  locale,
}: {
  rows: Signal[];
  /** اسمُك — **وجهةُ إشعار الردّ صفحةُ تعليقك** (D-257) */
  myUsername: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);

  /** اسمُ القائمة بلغة القارئ — **بوّابةٌ واحدةٌ لثلاثة أنواع** (D-343) */
  const listName = (s: Signal) =>
    curatedName(s.listSlug, s.title ?? "", locale === "en" ? "en" : "ar");

  /** نصُّ السطر — الفاعل ثم فعلُه ثم العمل إن كان له عمل */
  function line(s: Signal): string {
    const who = s.person.hide_name
      ? t.anonymousUser
      : s.person.nickname || s.person.username || t.anonymousUser;
    if (s.kind === "follow") return t.notifFollow(who);
    if (s.kind === "request") return t.notifRequest(who);
    if (s.kind === "reply") return t.notifReply(who, s.title ?? "");
    if (s.kind === "talk_reply") return t.notifTalkReply(who, s.title ?? "");
    if (s.kind === "list_review") return t.notifListReview(who, listName(s));
    if (s.kind === "like_list_review") return t.notifListReviewLike(who, listName(s));
    if (s.kind === "list_reply") return t.notifListReply(who, listName(s));
    return t.notifLike(who, s.title ?? "");
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted text-center py-16">{t.notifEmpty}</p>;
  }

  return (
    <ul className="divide-y divide-[color:var(--divider)]">
      {rows.map((s, i) => {
        /* 🔑 **الوجهةُ هي الشيءُ نفسُه لا صاحبُه** (D-218) — منقولةٌ
           بحرفها من الجرس: القائمةُ أوّلاً (لا `tmdb_id` لها أصلاً)،
           ثم الغرفةُ، ثم صفحةُ تعليقك، ثم ملفُّ الفاعل. */
        const titleHref = s.tmdbId
          ? `/${s.mediaType === "tv" ? "show" : "movie"}/${s.tmdbId}`
          : null;
        const href =
          (s.kind === "list_review" ||
            s.kind === "like_list_review" ||
            s.kind === "list_reply") &&
          s.listId
            ? `/lists/${s.listId}`
            : s.kind === "talk_reply" && s.tmdbId
              ? `/talk/${s.mediaType ?? "movie"}/${s.tmdbId}`
              : s.kind === "reply" && s.tmdbId
                ? myUsername
                  ? `/review/${s.mediaType ?? "movie"}/${s.tmdbId}/${myUsername}`
                  : titleHref
                : (profileHref(s.person) ?? titleHref);

        const body = (
          <span className="flex items-center gap-3 py-3">
            <Avatar
              src={s.person.hide_name ? null : s.person.avatar_url}
              name={s.person.hide_name ? t.anonymousUser : s.person.nickname}
              size={40}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-14 leading-snug">{line(s)}</span>
              <span className="block text-12 text-muted mt-0.5">{timeAgo(s.at, t)}</span>
            </span>
            {/* النقطة تقول «هذا وصل بعد آخر فتحة» — لا لونٌ يغرق السطر */}
            {s.isNew && <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-hidden />}
          </span>
        );

        return (
          <li key={`${s.kind}-${s.person.id}-${s.at}-${i}`}>
            {href ? (
              <Link href={href} prefetch={false} className="block">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
