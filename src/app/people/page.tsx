import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getUser,
  getCommunityFeed,
  getPeopleToFollow,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getTitleRooms,
  getConversations,
  getUnreadShares,
  getFeedSeenAt,
  type ConvShareEvent,
  type FeedItem,
  type PersonLite,
} from "@/lib/data";
import { myMutualFollows } from "@/lib/actions";
import { getT, getHiddenCommunityTabs } from "@/lib/locale";
import type { Dict } from "@/lib/i18n";
import { localizeRows, localizeTitleRooms } from "@/lib/localize";
import { timeAgo } from "@/lib/when";
import { FeedEmptyCta } from "@/components/FeedEmptyCta";
import { PeopleToFollow } from "@/components/PeopleToFollow";
import { Inbox } from "@/components/Inbox";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { PersonName } from "@/components/PersonRow";
import { backdropUrl, posterUrl } from "@/lib/media";
import { getTv, getMovie } from "@/lib/tmdb";
import { Icon } from "@/components/Icon";
import { LikeButton } from "@/components/LikeButton";
import { ReportButton } from "@/components/ReportButton";
import { PageTabs } from "@/components/ui/PageTabs";
import { CommunityTools } from "@/components/CommunityTools";
import { TitleNews } from "@/components/TitleNews";
import { getTitleNews } from "@/lib/titleNews";
import { ScrollMemory } from "@/components/ScrollMemory";
import { FeedSeenSync } from "@/components/FeedSeenSync";
import { NewActivityPill } from "@/components/NewActivityPill";

/** كم عملاً نطلب له صورةً عرضية — سقفٌ يمنع موجة طلباتٍ بحجم الخط */
const BACKDROP_LIMIT = 12;

type Tab = "mine" | "all" | "inbox" | "news";
function asTab(v: string | undefined): Tab {
  return v === "all" || v === "inbox" || v === "news" ? v : "mine";
}

/**
 * ترتيب خطّ النشاط — **درجةٌ واحدة تجمع النوع والعمر والتفاعل** (D-136).
 *
 * طلب أحمد نصّاً: «خلّه ذكي في العرض — التعليقات تأخذ أولوية من التقييم
 * وبعدها المشاهدة، لكن في نفس الوقت الريفيو القديم ينزل والأجدد أولى،
 * والي ياخذ لايك كأنه تجدّد ويبقى فوق أكثر».
 *
 * ثلاثة مطالب متعارضة لا يحلّها فرزٌ متعدّد المفاتيح: الفرز بالنوع أولاً
 * يدفن مشاهدةً وقعت قبل دقيقة تحت مراجعةٍ عمرها أسبوع، والفرز بالوقت
 * أولاً يُلغي الأولوية أصلاً. الحلّ **درجةٌ واحدة** يتنافس فيها الثلاثة:
 *
 *   score = وزنُ النوع − (عمرُ الحدث بالساعات ÷ ٣) + رصيدُ الإعجاب
 *
 *  • **وزن النوع** فارقٌ يعادل ساعاتٍ من العمر لا حاجزاً مطلقاً: مراجعةٌ
 *    مكتوبة تبدأ متقدّمةً بما يوازي يومين على المشاهدة — فتسبقها ما دامتا
 *    متقاربتين في العمر، وتتخلّف عنها إن شاخت. وهذا معنى «تأخذ أولوية»
 *    عند من يقرأ خطّاً لا عند من يقرأ جدولاً.
 *
 *  • **الإعجاب يُجدِّد ولا يُخلِّد**: `log` لا ضربٌ خطّي — أوّل إعجابٍ يرفع
 *    كثيراً والعاشر قليلاً، وسقفُه أربعٌ وعشرون نقطة = **ثلاثة أيامٍ من
 *    العمر**. فمراجعةُ أمسٍ بثمانية إعجابات تسبق مراجعةَ اليوم العارية
 *    («يبقى فوق أكثر»)، ومراجعةُ أربعة أيامٍ بثلاثين إعجاباً **لا** تسبقها
 *    («القديم ينزل»). المعايرة جُرِّبت على تسعة صفوفٍ محاكاة قبل الشحن:
 *    أول توزينٍ جعل الإعجاب يشتري تسعة أيام، فتصدّر الخطَّ صفٌّ عمره أربعة.
 *
 * ولا فرزَ ثانياً بعده: من أراد ترتيباً آخر فليس هذا خطَّه.
 */
