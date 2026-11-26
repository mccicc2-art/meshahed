import Link from "next/link";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import type { Signal } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { curatedName } from "@/core/universes";
import { signalHref, signalParts, signalPersonHref } from "@/core/signals";
import { timeAgo } from "@/core/when";
import { FollowRequestActions } from "./FollowRequestActions";
import { DeviceMark, PlatformMark } from "./links/DeviceMark";
import { linkSignalHref, linkSignalText, mergeByTime, type LinkSignalRow } from "@/core/linkSignals";

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
  pending = [],
  links = [],
}: {
  rows: Signal[];
  /** 🆕 المهمّة ٥٦١ — ما وصل من الربوط وسؤالُها (`my_link_signals`) — يُدمج مع أسطر الأشخاص بالأحدث أوّلاً */
  links?: LinkSignalRow[];
  /** 🆕 11-N دَين — من طلب متابعتي وطلبُه قائم: صفُّه يحمل قبولاً ورفضاً (D-1197) */
  pending?: readonly string[];
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

  if (rows.length === 0 && links.length === 0) {
    return <p className="text-sm text-muted text-center py-16">{t.notifEmpty}</p>;
  }

  return (
    <ul className="divide-y divide-[color:var(--divider)]">
      {mergeByTime(rows, links).map((s, i) => {
        if (!("person" in s)) return <LinkItem key={`link-${s.kind}-${s.source}-${s.at}-${i}`} r={s} locale={locale} />;
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

        /* 🆕 T509 — **الصورةُ تفتح حسابَ صاحبها والسطرُ يفتح مكانَ التفاعل** (أحمد ٢٢ نوفمبر «١٤ ب»): كان السطرُ كلُّه رابطاً واحداً،
           فلا طريقَ إلى حساب من ردّ أو أعجب إلّا من صفحة الردّ. رابطان متجاوران لا متداخلان (رابطٌ داخل رابطٍ لا يصحّ) */
        const who = signalPersonHref(s);
        const avatar = (
          <Avatar
            src={s.person.hide_name ? null : s.person.avatar_url}
            name={s.person.hide_name ? t.anonymousUser : s.person.nickname}
            size={40}
          />
        );
        const text = (
          <span className="block py-3">
            {/* 🆕 **والشارةُ صارت بجانب الاسم داخل الجملة** (D-775،
                تصحيحُ D-773ب) — **لا في آخر السطر.** والجملةُ تُشقُّ
                عند موضع الاسم (انظر `parts`).
                ⚠️ **والشارةُ داخلَ `<p>` لا خارجَها**: `inline-flex`
                يجعلها تسبح مع النصّ فتلتفّ معه في سطرٍ ثانٍ ولا تُترك
                وحدَها — **وشارةٌ في سطرٍ خالٍ أسوأُ من شارةٍ متأخّرة.** */}
            <p className="text-14 leading-snug">{sentence}</p>
            <span className="block text-12 text-muted mt-0.5">{timeAgo(s.at, t)}</span>
          </span>
        );

        return (
          <li key={`${s.kind}-${s.person.id}-${s.at}-${i}`} className="flex items-center gap-3">
            {who ? (
              <Link href={who} prefetch={false} aria-label={p.who} className="shrink-0 rounded-full">
                {avatar}
              </Link>
            ) : (
              <span className="shrink-0">{avatar}</span>
            )}
            <span className="min-w-0 flex-1">
              {href ? (
                <Link href={href} prefetch={false} className="block">
                  {text}
                </Link>
              ) : (
                text
              )}
            </span>
            {/* النقطة تقول «هذا وصل بعد آخر فتحة» — لا لونٌ يغرق السطر */}
            {s.isNew && <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-hidden />}
            {s.kind === "request" && pending.includes(s.person.id) ? <FollowRequestActions personId={s.person.id} locale={locale} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 🆕 المهمّة ٥٦١ — **سطرُ الربط**: شارةُ التطبيق مكانَ الصورة (لا شخصَ هنا)، والجملةُ من `core/linkSignals.ts` كالتطبيق والإشعار.
 * الضغطةُ تفتح العملَ حين يُعرف؛ والسؤالُ «شاهدتها؟» يُجاب من جرس التطبيق وبطاقة رئيسيّته — الويبُ لا بابَ جوابٍ فيه بعد.
 */
function LinkItem({ r, locale }: { r: LinkSignalRow; locale: Locale }) {
  const t = getDict(locale);
  const href = linkSignalHref(r);
  const mark = r.source === "netflix" || r.source === "osn" ? <PlatformMark platform={r.source} size={40} /> : <DeviceMark kind={r.source} size={40} />;
  const text = (
    <span className="block py-3">
      <p className="text-14 leading-snug">{linkSignalText(r, t)}</p>
      <span className="block text-12 text-muted mt-0.5">{timeAgo(r.at, t)}</span>
    </span>
  );
  return (
    <li className="flex items-center gap-3">
      {mark}
      <span className="min-w-0 flex-1">
        {href ? (
          <Link href={href} prefetch={false} className="block">
            {text}
          </Link>
        ) : (
          text
        )}
      </span>
      {r.isNew && <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-hidden />}
    </li>
  );
}
