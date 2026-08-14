import { redirect } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import {
  getUser,
  getLoopzNews,
  getNewsGenStale,
  refreshLoopzNews,
  getCommunityFeed,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getTitleRooms,
  getTalkStats,
  getFollows,
  getReactions,
  getFollowingIds,
} from "@/lib/data";
import { getT, getTabPrefs } from "@/lib/locale";
import { WorksTalk, groupByWork } from "@/components/WorksTalk";
import { ActivityFeed } from "@/components/ActivityFeed";
import { applyTabPrefs, defaultTab } from "@/lib/tabPrefs";
import { localizeRows, localizeTitleRooms } from "@/lib/localize";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { PageTabs } from "@/components/ui/PageTabs";
import { CommunityTools } from "@/components/CommunityTools";
import { TitleNews } from "@/components/TitleNews";
import { getTitleNews } from "@/lib/titleNews";
import { ScrollMemory } from "@/components/ScrollMemory";


/**
 * **تبويبان اليوم: النشاط · نقاش** — و«الناس» يأتي في دفعته (طلبُ أحمد
 * ١٤ أغسطس: «اكتيفتي ثم نقاشات ثم People»، و«People صفحةٌ جديدة… حالياً
 * ركّز تُقفل اكتيفتي»).
 *
 * **و«النشاط» يبتلع «خبر»** بنصّ أحمد: «الأخبار تُدمج مع اكتيفتي» —
 * تعليقاتُ الناس وأخبارُنا نحن في خطٍّ واحدٍ مرتَّبٍ بالزمن
 * (`ActivityFeed`). **وحجّتُه أن التبويبين كانا يقتسمان قارئاً واحداً
 * ومحتوًى شحيحاً**، وخطّان رفيعان يجعلان كليهما يبدو ميّتاً.
 *
 * ⚠️ **و«أخبارُ أعمالك» (`TitleNews`) لم تُدمج، وبقيت خلف `?tab=news`**
 * — **وهذا حكمٌ لا سهو**، لسببين يُقالان:
 * **الأوّل أن نصفَ صفوفها مستقبلٌ لا ماضٍ** («يصدر بعد أسبوعين»)، **وخطٌّ
 * يرتّب بالزمن لا يحمل ما لم يقع بعد**.
 * **والثاني أن قسم «جديد فنّانيك» يكلّف اثني عشر نداءَ TMDB**، ووضعُه في
 * التبويب الافتراضيّ يجعل كلَّ فتحةٍ للمجتمع تدفعها.
 * **والرابطُ يبقى حيّاً** كما بقي `?tab=all` — يُخفى ولا يُحذف (D-219).
 *
 * **(وما سبق من نصّ D-219 يبقى للحجّة، وما نُقض منه مُعلَّمٌ أعلاه.)**
 *
 * **ثلاثةُ تبويبات: تعليقات · نقاش · خبر** (D-219، طلبُ أحمد بلوحاته).
 *
 * **و«تعليقات» نقضٌ مقصودٌ لجزءٍ من D-187 لا نسيانٌ له:** يومها جُمّع
 * الخطُّ بالعمل لأن «عن ماذا يتكلّم الناس؟» أنفعُ من «من تكلّم؟».
 * **والسؤالان كلاهما صحيح** — فصارا تبويبين بدل أن يتنافسا على واحد.
 *
 * ⚠️ **و`all` باقٍ نوعاً ولا يظهر شريحةً** (اختيارُ أحمد: «يُخفى تماماً
 * الآن»). **والفرقُ بين «يُخفى» و«يُحذف» ليس تفصيلاً:** صفحةُ العمل تحمل
 * `TitleRoomLink` تُشير إلى `‎/people?tab=all&c=<id>`، **وحذفُ الفرع كان
 * يكسر رابطاً حيّاً في سطحٍ آخر** — **يُفحص المستهلك قبل الحذف** (D-214).
 * فالغرفةُ تُفتح بالرابط، **ولا شريحةَ لها في الصفّ.**
 */
type Tab = "activity" | "talk" | "news" | "all";
function asTab(v: string | undefined): Tab {
  /* **`comments` وريثُه `activity` حرفاً** — نفسُ التعليقات ومعها الأخبار.
     ورابطٌ محفوظٌ أو مشاركٌ في محادثةٍ لا يجوز أن يموت بتغييرِ اسم. */
  if (v === "activity" || v === "comments") return "activity";
  /* المفاتيحُ القديمة (`works` · `mine` · `reviews`) تسقط إلى «نقاش» —
     **وهو وريثُها حرفاً**: نفسُ `WorksTalk` ونفسُ التجميع. **وروابطُ
     محفوظةٌ ومشاركةٌ في محادثات لا يجوز أن تموت بتغييرِ تبويب** (D-187). */
  return v === "news" || v === "all" ? v : "talk";
}