const TYPE_WEIGHT: Record<string, number> = {
  review: 30, // مراجعةٌ مكتوبة — رأيٌ يستحق قراءةً وردّاً
  rate: 15, // تقييمٌ برقم
  movie: 6, // فيلمٌ شوهد
  episodes: 6, // حلقاتٌ شوهدت
  add: 0, // أُضيف للمكتبة — أضعف خبرٍ في الخطّ
};
/** كل ثلاث ساعاتٍ تُنقص نقطةً — أي ثماني نقاطٍ في اليوم */
const AGE_HOURS_PER_POINT = 3;
/** أقصى ما يشتريه الإعجاب — بحدٍّ كي لا يصير الخطُّ سباقَ إعجابات */
const LIKE_CEILING = 24;

/**
 * ما لم يُرَ بعدُ يعلو على ما رُئي — **مهما كان نوعه أو عمره** (D-149).
 *
 * ألفُ نقطةٍ ليست معايرةً بل **فصلٌ**: أكبر ما تبلغه الدرجة الطبيعية
 * ثلاثون وزناً زائد أربعٌ وعشرون إعجاباً، فألفٌ تجعل «لم يُرَ» طبقةً
 * فوق الخطّ لا متسابقاً فيه. وداخل الطبقتين تبقى خوارزمية D-134 كما هي
 * حرفياً — النقض في **بعدٍ أُضيف فوقها**، لا في وزنٍ عُدِّل داخلها.
 */
const UNSEEN_BOOST = 1000;

function isUnseen(a: FeedItem, seenAt: number | null): boolean {
  if (seenAt === null) return true; // لم يفتح خطَّه قطّ: كلُّه جديد
  return new Date(a.updated_at).getTime() > seenAt;
}

function feedScore(a: FeedItem, now: number, seenAt: number | null = null): number {
  const weight = TYPE_WEIGHT[a.review ? "review" : a.kind] ?? 0;
  const hours = Math.max(0, (now - new Date(a.updated_at).getTime()) / 3_600_000);
  const likes = Math.min(LIKE_CEILING, Math.log2(1 + Math.max(0, a.likes)) * 6);
  const fresh = isUnseen(a, seenAt) ? UNSEEN_BOOST : 0;
  return fresh + weight + likes - hours / AGE_HOURS_PER_POINT;
}

/**
 * تبديدُ الصفوف: لا يظهر شخصٌ مرّتين متتاليتين ما دام في الخطّ غيرُه.
 *
 * سقفُ الخمسة في SQL يمنع أن يملك شخصٌ الخطَّ **عدداً**، ولا يمنع أن
 * يملكه **بصريّاً**: أوّل تشغيلٍ حيّ أظهر خمسة صفوفٍ متلاصقة لشخصٍ واحد
 * («شاهد الفيلم» ×٥) فقرأ الخطّ كسجلٍّ لا كمجتمع. الترتيب الزمني وحده لا
 * يكفي حين تكون الدائرة صغيرة.
 *
 * جشعٌ بسيط: خذ أوّل صفٍّ صاحبُه غير صاحب سابقه، وإلا فخذ التالي كما هو.
 * الترتيب النسبي لصفوف الشخص الواحد محفوظ، والتكلفة لا شيء عند ستّين صفّاً.
 * **يُطبَّق على «الأحدث» وحده** — «الأكثر إعجاباً» ترتيبُه هو معناه.
 */
function spreadByPerson(rows: FeedItem[]): FeedItem[] {
  const pool = [...rows];
  const out: FeedItem[] = [];
  let last: string | null = null;
  while (pool.length) {
    let i = pool.findIndex((r) => r.person.id !== last);
    if (i === -1) i = 0;
    const [picked] = pool.splice(i, 1);
    out.push(picked);
    last = picked.person.id;
  }
  return out;
}

/**
 * صفُّ النجوم في **عمود المحتوى** لا تحت الملصق (طلب أحمد 9 Aug:
 * «التقييم لا يكون تحت الفلم، يكون في المحتوى وتظهر النجوم»).
 *
 * عشر نجوم لا خمس: هذا هو المقياس الذي يقيّم به المستخدم في `RatingBox`،
 * وقسمتُه على اثنتين للعرض تجعل ما يراه غير ما ضغطه. ونفس الحرف ونفس
 * لون التمييز — لا لغةَ بصريةٍ جديدة، والرقم يبقى بجانبها لمن يقرأ رقماً.
 */
