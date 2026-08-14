"use client";

import { useState } from "react";
import {
  addReviewReply,
  addNewsReply,
  deleteMyReply,
  deleteMyNewsReply,
  reportReply,
  reportNewsReply,
} from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import { tap } from "@/lib/haptics";
import { Avatar } from "../Avatar";
import { Composer } from "../Composer";
import { ReplyItem, TEMP, type ThreadReply } from "./ReplyItem";

/**
 * **خيطُ الردود — واحدٌ لكلِّ ما يُردّ عليه في Loopz** (D-242).
 *
 * ================= لماذا مكوّنٌ واحد بهدفَين =================
 *
 * كانا اثنين: `TalkThread` لرأي إنسان و`NewsThread` لنشرةٍ منّا،
 * **وكتبتُ يومها أن «ما تحتهما يفترق كلَّه»** (D-236). **وكان تبريراً
 * لا حجّة:** ما افترق **وجهةُ الكتابة وحدها** — أربعةُ أفعالٍ مقابل
 * أربعة، **وكلُّ ما فوقها واحد**: نفسُ الصفّ، ونفسُ التفاؤل، ونفسُ
 * المصالحة، ونفسُ حدِّ العمق. **ونسختان من منطقٍ واحد تفترقان عند أوّل
 * إصلاح** — وقد وقع: عيبُ «الردّ مرّتين» كان في الاثنين وأُصلح مرّتين.
 *
 * **فالهدفُ وسيطٌ لا عَلَم:** `target` يقول **إلى أين تُكتب**، ولا شيءَ
 * غيرَه يتفرّع. **وعَلَمٌ يقلب أربعةَ نداءات ليس عَلَماً، هو وسيط.**
 *
 * ================= والخيطُ مسطّحٌ كتويتر =================
 *
 * ردٌّ على ردٍّ **لا يُزاح** بل يحمل سطرَ «رداً على فلان» — انظر
 * `ReplyingTo`. **والترتيبُ زمنيٌّ واحد للجميع**، فيُقرأ الخيطُ نزولاً
 * كما يُقرأ في تويتر: **لا يبحث القارئُ عن مكانه في شجرة.**
 *
 * ================= وصندوقُ الكتابة صفٌّ لا زرّ =================
 *
 * وجهُك ثم «اكتب ردّك…» بعرض الصفّ، **بهيئة صفِّ الردّ نفسِه** — فما
 * ستكتبه يبدو حيث سيقع. **وهو سطرُ تويتر تحت المنشور حرفاً.**
 */
export type ReplyTarget =
  | { kind: "review"; reviewUserId: string; tmdbId: number; mediaType: "tv" | "movie" }
  | { kind: "post"; postKey: string };

