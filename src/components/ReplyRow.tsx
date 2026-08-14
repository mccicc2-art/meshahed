"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import { timeAgo } from "@/lib/when";
import { Avatar } from "./Avatar";

/**
 * **صفُّ الردّ — واحدٌ لخيطين** (D-239).
 *
 * وُلد داخل `TalkThread` حين كان للردّ خيطٌ واحد (`review_replies`).
 * **ثم صار لنشرات Loopz خيطُها** (`news_post_replies`، D-236) — **ولمّا
 * ظهر القارئُ الثاني خرج المكوّنُ إلى بيته** وحُذفت النسخةُ المحلّية في
 * الدفعة نفسِها. **وهو نفسُ ما فُعل بـ`Composer` و`Dropdown`**، وقاعدةٌ
 * نتّبعها: **نسخةٌ ثانية من صفٍّ يعني شكلين للردّ الواحد في تطبيقٍ واحد.**
 *
 * **والشكلُ بنيويٌّ لا لفظيّ:** ما يقبله هذا المكوّن **حقولُ الردّ لا نوعُ
 * جدوله** — فـ`ReviewReply` و`NewsReply` كلاهما يطابقه، **ولا يعرف هو
 * أيَّهما يرسم.** وهذا مقصود: صفُّ الردّ لا شأن له بمن يملك الخيط.
 */
export type ThreadReply = {
  replyId: string;
  nickname: string | null;
  username: string | null;
  avatar_url: string | null;
  hide_name: boolean;
  body: string;
  createdAt: string;
  isMine: boolean;
};

/** ردٌّ محليٌّ لم يُقرأ من القاعدة بعد — **معرّفُه مؤقّتٌ فيُرسم باهتاً** */
export const TEMP = "temp:";

export function ReplyRow({
  reply,
  locale,
  signedIn,
  replying,
  onReply,
  onDelete,
  onReport,
}: {
  reply: ThreadReply;
  locale: Locale;
  signedIn: boolean;
  replying?: boolean;
  /** **يُحذف الزرُّ كلَّه إن لم يُمرَّر** — لا زرَّ ردٍّ على العمق الثاني */
  onReply?: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const t = getDict(locale);
  const [reported, setReported] = useState(false);
  const name = displayNameOf(reply, t.anonymousUser);
  const pending = reply.replyId.startsWith(TEMP);
  return (
    <div className={`flex items-start gap-2 ${pending ? "opacity-60" : ""}`}>
      <Avatar src={reply.avatar_url} name={name} size={24} alt="" className="shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">
            <bdi>{name}</bdi>
          </span>
          <span className="text-muted text-[11px]"> · {timeAgo(reply.createdAt, t)}</span>
        </p>
        {/* **اتّجاهُ الردّ من الردّ لا من الصفحة** (نفسُ حكم D-228): من
            كتب بالعربية في واجهةٍ إنجليزية يُقرأ من اليمين ونقطتُه في مكانها. */}
        <p
          dir="auto"
          className="text-[13px] leading-relaxed text-muted whitespace-pre-line"
        >
          {reply.body}
        </p>
        {!pending && (
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            {signedIn && onReply && (
              <button
                type="button"
                onClick={onReply}
                aria-expanded={!!replying}
                className={`font-semibold transition ${
                  replying ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {t.talkReply}
              </button>
            )}
            {reply.isMine ? (
              <button
                type="button"
                onClick={onDelete}
                className="text-muted hover:text-red-300 transition"
              >
                {t.talkDeleteReply}
              </button>
            ) : (
              signedIn && (
                <button
                  type="button"
                  disabled={reported}
                  onClick={() => {
                    setReported(true);
                    onReport();
                  }}
                  className="text-muted hover:text-red-300 transition disabled:opacity-50"
                  lang={locale}
                >
                  {reported ? t.reportDone : t.reportLabel}
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
