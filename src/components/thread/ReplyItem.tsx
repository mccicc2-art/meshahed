"use client";

import { useState } from "react";
import Link from "next/link";
import { num, getDict, type Locale } from "@/lib/i18n";
import { displayNameOf, profileHref } from "@/lib/people";
import { timeAgoShort } from "@/lib/when";
import { dirOf } from "@/lib/dir";
import { gifUrl } from "@/lib/media";
import { tap } from "@/lib/haptics";
import { bulletinLine, bulletinFacts, bulletinSpoiler } from "@/lib/bulletinLine";
import { Avatar } from "../Avatar";
import { Icon } from "../Icon";
import { SpoilerText } from "../SpoilerText";
import { Dropdown, dropdownItem } from "../ui/Dropdown";
import { Sheet } from "../ui/Sheet";
import { ReplyingTo } from "./ThreadShell";
import { actionTailItem } from "../ui/controls";

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
  /**
   * 🆕 **صورةُ المشاركة من عمودها** (D-312، الهجرة ٩٧) — كانت في
   * `data.img` (D-298)، **والقراءةُ تُبقي ذلك السقفَ حزاماً** (D-179).
   */
  imagePath?: string | null;
  /** 🆕 **معرّفُ GIF لا رابطُه** (D-362) — الرابطُ يُركَّب من قالبٍ ثابت */
  gifId?: string | null;
};

/** ردٌّ محليٌّ لم يُقرأ من القاعدة بعد — **معرّفُه مؤقّتٌ فيُرسم باهتاً** */
export const TEMP = "temp:";

