"use client";

import { useState } from "react";
import { addNewsReply, deleteMyNewsReply, reportNewsReply } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import type { NewsReply } from "@/lib/data";
import { tap } from "@/lib/haptics";
import { Composer } from "./Composer";
import { ReplyRow, TEMP } from "./ReplyRow";

/**
 * **خيطُ نشرةِ Loopz** (D-239) — الوجهُ القارئ لما كتبه D-236.
 *
 * ================= لماذا صفحةٌ ولم يكفِ الصندوقُ في الخطّ =================
 *
 * منذ D-236 يفتح 💬 صندوقَ كتابةٍ في مكانه (طلبُ أحمد)، **فصار الردُّ
 * يُكتب ولا يُقرأ**: يذهب إلى الجدول ولا سطحَ يعرضه. **وذاك ليس نقصاً
 * في ميزة، هو حوارٌ من طرفٍ واحد** — من ردَّ ظنَّ أن كلامه ذهب سُدى،
 * ومن قرأ النشرةَ لم يعرف أن تحتها كلاماً.
 *
 * **واختار أحمد الصفحةَ على التوسّع في الخطّ**، وهو الأصحّ لسببين لم
 * يُقالا وقتها: **خطٌّ يطول ويقصر تحت الإصبع يفقد موضعَه**، **ورابطُ
 * التوسّع لا يُشارَك** — والنشرةُ التي تحتها نقاشٌ تستحقّ عنواناً يُرسَل.
 *
 * ================= وهو `TalkThread` في السلوك لا في النسخ =================
 *
 * نفسُ العمقِ الواحد، ونفسُ التفاؤل، ونفسُ صفِّ الردّ — **`ReplyRow`
 * المشترَك** (خرج من `TalkThread` في هذه الدفعة نفسِها، ولم يُنسخ).
 * **والمختلفُ وجهةُ الكتابة وحدها**: مفتاحٌ نصّيٌّ لا ثلاثةُ حقول.
 *
 * ⚠️ **ولا `router.refresh()` بعد الإرسال**: الفعلُ يُبطل المسار على
 * الخادم، **وتحديثُ الصفحة تحت إصبع الكاتب يقفز به بعيداً عن سطره**
 * (نمط D-124).
 */
export function NewsThread({
  postKey,
  replies,
  locale,
  signedIn,
}: {
  postKey: string;
  replies: NewsReply[];
  locale: Locale;
  signedIn: boolean;
}) {
  const t = getDict(locale);
  const [added, setAdded] = useState<NewsReply[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  /** الخيطُ المفتوح للكتابة: `""` للنشرة نفسِها، أو معرّفُ ردٍّ يُردّ عليه */
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* **الحمولةُ تغلب النسخةَ المحلّية** (D-241) — نفسُ مصالحة `TalkThread`
     حرفاً: ما ظهر معرّفُه من الخادم تسقط نسختُه هنا، **فلا يظهر الردُّ
     مرّتين ولا يظهر أحدُهما بلا اسم.** */
  const fromServer = new Set(replies.map((r) => r.replyId));
  const all = [...replies, ...added.filter((a) => !fromServer.has(a.replyId))].filter(
    (r) => !removed.has(r.replyId),
  );
  const tops = all.filter((r) => !r.parentId);
  const kids = (id: string) => all.filter((r) => r.parentId === id);

  return (
    <section className="mt-5">
      <h2 className="text-sm font-bold mb-3">
        {t.postRepliesTitle}
        {all.length > 0 && (
          <span className="ms-2 text-muted font-normal tabular-nums">{all.length}</span>
        )}
      </h2>

      {error && (
        <p role="alert" className="mb-3 text-xs text-[color:var(--error)]">
          {error}
        </p>
      )}

      {/* **صندوقُ الكتابة في الأعلى لا في الأسفل**: من فتح صفحةَ نشرةٍ
          جاء ليقرأ أو ليكتب، **وصندوقٌ تحت ثلاثين ردّاً يُبحث عنه**.
          ولا يُعرض لغير المسجَّل — **ولا زرَّ يفتح بابَ تسجيل** (D-221):
          القراءةُ مفتوحة والكتابةُ للحساب. */}
      {signedIn &&
        (open === "" ? (
          <Composer
            locale={locale}
            onCancel={() => setOpen(null)}
            onSend={(body) => send(body, null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              tap(6);
              setOpen("");
            }}
            className="w-full text-start text-[13px] text-muted bg-surface border border-border rounded-2xl px-4 py-3 hover:border-accent transition"
          >
            {t.postReplyPlaceholder}
          </button>
        ))}

      {all.length === 0 ? (
        <p className="mt-4 text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center leading-relaxed">
          {t.postNoReplies}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {tops.map((r) => (
            <li key={r.replyId}>
              <ReplyRow
                reply={r}
                locale={locale}
                signedIn={signedIn}
                replying={open === r.replyId}
                onReply={() => {
                  tap(6);
                  setOpen(open === r.replyId ? null : r.replyId);
                }}
                onDelete={() => remove(r)}
                onReport={() => void reportNewsReply({ replyId: r.replyId })}
              />
              {open === r.replyId && (
                <Composer
                  locale={locale}
                  hint={t.talkReplyingTo(displayNameOf(r, t.anonymousUser))}
                  onCancel={() => setOpen(null)}
                  onSend={(body) => send(body, r.replyId)}
                />
              )}
              {kids(r.replyId).length > 0 && (
                <ul className="mt-3 space-y-3 border-s-2 border-[color:var(--divider)] ps-3">
                  {kids(r.replyId).map((k) => (
                    <li key={k.replyId}>
                      {/* **ولا زرَّ ردٍّ هنا**: القاعدةُ تمنع العمقَ الثالث
                          (حارسُ الهجرة ٧٣)، **وزرٌّ يفتح صندوقاً ترفضه
                          القاعدةُ أسوأ من غيابه** (D-217). */}
                      <ReplyRow
                        reply={k}
                        locale={locale}
                        signedIn={signedIn}
                        onDelete={() => remove(k)}
                        onReport={() => void reportNewsReply({ replyId: k.replyId })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  /** إرسالٌ تفاؤليّ — يظهر بمعرّفٍ مؤقّت ويُسحب إن فشل */
  function send(body: string, parentId: string | null) {
    const temp = `${TEMP}${parentId ?? ""}:${body.length}:${all.length}`;
    /* **بلا اسمٍ لجزءٍ من ثانية وحدها** (D-241): الاسمُ يعود مع الفعل
       نفسِه — **ولا اسمَ مخترعاً في هذه اللحظة.** */
    setAdded((a) => [
      ...a,
      {
        replyId: temp,
        authorId: "",
        nickname: null,
        username: null,
        avatar_url: null,
        hide_name: true,
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
        const real = await addNewsReply({ postKey, body, parentId });
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

  function remove(x: NewsReply) {
    setRemoved((s) => new Set(s).add(x.replyId));
    if (x.replyId.startsWith(TEMP)) return;
    void (async () => {
      try {
        await deleteMyNewsReply({ replyId: x.replyId });
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
}