function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="mt-2 flex items-center gap-[1px]" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`text-[13px] leading-none ${
            i < rating ? "text-accent" : "text-muted/25"
          }`}
        >
          ★
        </span>
      ))}
      <span className="text-[12px] text-muted ms-1.5 tabular-nums" dir="ltr">
        {rating}/10
      </span>
    </span>
  );
}

/**
 * سطر الفعل تحت الاسم — «ماذا فعل» في جملةٍ واحدة (D-123).
 *
 * التقييم مع مشاهدةٍ في نفس اليوم يذكرهما معاً («شاهد ٦ حلقات · قيّمه»):
 * الصفّ الواحد ابتلع الحدثين، فالسطر يردّ للمشاهدة ذكرها. وتقييمٌ بمراجعةٍ
 * مكتوبةٍ بلا مشاهدة لا يحتاج سطراً أصلاً — النصّ نفسه هو الخبر.
 */
function actionLine(a: FeedItem, t: Dict): string | null {
  const parts: string[] = [];
  if (a.episodeCount > 0) {
    parts.push(t.feedActEpisodes(a.episodeCount));
    if (a.topSeason > 0) parts.push(t.seasonLabel(a.topSeason));
  }
  if (a.kind === "rate") {
    /* لا كلمة «قيّمه» بعد اليوم (طلب أحمد 9 Aug — شطبها في لقطته):
       صفُّ النجوم تحتها يقول الشيء نفسه بصورةٍ تُقرأ أسرع من كلمة.
       وما بقي في السطر هو المشاهدة التي ابتلعها التقييم إن وُجدت. */
  } else if (a.kind === "movie") {
    parts.push(t.feedActMovie);
  } else if (a.kind === "add") {
    parts.push(t.feedActAdd);
  }
  return parts.length ? parts.join(" · ") : null;
}

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    sort?: string;
    with?: string;
    c?: string;
    k?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const hiddenTabs = await getHiddenCommunityTabs();

  const {
    tab: tabParam,
    sort,
    with: withParam,
    c: cParam,
    k: kParam,
  } = await searchParams;
  const tab = asTab(tabParam);
  /* مرشِّح نوع الحدث (طلب أحمد 9 Aug: «احتاج فلتر التعليقات وفلتر
     التقييمات»). ثلاثة أقسام **متنافية** كي لا يتداخل مرشِّحان:
     «التقييمات» = رقمٌ بلا نصّ · «المراجعات» = رأيٌ مكتوب. والمشاهدات
     تظهر في «الكل» وحده — لها فعلها في السطر ولا تُطلب بذاتها.
     ملاحظة مفردات (D-026): كلمة المنتج للنصّ هي «مراجعة» لا «تعليق» —
     مصطلحٌ واحد لكل مفهوم؛ الفلتر هو ما طلبتَه واللفظ هو لفظ التطبيق. */
  const kind: "rate" | "review" | null =
    kParam === "rate" || kParam === "review" ? kParam : null;
  /* **الأحدث هو الافتراضي منذ D-123**: الخطّ صار يحمل المشاهدة لا المراجعة
     وحدها، وأحداث المشاهدة بلا إعجابات (D-124 لم تُشحن) — فالترتيب
     بالإعجاب كان يدفنها كلّها أسفل الصفحة ويعيد الخطّ إلى شكله القديم.
     والطزاجة هي ما يقول «الموقع حيّ». `?sort=top` يعيد القديم. */
  const newest = sort !== "top";
  const openWith = tab === "inbox" && withParam ? withParam : null;

  /* الخطّان يُبنيان معاً كي يحمل التبويبان عدّادَيهما دائماً — كصفّ شرائح
     المكتبة (١٨ مسلسلاً · ١٨ فيلماً). كلٌّ نداءا definer خفيفان؛ والترجمة
     والصور العرضية للنشِط وحده. والرسائل تُقرأ عند الحاجة فقط. */
  /* «المجتمع» صار دليلَ مجتمعاتٍ لا خطَّ تفاعلات (قرار المالك): خطُّ
     الجميع أُسقط — «مجتمعي» يكفي لدائرتك والتقييمات في صفحة كل عمل —
     فسقط طلبُه أيضاً، وحلّ محلّه نداءُ مجتمعاتي الخفيف لعدّاد التبويب. */
  /* سقط استعلاما قوائم المتابعة وطلباتها من هذه الصفحة مع سقوط شريطها
     (طلب أحمد): عدّاداهما انتقلا إلى ترويسة الرئيسية، فبقاؤهما هنا
     استعلامان يُدفعان في كل فتحةٍ لصفحةٍ لم تعد تعرضهما */
  const [followingFeed, myCommunities, myInvites, unread] = await Promise.all([
    getCommunityFeed("following"),
    getMyCommunities(),
    // دعواتي المعلّقة (هجرة 42) — قسم «دعوات» فوق مجتمعاتي في الدليل
    getMyCommunityInvites(),
    getUnreadShares(),
  ]);

  const allCount = myCommunities.length;

  // غرفةٌ مفتوحة؟ («‎?tab=all&c=<id>‎» — الحالة في الرابط كالوارد، D-051/D-054)
  const openCommunityRaw =
    tab === "all" && cParam ? await getCommunityRoom(cParam) : null;

  /* غرف الأعمال الحيّة (D-140) — لتبويب الدليل وحده وحين لا غرفة مفتوحة:
     نداءٌ لا يُدفع في تبويبٍ لا يعرضه */
  const titleRoomsRaw =
    tab === "all" && !openCommunityRaw ? await getTitleRooms(12) : [];

  /* اسمُ غرفة العمل بلغة القارئ لا بلغة أوّل من ولّدها (D-147).
     الصفحة هي من يملك `locale` لا طبقةُ البيانات — قاعدة D-048 نفسها. */
  const titleRooms = await localizeTitleRooms(titleRoomsRaw, locale);
  const openCommunity = openCommunityRaw
    ? (await localizeTitleRooms([openCommunityRaw], locale))[0]
    : null;

  // ===== الرسائل — محادثةٌ لكل شخص =====
  // ترجمة عناوين الأعمال المُشارَكة عند العرض (D-048): نجمع أحداث المشاركة
  // من كل المحادثات، نترجمها دفعةً، ثم نعيدها إلى مواضعها بمعرّفاتها
  let conversations = tab === "inbox" ? await getConversations() : [];
  if (conversations.length) {
    const shareEvents = conversations.flatMap((c) =>
      c.events.filter((e): e is ConvShareEvent => e.kind === "share"),
    );
    const localized = await localizeRows(shareEvents, locale);
    const byId = new Map(localized.map((s) => [s.id, s]));
    conversations = conversations.map((c) => ({
      ...c,
      events: c.events.map((e) => (e.kind === "share" ? byId.get(e.id) ?? e : e)),
    }));
  }

  // من نبدأ معه: المتابَعون المتبادلون ممّن لا خيط معهم بعد (طلب المالك —
  // «ابدأ محادثة مع شخص جديد» مع بقاء قاعدة «لا محادثة من فراغ»، D-051).
  // يُطلب للوارد وحده، ويُطرح منه أصحاب المحادثات القائمة كي لا يتكرّروا.
  let startable: PersonLite[] = [];
  if (tab === "inbox") {
    const withConv = new Set(conversations.map((c) => c.personId));
    startable = (await myMutualFollows()).filter((p) => !withConv.has(p.id));
  }

  /* ختمُ «آخر مرّة رأى خطَّه» (D-149) — يُقرأ لتبويب «مجتمعي» وحده،
     فلا يُدفع نداءٌ في تبويبٍ لا يرتّب شيئاً */
  const feedSeenAt = tab === "mine" ? await getFeedSeenAt() : null;

  // ===== خطّ الآراء — لتبويب «مجتمعي» وحده الآن =====
  /* **المرجع أحدثُ حدثٍ في الخطّ لا ساعةُ النظام.** الدرجة تطرح العمر
     طرحاً خطّياً، وطرحُ ثابتٍ واحد من كل الدرجات لا يغيّر ترتيبها — فأيّ
     مرجعٍ ثابت يعطي الترتيب نفسه. واختيارُ أحدث حدثٍ يجعل الدالّة **نقيّة
     وقابلة للاختبار**، ويُرضي قاعدة React التي تمنع قراءة الساعة أثناء
     الرسم (لولاها لاختلف ترتيبُ إعادةِ رسمٍ عن سابقتها بلا سبب). */
  const scoredAt = followingFeed.reduce(
    (m, a) => Math.max(m, new Date(a.updated_at).getTime()),
    0,
  );

  const sorted =
    tab !== "mine"
      ? []
      : (await localizeRows(followingFeed, locale))
          .filter((a) =>
            kind === "review"
              ? Boolean(a.review)
              : kind === "rate"
                ? a.kind === "rate" && !a.review
                : true,
          )
          .sort((a, b) =>
            newest
              ? feedScore(b, scoredAt, feedSeenAt) - feedScore(a, scoredAt, feedSeenAt) ||
                b.updated_at.localeCompare(a.updated_at)
              : b.likes - a.likes || b.updated_at.localeCompare(a.updated_at),
          );
  const feed = newest ? spreadByPerson(sorted) : sorted;

  /* «أشخاص لمتابعتهم» (D-126) — تُطلب حين يكون الخطّ هزيلاً لا فارغاً
     وحده: دائرةٌ من شخصين تُنتج خطّاً صامتاً كدائرةٍ من صفر، والفرق أن
     الأولى لا تُظهر حالةً فارغة فتبدو الصفحة معطوبة لا ناقصة.
     ونداءٌ ثانٍ مشروط لا يدخل `Promise.all`: أكثر الحسابات دائرتُها
     نشطة، فلا يُدفع ثمنُه إلا من يحتاجه. والمرشِّح يُلغيه — فراغُ
     مرشِّحٍ ليس فراغ دائرة (نفس تفريق D-106). */
  /* الأخبار للتبويب الرابع وحده: قسم «جديد فنّانيك» فيها يكلّف نداءات
     TMDB، ودفعُها في كل فتحةٍ للمجتمع ثمنٌ يدفعه من لم يفتح التبويب */
  const news = tab === "news" ? await getTitleNews() : [];

  const FEED_THIN = 5;
  const suggestions =
    tab === "mine" && kind === null && feed.length < FEED_THIN
      ? await getPeopleToFollow(null, 5)
      : [];

  /* الصورة العرضية ليست في صفّ التقييم — تُطلب من TMDB لأوائل الخط فقط،
     متوازيةً ومخزَّنة ساعةً في طبقة fetch. الأولوية: عرضيّة TMDB، ثم
     ملصقها، ثم الملصق المخزَّن، ثم الأيقونة. */
  const artTargets = feed.slice(0, BACKDROP_LIMIT);
  const artPairs = await Promise.all(
    artTargets.map(async (a) => {
      const key = `${a.media_type}-${a.tmdb_id}`;
      try {
        const d =
          a.media_type === "tv" ? await getTv(a.tmdb_id) : await getMovie(a.tmdb_id);
        return [key, { backdrop: d.backdrop_path, poster: d.poster_path }] as const;
      } catch {
        return [key, { backdrop: null, poster: null }] as const;
      }
    }),
  );
  const artById = new Map(artPairs);

  // روابط التبويبات — الحالة في الرابط كبقيّة التطبيق: قابلةٌ للمشاركة
  // وللرجوع، وتُرسم على الخادم فلا وميض
  /* **بلا عدّادٍ على «النشاط»** (D-134): الرقم كان طول الخطّ لا عدد
     أصدقائك — «٦٠» بجانب اسمٍ يقرؤه المستخدم «٦٠ شخصاً» وهي ستّون
     حدثاً في ثلاثين يوماً. رقمٌ يُقرأ خطأً أسوأ من لا رقم، وحذفُه
     يُفسح للتبويب الرابع عرضاً على الشاشة الضيّقة. عدّاد «المجتمع»
     يبقى (جردٌ صادق: عدد مجتمعاتك)، وشارة الرسائل تبقى (إشارةٌ تطلب
     فعلاً لا جرد). */
  const tabs = [
    { key: "mine", href: "/people", label: t.communityTabMine },
    { key: "all", href: "/people?tab=all", label: t.communityTabAll, count: allCount },
    {
      key: "inbox",
      href: "/people?tab=inbox",
      label: t.communityTabInbox,
      badge: unread,
      badgeLabel: t.communityUnreadAria(unread),
    },
    /* التبويب الرابع (طلب أحمد): **بلا عدّاد** — عدد الأخبار ليس مهمّةً
       تنتظر، وشارةٌ تُلحّ على خبرٍ لا يُطلب فعلاً تُدرَّب عين المستخدم
       على تجاهل الشارات كلّها */
    { key: "news", href: "/people?tab=news", label: t.communityTabNews },
  ];

  /* التبويبات المخفيّة (D-177) — من الكوكي على الخادم، فلا يومض تبويبٌ
     ثم يختفي. **والتبويب المفتوح لا يُخفى من نفسه**: من أخفى تبويباً وهو
     واقفٌ فيه يبقى يراه حتى يغادره، وإلا اختفت الصفحة تحت قدميه. */
  const visibleTabs = tabs.filter((x) => x.key === tab || !hiddenTabs.includes(x.key));

  return (
    <div className="space-y-5">
      {/* ذاكرة موضع التمرير — العائد من ملف صديقٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* العنوان مخفيٌّ بصريّاً وباقٍ لقارئ الشاشة — أُزيلت كلمة «المجتمع»
          المرئية، وانتقل عدّادا المتابعة وزرّ الإضافة إلى صفّ الترتيب أسفل
          التبويبات (طلب المالك) */}
      <h1 className="sr-only">{t.peopleTitle}</h1>

      {/* ===== رأس التبويبات =====
          `PageTabs` المشترك (D-134): نفس الموضع الرأسيّ في المكتبة
          واكتشف، وخطٌّ فاصلٌ **واحد**. وصفُّ الفرز والمرشِّح الذي كان
          تحته **حُذف** بطلب أحمد — انظر تعليق `newest`/`kind`. */}
      <PageTabs
        items={visibleTabs}
        active={tab}
        ariaLabel={t.communityTabsGroup}
        asNav
        /* رمزُ الأدوات (D-177) — نفس الزرّ ونفس المقاس في المكتبة واكتشف */
        action={
          <CommunityTools
            locale={locale}
            hidden={hiddenTabs}
            labels={Object.fromEntries(tabs.map((x) => [x.key, x.label]))}
          />
        }
      />

      {/* ===== محتوى التبويب ===== */}
      {tab === "news" ? (
        <TitleNews items={news} locale={locale} />
      ) : tab === "inbox" ? (
        <Inbox
          conversations={conversations}
          startable={startable}
          openWith={openWith}
          locale={locale}
        />
      ) : tab === "all" ? (
        openCommunity ? (
          <CommunityRoom room={openCommunity} locale={locale} />
        ) : (
          <CommunityDirectory
            mine={myCommunities}
            invites={myInvites}
            titleRooms={titleRooms}
            locale={locale}
          />
        )
      ) : (
        <section>
          {feed.length === 0 ? (
            /* حالةٌ موجَّهة لا جملةٌ تشخّص (تقييم 9 Aug م٦): الزرّ يفتح
               ورقة البحث عن الأشخاص — أول خطوةٍ للخروج من الفراغ.
               **لكن الفراغ الناتج عن مرشِّحٍ ليس فراغ دائرة**: اقتراح
               «ابحث عن أصدقاء» هناك تشخيصٌ خاطئ، والصواب جملةٌ تقول
               إن هذا النوع وحده خالٍ */
            kind !== null ? (
              <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-8 px-5 text-center">
                {t.feedFilterEmpty}
              </p>
            ) : (
              /* الحالة الفارغة تطوّرت من جملةٍ وزرّ بحث إلى أسماءٍ حقيقية
                 (D-126): «ابحث عن أصدقاء» يفترض أنه يعرف من يبحث عنه */
              <>
                <FeedEmptyCta locale={locale} />
                <PeopleToFollow people={suggestions} locale={locale} />
              </>
            )
          ) : (
            <>
            {/* الختم بعد الرسم لا قبله — انظر FeedSeenSync (D-149) */}
            <FeedSeenSync stamp={scoredAt} />
            {/* الشارة العائمة (D-151): الجديد لا يُقحم فوق ما تقرؤه */}
            {newest && <NewActivityPill locale={locale} />}
            <div className="divide-y divide-[color:var(--divider)]">
              {feed.map((a) => {
                const found = artById.get(`${a.media_type}-${a.tmdb_id}`);
                const line = actionLine(a, t);
                /* علامةُ «جديد» على ما لم يُرَ (D-149): الترتيب وحده لا
                   يُعلِم القارئ **لماذا** علا هذا الصفّ — والنقطة أرخص من
                   كلمة وتُقرأ في لمحة. تظهر في «الأحدث» وحده: «الأكثر
                   إعجاباً» ترتيبُه هو معناه ولا جِدّةَ فيه. */
                const unseen = newest && isUnseen(a, feedSeenAt);
                const art =
                  backdropUrl(found?.backdrop ?? null, "w500") ??
                  posterUrl(found?.poster ?? a.poster_path, "w342");
                return (
                  <article
                    key={`${a.person.id}-${a.media_type}-${a.tmdb_id}-${a.day}`}
                    className="py-4 first:pt-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <PersonName
                          person={a.person}
                          t={t}
                          size={34}
                          sub={timeAgo(a.updated_at, t)}
                        />
                        {unseen && (
                          <span
                            className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-accent"
                            title={t.feedUnseen}
                          >
                            <span
                              aria-hidden
                              className="w-1.5 h-1.5 rounded-full bg-accent"
                            />
                            {t.feedUnseen}
                          </span>
                        )}

                        {/* سطر الفعل: ما الذي حدث. يظهر لغير المراجعات، ومع
                            المراجعة إن حملت مشاهدةً في نفس اليوم (التقييم
                            يبتلع المشاهدة ولا يلغيها — D-123) */}
                        {line && <p className="mt-2.5 text-[13px] text-muted">{line}</p>}

                        {a.rating !== null && (
                          <Stars rating={a.rating} label={t.rateOutOf(a.rating)} />
                        )}

                        {a.review && (
                          <p className="text-[15px] leading-relaxed whitespace-pre-line mt-2">
                            {a.review}
                          </p>
                        )}

                        {/* الإعجاب على **كل** حدث (D-124): صفُّ التقييم
                            يكتب في `review_likes` وغيرُه في
                            `activity_likes`. أما البلاغ فللنصّ المكتوب
                            وحده — لا يُبلَّغ عن مشاهدةٍ لا رأي فيها */}
                        <div className="mt-2 flex items-center gap-1">
                          <LikeButton
                            reviewUserId={a.person.id}
                            tmdbId={a.tmdb_id}
                            mediaType={a.media_type}
                            likes={a.likes}
                            likedByMe={a.likedByMe}
                            isMine={false}
                            target={a.kind === "rate" ? "review" : "activity"}
                            day={a.day}
                            locale={locale}
                          />
                          {a.review && (
                            <ReportButton
                              reviewUserId={a.person.id}
                              tmdbId={a.tmdb_id}
                              mediaType={a.media_type}
                              locale={locale}
                            />
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/${a.media_type === "tv" ? "show" : "movie"}/${a.tmdb_id}`}
                        prefetch={false}
                        className="shrink-0 w-28 sm:w-40 group"
                      >
                        <span className="relative block w-full aspect-video rounded-lg overflow-hidden bg-surface-2">
                          {art ? (
                            <Image
                              src={art}
                              alt=""
                              fill
                              sizes="(max-width: 640px) 112px, 160px"
                              className="object-cover"
                            />
                          ) : (
                            <span
                              className="w-full h-full grid place-items-center text-muted"
                              aria-hidden
                            >
                              <Icon name="film" size={16} />
                            </span>
                          )}
                        </span>

                        <span className="mt-1.5 block text-[13px] font-semibold leading-snug truncate group-hover:text-accent transition">
                          {a.title ?? "—"}
                        </span>

                        {/* النوع وحده تحت الملصق — التقييم انتقل إلى عمود
                            المحتوى نجوماً (طلب أحمد)، وبقاؤه هنا تكرارٌ
                            لرقمٍ واحد في مكانين */}
                        <span className="mt-0.5 block text-[11px] text-muted truncate">
                          {a.media_type === "tv" ? t.typeSeries : t.typeMovie}
                        </span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
            {/* خطٌّ هزيل: الاقتراح **بعد** الصفوف لا قبلها — ما فعلته
                دائرتك أهمّ ممّن قد تضيفه إليها */}
            <PeopleToFollow people={suggestions} locale={locale} compact />
            </>
          )}
        </section>
      )}
    </div>
  );
}
