"use client";

import { useState } from "react";
import Link from "next/link";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import { timeAgoShort } from "@/lib/when";
import { dirOf } from "@/lib/dir";
import { tap } from "@/lib/haptics";
import { bulletinLine, bulletinFacts, bulletinSpoiler } from "@/lib/bulletinLine";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { SpoilerText } from "../SpoilerText";
import { Dropdown, dropdownItem } from "../ui/Dropdown";
import { ReplyingTo } from "./ThreadShell";

/**
 * **صفُّ الردّ بتشريح تويتر** (D-242).
 *
 * وجهٌ ٤٠ في البداية · اسمٌ ووسمٌ زمنيٌّ مختصرٌ في سطر · نقاطٌ في
 * الزاوية · النصّ · ثم فعلٌ واحد. **وهو صفُّ خطّ النشاط نفسُه مصغَّراً**
 * — لا عائلةَ ثالثة.
 *
 * ================= ثلاثةُ تغييرات عمّا كان =================
 *
 * **١ · «ردّ» و«حذف» و«إبلاغ» خرجت من النصّ إلى قائمة النقاط.** كانت
 * روابطَ نصّيةً عاريةً تحت كل ردّ (رآها أحمد في لقطته)، **وثلاثُ كلماتٍ
 * زرقاءَ تحت كل سطرٍ تجعل الخيطَ يبدو نموذجاً لا حواراً**. **وتويتر
 * يضع المدمِّرَ في ⋯ ويُبقي المتكرِّرَ ظاهراً** — فالردُّ وحده ظاهر.
 *
 * **٢ · الوسمُ الزمنيّ مختصر** (`2h`) كما في الخطّ، لا «قبل ساعتين»:
 * **جملةٌ في موضع وسمٍ تسرق العرضَ من الاسم** (D-228).
 *
 * **٣ · «رداً على فلان» بدل الإزاحة** — انظر `ReplyingTo`.
 */
export type ThreadReply = {
  replyId: string;
  authorId: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
  parentId: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
  /**
   * 🆕 **نشرةُ Loopz** (D-261) — `null`/غائبٌ لكلام البشر، وهو الحالُ في
   * الخيوط الثلاثة إلا غرفةَ النقاش. **ومتنُها يُصاغ من `data` عند
   * العرض** فلا يُقرأ من `body` (D-211).
   */
  kind?: string | null;
  data?: Record<string, unknown> | null;
  spoiler?: Record<string, unknown> | null;
  /**
   * 🆕 **«رسالتي فيها حرق»** (D-271 · الهجرة ٨٤، طلبُ أحمد) — **إعلانُ
   * كاتبها لا استنتاجُنا**: لا نقرأ نصّاً ولا نخمّن، **وحقلٌ يُملأ بالتخمين
   * يكذب في الاتّجاهين** (يحجب ما لا يحرق، ويكشف ما يحرق).
   *
   * ⚠️ **وغيرُ `spoiler` أعلاه**: تلك تحمل **نصّاً ثانياً محجوباً** ومتنُ
   * النشرة يبقى مرئيّاً، **وهنا المتنُ نفسُه هو المحجوب** — **حقلان
   * لمعنيين** (حجّةُ الهجرة ٨٤).
   */
  hasSpoiler?: boolean;
};

/** ردٌّ محليٌّ لم يُقرأ من القاعدة بعد — **معرّفُه مؤقّتٌ فيُرسم باهتاً** */
export const TEMP = "temp:";

