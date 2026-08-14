"use client";

import { useMemo, useState } from "react";
import { addReviewReply, deleteMyReply, reportReply } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import type { ReviewReply, TitleReview } from "@/lib/data";
import { tap } from "@/lib/haptics";
import { Composer } from "./Composer";
import { Icon } from "./Icon";
import { timeAgo } from "@/lib/when";
import { dirOf } from "@/lib/dir";
import { ReplyRow, TEMP } from "./ReplyRow";
import { PersonName } from "./PersonRow";
import { LikeButton } from "./LikeButton";
import { ReportButton } from "./ReportButton";

/**
 * **خيطُ الكلام عن عمل** (D-193، طلب أحمد: «إذا ضغطت على الفيلم أبغى صفحة
 * تعليقات فقط كأني فاتح مجتمع، لكن فيه كل التعليقات الي في صفحة الفيلم
 * **ومربوطين ببعض**»).
 *
 * **و«مربوطين ببعض» هي كلُّ الفرق بين هذه الصفحة وتبويب الآراء:** هناك
 * الآراءُ قائمةٌ متجاورة — عشرةُ أشخاصٍ يتكلّمون في الهواء ولا أحد يجيب.
 * هنا **لكل رأيٍ خيطُه**: تردّ على صاحبه، ويردّ عليك، فيصير الرأيُ حواراً.
 *
 * ================= أربعةُ قرارات في الرسم =================
 *
 * **١ · «أردّ على نفس الشخص أو أعلّق على الفيلم»** (نصُّه) — فعلان لا
 * واحد، وقد فُصلا في الواجهة كما فُصلا في القاعدة: زرُّ «ردّ» تحت كل رأي،
 * **و«قل رأيك في العمل» صندوقُ التقييم نفسُه** (`RatingBox variant="review"`
 * في الصفحة، لا نسخةٌ ثانية منه هنا — قاعدة ٦). فالتعليقُ على العمل
 * تقييمٌ ورأي، ومن كتب رأيه صار له خيطٌ يردّ عليه الناس.
 *
 * **٢ · عمقٌ واحد، والردُّ على ردٍّ يُعلّق باسم صاحبه.** القاعدة تمنع
 * العمقَ الثالث (`review_replies_depth_guard`)، فالواجهةُ لا تعرض زرَّ
 * ردٍّ على ردّ **بل زرَّ «ردّ» واحداً يذكر لمن**: تضغطه على ردٍّ فيُرسل
 * `parentId`، وتضغطه على الرأي فيُرسل `null`. **حدٌّ واحد في مكانين لا
 * قاعدتان.**
 *
 * **٣ · تفاؤليٌّ كبقية الأفعال.** الردُّ يظهر قبل جواب الخادم بمعرّفٍ
 * مؤقّت، ويُسحب إن فشلت الكتابة. **ولا `router.refresh()`:** الفعل
 * يُبطل الصفحتين على الخادم، فأوّلُ تنقّلٍ طبيعي يقرأ الحقيقة — وتحديثُ
 * الصفحة تحت إصبع الكاتب يقفز به بعيداً عن سطره.
 *
 * **٤ · الإعجابُ والبلاغُ على الرأي من مكوّنيهما القائمين** (`LikeButton`
 * · `ReportButton`) — نفسُ الرقم في صفحة العمل وهنا، لأنه نفسُ الجدول.
 * وللردّ بلاغُه الخاصّ (`reportReply`) صامتاً بلا عدّاد، كالرأي.
 */
