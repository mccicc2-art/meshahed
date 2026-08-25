"use client";

import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpoilerText } from "./SpoilerText";
import { reportListReview } from "@/lib/actions";
import { ListReviewForm } from "./ListReviewForm";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, num, type Locale } from "@/lib/i18n";
import { LikeButton } from "./LikeButton";
import { ThreadReplies } from "./thread/ThreadReplies";
import type { ListReviewRow, ListReviewSocial, ReviewReply } from "@/lib/data";
import { actionTailItem } from "./ui/controls";

/**
 * **تقييمُ قائمةٍ ومراجعتُها** (D-327، طلبُ أحمد: «نفّذ المراجعات وتقييم
 * الليستات»).
 *
 * ================= مكوّنٌ واحدٌ لا سطحٌ جديد =================
 *
 * **ولا وصفةَ بصريّةً جديدة هنا**: الرقائقُ عائلةُ التحكّم الثانية
 * (D-016)، والحاجبُ `SpoilerText` نفسُه (D-315)، والوجهُ `Avatar`،
 * والزرُّ من مصنع `Button`. **وأيُّ عائلةٍ ثالثةٍ في سطحٍ رابع هي كيف
 * يتفكّك النظام** (D-002).
 *
 * ================= السلّمُ عشرةٌ كسلّم الأعمال =================
 *
 * **عملٌ يُقيَّم من عشرة وقائمةٌ من خمسة تُعلّم القارئَ سلّمين** — فالسلّم
 * واحد، **والرقائقُ عشرٌ تُختار منها واحدة** (سؤالٌ مغلقٌ من مجموعةٍ
 * معلومة).
 *
 * ================= والحالةُ تفاؤليّةٌ بحدّها =================
 *
 * **الحفظُ يكتب ثم يُبطل مسارَ الصفحة** (`revalidatePath` في الفعل) —
 * **ولا نرسم رأياً في الخطّ قبل أن يصل**: خطُّ الآراء يقرؤه غيرُك،
 * **ونسخةٌ تفاؤليّةٌ في سطحٍ عامٍّ تكذب على قارئٍ ثانٍ** (D-241 بحدّه).
 * الصندوقُ وحدَه يتفاءل: زرُّه يُقفل وتظهر رسالةُ النجاح.
 *
 * ⚠️ **وصاحبُ القائمة لا يُقيّمها**: القاعدةُ ترفضه في `with check`،
 * **والواجهةُ تقول له لماذا بدل أن تعرض له زرّاً يفشل** (D-217).
 *
 * ================= 🔴 وكلامُ الناس كان لا يُرسم لأحد (D-371) =================
 *
 * **مقيسٌ في المستودع لا مستنتَج**: الفروعُ كانت `isOwner ? سطرٌ :
 * canReview ? صندوقٌ : قائمةُ الآراء`، **والصفحةُ تمرّر
 * `canReview={!isOwner}`** — **فالفرعُ الثالث لا يبلغه أحد**: صاحبُها يرى
 * سطراً، وغيرُه يرى صندوقَه وحدَه، والزائرُ بلا حساب لا يبلغ الصفحة أصلاً
 * (فرعٌ سابقٌ في `page.tsx`). **فكان تبويبُ التقييمات يعرض عليك أن تكتب
 * ولا يريك أحداً كتب** — **وسطحٌ اجتماعيٌّ لا يُظهر كلامَ الناس ليس
 * اجتماعيّاً**، وهو أوّلُ ما يُصلَح قبل أن يُبنى فوقه قلبٌ وردّ.
 * **والعلاجُ أن يجتمعا**: صندوقي أوّلاً ثم كلامُهم — **الفعلُ فوق
 * والقراءةُ تحته** كصفحة العمل حرفاً.
 *
 * ================= والقلبُ والردُّ (D-370 · الهجرة ١١٣) =================
 *
 * **ولا عائلةَ جديدة**: القلبُ `LikeButton` بوجهةٍ رابعة، **والخيطُ
 * `ThreadReplies` بهدفٍ رابع** — **وخيطٌ واحدٌ مفتوحٌ في الشاشة** لا
 * صندوقٌ تحت كلِّ رأي (علّةُ D-242: عشرةُ أبوابٍ مفتوحةٍ في صفحةٍ سؤالُها
 * «ماذا قالوا؟»).
 */
