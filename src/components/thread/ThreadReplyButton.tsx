"use client";

import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import { Icon } from "../Icon";
import { actionTailItem } from "../ui/controls";
import { THREAD_WRITE_EVENT } from "./ThreadShell";

/**
 * 🆕 T544 — **زرُّ الردود في شريط أفعال المراجعة والنشرة** (أحمد ٢٥ نوفمبر: «نفس الترتيب هنا»): ثاني خانةٍ كما في بطاقة
 * المجتمع، ومعه عددُ الردود. يفتح صندوقَ الكتابة الذي يفتحه القلمُ العائم — الحالةُ في `ThreadReplies`، فالنداءُ حدثٌ لا prop.
 * والزائرُ يقرأ العددَ ولا يضغطه (D-221): الكتابةُ للمسجَّلين وحدهم.
 */
export function ThreadReplyButton({ count, signedIn, locale }: { count: number; signedIn: boolean; locale: Locale }) {
  const t = getDict(locale);
  return (
    <button
      type="button"
      disabled={!signedIn}
      onClick={() => {
        tap(6);
        window.dispatchEvent(new Event(THREAD_WRITE_EVENT));
      }}
      aria-label={count > 0 ? `${t.actionComment}: ${count}` : t.actionComment}
      title={t.actionComment}
      className={actionTailItem(false, "disabled:hover:text-muted")}
    >
      <Icon name="comment" size={15} />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