export function TalkThread({
  reviews,
  replies,
  tmdbId,
  mediaType,
  locale,
  signedIn,
}: {
  reviews: TitleReview[];
  replies: ReviewReply[];
  tmdbId: number;
  mediaType: "tv" | "movie";
  locale: Locale;
  signedIn: boolean;
}) {
  const t = getDict(locale);
  const [added, setAdded] = useState<ReviewReply[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  /** الخيطُ المفتوح للكتابة: `reviewUserId` أو `reviewUserId|parentId` */
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * **الحمولةُ تغلب النسخةَ المحلّية** (D-241، بلاغُ أحمد: «إذا كتبت ردّ
   * يظهر مرّتين، بتواجد منهم Someone»).
   *
   * **والعلّةُ كانت في «متى تُحذف النسخة» لا في إضافتها:** كانت تُحذف
   * **عند الفشل وحده**. والكتابةُ الناجحة تُبطل المسار، **فيعيد الخادمُ
   * الردَّ الحقيقيَّ والنسخةُ المؤقّتة باقية** — فيراهما القارئ اثنين،
   * وأحدُهما بلا اسم لأنه لم يكن يحمل ملفّاً.
   *
   * **فالمصالحةُ بالمعرّف لا بالنصّ:** الفعلُ يعيد معرّفَ الردّ (D-241)،
   * **فما ظهر معرّفُه في حمولة الخادم تسقط نسختُه المحلّية.** وردّان
   * بنصٍّ واحد يبقيان اثنين كما كتبهما صاحبُهما — **والمطابقةُ بالنصّ كانت
   * ستبتلع أحدَهما.**
   */
  const all = useMemo(() => {
    const fromServer = new Set(replies.map((r) => r.replyId));
    return [...replies, ...added.filter((a) => !fromServer.has(a.replyId))].filter(
      (r) => !removed.has(r.replyId),
    );
  }, [replies, added, removed]);

  /* الردودُ مفهرسةٌ بصاحب الرأي مرّةً واحدة: الرسمُ يمرّ على الآراء،
     ولو بحث كلُّ رأيٍ في المصفوفة كلّها صار العملُ حاصلَ ضرب */
  const byReview = useMemo(() => {
    const m = new Map<string, ReviewReply[]>();
    for (const r of all) {
      const arr = m.get(r.reviewUserId);
      if (arr) arr.push(r);
      else m.set(r.reviewUserId, [r]);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return m;
  }, [all]);

  /* الرأيُ يظهر إن كان مكتوباً — **أو إن كان له ردود**: خيطٌ برأسٍ محذوف
     النصِّ يقرأ كحوارٍ مع فراغ، فيُعرض رأسُه ولو كان تقييماً مجرّداً */
  const shown = reviews.filter((r) => r.review?.trim() || byReview.has(r.id));

  if (!shown.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <p className="text-2xl mb-2" aria-hidden>
          💬
        </p>
        <p className="text-sm text-muted leading-relaxed">{t.noReviews}</p>
      </div>
    );
  }

  return (
    /* **صفوفٌ مفصولةٌ بخطّ لا بطاقاتٌ مؤطَّرة** (D-217، طلب أحمد: «الردود
       بدون إطارات تكون مثل كذا بالمحادثة… شكلها قريب تويتر، ناعم واحترافي»).
       **والإطارُ كان يقول شيئاً غيرَ صحيح:** بطاقةٌ محاطة تُقرأ **غرضاً
       مستقلّاً**، والآراءُ هنا **أدوارُ حديثٍ واحد**. **والخطُّ الفاصل يفصل
       بلا أن يعزل** — وهو شكلُ صفّ «الأعمال» نفسُه (`WorksTalk`)، **فسطحان
       بشكلٍ واحد لا شكلين.**

       ⚠️ **وهذا يغيّر سطحين لا سطحاً:** `CommunityReviews` (تبويب الآراء في
       صفحة العمل) يرسم بهذا المكوّن نفسِه منذ D-193. **وهو الصواب لا أثرٌ
       جانبيّ:** الرأيُ الواحد لا يُقرأ بشكلين في التطبيق. */
    <div className="divide-y divide-[color:var(--divider)]">
      {error && (
        <p role="alert" className="text-xs text-[color:var(--error)]">
          {error}
        </p>
      )}
      {shown.map((r) => {
        const thread = byReview.get(r.id) ?? [];
        const tops = thread.filter((x) => !x.parentId);
        const kids = (id: string) => thread.filter((x) => x.parentId === id);
        return (
          <article key={r.id} id={`review-${r.id}`} className="py-4 first:pt-0">
            <div className="flex items-center justify-between gap-3 mb-2">
              <PersonName person={r} t={t} size={32} sub={timeAgo(r.updated_at, t)} />
              {/* **النجمةُ نصٌّ لا شارةٌ مؤطَّرة**: الإطارُ الصغير داخل صفٍّ
                  بلا إطارٍ يعود بالضجيج الذي أُزيل من حوله */}
              {/* **وشكلُ الرقم واحدٌ في السطحين** (D-241): كان «10/10» هنا
                  و«10.0» في خطّ النشاط — **رقمٌ واحد بشكلين يجعل القارئ
                  يتساءل إن كانا مقياسين.** والمقامُ محذوفٌ لأن المقياسَ
                  ثابتٌ في التطبيق كلِّه، **والمقامُ يُكتب حيث يتغيّر
                  (متوسّطُ الجماعة وعددُه) لا حيث يثبت.** */}
              <span
                className="text-[13px] shrink-0 font-bold text-accent tabular-nums"
                title={t.rateOutOf(r.rating)}
              >
                ★ <span dir="ltr">{r.rating.toFixed(1)}</span>
              </span>
            </div>

            {/* **اتّجاهُ الرأي من الرأي** (D-241، وهو ما رآه أحمد في لقطته):
                كان بلا `dir` إطلاقاً، **فيرث اتّجاهَ الواجهة** — ورأيٌ
                عربيٌّ في واجهةٍ إنجليزية تنحلّ أسطرُه كلٌّ على حدة، فيصطفّ
                سطران يميناً وثالثٌ يساراً. **وهي العلّةُ نفسُها التي
                أُصلحت في خطّ النشاط (D-228) ولم تُصلَح هنا** — والقاعدة:
                إصلاحُ سلوكٍ في سطحٍ يُطبَّق على كلِّ سطحٍ يعرضه.

                **ولونُه لون المتن لا لون الحاشية**: كان `text-muted` —
                **وأخفتُ نصٍّ في صفحةٍ لا يصحّ أن يكون سببَ وجودها.** */}
            {r.review?.trim() && (
              <p
                dir={dirOf(r.review)}
                className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line"
              >
                {r.review}
              </p>
            )}

            {/* **ولا خطَّ فاصلٍ فوق شريط الأفعال**: الصفُّ كلُّه بلا إطار،
                فخطٌّ داخله يرسم بطاقةً من جديد */}
            {/* **وشريطُ الأفعال بهندسة خطّ النشاط** (D-241، وهو حكمُ أحمد
                هناك: «خلّه متوازن مع صورة الشخص… ليه الفوضى هذي في كل مكان
                وشكلٌ مختلف!»). **كان مكوَّماً في البداية والبلاغُ منفيّاً
                إلى النهاية**، فيبدو الشريطُ نصفَ ممتلئ. **موزَّعٌ الآن
                بـ`justify-between` وبإزاحة `-mx-0.5` نفسِها** — فأوّلُ رمزٍ
                يقف على حافّة الصفّ كما يقف في الخطّ. */}
            <div className="mt-2.5 -mx-0.5 flex items-center justify-between">
              <LikeButton
                reviewUserId={r.id}
                tmdbId={tmdbId}
                mediaType={mediaType}
                likes={r.likes}
                likedByMe={r.likedByMe}
                isMine={r.isMine}
                /* **الزائرُ يقرأ الرقم ولا يضغطه** (D-221): زرٌّ يفشل عند
                   أوّل لمسةٍ أسوأُ من رقمٍ ساكن */
                readOnly={!signedIn}
                locale={locale}
              />
              {/* **وكذلك خانةُ الردّ**: الزائرُ يقرأ ولا يردّ (D-221)،
                  **وشريطُه يجب أن يحاذي شريطَ المسجَّل** لأن القائمةَ
                  واحدة وتُقرأ بالمَسح. */}
              {signedIn ? (
                <ReplyToggle
                  label={t.talkReply}
                  active={open === r.id}
                  onClick={() => {
                    tap(6);
                    setOpen(open === r.id ? null : r.id);
                  }}
                />
              ) : (
                <span aria-hidden className="w-8 h-8" />
              )}
              {/* **والبلاغُ فعلٌ يحتاج صاحباً** (D-221): بلاغٌ بلا هويّةٍ
                  لا يُقبل في القاعدة أصلاً، فزرُّه للزائر وعدٌ كاذب.

                  ⚠️ **وخانتُه تُحجَز وإن لم يُرسم** (D-234 حرفاً): شريطٌ
                  موزَّعٌ بعنصرين وحدهما **يقذفهما إلى الطرفين** — وهو
                  بعينه ما رفضه أحمد في الخطّ («راحت يسار بزيادة»). **رأيي
                  أنا لا يُبلَّغ عنه، فلو سقطت الخانةُ لاختلف شريطُ صفّي عن
                  شريط جاري في القائمة نفسِها.** */}
              {signedIn && !r.isMine ? (
                <ReportButton
                  reviewUserId={r.id}
                  tmdbId={tmdbId}
                  mediaType={mediaType}
                  locale={locale}
                />
              ) : (
                <span aria-hidden className="w-8 h-8" />
              )}
            </div>

            {open === r.id && (
              <Composer
                locale={locale}
                onCancel={() => setOpen(null)}
                onSend={(body) =>
                  send({ reviewUserId: r.id, parentId: null, body, person: null })
                }
              />
            )}

            {/* الردود — إزاحةٌ واحدة للخيط، وإزاحةٌ ثانية للردّ على ردّ.
                ولا خطَّ رأسيّ ثالث: العمقُ محدودٌ باثنين في القاعدة */}
            {tops.length > 0 && (
              <ul className="mt-3 space-y-3 border-s-2 border-[color:var(--divider)] ps-3">
                {tops.map((x) => (
                  <li key={x.replyId}>
                    <ReplyRow
                      reply={x}
                      locale={locale}
                      signedIn={signedIn}
                      onReply={() => {
                        tap(6);
                        const k = `${r.id}|${x.replyId}`;
                        setOpen(open === k ? null : k);
                      }}
                      replying={open === `${r.id}|${x.replyId}`}
                      onDelete={() => remove(x)}
                      onReport={() => void reportReply({ replyId: x.replyId })}
                    />
                    {open === `${r.id}|${x.replyId}` && (
                      <Composer
                        locale={locale}
                        hint={t.talkReplyingTo(displayNameOf(x, t.anonymousUser))}
                        onCancel={() => setOpen(null)}
                        onSend={(body) =>
                          send({
                            reviewUserId: r.id,
                            parentId: x.replyId,
                            body,
                            person: x,
                          })
                        }
                      />
                    )}
                    {kids(x.replyId).length > 0 && (
                      <ul className="mt-3 space-y-3 border-s-2 border-[color:var(--divider)] ps-3">
                        {kids(x.replyId).map((k) => (
                          <li key={k.replyId}>
                            <ReplyRow
                              reply={k}
                              locale={locale}
                              signedIn={signedIn}
                              onDelete={() => remove(k)}
                              onReport={() => void reportReply({ replyId: k.replyId })}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );

  /** إرسالُ ردّ — تفاؤليّ: يظهر بمعرّفٍ مؤقّت ويُسحب إن فشل */
  function send(input: {
    reviewUserId: string;
    parentId: string | null;
    body: string;
    person: ReviewReply | null;
  }) {
    const temp = `${TEMP}${input.reviewUserId}:${input.parentId ?? ""}:${input.body.length}`;
    /* **ويُرسم بلا اسمٍ لجزءٍ من ثانية وحدها** (D-241): الاسمُ والصورةُ
       يعودان مع الفعل نفسِه، **فلا يستقرّ «Someone» في الشاشة.** ولا
       اسمَ مخترعاً في هذه اللحظة — **الفراغُ أصدقُ من التخمين.** */
    setAdded((a) => [
      ...a,
      {
        id: "",
        nickname: null,
        username: null,
        avatar_url: null,
        hide_name: true,
        replyId: temp,
        reviewUserId: input.reviewUserId,
        parentId: input.parentId,
        body: input.body,
        createdAt: new Date().toISOString(),
        isMine: true,
      },
    ]);
    setOpen(null);
    setError(null);
    void (async () => {
      try {
        const real = await addReviewReply({
          reviewUserId: input.reviewUserId,
          tmdbId,
          mediaType,
          body: input.body,
          parentId: input.parentId,
        });
        /* **النسخةُ تلبس هويّتَها الحقيقية فور وصولها** — معرّفاً واسماً
           وصورة. **ولا نحذفها هنا وننتظر الخادم**: بينهما لحظةٌ يختفي
           فيها كلامُ الكاتب من تحت إصبعه، **والوميضُ يُقرأ فشلاً.** */
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

  function remove(x: ReviewReply) {
    setRemoved((s) => new Set(s).add(x.replyId));
    if (x.replyId.startsWith(TEMP)) return;
    void (async () => {
      try {
        await deleteMyReply({ replyId: x.replyId, tmdbId, mediaType });
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

/** زرُّ «ردّ» — نفسُ صوت `LikeButton`: نصٌّ صغير ورمزٌ، لا زرٌّ ممتلئ */
function ReplyToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-2.5 py-1 transition ${
        active ? "text-accent bg-accent/10" : "text-muted hover:text-foreground"
      }`}
    >
      <Icon name="comment" size={14} />
      {label}
    </button>
  );
}
