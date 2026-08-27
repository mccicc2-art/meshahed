"use client";

import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { SpoilerText } from "./SpoilerText";
import { reportListReview, saveListReview, deleteListReview } from "@/lib/actions";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { ListReviewForm, StarRatingRow } from "./ListReviewForm";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, num, type Locale } from "@/lib/i18n";
import { timeAgoShort } from "@/lib/when";
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
  /* 🆕 **صندوقُ الكتابة يبدأ سطراً** (D-681، لقطتُه: «Write a review…»
     حقلٌ واحدٌ بجوار وجهك) — **ويتّسع بضغطةٍ إلى النموذج القائم**:
     الرتبةُ والنصُّ والكاتبُ كما هم (`ListReviewForm`)، **والذي تبدّل
     بابُه.** ومن له رأيٌ قائمٌ يفتح على نموذجه (تعديل). */
  const [writing, setWriting] = useState(false);
  /* 🆕 **المُرسِلُ السريع** (D-694، حكمُه بلقطة: «حط النجوم فوق مكان
     الكتابة وحط علامة إرسال — أكتب داخل المربع بدال ما يكبر ويتحوّل
     الشكل القديم»): الرتبةُ نجومٌ فوق الحقل، والحقلُ حقلٌ حقيقيٌّ
     بزرّ إرسالٍ في طرفه — **ولا تحوّلَ إلى النموذج الكبير في الصفحة
     أبداً** (بقي لورقة النجمة على البطاقات — `ListRateStar`). */
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [busy, setBusy] = useState(false);
  /* 🆕 D-701 (حكمُه بلقطة ورقة العمل: «كتابة النص أبغاها تنفتح مثل كذا
     بحيث الواحد يكتب تعليق مرتّب وياخذ راحته»): الحقلُ صار باباً —
     الضغطةُ تفتح ورقةَ الكتابة الرحبة (`ListReviewForm` — ورقةُ
     `ListRateStar` نفسُها، لا نسخةً ثانية) والنجومُ المختارةُ تركب
     معها. والإرسالُ السريعُ باقٍ لرتبةٍ بلا كلام. */
  const [composeOpen, setComposeOpen] = useState(false);
  /* 🆕 **والقاعُ مطويٌّ بعد ثلاثة** (D-681): «عرض كل الآراء (N)» */
  const [showAll, setShowAll] = useState(false);
  /** الخيطُ المفتوح — **واحدٌ لا غير** (علّةُ D-242) */
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [, start] = useTransition();

  function submitQuick() {
    if (!rating || busy) return;
    tap([12, 30]);
    setBusy(true);
    start(async () => {
      try {
        /* **رايةُ الحرق تُحفَظ كما كانت** عند التعديل — المُرسِلُ السريع
           لا يملك مفتاحَها، وإسقاطُها صمتاً كذبٌ على من رفعها */
        /* **النصُّ القائمُ لا يُمسّ**: الإرسالُ السريعُ رتبةٌ — والكلامُ بابُه الورقة */
        await saveListReview({ listId, rating, body: mine?.body ?? "", hasSpoiler: mine?.hasSpoiler ?? false });
        toast(t.listReviewSave, { tone: "success" });
        setWriting(false);
      } catch (e) {
        flashError((e as Error).message);
      } finally {
        setBusy(false);
      }
    });
  }

  function removeQuick() {
    tap(8);
    setBusy(true);
    start(async () => {
      try {
        await deleteListReview(listId);
        setRating(0);
        setWriting(false);
      } catch (e) {
        flashError((e as Error).message);
      } finally {
        setBusy(false);
      }
    });
  }

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
      {/* ⚖️ 🆕 **العنوانُ «الآراء · N» بلا رمزٍ ولا متوسّط** (D-681):
          المتوسّطُ صعد إلى شريط الحال — **ورقمان لشيءٍ واحدٍ في شاشةٍ
          واحدة يفترقان** (D-219). */}
      <h2 className="text-17 font-bold">
        {t.listReviewsTitle}
        {stats.count > 0 && (
          <span className="text-muted font-medium"> · {num(stats.count, locale)}</span>
        )}
      </h2>

      {isOwner ? (
        <p className="text-12 text-muted">{t.listReviewOwn}</p>
      ) : canReview && (!mine || writing) ? (
        /* 🆕 D-694: صفُّ النجوم العشر فوق الحقل، والإرسالُ في طرفه —
           **السلّمُ عشرةٌ كسلّم الأعمال** (D-327) والنجومُ وجهُه السريع.
           ⚖️ **وهو وجهٌ ثانٍ لإدخال الرتبة بجانب رقائق الورقة** — نقضٌ
           محصورٌ لقاعدة العائلة الواحدة بحكم صاحبه، **ويُرصد للتوحيد.** */
        <div className="space-y-2">
          <StarRatingRow rating={rating} onPick={setRating} locale={locale} label={t.listReviewMine} />
          <div className="flex items-center gap-3">
            <Avatar src={me?.avatar ?? null} name={me?.name ?? ""} size={34} className="shrink-0" />
            <div className="flex-1 min-w-0 flex items-center gap-1 rounded-full border border-border bg-surface-2 ps-4 pe-1.5 py-1">
              {/* **بابٌ لا حقل** (D-701): الكتابةُ في ورقةٍ رحبةٍ لا في سطرٍ ضيّق */}
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  tap(6);
                  setComposeOpen(true);
                }}
                className={`flex-1 min-w-0 text-start truncate bg-transparent outline-none text-base py-1.5 ${mine?.body ? "" : "text-muted"}`}
              >
                {mine?.body?.trim() ? mine.body : t.reviewPlaceholder}
              </button>
              {mine && (
                <button
                  type="button"
                  aria-label={t.listReviewDelete}
                  title={t.listReviewDelete}
                  disabled={busy}
                  onClick={removeQuick}
                  className="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:text-[color:var(--error)]"
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
              <button
                type="button"
                aria-label={t.shareReplySend}
                title={t.shareReplySend}
                disabled={!rating || busy}
                onClick={submitQuick}
                className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-accent text-[color:var(--on-accent)] disabled:opacity-40 active:scale-95 transition"
              >
                <Icon name="send" size={16} className="rtl:-scale-x-100" />
              </button>
            </div>
          </div>

          {/* **ورقةُ الكتابة الرحبة** — ورقةُ `ListRateStar` نفسُها (D-018:
              حقلُ كتابةٍ فورقةٌ علويّةٌ لا يغطّيها الملاح)، **وتُركَّب عند
              فتحها** فتركب النجومُ المختارةُ الآن لا لقطةُ أوّل رسمة. */}
          {composeOpen && (
            <Sheet
              open
              variant="top"
              onClose={() => setComposeOpen(false)}
              closeLabel={t.closeLabel}
              labelledBy="list-quick-compose"
            >
              <SheetHeader
                id="list-quick-compose"
                title={t.listReviewMine}
                closeLabel={t.closeLabel}
                onClose={() => setComposeOpen(false)}
              />
              <div className="px-5 pb-5 pt-3">
                <ListReviewForm
                  listId={listId}
                  locale={locale}
                  mine={{
                    rating: rating || (mine?.rating ?? 0),
                    body: mine?.body ?? null,
                    hasSpoiler: mine?.hasSpoiler ?? false,
                  }}
                  onSaved={() => {
                    setComposeOpen(false);
                    setWriting(false);
                  }}
                />
              </div>
            </Sheet>
          )}
        </div>
      ) : null}

      {/* 🔴 **وكلامُ الناس يُرسم دائماً** (D-371) — لا في فرعٍ لا يبلغه
          أحد. **ورأيي أنا يبقى في الخطّ** كما هو في صفحة العمل: من كتب
          يرى كلامَه حيث يراه الناس (D-251). */}
      {reviews.length > 0 && (
        <ul className="space-y-5">
          {(showAll ? reviews : reviews.slice(0, 3)).map((r) => {
            const s = social?.get(`${listId}|${r.userId}`);
            const isMine = !!meId && meId === r.userId;
            const mineReplies = (replies ?? []).filter((x) => x.reviewUserId === r.userId);
            const open = openThread === r.userId;
            return (
            /* ⚖️ 🆕 **صفٌّ عارٍ بلا بطاقة** (D-681، لقطتُه): وجهٌ فاسمٌ
               فعمرٌ، والنصُّ تحتهم — **والرتبةُ باقيةٌ في الطرف**:
               آراؤنا تقييماتٌ قبل أن تكون كلاماً (فرقٌ مُعلَنٌ عن
               اللقطة، الرقمُ حقيقةٌ لا تُحذف للشكل — D-217). */
            <li key={r.userId} className="flex gap-3">
              <Avatar
                src={r.avatarUrl}
                name={r.nickname ?? r.username ?? ""}
                size={34}
                className="shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {/* **ومخفي الاسم بلا بديل** — الغيابُ أصدق (D-011) */}
                <span className="text-14 font-bold truncate">
                  {r.hideName ? "" : (r.nickname ?? r.username ?? "")}
                </span>
                <span className="text-12 text-muted shrink-0">
                  {timeAgoShort(r.updatedAt, t)}
                </span>
                <span className="ms-auto text-13 font-bold tabular-nums text-accent" dir="ltr">
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
                {isMine ? (
                  /* 🆕 **بابُ تعديل رأيي على صفّي** (D-683) — النموذجُ
                     فوق مطويٌّ، وهذا يوقظه. **في خانة البلاغ نفسِها**:
                     البلاغُ لا يُرسم على رأيي، فالطرفُ له. */
                  canReview && (
                    <button
                      type="button"
                      onClick={() => {
                        tap(6);
                        setWriting(true);
                      }}
                      className="ms-auto flex items-center gap-1 text-12 text-muted hover:text-foreground"
                    >
                      <Icon name="edit" size={13} />
                      {t.ratingEditAria}
                    </button>
                  )
                ) : (
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
              </div>
            </li>
            );
          })}
        </ul>
      )}

      {/* 🆕 **«عرض كل الآراء»** (D-681) — يطوي لا يقصّ: العدُّ صادقٌ
          في العنوان، والبقيّةُ ضغطةٌ في المكان. */}
      {!showAll && reviews.length > 3 && (
        <button
          type="button"
          onClick={() => {
            tap(6);
            setShowAll(true);
          }}
          className="flex items-center gap-1 text-14 font-bold text-accent"
        >
          {t.listReviewsViewAll(reviews.length)}
          <Icon name="chevron-down" size={15} className="-rotate-90 rtl:rotate-90" />
        </button>
      )}
    </section>
  );
}