export function ListReviews({
  listId,
  locale,
  isOwner,
  canReview,
  reviews,
  mine,
  stats,
  meId = "",
  me = null,
  social,
  replies,
}: {
  listId: string;
  locale: Locale;
  /** القائمةُ لي؟ — فلا صندوقَ، وسطرٌ يقول السبب */
  isOwner: boolean;
  /** قائمةٌ معلنةٌ ولستُ صاحبَها ولي حساب */
  canReview: boolean;
  reviews: ListReviewRow[];
  mine: { rating: number; body: string | null; hasSpoiler: boolean } | null;
  stats: { avg: number | null; count: number };
  /** أنا — **لئلّا يُرسم قلبٌ على رأيي أنا** (القاعدة تمنعه أصلاً) */
  meId?: string;
  /** وجهي واسمي — للنسخة التفاؤلية في الخيط (D-241) */
  me?: { name: string; avatar: string | null } | null;
  /**
   * 🆕 **قلوبُ الآراء وعددُ ردودها** (D-370) — بمفتاح `listId|userId`.
   *
   * **واختياريّةٌ لسببِ النشر لا للتجميل**: الرفعُ يقع مجلّداً مجلّداً
   * **وكلُّ رفعةٍ تُبنى وحدَها** (`19_Tools_And_Access`) — فخاصّيةٌ
   * إلزاميةٌ هنا تكسر البناءَ في اللحظة بين رفعة `components` ورفعة
   * `app`. **وغيابُها يعني «لا قلوبَ بعد» لا «تعذّرت القراءة»**: القارئُ
   * يُرجع خريطةً فارغةً عند الفشل أصلاً، فالحالتان تُرسمان سواءً (D-063).
   */
  social?: Map<string, ListReviewSocial>;
  /** 🆕 ردودُ آراء القائمة كلِّها — **وتُرشَّح في الذاكرة لكلِّ رأي** */
  replies?: ReviewReply[];
}) {
  const t = getDict(locale);
  const [reported, setReported] = useState<ReadonlySet<string>>(new Set());
  /** الخيطُ المفتوح — **واحدٌ لا غير** (علّةُ D-242) */
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [, start] = useTransition();

  function report(userId: string) {
    tap(8);
    setReported((prev) => new Set(prev).add(userId));
    start(async () => {
      try {
        await reportListReview({ listId, reviewUserId: userId });
        toast(t.listReviewReported, { tone: "info" });
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    /* **صار القسمُ لوحَ تبويبٍ** (D-333) — فسقطت مرساةُ D-332 وهامشُ
       القاع: لوحُ `DetailTabs` يعطي المسافةَ، **ومرساةٌ إلى لوحٍ مخفيٍّ
       رابطٌ ميّت** */
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon name="star" size={18} className="text-accent shrink-0" />
        <h2 className="text-15 font-bold">{t.listReviewsTitle}</h2>
        {/* **الرقمُ يجاور صاحبَه، والمقامُ معه** (D-216/D-219) — ولا يُرسم
            متوسّطٌ بلا رأيٍ واحد: **صفرٌ يُقرأ حكماً لا فراغاً.** */}
        {stats.count > 0 && stats.avg !== null && (
          <span className="ms-auto flex items-center gap-1.5 text-12 font-bold tabular-nums">
            <span dir="ltr">★ {num(stats.avg, locale)}</span>
            <span className="text-muted font-medium">
              {t.listReviewCount(num(stats.count, locale))}
            </span>
          </span>
        )}
      </div>

      {isOwner ? (
        <p className="text-12 text-muted">{t.listReviewOwn}</p>
      ) : canReview ? (
        /* 🔧 **الصندوقُ خرج مكوّناً عند قارئه الثاني** (D-352):
            النجمةُ على بطاقة القائمة تفتحه ورقةً، **ونسخُه كان سيعني
            سلّمين يفترقان يوماً** (القاعدة ٦). */
        <div className="rounded-card border border-border bg-surface p-4">
          <ListReviewForm listId={listId} locale={locale} mine={mine} />
        </div>
      ) : null}

      {/* 🔴 **وكلامُ الناس يُرسم دائماً** (D-371) — لا في فرعٍ لا يبلغه
          أحد. **ورأيي أنا يبقى في الخطّ** كما هو في صفحة العمل: من كتب
          يرى كلامَه حيث يراه الناس (D-251). */}
      {reviews.length > 0 && (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const s = social?.get(`${listId}|${r.userId}`);
            const isMine = !!meId && meId === r.userId;
            const mineReplies = (replies ?? []).filter((x) => x.reviewUserId === r.userId);
            const open = openThread === r.userId;
            return (
            <li key={r.userId} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <Avatar src={r.avatarUrl} name={r.nickname ?? r.username ?? ""} size={28} />
                {/* **ومخفي الاسم بلا بديل** — الغيابُ أصدق (D-011) */}
                <span className="text-14 font-semibold truncate">
                  {r.hideName ? "" : (r.nickname ?? r.username ?? "")}
                </span>
                <span className="ms-auto text-14 font-bold tabular-nums" dir="ltr">
                  ★ {num(r.rating, locale)}
                </span>
              </div>
              {r.body && (
                <div className="fs-content mt-2 text-15 leading-relaxed">
                  {r.hasSpoiler ? (
                    <SpoilerText text={r.body} locale={locale} note={t.listReviewSpoilerNote} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{r.body}</p>
                  )}
                </div>
              )}

              {/* 🆕 **الذيل: قلبٌ ثم ردٌّ ثم بلاغ** (D-370) — **وشكلُه شكلُ
                  ذيل `TalkThread` حرفاً** (D-234): إزاحةُ `-mx-0.5`
                  والصفرُ لا يُرسم (D-222). **والبلاغُ آخرَه** لأنه أندرُ
                  الثلاثة فعلاً. */}
              <div className="mt-2 -mx-0.5 flex items-center gap-1">
                <LikeButton
                  target="listReview"
                  reviewUserId={r.userId}
                  listId={listId}
                  likes={s?.likes ?? 0}
                  likedByMe={s?.likedByMe ?? false}
                  isMine={isMine}
                  locale={locale}
                />
                {/* **زرٌّ لا رابط**: الخيطُ يُفتح تحت الرأي نفسِه — **ولا
                    صفحةَ لمراجعة قائمة** (D-334: بابٌ واحدٌ للقائمة). */}
                <button
                  type="button"
                  aria-expanded={open}
                  aria-label={t.talkReply}
                  title={t.talkReply}
                  onClick={() => {
                    tap(8);
                    setOpenThread(open ? null : r.userId);
                  }}
                  className={actionTailItem(open)}
                >
                  <Icon name="comment" size={15} />
                  <span>{t.talkReply}</span>
                  {(s?.replies ?? mineReplies.length) > 0 && (
                    <span className="tabular-nums">
                      {num(s?.replies ?? mineReplies.length, locale)}
                    </span>
                  )}
                </button>
                {/* **بابُ البلاغ على كلِّ رأي** (D-193) — ويُقفل بعد الضغط
                    فلا يُبلَّغ مرّتين، **والقاعدةُ تمنع الثاني بمفتاحها.**
                    ⚠️ **ولا يُرسم على رأيي أنا** — **زرُّ بلاغٍ على كلامك
                    أنت عبثٌ يُقرأ عطلاً** (نصُّ صفحة التعليق). */}
                {!isMine && (
                  <button
                    type="button"
                    disabled={reported.has(r.userId)}
                    onClick={() => report(r.userId)}
                    className="ms-auto text-12 text-muted hover:text-foreground disabled:opacity-50"
                  >
                    {reported.has(r.userId) ? t.listReviewReported : t.listReviewReport}
                  </button>
                )}
              </div>

              {/* **والخيطُ داخل الصفّ لا تحته**: ما يُردّ عليه فوق ما
                  يُكتب — **ومن فتح خيطاً أغلق ما قبله** فلا صندوقان. */}
              {open && (
                <div className="mt-3 border-t border-[color:var(--divider)] pt-2">
                  <ThreadReplies
                    target={{ kind: "listReview", reviewUserId: r.userId, listId }}
                    replies={mineReplies.map((x) => ({
                      replyId: x.replyId,
                      authorId: x.id,
                      nickname: x.nickname,
                      username: x.username,
                      avatar_url: x.avatar_url,
                      hide_name: x.hide_name,
                      parentId: x.parentId,
                      body: x.body,
                      createdAt: x.createdAt,
                      isMine: x.isMine,
                    }))}
                    me={me}
                    locale={locale}
                    signedIn
                  />
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