/* **سقطت هنا خوارزميةُ ترتيب الخطّ كاملةً (D-134/D-136/D-149)** مع
   سقوط خطّ البطاقات في D-187: أوزانُ الأنواع وتناقصُ العمر وسقفُ
   الإعجاب وطبقةُ «لم يُرَ». **وصفُّ «الأعمال» يرتّب بأحدث رأي** —
   والترتيبُ في `groupByWork` بموضعٍ واحد.
   ولا تُستنسخ من هنا يوماً: نصُّها ومعايرتُها في تاريخ الملفّ. */






export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    scope?: string;

    c?: string;
    with?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const tabPrefs = await getTabPrefs("community");

  const {
    tab: tabParam,
    scope: sParam,
    c: cParam,
    with: withParam,
  } = await searchParams;
  /* **الروابط القديمة لا تموت** (D-187): `‎/people?tab=inbox` كان يُشارَك
     في محادثاتٍ ويُحفظ في المتصفّحات. يُحوَّل إلى بيته الجديد ومعه الخيط
     المفتوح إن كان — تحويلٌ دائم، فالمسار انتقل ولم يتعطّل. */
  if (tabParam === "inbox") {
    redirect(withParam ? `/messages?with=${encodeURIComponent(withParam)}` : "/messages");
  }
  const tab = tabParam ? asTab(tabParam) : asTab(defaultTab(tabPrefs, "activity"));
  /* **نطاقُ «الأعمال»: الكلُّ افتراضاً** (D-187، طلب أحمد: «أحتاج الكل
     يقدر يتفاعل مع الآخر»). دائرةُ المستخدم الجديد فارغة، **وخطٌّ مشروطٌ
     بمتابعاتٍ لم تُبنَ بعد يبدو تطبيقاً ميّتاً لا تبويباً فارغاً**.
     ⚠️ **وتصحيحٌ يُقال:** ظننتُ `community_activity` مبنيّةً في القاعدة
     فكتبتُ ذلك، **والفحصُ على `pg_proc` أثبت أنها غير موجودة** — ملفُّها
     `supabase/community_feed.sql` (الهجرة ٢٧) مكتوبٌ ولم يُشغَّل قطّ.
     فحتى تُشغَّل، يرتدّ `getCommunityFeed` إلى خطّ المتابَعين (انظر
     تعليقه)، **ولا هجرةَ جديدة ولا سياسة قراءةٍ خامسة** حين تُشغَّل:
     الدالّة تُخفي الاسم في SQL وتستثني المبلَّغ عنه وصاحبَ الحساب. */
  const scope: "all" | "following" = sParam === "following" ? "following" : "all";
  /* **سقطا مع خطّ البطاقات (D-187):** مرشِّحُ نوع الحدث (`?k=`) —
     صار «الأعمال» مراجعاتٍ كلَّها فلا نوعَ يُرشَّح — وترتيبُ «الأكثر
     إعجاباً» (`?sort=top`): الصفُّ عملٌ لا حدثٌ، وإعجاباتُ الأعمال ليست
     مجموعَ إعجابات آرائها. **يعودان يوم يكون لهما معنًى، لا قبله.** */

  /* الخطّان يُبنيان معاً كي يحمل التبويبان عدّادَيهما دائماً — كصفّ شرائح
     المكتبة (١٨ مسلسلاً · ١٨ فيلماً). كلٌّ نداءا definer خفيفان؛ والترجمة
     والصور العرضية للنشِط وحده. والرسائل تُقرأ عند الحاجة فقط. */
  /* «المجتمع» صار دليلَ مجتمعاتٍ لا خطَّ تفاعلات (قرار المالك): خطُّ
     الجميع أُسقط — «مجتمعي» يكفي لدائرتك والتقييمات في صفحة كل عمل —
     فسقط طلبُه أيضاً، وحلّ محلّه نداءُ مجتمعاتي الخفيف لعدّاد التبويب. */
  /* سقط استعلاما قوائم المتابعة وطلباتها من هذه الصفحة مع سقوط شريطها
     (طلب أحمد): عدّاداهما انتقلا إلى ترويسة الرئيسية، فبقاؤهما هنا
     استعلامان يُدفعان في كل فتحةٍ لصفحةٍ لم تعد تعرضهما */
  /* **ونداءا المجتمعات صارا مشروطين بتبويبهما** (D-219): شريحتُهما أُزيلت
     من الصفّ، **فلم يعد لهما عدّادٌ يُدفع ثمنُه في كل فتحة** — ولا
     يُقرآن إلا لمن وصل بالرابط. **مكسبٌ لم يكن مقصوداً من إخفاء
     الشريحة، ويُقال لأنه يوضّح لماذا الفرعُ باقٍ.** */
  const followingFeed = tab === "all" ? [] : await getCommunityFeed(scope);
  const [myCommunities, myInvites] =
    tab === "all"
      ? await Promise.all([
          getMyCommunities(),
          // دعواتي المعلّقة (هجرة 42) — قسم «دعوات» فوق مجتمعاتي في الدليل
          getMyCommunityInvites(),
        ])
      : [[], []];

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

  /* **الرسائل غادرت هذه الصفحة إلى `/messages`** (D-187) — ومعها
     `getConversations` و`myMutualFollows` وترجمةُ أحداث المشاركة، **نقلاً
     لا نسخاً**. والرابط القديم `?tab=inbox` يُحوَّل أعلاه. */

  /* **الأعمال لا الآراء** (D-187): الخطّ يُجمَّع بالعمل في `groupByWork`،
     فيقرأ المستخدم «عن ماذا يتكلّم الناس» لا «من تكلّم». والترجمة قبل
     التجميع لا بعده: العنوان مفتاحُ العرض، ولو جُمّع بالعنوان المخزَّن
     لانقسم العملُ الواحد بين لغتين (D-048). */
  /* **والخطُّ نفسُه يخدم تبويبين** (D-219): «نقاش» يجمّعه بالعمل،
     و«تعليقات» يعرضه كما هو صفّاً صفّاً. **نداءٌ واحد لسؤالين**، والترجمةُ
     قبل التجميع لا بعده كما كانت. */
  const localized =
    tab === "talk" || tab === "activity" ? await localizeRows(followingFeed, locale) : [];
  const works = tab === "talk" ? groupByWork(localized) : [];

  /* أرقامُ البطاقة (D-193): الردودُ ومن شاهد — **نداءٌ واحد للأعمال كلّها**
     (`title_talk_stats`) لا نداءٌ لكل صفّ. ولا يُدفع إلا في تبويبه، ولا
     يُدفع لخطٍّ فارغ. **وسقوطُه لا يُسقط الصفّ**: الدالّة تُرجع خريطةً
     فارغة فتُخفى الأرقام ويبقى الكلامُ مقروءاً. */
  /* **ونداءٌ واحدٌ يخدم التبويبين** (D-198): «نقاش» يعرض الردودَ والمشاهدين
     على بطاقة العمل، و«النشاط» يعرض «كم شاهده» في ذيل الصفّ — **ومصدرٌ
     واحد لقسمين خيرٌ من دالّتين تختلفان يوماً.** */
  const talkStats =
    works.length || tab === "activity" ? await getTalkStats() : undefined;

  /* «أشخاص لمتابعتهم» (D-126) — تُطلب حين يكون الخطّ هزيلاً لا فارغاً
     وحده: دائرةٌ من شخصين تُنتج خطّاً صامتاً كدائرةٍ من صفر، والفرق أن
     الأولى لا تُظهر حالةً فارغة فتبدو الصفحة معطوبة لا ناقصة.
     ونداءٌ ثانٍ مشروط لا يدخل `Promise.all`: أكثر الحسابات دائرتُها
     نشطة، فلا يُدفع ثمنُه إلا من يحتاجه. والمرشِّح يُلغيه — فراغُ
     مرشِّحٍ ليس فراغ دائرة (نفس تفريق D-106). */
  /* الأخبار للتبويب الرابع وحده: قسم «جديد فنّانيك» فيها يكلّف نداءات
     TMDB، ودفعُها في كل فتحةٍ للمجتمع ثمنٌ يدفعه من لم يفتح التبويب */
  const news = tab === "news" ? await getTitleNews() : [];
  /* **أخبارُنا نحن** (D-211): حقائقُ نرصدها ونكتبها، بلا رابطٍ خارجيّ
     ولا مصدرٍ يُخفى — **والعناوينُ المجمَّعة رُفعت من الواجهة بطلب أحمد**
     (الجدولُ والمسار باقيان للفحص، انظر `05`)

     **وسقفُها اثنا عشر لا ثلاثون** بعد الدمج: الخبرُ يُولَّد ذاتياً كلَّ
     دورةٍ والتعليقُ يُكتب بيد إنسان، **فسقفٌ واسعٌ يدفن كلامَ الناس تحت
     رصدنا نحن** — والتبويب اسمُه «النشاط» لا «الأخبار».
     **ولا خبرَ في «من أتابع»**: الرقاقةُ تسأل «كلامُ مَن؟»، **وخبرُنا
     ليس كلامَ أحدٍ تتابعه** — فبقاؤه فيها يجعل الرقاقتين بلا فرق. */
  const genNews =
    tab === "activity" && scope === "all" ? await getLoopzNews(12) : [];
  /* **التجديدُ بحركة المرور** (اختيارُ أحمد في D-210، ويُعاد هنا): من فتح
     التبويب بعد عشر دقائق يُطلق دورةَ رصدٍ **بعد إرسال الصفحة** فلا
     ينتظرها — ولا صفَّ cron ولا سرَّ في البيئة.
     **والبوّابةُ زمنٌ لا حركة**: انتقالُها إلى التبويب الافتراضيّ يزيد
     عددَ من يمرّ بها ولا يزيد عددَ الدورات — أوّلُ مارٍّ بعد العشر
     دقائق يُطلقها، ومن بعده يجدها غيرَ مستحقّة. */
  if (tab === "activity" && (await getNewsGenStale(10))) {
    after(() => refreshLoopzNews());
  }

  /* **حالةُ «+ للمشاهدة» الابتدائية** (D-205/D-223): **نداءٌ واحدٌ
     مخزَّنٌ (`cache`) للصفحة كلِّها**، لا سؤالٌ من كل بطاقة — ثلاثون بطاقةً
     تسأل عن نفسها ثلاثون استعلاماً. **ولا يُدفع إلا في تبويبه.** */
  const followed =
    tab === "activity"
      ? new Set((await getFollows()).map((f) => `${f.media_type}-${f.tmdb_id}`))
      : new Set<string>();

  /* **إعجاباتُ أخبارِنا** (D-224): `post_reactions` القائم منذ `news.sql`،
     **بنداءٍ واحدٍ للقائمة كلِّها** (`reaction_counts` — دالّة definer
     تعدّ في Postgres ولا تكشف معرّف من تفاعل). ولا يُدفع لخطٍّ بلا أخبار. */
  const postLikes = genNews.length
    ? await getReactions(genNews.map((n) => n.tmdb_id))
    : { counts: {}, mine: new Set<string>() };

  /* مَن أتابعهم — لصفّ المتابعة في قائمة نقاط كل صفّ (D-225) */
  const followingIds = tab === "activity" ? await getFollowingIds() : new Set<string>();

  /* **سقط مع خطّ البطاقات:** «أشخاصٌ لمتابعتهم» (D-126) والصورُ
     العرضية (نداءُ TMDB لأوائل الخطّ). صفُّ «الأعمال» يعرض الملصق الذي
     يحمله الصفُّ نفسه — **فلا نداءَ خارجيّاً واحداً في هذا التبويب بعد
     اليوم**، وهو مكسبٌ لم يكن مقصوداً من إعادة التنظيم.
     و«أشخاصٌ لمتابعتهم» يعود يوم يصير له سطحٌ يستحقّه — والفراغُ اليوم
     يدلّ على «الكل» بدل أن يقترح غرباء. */

  // روابط التبويبات — الحالة في الرابط كبقيّة التطبيق: قابلةٌ للمشاركة
  // وللرجوع، وتُرسم على الخادم فلا وميض
  /* **بلا عدّادٍ على «النشاط»** (D-134): الرقم كان طول الخطّ لا عدد
     أصدقائك — «٦٠» بجانب اسمٍ يقرؤه المستخدم «٦٠ شخصاً» وهي ستّون
     حدثاً في ثلاثين يوماً. رقمٌ يُقرأ خطأً أسوأ من لا رقم، وحذفُه
     يُفسح للتبويب الرابع عرضاً على الشاشة الضيّقة. عدّاد «المجتمع»
     يبقى (جردٌ صادق: عدد مجتمعاتك)، وشارة الرسائل تبقى (إشارةٌ تطلب
     فعلاً لا جرد). */
  const tabs = [
    /* **اثنان بترتيب أحمد** (١٤ أغسطس): النشاط · نقاش — **و«الناس»
       ثالثاً حين يُعرف محتواه.**
       **و«النشاط» أوّلاً لأنه أسرعُ ما يُقرأ**: سطرٌ من إنسانٍ عن عمل،
       أو سطرٌ منّا عمّا جدَّ فيه — بلا تجميعٍ ولا مقدّمة.
       **و«المجتمعات» و«أخبارُ أعمالك» ليستا هنا** — تُفتحان بالرابط،
       وشريحتاهما أُزيلتا باختيار أحمد.
       ⚠️ **والمفتاحُ نفسُه في `TAB_SURFACES`** — تبويبٌ يُعاد تسميته
       يُعاد تسميتُه في مكانين (D-220). */
    { key: "activity", href: "/people", label: t.communityTabMine },
    { key: "talk", href: "/people?tab=talk", label: t.communityTabWorks },
  ];


  /* التبويبات المخفيّة (D-177) — من الكوكي على الخادم، فلا يومض تبويبٌ
     ثم يختفي. **والتبويب المفتوح لا يُخفى من نفسه**: من أخفى تبويباً وهو
     واقفٌ فيه يبقى يراه حتى يغادره، وإلا اختفت الصفحة تحت قدميه. */
  const visibleTabs = applyTabPrefs(tabs, tabPrefs, tab);

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
            prefs={tabPrefs}
            labels={Object.fromEntries(tabs.map((x) => [x.key, x.label]))}
          />
        }
      />

      {/* ===== محتوى التبويب ===== */}
      {tab === "news" ? (
        /* **«أخبارُ أعمالك» وحدها** — أخبارُنا انتقلت إلى «النشاط»
           (انظر رأس الملفّ). **وفرعٌ بلا شريحة كفرع «المجتمعات»**:
           يُفتح بالرابط فلا يموت رابطٌ مشارَك، ولا يُدفع ثمنُ نداءات
           TMDB في التبويب الافتراضيّ. */
        <div>
          <h2 className="text-[15px] font-bold mb-2">{t.communityTabNews}</h2>
          <TitleNews items={news} locale={locale} />
        </div>
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
        /* **عمودُ قراءةٍ مسقوف** (D-225): على الشاشة العريضة كان سطرُ
           التعليق يمتدّ ٦٦٠px، **فيبعد النصُّ عن اسم صاحبه** ويقفز
           سطرٌ عربيّ (`dir="auto"`) إلى الطرف المقابل. **والقياسُ
           المريح للقراءة ٦٠–٨٠ حرفاً** — والسقفُ يخدم «نقاش» معه، فهو
           على القسم لا على الخطّ وحده. */
        <section className="max-w-[680px]">
          {/* رقاقتان لا تبويبان (D-187): «الكل» و«من أتابع» سؤالٌ واحد
              بنطاقين، **وتبويبان لخطّين رفيعين يجعلان كليهما يبدو ميّتاً**.
              وهما روابطُ لا أزرار: الحالة تسكن الرابط فيُشارَك ويعود
              إليه زرُّ الرجوع (D-095). */}
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { key: "all", label: t.worksScopeAll, href: `/people?tab=${tab}` },
                {
                  key: "following",
                  label: t.worksScopeFollowing,
                  href: `/people?tab=${tab}&scope=following`,
                },
              ] as const
            ).map((c) => (
              <Link
                key={c.key}
                href={c.href}
                aria-current={scope === c.key ? "true" : undefined}
                className={
                  scope === c.key
                    ? "px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-accent text-black"
                    : "px-3.5 py-1.5 rounded-full text-[13px] font-semibold border border-border text-muted hover:text-foreground transition"
                }
              >
                {c.label}
              </Link>
            ))}
          </div>

          {/* **الرقاقتان فوق التبويبين معاً** (D-219): النطاقُ سؤالٌ عن
              «كلامِ مَن» لا عن شكل العرض، **فيصحّ فوق التجميع وفوق الخطّ
              المسطّح** — ولا نسخةَ ثانية منه. */}
          {tab === "activity" ? (
            <ActivityFeed
              comments={localized}
              news={genNews}
              meId={user.id}
              followed={followed}
              postLikes={postLikes}
              stats={talkStats}
              followingIds={followingIds}
              emptyText={scope === "all" ? t.worksEmptyAll : t.worksEmptyFollowing}
              locale={locale}
            />
          ) : works.length === 0 ? (
            /* **وفراغُ «الكل» غيرُ فراغ «من أتابع»** — ولكلٍّ جملتُه:
               الأوّل يعني «لم يكتب أحدٌ بعد» فيدعوك لتكون الأوّل، والثاني
               يعني «دائرتُك صامتة» فيدلّك على «الكل» (نمط D-106). */
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
              {scope === "all" ? t.worksEmptyAll : t.worksEmptyFollowing}
            </p>
          ) : (
            <WorksTalk works={works} stats={talkStats} locale={locale} />
          )}
        </section>
      )}
    </div>
  );
}