export function ThreadReplies({
  target,
  replies,
  me,
  locale,
  signedIn,
}: {
  target: ReplyTarget;
  replies: ThreadReply[];
  /** وجهي واسمي — **لصفّ الكتابة وللنسخة التفاؤلية** (D-241) */
  me: { name: string; avatar: string | null } | null;
  locale: Locale;
  signedIn: boolean;
}) {
  const t = getDict(locale);
  const [added, setAdded] = useState<ThreadReply[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  /** الصندوقُ المفتوح: `""` للمنشور نفسِه، أو معرّفُ ردٍّ يُردّ عليه */
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* **الحمولةُ تغلب النسخةَ المحلّية** (D-241): ما ظهر معرّفُه من الخادم
     تسقط نسختُه هنا — فلا يظهر الردُّ مرّتين. */
  const fromServer = new Set(replies.map((r) => r.replyId));
  const all = [...replies, ...added.filter((a) => !fromServer.has(a.replyId))]
    .filter((r) => !removed.has(r.replyId))
    /* **ترتيبٌ زمنيٌّ واحدٌ للخيط كلِّه** — لا شجرة */
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const nameOf = new Map(all.map((r) => [r.replyId, displayNameOf(r, t.anonymousUser)]));

  return (
    <>
      {error && (
        <p role="alert" className="py-2 text-xs text-[color:var(--error)]">
          {error}
        </p>
      )}

      {/* ===== صفُّ الكتابة ===== */}
      {signedIn && (
        <div className="py-3 border-b border-[color:var(--divider)]">
          {open === "" ? (
            <Composer locale={locale} onCancel={() => setOpen(null)} onSend={(b) => send(b, null)} />
          ) : (
            <button
              type="button"
              onClick={() => {
                tap(6);
                setOpen("");
              }}
              className="w-full flex items-center gap-3 text-start"
            >
              <Avatar src={me?.avatar ?? null} name={me?.name ?? ""} size={40} alt="" className="shrink-0" />
              <span className="text-[15px] text-muted">{t.postReplyPlaceholder}</span>
            </button>
          )}
        </div>
      )}

      {/* ===== الردود ===== */}
      {all.length === 0 ? (
        <p className="py-10 px-5 text-center text-sm text-muted leading-relaxed">
          {t.postNoReplies}
        </p>
      ) : (
        all.map((r) => (
          <div key={r.replyId}>
            <ReplyItem
              reply={r}
              replyingToName={r.parentId ? (nameOf.get(r.parentId) ?? null) : null}
              locale={locale}
              signedIn={signedIn}
              /* **العمقُ الثاني لا يُردّ عليه** — حارسُ القاعدة يمنعه */
              canReply={!r.parentId}
              onReply={() => {
                tap(6);
                setOpen(open === r.replyId ? null : r.replyId);
              }}
              onDelete={() => remove(r)}
              onReport={() => report(r)}
            />
            {open === r.replyId && (
              <div className="pb-3 border-b border-[color:var(--divider)] ps-[52px]">
                <Composer
                  locale={locale}
                  hint={t.talkReplyingTo(nameOf.get(r.replyId) ?? "")}
                  onCancel={() => setOpen(null)}
                  onSend={(b) => send(b, r.replyId)}
                />
              </div>
            )}
          </div>
        ))
      )}
    </>
  );

  /** إرسالٌ تفاؤليّ — ثم مصالحةٌ بالمعرّف الحقيقيّ (D-241) */
  function send(body: string, parentId: string | null) {
    const temp = `${TEMP}${parentId ?? ""}:${body.length}:${all.length}`;
    setAdded((a) => [
      ...a,
      {
        replyId: temp,
        authorId: "",
        nickname: me?.name ?? null,
        username: null,
        avatar_url: me?.avatar ?? null,
        hide_name: !me,
        parentId,
        body,
        createdAt: new Date().toISOString(),
        isMine: true,
      },
    ]);
    setOpen(null);
    setError(null);
    void (async () => {
      try {
        const real =
          target.kind === "review"
            ? await addReviewReply({
                reviewUserId: target.reviewUserId,
                tmdbId: target.tmdbId,
                mediaType: target.mediaType,
                body,
                parentId,
              })
            : await addNewsReply({ postKey: target.postKey, body, parentId });
        if (real) {
          setAdded((a) =>
            a.map((x) =>
              x.replyId === temp
                ? {
                    ...x,
                    replyId: real.replyId,
                    createdAt: real.createdAt,
                    nickname: real.nickname,
                    username: real.username,
                    avatar_url: real.avatar_url,
                    hide_name: real.hide_name,
                  }
                : x,
            ),
          );
        }
      } catch (e) {
        setAdded((a) => a.filter((x) => x.replyId !== temp));
        setError((e as Error).message);
      }
    })();
  }

  function remove(x: ThreadReply) {
    setRemoved((s) => new Set(s).add(x.replyId));
    if (x.replyId.startsWith(TEMP)) return;
    void (async () => {
      try {
        if (target.kind === "review") {
          await deleteMyReply({
            replyId: x.replyId,
            tmdbId: target.tmdbId,
            mediaType: target.mediaType,
          });
        } else {
          await deleteMyNewsReply({ replyId: x.replyId });
        }
      } catch (e) {
        setRemoved((s) => {
          const n = new Set(s);
          n.delete(x.replyId);
          return n;
        });
        setError((e as Error).message);
      }
    })();
  }

  function report(x: ThreadReply) {
    void (target.kind === "review"
      ? reportReply({ replyId: x.replyId })
      : reportNewsReply({ replyId: x.replyId }));
  }
}
