"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { mySignals, markSignalsSeen, type Signal } from "@/lib/actions";
import { getDict, num, type Locale } from "@/lib/i18n";
import { timeAgo } from "@/lib/when";
import { tap } from "@/lib/haptics";
import { sheetScroll } from "./ui/controls";

/**
 * جرسُ الإشعارات (**D-125**) — النصف المفقود من الحلقة الاجتماعية.
 *
 * من أعجب بتقييمك أو تابعك لم يكن يصلك خبرُه أبداً، فلا سبب يعيدك. وPush
 * خارج نطاق `03` اليوم، فهذا هو النصف الممكن: **يعمل حين تفتح التطبيق**.
 *
 * **الشارة رقمٌ من الخادم، والأسطر تُحمَّل عند الفتح** — نفس تقسيم
 * `BlockedList` (D-060): الترويسة تُرسم في كل صفحة، فحملُ ثلاثين سطراً
 * بأسمائها لرسم رقمٍ واحد هدر.
 *
 * والختم يُكتب **عند الفتح لا عند الإغلاق**: من فتح فقد رأى، ومن أغلق
 * بسرعةٍ لا يجب أن تعود الشارة تلاحقه بنفس الخبر.
 */
export function NotificationBell({
  unread,
  myUsername = null,
  locale,
}: {
  /** العدّاد المحسوب على الخادم — يُرسم فوراً بلا وميض */
  unread: number;
  /** اسمُك — **وجهةُ إشعار الردّ صفحةُ تعليقك** (D-257)، انظر `href` */
  myUsername?: string | null;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Signal[] | null>(null);
  const [count, setCount] = useState(unread);
  const [pending, start] = useTransition();

  function openSheet() {
    tap(8);
    setOpen(true);
    // الشارة تسقط فوراً — القراءة حدثت بالفتح، والكتابة تلحق
    setCount(0);
    start(async () => {
      try {
        const [list] = await Promise.all([mySignals(), markSignalsSeen()]);
        setRows(list);
        router.refresh();
      } catch {
        setRows([]);
      }
    });
  }

  /** نصُّ السطر — الفاعل ثم فعلُه ثم العمل إن كان له عمل */
  function line(s: Signal): string {
    const who = s.person.hide_name
      ? t.anonymousUser
      : s.person.nickname || s.person.username || t.anonymousUser;
    if (s.kind === "follow") return t.notifFollow(who);
    if (s.kind === "request") return t.notifRequest(who);
    /* **الردّ** (D-218) — والعملُ قد يكون بلا عنوان إن حُذف التقييمُ وبقي
       الخيط، **فجملتان لا جملةٌ بفراغ**: «ردّ عليك في X» أو «ردّ عليك» */
    if (s.kind === "reply") return t.notifReply(who, s.title ?? "");
    /* **وردُّ الغرفة جملتُه تسمّي المكان** (D-259) — انظر `notifTalkReply` */
    if (s.kind === "talk_reply") return t.notifTalkReply(who, s.title ?? "");
    return t.notifLike(who, s.title ?? "");
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={t.notifTitle}
        title={t.notifTitle}
        className="relative shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-foreground hover:bg-surface transition"
      >
        <Icon name="bell" size={18} />
        {count > 0 && (
          <span
            aria-label={t.notifUnreadAria(count)}
            className="absolute -top-0.5 -end-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[color:var(--on-accent)] text-[11px] font-bold tabular-nums"
            dir="ltr"
          >
            {num(count, locale)}
          </span>
        )}
      </button>

      <Sheet
        open={open}
        variant="bottom"
        onClose={() => setOpen(false)}
        closeLabel={t.closeLabel}
      >
        <SheetHeader
          title={t.notifTitle}
          closeLabel={t.closeLabel}
          onClose={() => setOpen(false)}
        />

        {/* حاويةٌ تُمرَّر: لوح الورقة `overflow-hidden`، فقائمةٌ من ثلاثين
            إشعاراً كانت **تُقصّ بلا أي طريقةٍ لرؤية بقيّتها** — لا تمرير
            ولا إشارة. كل ورقةٍ في التطبيق تحمل هذه الحاوية، وهذه وحدها
            نسيتها (بلاغ أحمد 9 Aug). */}
        <div className={`${sheetScroll} px-5`}>
          {rows === null || (pending && !rows) ? (
            /* هيكلٌ بارتفاع الصفوف نفسه — لا تقفز الورقة عند الوصول (D-046) */
            <ul className="space-y-3 px-1 pb-2">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="skeleton w-9 h-9 rounded-full shrink-0" />
                  <span className="skeleton h-4 flex-1 rounded" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted text-center py-10">{t.notifEmpty}</p>
          ) : (
            <ul className="divide-y divide-[color:var(--divider)] pb-2">
              {rows.map((s, i) => {
                /* 🔑 **الوجهةُ هي الشيءُ نفسُه لا صاحبُه** (D-218).
                   بقيةُ الإشعارات تفتح ملفَّ الفاعل لأن الخبرَ عنه («تابعك»
                   · «أعجبه رأيك») — **أما الردُّ فخبرٌ عن حديثٍ ينتظرك**،
                   وفتحُ ملفِّ من ردّ يترك الحلقةَ مفتوحةً كما كانت: **علمتَ
                   ولم تصل إلى ما تردّ عليه.**

                   ⚠️ **وكانت `‎/talk` حتى D-257 — وصارت كذبةً يومَها**:
                   الردُّ ردٌّ على **تعليقك**، و`‎/talk` صارت نقاشاً خالصاً
                   لا تعليقَ فيها. **فالوجهةُ صفحةُ تعليقك نفسِها.**
                   **وبلا اسمٍ تسقط إلى صفحة العمل** — أقربُ ما نملك،
                   ولا رابطَ ميّت. */
                const titleHref = s.tmdbId
                  ? `/${s.mediaType === "tv" ? "show" : "movie"}/${s.tmdbId}`
                  : null;
                const href =
                  /* **ردُّ الغرفة يفتح الغرفة** (D-259) — ولا يحتاج اسمَك:
                     الغرفةُ لا صاحبَ لها، ومسارُها العملُ نفسُه. */
                  s.kind === "talk_reply" && s.tmdbId
                    ? `/talk/${s.mediaType ?? "movie"}/${s.tmdbId}`
                    : s.kind === "reply" && s.tmdbId
                      ? myUsername
                        ? `/review/${s.mediaType ?? "movie"}/${s.tmdbId}/${myUsername}`
                        : titleHref
                      : s.person.username
                        ? `/u/${s.person.username}`
                        : titleHref;
                const body = (
                  <span className="flex items-center gap-3 py-3">
                    <Avatar
                      src={s.person.hide_name ? null : s.person.avatar_url}
                      name={s.person.hide_name ? t.anonymousUser : s.person.nickname}
                      size={36}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug">{line(s)}</span>
                      <span className="block text-[11px] text-muted mt-0.5">
                        {timeAgo(s.at, t)}
                      </span>
                    </span>
                    {/* النقطة تقول «هذا وصل بعد آخر فتحة» — لا لونٌ يغرق السطر */}
                    {s.isNew && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-accent" aria-hidden />
                    )}
                  </span>
                );
                return (
                  <li key={`${s.kind}-${s.person.id}-${s.at}-${i}`}>
                    {href ? (
                      <Link href={href} prefetch={false} onClick={() => setOpen(false)} className="block">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}
