"use client";

import { useState } from "react";
import {
  addReviewReply,
  addNewsReply,
  addTalkPost,
  deleteMyReply,
  deleteMyNewsReply,
  deleteMyTalkPost,
  reportReply,
  reportNewsReply,
  reportTalkPost,
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
 * ================= وخيطان لا واحد، والفرقُ قرارُ أحمد =================
 *
 * **الرأيُ والنشرةُ خيطٌ مسطّحٌ كتويتر**: ردٌّ على ردٍّ **لا يُزاح** بل
 * يحمل سطرَ «رداً على فلان» (`ReplyingTo`)، والترتيبُ زمنيٌّ واحد
 * فيُقرأ نزولاً — **لا يبحث القارئُ عن مكانه في شجرة.**
 *
 * **والنقاشُ شجرةٌ كـReddit** (D-257، طلبُ أحمد بنصّه: «طريقة النقاش
 * والردود ما ألغيها، تكون مثل Reddit لا مثل تويتر»). **ولماذا يختلفان
 * وهما ردود؟** لأن السؤالَ يختلف: تحت رأيٍ واحد **الردودُ كلُّها ردٌّ
 * على ذلك الرأي** فالتسطيحُ صادق؛ **وفي غرفةٍ بلا صاحبٍ تتفرّع الجُمَل
 * إلى أحاديثَ** — ومن سطّحها خلط ثلاثةَ حواراتٍ في عمود.
 *
 * **والإزاحةُ ثلاثُ درجاتٍ ثم تقف** — لا لأن القاعدة تمنع فحسب (حارسُ
 * العمق، الهجرة ٧٨)، **بل لأن كل درجةٍ تأكل من عرض الهاتف** والرابعةُ
 * تجعل الكلمةَ في السطر. **والخطُّ الرأسيُّ على الحافّة هو ما يقول
 * «هذه تتبع تلك»** — وهو خطُّ Reddit نفسُه.
 *
 * ================= وصندوقُ الكتابة صفٌّ لا زرّ =================
 *
 * وجهُك ثم «اكتب ردّك…» بعرض الصفّ، **بهيئة صفِّ الردّ نفسِه** — فما
 * ستكتبه يبدو حيث سيقع. **وهو سطرُ تويتر تحت المنشور حرفاً.**
 */
export type ReplyTarget =
  | { kind: "review"; reviewUserId: string; tmdbId: number; mediaType: "tv" | "movie" }
  | { kind: "post"; postKey: string }
  /**
   * **غرفةُ نقاشٍ** (D-257) — ولا `reviewUserId` لها: **الغرفةُ لا صاحبَ
   * لها**، ومرساتُها العملُ نفسُه. **والعنوانُ والملصقُ والغلافُ يُمرَّرون
   * ليُكتبوا مع الصفّ** (انظر `addTalkPost`).
   */
  | {
      kind: "talk";
      tmdbId: number;
      mediaType: "tv" | "movie";
      title?: string | null;
      posterPath?: string | null;
      backdropPath?: string | null;
    };

/** أقصى إزاحةٍ بصريّة — وحارسُ القاعدة يقف عندها أيضاً (الهجرة ٧٨) */
const MAX_DEPTH = 3;

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

  /** شجرةٌ أم عمود؟ **القرارُ من الهدف لا من وسيطٍ يمرّره المستدعي** */
  const nested = target.kind === "talk";

  /* **الشجرةُ تُبنى في تمريرةٍ واحدة** — والأبناءُ يرثون ترتيبَ `all`
     الزمنيّ، **فحديثٌ متفرّعٌ يُقرأ داخلَ فرعه بترتيب وقوعه.**
     **واليتيمُ جذر**: من حُذف أبوه محليّاً لا يختفي معه بلا أثر. */
  const byId = new Set(all.map((r) => r.replyId));
  const kids = new Map<string, ThreadReply[]>();
  const roots: ThreadReply[] = [];
  for (const r of all) {
    if (nested && r.parentId && byId.has(r.parentId)) {
      const list = kids.get(r.parentId);
      if (list) list.push(r);
      else kids.set(r.parentId, [r]);
    } else {
      roots.push(r);
    }
  }

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
            <Composer
              locale={locale}
              /* **والمفتاحُ حيث يُخزَّن وحدَه** (D-271): `has_spoiler`
                 عمودٌ على `title_posts` — **فلا يظهر على خيط رأيٍ ولا
                 نشرة**، وزرٌّ يُضغط بلا أثرٍ أسوأُ من زرٍّ غائب. */
              allowSpoiler={nested}
              onCancel={() => setOpen(null)}
              onSend={(b, sp) => send(b, null, sp)}
            />
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
              {/* **ودعوةُ الغرفة غيرُ دعوةِ الردّ**: هناك تردّ على سطرٍ
                  قِيل، **وهنا تبدأ حديثاً لم يبدأه أحد** (D-257) */}
              <span className="text-[15px] text-muted">
                {nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ===== الردود ===== */}
      {all.length === 0 ? (
        <p className="py-10 px-5 text-center text-sm text-muted leading-relaxed">
          {nested ? t.talkRoomEmpty : t.postNoReplies}
        </p>
      ) : (
        roots.map((r) => node(r, 0))
      )}
    </>
  );

  /**
   * صفٌّ واحدٌ ومن تحته — **ودالّةٌ واحدة للحالتين**: العمقُ صفرٌ دائماً
   * في المسطَّح، **فلا فرعَ ثانٍ في الرسم** (نفسُ درسِ D-242).
   */
  function node(r: ThreadReply, depth: number) {
    const kid = nested ? (kids.get(r.replyId) ?? []) : [];
    return (
      <div
        key={r.replyId}
        /* **الخطُّ الرأسيُّ على حافّة البداية** — هو ما يقول «تابعةٌ لما
           فوقها»، و`ps-3` تفصل النصَّ عنه. **ولا خطَّ للجذر**: خطٌّ بلا
           أبٍ يعد بشيءٍ فوقه وليس فوقه شيء. */
        className={depth > 0 ? "border-s border-[color:var(--divider)] ps-3" : undefined}
        style={depth > 0 ? { marginInlineStart: 20 } : undefined}
      >
        <ReplyItem
          reply={r}
          /* **و«ردّاً على فلان» للمسطَّح وحده**: في الشجرة الأبُ فوقها
             بعينه — **وسطرٌ يقول ما تراه العينُ يأكل سطراً بلا معنى.** */
          replyingToName={!nested && r.parentId ? (nameOf.get(r.parentId) ?? null) : null}
          locale={locale}
          signedIn={signedIn}
          /* **وحدُّ الردّ حدُّ القاعدة نفسُه** — فلا زرَّ يعد بما تمنعه */
          canReply={nested ? depth < MAX_DEPTH : !r.parentId}
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
              allowSpoiler={nested}
              onCancel={() => setOpen(null)}
              onSend={(b, sp) => send(b, r.replyId, sp)}
            />
          </div>
        )}
        {kid.map((c) => node(c, depth + 1))}
      </div>
    );
  }

  /** إرسالٌ تفاؤليّ — ثم مصالحةٌ بالمعرّف الحقيقيّ (D-241) */
  function send(body: string, parentId: string | null, hasSpoiler = false) {
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
        /* **والنسخةُ التفاؤلية تحمل العَلَم** (D-241): من أعلن الحرقَ
           يرى سطرَه محجوباً فوراً — **ولو ظهر مكشوفاً ثم انحجب بعد
           المصالحة لظنَّ أن الزرّ لم يعمل.** */
        hasSpoiler,
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
            : target.kind === "talk"
              ? await addTalkPost({
                  tmdbId: target.tmdbId,
                  mediaType: target.mediaType,
                  body,
                  parentId,
                  hasSpoiler,
                  title: target.title,
                  posterPath: target.posterPath,
                  backdropPath: target.backdropPath,
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
        } else if (target.kind === "talk") {
          await deleteMyTalkPost({
            postId: x.replyId,
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
      : target.kind === "talk"
        ? reportTalkPost({ postId: x.replyId })
        : reportNewsReply({ replyId: x.replyId }));
  }
}
