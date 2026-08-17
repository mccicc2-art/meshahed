"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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
  togglePostLike,
  votePost,
} from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { displayNameOf } from "@/lib/people";
import { tap } from "@/lib/haptics";
import { useKeyboardInset, useKeyboardOpen, KEYBOARD_MIN } from "@/lib/useKeyboard";
import { Icon } from "../Icon";
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
  likes,
  votes,
  translations,
}: {
  target: ReplyTarget;
  replies: ThreadReply[];
  /**
   * 🆕 **إعجاباتُ المشاركات — عدداً وحالةً** (D-289، الهجرة ٩٠).
   * **تصل من الخادم في نداءٍ واحدٍ للغرفة** (D-205)، **وتغيب في
   * السطحين الآخرين** (الرأي والنشرة) فلا يُرسم زرّ.
   */
  likes?: { counts: Record<string, number>; mine: string[] };
  /**
   * 🆕 **أصواتُ المشاركات** (D-305، الهجرة ٩٤) — نمطُ `likes` حرفاً:
   * **من الخادم في نداءٍ واحد، وتغيب في السطحين الآخرين** فلا سهمَ
   * يُرسم. **والترتيبُ وقع في الصفحة قبل الوصول** — انظر رأسَها.
   */
  votes?: { scores: Record<string, number>; mine: Record<string, number> };
  /** 🆕 **ترجماتُ المتون بلغة القارئ** (D-307) — بمفتاح المشاركة، من الخادم */
  translations?: Record<string, string>;
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
  /* 🆕 **قياسٌ واحدٌ للكيبورد يقرؤه المرسى والقلم** (D-359) — خرج إلى
     `lib/useKeyboard` عند قارئه الثاني (D-002). */
  const kbOpen = useKeyboardOpen();
  /* 🆕 **مسارُ الصفحة الحيّ** (D-361) — يسافر مع الصوت ليُبطل نسخةَ هذه
     الصفحة وحدَها لا صفحةً مسمّرةً في الفعل. */
  const pathname = usePathname();
  /**
   * 🆕 **الفروعُ مطويّةٌ حتى تُفتح** (D-284، طلبُ أحمد: «الردود الي في ردّ
   * الشخص المفروض ما تظهر على طول، لازم فيه سهم توسيع»).
   *
   * **والعطلُ الذي رآه:** خيطٌ فيه ثلاثةُ ردودٍ متداخلة يفتح الصفحةَ
   * على شجرةٍ كاملة، **فيقرأ القارئُ حواراً جانبيّاً قبل أن يرى بقيّة
   * الغرفة** — والصفحةُ صارت أطولَ مما تقول.
   * **والمطويُّ يُعلن عددَه** فلا يُخفى شيءٌ بلا إشارة (D-138: أداةٌ لا
   * تُرى لا توجد).
   * ⚠️ **وما كتبتَه أنت يُفتح فوراً**: من ردّ ثم رأى ردَّه مطويّاً ظنّ
   * أنه لم يُرسَل (D-241/D-251).
   *
   * 🆕 **ويُطوى بعد أن يُفتح** (D-287، سؤالُ أحمد: «بعد ما فتحتها وين
   * الزرُّ الي قفلها؟»). **وزرٌّ يفتح ولا يُغلق ليس مفتاحاً** — **ومن فتح
   * فرعاً بالخطأ كان عليه أن يعيد تحميل الصفحة ليخفيه** (D-047:
   * «تراجَع بعد» يقتضي وجودَ تراجُع).
   *
   * ⚠️ **والمجموعةُ تحمل «ما قلبه القارئ» لا «ما هو مفتوح»** — لأن
   * الافتراضَ نفسَه يختلف من فرعٍ لفرع (فرعٌ فيه ردُّك مفتوحٌ ابتداءً).
   * **فالمحسوبُ `toggled ? !auto : auto`** — **ومجموعةٌ تعني «مفتوح»
   * كانت ستمنع أحمد من طيّ فرعه هو**، وهو بالضبط الفرعُ الذي في لقطته.
   */
  const [toggled, setToggled] = useState<Set<string>>(new Set());

  /**
   * 🆕 **قلبُ الإعجاب تفاؤليّاً** (D-289/D-241): الخريطةُ تحمل **الفرقَ
   * عن الخادم لا الرقمَ نفسَه** — `+1` أو `-1` — **فما يصل من الخادم
   * يبقى هو المصدر، والفرقُ يُضاف إليه.**
   * **ورقمٌ محليٌّ كاملٌ كان سيتجمّد** يوم يتغيّر الخادمُ تحته.
   */
  const [likeDelta, setLikeDelta] = useState<Record<string, number>>({});
  const serverMine = new Set(likes?.mine ?? []);
  const likedNow = (id: string) => {
    const d = likeDelta[id];
    return d === undefined ? serverMine.has(id) : d > 0;
  };
  const likesNow = (id: string) =>
    Math.max(0, (likes?.counts[id] ?? 0) + (likeDelta[id] ?? 0));

  function like(id: string) {
    const was = likedNow(id);
    tap(8);
    /* **الحالةُ تنقلب فور اللمس ثم تُكتب** — وزرٌّ لا يستجيب يُلمس
       مرّتين (سيرةُ `LikeButton`). **وإن فشلت الكتابة رجعت.** */
    setLikeDelta((d) => ({ ...d, [id]: was ? -1 : 1 }));
    void togglePostLike(id, was).catch(() => {
      setLikeDelta((d) => ({ ...d, [id]: was ? 1 : -1 }));
      setError(t.errorTitle);
    });
  }

  /**
   * 🆕 **حالةُ الصوت التفاؤليّة — قيمةٌ لا فرق** (D-305). الإعجابُ
   * ثنائيٌّ ففرقُه `±1` يكفي؛ **والصوتُ ثلاثيٌّ** (فوق/تحت/لا شيء)
   * **وفرقُ قفزةٍ من -١ إلى ١ اثنان** — فتُخزَّن **قيمتي الجديدة**
   * ويُشتقّ الفرقُ منها ومن قيمة الخادم. **والمجموعُ لا يُعاد ترتيبُ
   * الشاشة به تحت الإصبع** (D-008) — الترتيبُ للفتحة التالية.
   */
  const [voteNow, setVoteNow] = useState<Record<string, number>>({});
  const myVoteOf = (id: string) => voteNow[id] ?? votes?.mine[id] ?? 0;
  const scoreOf = (id: string) =>
    (votes?.scores[id] ?? 0) + (myVoteOf(id) - (votes?.mine[id] ?? 0));

  function vote(id: string, v: -1 | 0 | 1) {
    const was = myVoteOf(id) as -1 | 0 | 1;
    tap(8);
    setVoteNow((d) => ({ ...d, [id]: v }));
    /* 🆕 **والمسارُ يسافر مع الصوت** (D-361): الفعلُ يعرف الصفَّ ولا يعرف
       الصفحةَ التي يُقرأ فيها — **والصفوفُ الثلاثة تُقرأ من ثلاثة مسارات**
       (الغرفة · النشرة · الريفيو) — **فيُمرَّر المسارُ الحيُّ ويُحرَس في
       الخادم** (D-257: هدفٌ ثالثٌ وسيطٌ لا نسخة). */
    void votePost(id, v, pathname).catch(() => {
      setVoteNow((d) => ({ ...d, [id]: was }));
      setError(t.errorTitle);
    });
  }

  /* **الحمولةُ تغلب النسخةَ المحلّية** (D-241): ما ظهر معرّفُه من الخادم
     تسقط نسختُه هنا — فلا يظهر الردُّ مرّتين. */
  const fromServer = new Set(replies.map((r) => r.replyId));
  const all = [...replies, ...added.filter((a) => !fromServer.has(a.replyId))]
    .filter((r) => !removed.has(r.replyId))
    /* **ترتيبٌ زمنيٌّ واحدٌ للخيط كلِّه** — لا شجرة */
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  /**
   * 🆕 **ثم الجذورُ بالأصوات حيث توجد** (D-305، نصُّ أحمد: «أكثر ردّ
   * عنده أسهم يكون فوق واللي بالسالب ينزل تحت — فهذا شي يسهّل القراءة»).
   *
   * **بأرقام الخادم لا بالحالة التفاؤليّة عمداً**: ترتيبٌ يقرأ صوتَك
   * لحظةَ ضغطه **يقفز بالرسالة من تحت إصبعك وأنت تقرؤها** (D-008/D-301)
   * — **فالصوتُ الجديد يُرى رقماً، ويُرتَّب في الفتحة التالية.** وهو
   * عقدُ الدبّوس حرفاً.
   *
   * **والفرزُ مستقرٌّ** (ضمانةُ اللغة): المتساوون — وكلُّ الأبناء —
   * **يبقون بترتيب الزمن.** **وموضعُ الابن في المصفوفة لا يغيّر أباه**:
   * الشجرةُ تُبنى من `parentId` لا من الجوار.
   */
  if (votes) {
    /* ⚠️ **قسمةٌ ثم دمجٌ، لا مقارنٌ مشروط**: مقارنٌ يرجع صفراً لكلِّ
       زوجٍ فيه ابنٌ **ليس ترتيباً متعدّياً** — والفرزُ به غيرُ معرَّف.
       فتُفرز الجذورُ وحدَها ويُعاد بناءُ المصفوفة. */
    const roots = all.filter((r) => !r.parentId);
    const children = all.filter((r) => r.parentId);
    roots.sort(
      (a, b) => (votes.scores[b.replyId] ?? 0) - (votes.scores[a.replyId] ?? 0),
    );
    all.splice(0, all.length, ...roots, ...children);
  }

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

      {/* ===== الردود ===== */}
      {all.length === 0 ? (
        <p className="py-10 px-5 text-center text-sm text-muted leading-relaxed">
          {nested ? t.talkRoomEmpty : t.postNoReplies}
        </p>
      ) : (
        roots.map((r) => node(r, 0))
      )}

      {/* ===== صفُّ الكتابة — في قاع الصفحة (D-284) =====
          **طلبُ أحمد بلقطةٍ من X: «مكان كتابتي للتعليق خلّه تحت جدًّا في
          أسفل الصفحة».**

          **وكان فوق الردود، وهو موضعٌ يقلب معنى الصفحة**: أوّلُ ما تراه
          دعوةٌ لتكتب، **قبل أن تقرأ سطراً واحداً ممّا كُتب** — والغرفةُ
          سطحُ قراءةٍ يجوز أن يُكتب فيه، لا سطحُ كتابةٍ تحته أرشيف.
          **والقاعُ هو عُرف تويتر وX وReddit** — ولِما له عُرفٌ راسخ
          يُنسخ (D-150/D-242).

          ⚠️ **و`sticky` لا `fixed`**: `fixed` يخرج من عمود القراءة
          فيمتدّ بعرض الشاشة على اللوح، **و`sticky` يرث عرضَ أبيه**.
          ⚠️ **ويجلس فوق الشريط السفليّ لا تحته**: الشريطُ `fixed` بارتفاعٍ
          ثابتٍ زائدَ المنطقةِ الآمنة، **فالإزاحةُ تحسبه** — ويسقط
          الحسابُ من `md:` فصاعداً حيث يختفي الشريط (`md:hidden`).
          **وأداةٌ تختفي خلف أخرى أسوأُ من أداةٍ غائبة** (D-138). */}
      {/* 🔴 🆕 **زرُّ الكتابة صار علامةً عائمةً** (D-305، طلبُ أحمد
          بلقطتين: دائرةٌ على شريط «Join the discussion…» عندنا وقلمٌ
          عائمٌ من التطبيق الآخر — «احذف هذي حقّة الكتابة اللي عندنا
          وخلّها مثل الموقع الثاني، علامة بتكون أفضل»).

          **وحجّتُه تُقاس**: الشريطُ كان يحجز صفّاً كاملاً بعرض الشاشة
          **وخطَّ حدٍّ فوقه** — **دعوةٌ دائمةُ الحضور لفعلٍ نادرِ
          الوقوع**، وآخرُ رسالةٍ في الغرفة تختفي خلفه (D-266: أرخصُ
          عنصرٍ هو الذي لا يُرسم). **والقلمُ يقول «اكتب» بلا سطر.**

          ⚠️ **وإذا فُتح الصندوقُ عاد الشريطُ كما كان** — الكتابةُ نفسُها
          تحتاج العرضَ كلَّه، **والعلامةُ بابٌ لا غرفة.**
          ⚠️ **والموضعُ `end` المنطقيّ** (D-216): يمينٌ في LTR ويسارٌ في
          RTL — **فلا يغطّي بدايةَ السطور وهي جهةُ القراءة.**
          **وفوق شريط التنقّل بنفس حساب الشريط القديم** — والارتفاعُ
          `bottom` نفسُه فلا يظهر تحته فراغٌ جديد. */}
      {/* 🔴 🆕 **والصندوقُ المفتوح يرسو على حافّة النافذة المرئيّة**
          (D-320، بلاغُ أحمد بلقطتين: «إذا فتحته لا يرتفع فوق مرّة —
          خلّه قريباً من الكيبورد»).
          **`sticky` كان يسقط بنفس علّة القلم** (D-319): آخرُ عنصرٍ في
          غرفةٍ قصيرةٍ موضعُه الطبيعيُّ فوق الحافّة فلا ينعقد، **فيجلس
          الصندوقُ بعيداً عن الكيبورد وتحته فراغٌ ميّت** — وهو ما صوّره.
          **والمرسى `KeyboardDock` أسفل الملفّ**: `fixed` يُرفع بقياس
          `visualViewport` فيلتصق بالكيبورد حين يفتح وبشريط التنقّل حين
          يغيب — **والعرضُ يُقاس من عمود الصفحة لا يُفترض** (D-282):
          الغرفةُ `max-w-xl` والنشرةُ ٦٨٠px، والمرسى يخدمهما معاً. */}
      {signedIn &&
        (open === "" ? (
          <KeyboardDock>
            <Composer
              locale={locale}
              /* **والمفتاحُ حيث يُخزَّن وحدَه** (D-271): `has_spoiler`
                 عمودٌ على `title_posts` — **فلا يظهر على خيط رأيٍ ولا
                 نشرة**، وزرٌّ يُضغط بلا أثرٍ أسوأُ من زرٍّ غائب. */
              allowSpoiler={nested}
              /* **والصورةُ حيث تُخزَّن وحدَها** — `title_posts.data` (D-298) */
              allowImage={nested}
              onCancel={() => setOpen(null)}
              onSend={(b, sp, img) => send(b, null, sp, img)}
            />
          </KeyboardDock>
        ) : (
          /* 🔴 🆕 **والقلمُ `fixed` لا `sticky`** (D-319، بلاغُ أحمد
             بلقطتين: «القلم المفروض عائم، هذا ثابت!!»).
             **`sticky bottom` لا ينعقد إلا ما دام الموضعُ الطبيعيُّ
             للعنصر تحت حافّة الشاشة** — والقلمُ آخرُ عنصرٍ في الغرفة،
             **ففي غرفةٍ قصيرةٍ موضعُه الطبيعيُّ فوق الحافّة أصلاً فيجلس
             في التدفق كأيِّ صفّ** — وهو ما صوّره أحمد حرفاً.
             **وحجّةُ «لا `fixed`» أعلاه كانت حجّةَ الشريط**: شريطٌ بعرض
             العمود يحتاج وراثةَ عرض أبيه — **والقلمُ دائرةٌ ٤٨px لا
             عرضَ لها، فالحجّةُ ماتت بموت سببها** (D-250). **والعائمُ
             الحقُّ يسكن الشاشةَ لا المستند** — وهو عُرف القلم في كلِّ
             تطبيقٍ نسخنا شكلَه (D-150).
             **والفراغُ `h-14` قبله يبقى في التدفق** كي لا يختفي ذيلُ
             آخرِ صفٍّ خلف القلم (D-138: أداةٌ تخفي أخرى أسوأُ من
             غائبة).
             🔴 🆕 **ويغيب ما دام الكيبوردُ مفتوحاً** (D-359): من فتح
             ردّاً على صفٍّ بعينه **يكتب الآن**، **ودعوةٌ إلى كتابةٍ ثانية
             فوق كيبورده تُزاحم ما يكتبه** — **والفراغُ يبقى في التدفق**
             فلا يقفز ما تحته (D-046). */
          <>
            <div aria-hidden className="h-14" />
            <div
              className={`${
                kbOpen ? "hidden" : ""
              } fixed bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] md:bottom-6 end-4 md:end-8 z-20 pointer-events-none`}
            >
            <button
              type="button"
              onClick={() => {
                tap(6);
                setOpen("");
              }}
              aria-label={nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
              title={nested ? t.talkRoomPlaceholder : t.postReplyPlaceholder}
              className="pointer-events-auto w-12 h-12 rounded-full bg-surface-2 border border-border text-foreground grid place-items-center shadow-xl active:scale-95 transition hover:border-accent"
            >
              <Icon name="edit" size={20} />
            </button>
            </div>
          </>
        ))}

    </>
  );

  /**
   * صفٌّ واحدٌ ومن تحته — **ودالّةٌ واحدة للحالتين**: العمقُ صفرٌ دائماً
   * في المسطَّح، **فلا فرعَ ثانٍ في الرسم** (نفسُ درسِ D-242).
   */
  function node(r: ThreadReply, depth: number) {
    const kid = nested ? (kids.get(r.replyId) ?? []) : [];
    /* **الافتراضُ: مفتوحٌ إن كان فيه ردُّك** (D-284/D-251) — **وقلبُ
       القارئ يغلب الافتراضَ في الاتّجاهين** (D-287). */
    const autoOpen = kid.some((c) => c.isMine);
    const kidsOpen = toggled.has(r.replyId) ? !autoOpen : autoOpen;
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
          /* 🆕 **وسهمُ الطيّ يركب صفَّ الأفعال** (D-288): كان سطراً
             مستقلّاً بإزاحة ٥٢px تحت الرسالة — **سطرٌ كاملٌ لأربع
             كلمات** — وطلب أحمد ضمَّه إلى صفّ العلامات. */
          fold={
            kid.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  tap(6);
                  setToggled((s2) => {
                    const n = new Set(s2);
                    if (n.has(r.replyId)) n.delete(r.replyId);
                    else n.add(r.replyId);
                    return n;
                  });
                }}
                aria-expanded={kidsOpen}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-bold text-muted hover:text-accent transition"
              >
                <Icon
                  name="chevron-down"
                  size={14}
                  className={`shrink-0 transition-transform ${kidsOpen ? "rotate-180" : ""}`}
                />
                {kidsOpen ? t.talkHideReplies : t.talkShowReplies(countUnder(r.replyId))}
              </button>
            ) : null
          }
          /* **و«ردّاً على فلان» للمسطَّح وحده**: في الشجرة الأبُ فوقها
             بعينه — **وسطرٌ يقول ما تراه العينُ يأكل سطراً بلا معنى.** */
          translatedBody={translations?.[r.replyId] ?? null}
          replyingToName={!nested && r.parentId ? (nameOf.get(r.parentId) ?? null) : null}
          locale={locale}
          signedIn={signedIn}
          /* **وحدُّ الردّ حدُّ القاعدة نفسُه** — فلا زرَّ يعد بما تمنعه */
          canReply={nested ? depth < MAX_DEPTH : !r.parentId}
          /* **والعددُ بجانب علامته** (D-284) — كلُّ الفرع لا أبناؤه وحدهم */
          replyCount={nested ? countUnder(r.replyId) : 0}
          /* **الإعجابُ في الغرفة وحدَها** (D-289): الجدولُ يشير إلى
             `title_posts`، **وسطحٌ يعرض زرّاً لا وجهةَ له يعد بما
             تمنعه القاعدة** (D-217). **ولا زرَّ على مشاركتك** — ولا
             على نسخةٍ تفاؤليّةٍ لم يصلها معرّفُها بعد (D-241). */
          likes={likes ? likesNow(r.replyId) : 0}
          likedByMe={likes ? likedNow(r.replyId) : false}
          onLike={
            likes && signedIn && !r.isMine && !r.replyId.startsWith(TEMP)
              ? () => like(r.replyId)
              : undefined
          }
          /* 🆕 **والسهمان بشروط القلب نفسِها** (D-305/D-289) — سطحٌ
             واحد، ولا صوتَ على كلامك ولا على نسخةٍ لم يصل معرّفُها. */
          score={votes ? scoreOf(r.replyId) : 0}
          myVote={votes ? myVoteOf(r.replyId) : 0}
          onVote={
            votes && signedIn && !r.isMine && !r.replyId.startsWith(TEMP)
              ? (v) => vote(r.replyId, v)
              : undefined
          }
          onReply={() => {
            tap(6);
            setOpen(open === r.replyId ? null : r.replyId);
          }}
          onDelete={() => remove(r)}
          onReport={() => report(r)}
        />
        {open === r.replyId && (
          /* 🆕 **وحشوةُ الـ٥٢ سقطت** (D-296): كانت تُحاذي عمودَ النصّ
             القديم (وجهٌ ٤٠ + فجوةٌ ١٢)، **وذلك العمودُ لم يعد موجوداً** —
             **ومحاذاةٌ لعنصرٍ حُذف هي كيف تبقى الأرقامُ السحريّة** (D-214).
             **وصندوقُ الكتابة يأخذ العرضَ كما يأخذه المتنُ فوقه.** */
          <div className="pb-3 border-b border-[color:var(--divider)]">
            <Composer
              locale={locale}
              hint={t.talkReplyingTo(nameOf.get(r.replyId) ?? "")}
              allowSpoiler={nested}
              /* **والصورةُ حيث تُخزَّن وحدَها** — النقاشُ اليوم (D-298) */
              allowImage={nested}
              onCancel={() => setOpen(null)}
              onSend={(b, sp, img) => send(b, r.replyId, sp, img)}
            />
          </div>
        )}
        {kidsOpen && kid.map((c) => node(c, depth + 1))}
      </div>
    );
  }

  /** **كلُّ ما تحته لا أبناؤه المباشرون** — العددُ يعد الفرعَ كلَّه */
  function countUnder(id: string): number {
    const direct = kids.get(id) ?? [];
    return direct.reduce((n, c) => n + 1 + countUnder(c.replyId), 0);
  }

  /** إرسالٌ تفاؤليّ — ثم مصالحةٌ بالمعرّف الحقيقيّ (D-241) */
  /**
   * 🆕 **والصورةُ تسافر مع المتن** (D-298) — **لا حالةٌ ثانيةٌ هنا تفترق
   * عنه** (نفسُ حجّة `hasSpoiler` في D-271).
   */
  function send(
    body: string,
    parentId: string | null,
    hasSpoiler = false,
    imageUrl?: string | null,
  ) {
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
        /* **والنسخةُ التفاؤليّة تحمل الصورةَ أيضاً** (D-241): من رفع
           صورةً ثم لم يرها في الحال ظنَّ الرفعَ سقط — **والرابطُ بيدنا
           أصلاً فلا انتظارَ لمصالحة.** **وفي حقلها الحقيقيّ** (D-312). */
        imagePath: imageUrl ?? null,
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
                  imageUrl,
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
        /* 🔴 **ونصُّ الخطأ لنا لا للقارئ** (D-302، لقطةُ أحمد: سطرٌ أحمر
           في وسط الغرفة يقول «Minified React error #441; visit
           react.dev/errors/441…»).
           **وNext تُخفي رسائلَ أخطاء الخادم في الإنتاج عمداً** لئلّا
           تُسرّب تفاصيل — **فما يصل العميلَ ليس سببَ العطل، هو رقمُ
           عطلٍ في React ورابطُ توثيق.** **وعرضُه كما هو يعطي القارئَ
           نصّاً لا يفهمه ولا يستطيع فعلَ شيءٍ به** (D-077/D-181: الرسالةُ
           تقول ما جرى وما العمل، **ورقمٌ إنجليزيٌّ في سطحٍ عربيٍّ يُقرأ
           عطلاً في التطبيق نفسِه**).
           **فالمعروضُ جملتُنا، والتفصيلُ إلى `console`** — حيث يقرؤه من
           يصلح لا من يكتب. */
        console.error("thread send failed", e);
        setError(t.errorTitle);
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
        /* **ونفسُ حجّة D-302 أعلاه** — **ونسخةٌ ثانيةٌ من العلاج في
           الملفّ نفسِه تُصلَح معه لا بعده** (D-145). */
        console.error("thread delete failed", e);
        setError(t.errorTitle);
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


/**
 * 🆕 **مرسى الكتابة — على حافّة النافذة المرئيّة** (D-320).
 *
 * **لماذا لا يكفي `fixed bottom-0`:** حين يفتح الكيبورد على iOS تبقى
 * عناصرُ `fixed` مربوطةً بنافذة *التخطيط* — **فيغرق الشريطُ خلف
 * الكيبورد.** و`visualViewport` هي الحقيقة: **ما حجبه الكيبورد =
 * `innerHeight - height - offsetTop`**، فيُرفع الشريطُ بهذا القياس
 * ويُعاد قياسُه مع كلِّ `resize`/`scroll` للنافذة المرئيّة —
 * **الانتظارُ حدثٌ لا مؤقّت** (D-250).
 *
 * **والعرضُ يُقاس من الفاصل لا يُفترض** (D-282): الفاصلُ `h-40` يسكن
 * عمودَ الصفحة نفسَه — أيّاً كان عرضُه — **ويحجز في التدفق مكانَ
 * الشريط كي لا يختفي آخرُ ردٍّ خلفه** (D-138). والنزفُ الجانبيُّ
 * (`bleed`) يعيد امتدادَ `-mx-4 sm:-mx-6` القديم بالقياس.
 *
 * **وحين لا كيبورد** (عتبةُ ٦٠px تُسقط تنفُّسَ أشرطة المتصفّح) يجلس
 * فوق شريط التنقّل بنفس حساب الشريط القديم — ويسقط الحسابُ من `md:`
 * حيث يختفي الشريط.
 */
function KeyboardDock({ children }: { children: React.ReactNode }) {
  const anchor = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  /* 🆕 **والقياسُ صار مشتركاً** (D-359): الارتفاعُ المحجوب من
     `useKeyboardInset` — **والعرضُ وحدَه يبقى هنا لأنه يُقاس من فاصل هذا
     المكوّن لا من النافذة** (D-282). */
  const kb = useKeyboardInset();
  useEffect(() => {
    const read = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const bleed = window.innerWidth >= 640 ? 24 : 16;
      setBox({
        left: Math.max(0, r.left - bleed),
        width: Math.min(window.innerWidth, r.width + bleed * 2),
      });
    };
    read();
    window.addEventListener("resize", read);
    window.visualViewport?.addEventListener("resize", read);
    window.visualViewport?.addEventListener("scroll", read);
    return () => {
      window.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("resize", read);
      window.visualViewport?.removeEventListener("scroll", read);
    };
  }, []);
  const kbOpen = kb > KEYBOARD_MIN;
  return (
    <>
      <div ref={anchor} aria-hidden className="h-40" />
      <div
        className={`fixed z-30 ${
          kbOpen ? "" : "bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:bottom-0"
        }`}
        style={{
          left: box ? box.left : 0,
          width: box ? box.width : "100%",
          ...(kbOpen ? { bottom: kb + 6 } : null),
        }}
      >
        <div className="px-4 sm:px-6 py-3 border-t border-[color:var(--divider)] bg-[color:var(--background)]">
          {children}
        </div>
      </div>
    </>
  );
}
