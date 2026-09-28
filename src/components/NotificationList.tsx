import Link from "next/link";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import type { Signal } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { curatedName } from "@/core/universes";
import { signalHref, signalParts } from "@/core/signals";
import { timeAgo } from "@/core/when";

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
  myId,
  locale,
}: {
  rows: Signal[];
  /**
   * **معرّفُك لا اسمُك** — وجهةُ إشعار الردّ صفحةُ تعليقك (D-257).
   *
   * 🔴 D-899 (بلاغُ عضو: «ضغطت على ردّ مشعل ولا ودّاني له» ⇢ Page not
   * found): المقطعُ الأخير في `/review/<type>/<id>/<user>` **معرّفُ
   * الكاتب** — الصفحةُ تطابقه بـ`x.id` (وكذلك كلُّ رابطِ رأيٍ في
   * `ActivityFeed`/`PeopleBoard`/`TitleReviewRow`) — **وكان هذا وحدَه
   * يمرّر اسمَ المستخدم**، فكلُّ إشعارِ ردٍّ لمن له اسمٌ يفتح 404، ومن
   * لا اسمَ له كان يرتدّ إلى صفحة العمل «فيعمل» ويُخفي العطل.
   */
  myId: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);

  /** اسمُ القائمة بلغة القارئ — **بوّابةٌ واحدةٌ لثلاثة أنواع** (D-343) */
  const listName = (s: Signal) =>
    curatedName(s.listSlug, s.title ?? "", locale === "en" ? "en" : "ar");

  /* 🆕 11-M · M4 — **الجملةُ المشقوقةُ عند الاسم (D-775) والوجهةُ (D-218/D-899) انتقلتا إلى `core/signals.ts`** بحرفهما:
     التطبيقُ الأصليُّ يرسم الإشعاراتِ منهما أيضاً، فلا وجهتان تفترقان لإشعارٍ واحد. */

  if (rows.length === 0) {
    return <p className="text-sm text-muted text-center py-16">{t.notifEmpty}</p>;
  }

  return (
    <ul className="divide-y divide-[color:var(--divider)]">
      {rows.map((s, i) => {
        /* 🔑 **الوجهةُ هي الشيءُ نفسُه لا صاحبُه** (D-218) — `core/signals.ts` */
        const href = signalHref(s, myId);

        /* **وتُحسب مرّةً لا ثلاثاً**: نداءٌ لكلِّ جزءٍ يبني الجملةَ
           ثلاثَ مرّاتٍ لكلِّ إشعار. */
        const p = signalParts(s, t, listName(s));
        const sentence = (
          <>
            {p.pre}
            <bdi className="font-semibold">{p.who}</bdi>
            {s.person.hide_name ? null : (
              <AccountBadges profile={s.person} t={t} className="align-middle mx-1" />
            )}
            {p.post}
          </>
        );

        const body = (
          <span className="flex items-center gap-3 py-3">
            <Avatar
              src={s.person.hide_name ? null : s.person.avatar_url}
              name={s.person.hide_name ? t.anonymousUser : s.person.nickname}
              size={40}
            />
            <span className="min-w-0 flex-1">
              {/* 🆕 **والشارةُ صارت بجانب الاسم داخل الجملة** (D-775،
                  تصحيحُ D-773ب) — **لا في آخر السطر.** والجملةُ تُشقُّ
                  عند موضع الاسم (انظر `parts`).
                  ⚠️ **والشارةُ داخلَ `<p>` لا خارجَها**: `inline-flex`
                  يجعلها تسبح مع النصّ فتلتفّ معه في سطرٍ ثانٍ ولا تُترك
                  وحدَها — **وشارةٌ في سطرٍ خالٍ أسوأُ من شارةٍ متأخّرة.** */}
              <p className="text-14 leading-snug">{sentence}</p>
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