export function ReplyItem({
  reply,
  translatedBody,
  replyingToName,
  locale,
  signedIn,
  canReply,
  replyCount = 0,
  fold,
  likes = 0,
  likedByMe = false,
  onLike,
  score = 0,
  myVote = 0,
  onVote,
  onReply,
  onDelete,
  onReport,
}: {
  reply: ThreadReply;
  /**
   * 🆕 **ترجمةُ المتن بلغة القارئ** (D-307) — **تصل من الخادم مع الصفّ**
   * (لا نداءَ من العميل)، **وغيابُها يعني «لا ترجمةَ لازمة»** فلا زرَّ
   * يُرسم (D-217). **والمعروضُ الترجمةُ افتراضاً وزرٌّ صغيرٌ يقلب** —
   * «تراجَع بعد» (D-047).
   */
  translatedBody?: string | null;
  /** اسمُ صاحب الردّ الأب — يظهر سطراً فوق النصّ، لا إزاحةً */
  replyingToName?: string | null;
  locale: Locale;
  signedIn: boolean;
  /** **العمقُ الثاني لا يُردّ عليه**: القاعدةُ تمنعه، فلا زرَّ يعد بما تمنعه */
  canReply: boolean;
  /**
   * 🆕 **عددُ الردود بجانب علامة التعليق** (D-284، طلبُ أحمد: «عدد الردود
   * الي في محادثة أحمد المفروض يُكتب جنب علامة التعليق الي في رسالته
   * الأولى»).
   *
   * **والرقمُ يجاور صاحبَه** (D-223/D-241): هو عددُ ما تحت *هذا* الصفّ،
   * **فيسكن زرَّ الردّ عليه لا سطراً في مكانٍ آخر.**
   * **والصفر يُخفى** (D-222) — «٠ ردّاً» ضجيجٌ لا خبر.
   */
  replyCount?: number;
  /**
   * 🆕 **سهمُ طيّ الفرع — وسيطٌ لا مبنيٌّ هنا** (D-288). **الفرعُ يخصّ
   * `ThreadReplies` وحدَها** (هي التي تعرف الأبناءَ وتحسب عددَهم)،
   * **والمكانُ يخصّ هذا الصفّ** — **فيُمرَّر العنصرُ ولا تُنقل الحالة.**
   */
  fold?: React.ReactNode;
  /**
   * 🆕 **إعجابُ المشاركة** (D-289، الهجرة ٩٠، طلبُ أحمد: «لازم فيه لايك
   * عند كل ردّ»).
   *
   * **ولماذا وسيطٌ لا `LikeButton`:** ذاك زرُّ عميلٍ يعرف وجهتَه ويكتب
   * بنفسه، **وهذا الصفُّ يعيش داخل خيطٍ يملك حالتَه التفاؤليّة كلَّها**
   * (`added`/`removed`/`toggled`) — **وحالتان لشيءٍ واحد تفترقان.**
   * فيُمرَّر العددُ والحالةُ ويُرفع الفعلُ إلى `ThreadReplies`.
   *
   * ⚠️ **و`onLike` غائبةٌ حيث لا يُسمح**: مشاركتُك أنت، أو زائرٌ لم
   * يدخل، أو خيطٌ ليس غرفةَ نقاش — **والزرُّ يصير عدّاداً يُقرأ**
   * (D-217: العاري يُقرأ)، **ولا يُرسم أصلاً إن كان صفراً** (D-222).
   */
  likes?: number;
  likedByMe?: boolean;
  onLike?: () => void;
  /**
   * 🆕 **أسهمُ التصويت** (D-305، الهجرة ٩٤، طلبُ أحمد بلقطةٍ من Reddit).
   *
   * **وليست القلبَ باسمٍ ثانٍ**: القلبُ «أحببتُه» — إشارةٌ لصاحب الردّ؛
   * **والسهمان «يستحق مكاناً أعلى/أدنى»** — إشارةٌ للترتيب يقرؤها
   * الجميع (D-224: معنيان فمعموران). **والترتيبُ نفسُه يقع على الخادم
   * في الفتحة التالية لا تحت الإصبع** (D-008/D-301).
   *
   * **و`onVote` غائبةٌ حيث لا يُسمح** — مشاركتُك أنت، أو زائر، أو خيطٌ
   * ليس غرفةَ نقاش — **فيصير الرقمُ عدّاداً يُقرأ** (D-217/D-289 حرفاً).
   */
  score?: number;
  myVote?: number;
  onVote?: (v: -1 | 0 | 1) => void;
  onReply: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const t = getDict(locale);
  const [menu, setMenu] = useState(false);
  /* 🆕 **«النص الأصلي» حالةُ هذا الصفّ وحدَه** (D-307) — لا تفضيلَ يُحفظ */
  const [showOriginal, setShowOriginal] = useState(false);
  const shownBody = translatedBody && !showOriginal ? translatedBody : reply.body;
  const [reported, setReported] = useState(false);
  const name = displayNameOf(reply, t.anonymousUser);
  const pending = reply.replyId.startsWith(TEMP);
  /* 🆕 **والمعرّفُ يكفي حين لا اسمَ مستخدم** (D-655) */
  const whoHref = profileHref(reply);

  /* **متنُ النشرة يُركَّب هنا** (D-261) — و`bulletin === null` يعني
     «صفُّ إنسان»، **فالفرعُ واحدٌ لا ثلاثة أعلام.** */
  const bulletin = bulletinLine(reply.kind ?? null, reply.data ?? null, t, locale);
  const facts = bulletin ? bulletinFacts(reply.data ?? null, t) : { runtime: null, vote: null };
  const spoilerText = bulletin ? bulletinSpoiler(reply.spoiler ?? null, locale) : null;

  /**
   * 🆕 **صورةُ المشاركة** (D-298) — **من `data` لا من عمودٍ جديد.**
   *
   * **وقارئٌ متسامح** (D-179): الصفوفُ القديمة `data` فيها `null`،
   * **والنشراتُ `data` فيها موسمٌ وحلقة** — **فالشرطُ نوعُ الحقل نفسِه
   * لا وجودُه**، **ولا صفَّ ينكسر لأن حمولته ليست ما نتوقّع.**
   * ⚠️ **ولا تُقرأ لصفِّ نشرة**: `bulletin` حاضرٌ يعني `kind = 'episode'`،
   * **وحمولتُه موسمٌ وحلقةٌ لا صورة** — **وحقلٌ يُقرأ بمعنى غير معناه هو
   * كيف يولد العطل** (D-224).
   */
  const raw = !bulletin
    ? (reply.imagePath ?? (reply.data as Record<string, unknown> | null)?.img)
    : null;
  const image = typeof raw === "string" && raw.startsWith("https://") ? raw : null;
  /* 🆕 **والـGIF حمولةٌ ثالثةٌ بنفس البيت** (D-362): **عارضٌ واحدٌ لا
     ثانٍ** — `PostImage` نفسُها بحاجبها وورقتها (D-002)، **والرابطُ
     يُبنى من المعرّف هنا فلا يُخزَّن عنوانٌ في القاعدة أبداً**
     (D-298/D-302). **ولا تُقرأ لصفِّ نشرة** كأختها. */
  const gif = !bulletin ? gifUrl(reply.gifId) : null;

  return (
    /* 🆕 **الصفُّ صار طابقين لا عمودين** (D-296، طلبُ أحمد بلقطةٍ مرجعية:
       «نحتاج نستفيد من المساحة العرضية كاملة… نصغّر الأفاتار بحيث الكلام
       يُعرض من بداية الشاشة»).
    
       **وكان الوجهُ عموداً يمينَه كلُّ شيء**: وجهٌ ٤٠ + فجوةٌ ١٢ + حشوةُ
       الصفحة ١٦ = **٦٨px تُقتطع من كلِّ سطرٍ في الصفحة**، على شاشةٍ عرضُها
       ٣٩٣. **والوجهُ يخصّ الترويسة وحدَها، والمتنُ لا علاقة له به** —
       **فبقاؤه عموداً كان يُملي على الكلام هامشاً لا سبب له.**
    
       **والآن: ترويسةٌ فيها الوجهُ والاسمُ والوقتُ والنقاط، ثم المتنُ
       والأفعالُ بعرض الصفّ كلِّه.** **ومكسبُه ٥٢px في كلِّ سطر.**
    
       ⚠️ **وهذا هو تشريحُ Reddit لا تويتر** — **وهو اختيارُ أحمد نفسُه
       لهذا السطح** («تكون مثل Reddit لا مثل تويتر»، رأسُ `ThreadReplies`):
       **تويتر يُزيح المتنَ تحت الوجه لأن خيطَه مسطَّح، وReddit يُفرغ
       العرضَ للكلام لأن خيطَه شجرة.** **فالتشريحُ تبع الخيط لا تبع
       الذوق** (D-242). */
    <article
      className={`py-3 border-b border-[color:var(--divider)] ${pending ? "opacity-60" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {/* **والوجهُ ٣٤ لا ٤٠**: صار في سطرِ ترويسةٍ ارتفاعُه ارتفاعُ
              سطرين من النصّ، **ووجهٌ أطولُ من ترويسته يمطّ الصفَّ بلا
              معنًى** (D-229: المقاسُ يُراجَع يومَ يتغيّر ما حوله). */}
          {whoHref ? (
            <Link href={whoHref} prefetch={false} className="shrink-0 active:opacity-80 transition">
              <Avatar src={reply.avatar_url} name={name} size={34} alt="" />
            </Link>
          ) : (
            <Avatar src={reply.avatar_url} name={name} size={34} alt="" className="shrink-0" />
          )}
          <span className="min-w-0 truncate font-bold text-14 leading-tight">
            <bdi>{name}</bdi>
          </span>
          <span aria-hidden className="shrink-0 text-muted text-12">
            ·
          </span>
          <span className="shrink-0 text-12 text-muted tabular-nums">
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
          /* **ومسافةٌ تفصل المتنَ عن ترويسته** — الصفّان صارا طابقين
             فلا فجوةَ أفقيّةً تفصلهما كما كان (D-296) */
          <div className="mt-1.5">
            {/* **الحقائقُ ظاهرةٌ بلا حرق** — بخطّ المتن لا الحاشية (D-241) */}
            <p
              dir={dirOf(bulletin)}
              className="fs-content text-14 leading-relaxed text-foreground/90 whitespace-pre-line"
            >
              {bulletin}
              {/* 🆕 **★ في سطر العنوان** (D-308، طلبُ أحمد: «احذف الوقت
                  وخلّ التقييم بعد العنوان مباشرة عشان ما تخسر سطر على
                  الفاضي») — والصفرُ يُخفى (D-219)، والرقمُ `ltr`. */}
              {facts.vote && (
                <span className="inline-flex items-center gap-1 ms-2 text-12 text-muted align-middle">
                  <Icon name="star" size={12} className="shrink-0 text-accent" />
                  <span dir="ltr">{facts.vote}</span>
                </span>
              )}
            </p>

            {/* ⚖️ **والمدّةُ سقطت من النشرة كلِّها** (D-308): هي في صفحة
                الحلقة لمن أرادها، **وسطرٌ في كلِّ نشرةٍ ثمنُ رقمٍ لا
                يُقرَّر به شيء** (D-266). */}

            {/* **«أبرزُ ما فيها» خلف الحاجب** — قرارُ أحمد */}
            {spoilerText && <SpoilerText text={spoilerText} locale={locale} />}
          </div>
        ) : reply.hasSpoiler ? (
          /* **ومتنُ العضو خلف الحاجب نفسِه** (D-271) — **لا حاجبَ ثانٍ**:
             `SpoilerText` لا يُصيّر النصَّ حتى يُطلب، **وهو ما يجعله
             حاجباً لا ضباباً** (D-063). **والسببُ يتغيّر وحدَه**: من أعلن
             الحرقَ هو الكاتب، **فلا نقول «يكشف أحداث الحلقة» عن كلامٍ لا
             نعرف ما فيه** (D-216). */
          /* ⚖️ **وسقط السطرُ الثاني أيضاً** (D-289، بعد أن حُذف أخوه في
             D-287): طلبُ أحمد كان «مو لازم تشرح» — **وحين سألتُه عن هذا
             تحديداً لم يفهم السؤال، فكان الجوابُ أن أحذفه لا أن أُعيد
             السؤال** (D-285: الإذنُ الذي لا يُفهَم ليس إذناً — **وهنا
             لم يكن ثمّة ما يحتاج إذناً أصلاً، كان تفضيلاً قاله مرّة**).
             **والزرُّ يقول «اعرض الحرق» وحدَه.** */
          <div className="mt-1.5">
            {/* **والصورةُ خلف الحاجب نفسِه** (D-298): **حرقٌ في صورةٍ
                أسرعُ وصولاً منه في جملة** — **وحاجبٌ يستر النصَّ ويترك
                صورتَه ليس حاجباً.** */}
            <SpoilerText text={shownBody} locale={locale}>
              {image && <PostImage src={image} alt={t.talkImageAlt} locale={locale} />}
              {/* 🆕 **والـGIF خلف الحاجب نفسِه** (D-362/D-298 حرفاً) */}
              {gif && <PostImage src={gif} alt={t.talkImageAlt} locale={locale} />}
            </SpoilerText>
          </div>
        ) : (
          /* **اتّجاهُ الردّ من الردّ** (D-241) — لا من لغة الواجهة.
             🆕 **ولا فقرةَ لمتنٍ فارغ** (D-302): **صورةٌ بلا نصٍّ مشاركةٌ
             كاملة**، **وفقرةٌ فارغةٌ فوقها هامشٌ لا يفسّره شيء** —
             **وأرخصُ عنصرٍ هو الذي لا يُرسم** (D-266/D-222). */
          shownBody.trim() && (
            <p
              dir={dirOf(shownBody)}
              className="mt-1.5 fs-content text-14 leading-relaxed text-foreground/90 whitespace-pre-line"
            >
              {shownBody}
            </p>
          )
        )}

        {/* 🆕 **زرُّ «النص الأصلي / الترجمة»** (D-307) — **لا يُرسم إلا
            حيث توجد ترجمةٌ فعلاً** (D-217)، **وبصيغة الفعل القادم**:
            من يقرأ ترجمةً يريد الأصل، والعكس. */}
        {translatedBody && !reply.hasSpoiler && (
          <button
            type="button"
            onClick={() => setShowOriginal((v) => !v)}
            className="mt-1 text-12 font-bold text-muted hover:text-accent transition"
          >
            {showOriginal ? t.showTranslation : t.showOriginalText}
          </button>
        )}

        {/* **والصورةُ بعد المتن** — **ترتيبُ الكتابة هو ترتيبُ القراءة**:
            من كتب سطراً ثم أرفق صورةً يتوقّعها تحته. */}
        {image && !reply.hasSpoiler && (
          <div className="mt-2">
            <PostImage src={image} alt={t.talkImageAlt} locale={locale} />
          </div>
        )}
        {/* 🆕 **والـGIF مكانَ الصورة ووصفتَها** (D-362) — **عارضٌ واحدٌ
            لحمولةٍ بصريّة، ولا ثانٍ** (D-002). */}
        {gif && !reply.hasSpoiler && (
          <div className="mt-2">
            <PostImage src={gif} alt={t.talkImageAlt} locale={locale} />
          </div>
        )}

        {/* 🆕 **صفُّ أفعالٍ واحد** (D-288، طلبُ أحمد: «هذي العبارة لا
            تخلّيها في سطر لها، حطّها مع نفس سطر علامة اللايك والتعليق —
            ضروري نستغلّ المساحات»). **وسهمُ الطيّ فعلٌ على هذه الرسالة
            كعلامة الردّ** — فيسكن صفَّها لا سطراً تحته.
            ⚠️ **والشرطُ صار شرطين لا واحداً**: زرُّ الردّ يشترط دخولاً
            وسماحاً، **والطيُّ لا يشترط شيئاً** — **فزائرٌ لا يستطيع
            الردَّ كان سيفقد سهمَ الطيّ لو بقي الشرطُ واحداً.** */}
        {!pending && ((signedIn && canReply) || fold || onLike || likes > 0 || onVote || score !== 0) && (
          <div className="mt-1.5 -mx-0.5 flex items-center gap-1">
            {/* 🆕 **والقلبُ أوّلاً — والترتيبُ قاعدةٌ لا ذوق** (D-294،
                طلبُ أحمد: «دائماً الأول القلب بعدها التعليق وبعدها
                المشاهدة وآخر شي النشر، حافظ على هذا الترتيب»).
                **وكان الردُّ أوّلَ هذا الصفّ وحدَه في التطبيق** — والخطُّ
                يبدأ بالقلب — **وترتيبان لأفعالٍ واحدة في سطحين هما ما
                تمنعه القاعدة ٣**: **الإصبعُ يحفظ الموضعَ لا الأيقونة.**
                **والقلبُ المصمتُ حالةٌ والمفرَّغُ غيابُها** (D-260)،
                **واللونُ يحمل الحالة** (D-003). */}
            {/* 🆕 **السهمان في أوّل الصفّ** (D-305، نصُّ أحمد: «يكونون
                يسار القلب») — **وهو موضعُ Reddit نفسُه الذي أرسل لقطتَه**:
                أداةُ الترتيب قبل أدوات التفاعل. **⚠️ وهذا استثناءٌ مقصودٌ
                من ترتيب D-294** (قلبٌ · تعليق · مشاهدة · نشر): تلك قاعدةُ
                أفعال التفاعل، **والسهمان ليسا منها** — فيقفان قبلها كما
                في المرجع الذي طُلب.
                **والرقمُ بين السهمين** يقرأ صافيَ الأصوات، **ولونُه يقول
                صوتي أنا**: أصفرُ فوق، خافتٌ تحت (D-003: اللونُ يحمل
                الحالة). **وضغطُ السهم نفسِه مرّتين سحبٌ** — «تراجَع بعد»
                (D-047). */}
            {(onVote || score !== 0) && (
              <span className="inline-flex items-center gap-0.5 me-0.5">
                <button
                  type="button"
                  onClick={onVote ? () => onVote(myVote === 1 ? 0 : 1) : undefined}
                  disabled={!onVote}
                  aria-pressed={myVote === 1}
                  aria-label={t.voteUp}
                  title={t.voteUp}
                  className={`inline-flex items-center rounded-full p-1.5 transition ${
                    myVote === 1 ? "text-accent" : "text-muted"
                  } ${onVote ? "hover:text-accent active:scale-90" : "cursor-default"}`}
                >
                  <Icon name="chevron-up" size={16} strokeWidth={2.4} />
                </button>
                <span
                  className={`min-w-[1ch] text-center text-12 tabular-nums ${
                    myVote === 1 ? "text-accent" : myVote === -1 ? "text-muted" : "text-muted"
                  }`}
                >
                  {num(score, locale)}
                </span>
                <button
                  type="button"
                  onClick={onVote ? () => onVote(myVote === -1 ? 0 : -1) : undefined}
                  disabled={!onVote}
                  aria-pressed={myVote === -1}
                  aria-label={t.voteDown}
                  title={t.voteDown}
                  className={`inline-flex items-center rounded-full p-1.5 transition ${
                    myVote === -1 ? "text-foreground" : "text-muted"
                  } ${onVote ? "hover:text-foreground active:scale-90" : "cursor-default"}`}
                >
                  <Icon name="chevron-down" size={16} strokeWidth={2.4} />
                </button>
              </span>
            )}
            {(onLike || likes > 0) && (
              <button
                type="button"
                onClick={onLike}
                disabled={!onLike}
                aria-pressed={likedByMe}
                aria-label={t.likesLabel}
                title={t.likesLabel}
                className={actionTailItem(
                  likedByMe,
                  onLike ? "active:scale-95" : "cursor-default hover:text-muted",
                )}
              >
                <Icon name={likedByMe ? "heart-filled" : "heart"} size={15} />
                <span>{t.likesLabel}</span>
                {likes > 0 && <span className="tabular-nums">{num(likes, locale)}</span>}
              </button>
            )}
            {signedIn && canReply && (
              <button
                type="button"
                onClick={onReply}
                aria-label={t.talkReply}
                title={t.talkReply}
                className={actionTailItem(false)}
              >
                <Icon name="comment" size={15} />
                <span>{t.talkReply}</span>
                {replyCount > 0 && (
                  <span className="tabular-nums">{num(replyCount, locale)}</span>
                )}
              </button>
            )}
            {fold}
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * 🆕 **صورةُ مشاركةٍ في الخيط** (D-298).
 *
 * **ونسبتُها من الصورة لا منّا**: `width`/`height` صفرٌ مع `w-full h-auto`
 * **تجعل المتصفّح يحجز مكانَها بنسبتها الحقيقيّة قبل أن تصل** — **فلا
 * يقفز الكلامُ تحتها حين تُرسم** (D-046: لا شيء يتغيّر حجمه بعد أن
 * يُرسم). **وسقفٌ لارتفاعها** حتى لا تبتلع صورةٌ طويلةٌ الشاشةَ كلَّها،
 * **والباقي يُقصّ لا يُشوَّه** (`object-cover`).
 *
 * ================= 🔴 🆕 والضغطةُ تكبّرها ولا تُخرجك (D-302) =================
 *
 * **وكانت رابطاً** (`target="_blank"`) — **بلاغُ أحمد: «إذا ضغطتها يوديك
 * على رابط، ما تكبر لوحدها».** **وحجّتُه أنّ ما قُصّ له بابٌ ما زالت
 * صحيحة، والبابُ كان خاطئاً:** رابطُ التخزين يخرج بالقارئ من التطبيق
 * إلى لسانٍ ثانٍ **يعرض ملفّاً عارياً على خلفيّةٍ بيضاء بعنوان
 * `supabase.co`** — **فيفقد موضعَه في النقاش، ويقرأ العنوانَ الغريب
 * عطلاً** (D-063: الغيابُ أصدق من الوهم، **والوهمُ هنا أنه خرج**).
 *
 * **فالبابُ صار عارضاً في مكانه**: `Sheet variant="bare"` — **الورقةُ
 * نفسُها التي في التطبيق منذ D-018** بحجابها وقفلِ تمريرها وحبسِ تركيزها
 * وإغلاقِها بـ`Escape` وباللمس خارجها. **ولا عارضَ صورٍ ثانٍ**
 * (D-002/D-018: عائلةٌ ثانيةٌ لمعنًى واحدٍ عطل).
 *
 * ⚠️ **والمصغَّرةُ صارت زرّاً لا رابطاً**: **ما لا ينقلك إلى عنوانٍ ليس
 * رابطاً** — والفرقُ يسمعه قارئُ الشاشة قبل أن تراه العين (D-217).
 */
function PostImage({ src, alt, locale }: { src: string; alt: string; locale: Locale }) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.talkOpenImage}
        title={t.talkOpenImage}
        className="block w-full relative rounded-xl overflow-hidden border border-border bg-surface-2 max-h-[420px] active:scale-[.99] transition"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto object-cover" />
      </button>
      {/* **وبحجمها الكامل بلا قصّ**: `object-contain` وسقفٌ بالشاشة —
          **العارضُ يعرض ما قُصَّ، فقصٌّ فيه يُبطل سببَ فتحه** (D-046). */}
      {open && (
        <Sheet open onClose={() => setOpen(false)} closeLabel={t.closeLabel} variant="bare">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[86svh] max-w-full w-auto h-auto object-contain rounded-xl"
          />
        </Sheet>
      )}
    </>
  );
}