export function ReplyItem({
  reply,
  replyingToName,
  locale,
  signedIn,
  canReply,
  onReply,
  onDelete,
  onReport,
}: {
  reply: ThreadReply;
  /** اسمُ صاحب الردّ الأب — يظهر سطراً فوق النصّ، لا إزاحةً */
  replyingToName?: string | null;
  locale: Locale;
  signedIn: boolean;
  /** **العمقُ الثاني لا يُردّ عليه**: القاعدةُ تمنعه، فلا زرَّ يعد بما تمنعه */
  canReply: boolean;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const t = getDict(locale);
  const [menu, setMenu] = useState(false);
  const [reported, setReported] = useState(false);
  const name = displayNameOf(reply, t.anonymousUser);
  const pending = reply.replyId.startsWith(TEMP);
  const whoHref = reply.username ? `/u/${reply.username}` : null;

  /* **متنُ النشرة يُركَّب هنا** (D-261) — و`bulletin === null` يعني
     «صفُّ إنسان»، **فالفرعُ واحدٌ لا ثلاثة أعلام.** */
  const bulletin = bulletinLine(reply.kind ?? null, reply.data ?? null, t, locale);
  const facts = bulletin ? bulletinFacts(reply.data ?? null, t) : { runtime: null, vote: null };
  const spoilerText = bulletin ? bulletinSpoiler(reply.spoiler ?? null, locale) : null;

  return (
    <article
      className={`py-3 border-b border-[color:var(--divider)] flex gap-3 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {whoHref ? (
        <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
          <Avatar src={reply.avatar_url} name={name} size={40} alt="" />
        </Link>
      ) : (
        <Avatar src={reply.avatar_url} name={name} size={40} alt="" className="shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate font-bold text-[14px] leading-tight">
            <bdi>{name}</bdi>
          </span>
          <span aria-hidden className="shrink-0 text-muted text-[12px]">
            ·
          </span>
          <span className="shrink-0 text-[12px] text-muted tabular-nums">
            {timeAgoShort(reply.createdAt, t)}
          </span>

          {/* **النقاطُ في الزاوية** — نفسُ منسدلة التطبيق (D-226).
              **ولا تُرسم لردٍّ لم يُكتب بعد**: لا حذفَ لما لا معرّفَ له. */}
          {!pending && signedIn && (
            <span className="ms-auto shrink-0 relative">
              <button
                type="button"
                onClick={() => {
                  tap(6);
                  setMenu((v) => !v);
                }}
                aria-expanded={menu}
                aria-label={t.moreMenuTitle}
                className="w-8 h-8 -my-1 rounded-full grid place-items-center text-muted hover:text-foreground transition"
              >
                <Icon name="dots" size={16} />
              </button>
              <Dropdown open={menu} onClose={() => setMenu(false)} align="end" caret>
                {reply.isMine ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenu(false);
                      onDelete();
                    }}
                    className={dropdownItem}
                  >
                    <Icon name="trash" size={16} className="shrink-0 text-[color:var(--error)]" />
                    <span className="text-[color:var(--error)]">{t.talkDeleteReply}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={reported}
                    onClick={() => {
                      setMenu(false);
                      setReported(true);
                      onReport();
                    }}
                    className={`${dropdownItem} disabled:opacity-50`}
                    lang={locale}
                  >
                    <Icon name="shield" size={16} className="shrink-0 text-muted" />
                    <span>{reported ? t.reportDone : t.reportLabel}</span>
                  </button>
                )}
              </Dropdown>
            </span>
          )}
        </div>

        {replyingToName && <ReplyingTo name={replyingToName} locale={locale} />}

        {/* **صفٌّ واحدٌ بمتنين** (D-261) — **ولا مكوّنَ ثانٍ للنشرة**:
            الوجهُ والاسمُ والوقتُ والنقاطُ وزرُّ الردّ **كلُّها هي هي**،
            **والذي يفترق المتنُ وحدَه** — ومكوّنٌ ثانٍ كان سيُصلَح مرّتين
            (D-257: الفحصُ ليس «هل يبدوان مختلفين» بل «هل يُصلَح العيبُ
            مرّتين»). */}
        {bulletin ? (
          <div>
            {/* **الحقائقُ ظاهرةٌ بلا حرق** — بخطّ المتن لا الحاشية (D-241) */}
            <p
              dir={dirOf(bulletin)}
              className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line"
            >
              {bulletin}
            </p>

            {/* **المدّةُ والتقييمُ سطرٌ ثانٍ**، وكلٌّ يغيب وحدَه والصفرُ
                يُخفى (D-219). **و★ تجاور رقمَها** (D-223). */}
            {(facts.runtime || facts.vote) && (
              <p className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                {facts.runtime && <span>{facts.runtime}</span>}
                {facts.runtime && facts.vote && <span aria-hidden="true">·</span>}
                {facts.vote && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="star" size={12} className="shrink-0 text-accent" />
                    <span dir="ltr">{facts.vote}</span>
                  </span>
                )}
              </p>
            )}

            {/* **«أبرزُ ما فيها» خلف الحاجب** — قرارُ أحمد */}
            {spoilerText && <SpoilerText text={spoilerText} locale={locale} />}
          </div>
        ) : reply.hasSpoiler ? (
          /* **ومتنُ العضو خلف الحاجب نفسِه** (D-271) — **لا حاجبَ ثانٍ**:
             `SpoilerText` لا يُصيّر النصَّ حتى يُطلب، **وهو ما يجعله
             حاجباً لا ضباباً** (D-063). **والسببُ يتغيّر وحدَه**: من أعلن
             الحرقَ هو الكاتب، **فلا نقول «يكشف أحداث الحلقة» عن كلامٍ لا
             نعرف ما فيه** (D-216). */
          <SpoilerText text={reply.body} locale={locale} note={t.spoilerByAuthor} />
        ) : (
          /* **اتّجاهُ الردّ من الردّ** (D-241) — لا من لغة الواجهة */
          <p
            dir={dirOf(reply.body)}
            className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line"
          >
            {reply.body}
          </p>
        )}

        {!pending && signedIn && canReply && (
          <div className="mt-1.5 -mx-0.5">
            <button
              type="button"
              onClick={onReply}
              aria-label={t.talkReply}
              title={t.talkReply}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] text-muted hover:text-accent transition"
            >
              <Icon name="comment" size={15} />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
