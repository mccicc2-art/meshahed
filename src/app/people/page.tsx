import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUser,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getTitleRooms,
} from "@/lib/data";
import { buildCommunity, refreshCommunityAfter } from "@/lib/communityCore";
import { asCommunityTab as asTab, asBoardSection as asAll } from "@/core/communityParams";
import { getT, getTabPrefs, getFeedStrangers, getFeedSort, getTalkFollowedOnly, getTalkSort, getTranslateEnabled, getHiddenRails } from "@/lib/locale";
import { railsHiddenFor, railOff } from "@/core/railPrefs";
import { TalkFilters } from "@/components/TalkFilters";
import { WorksTalk } from "@/components/WorksTalk";
import {
  PeopleLeaderboard,
  TopReviews,
  TopSavedLists,
  TalkedAboutWork,
} from "@/components/PeopleBoard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { applyTabPrefs, defaultTab } from "@/core/tabPrefs";
import { localizeTitleRooms } from "@/lib/localize";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { CommunityTools } from "@/components/CommunityTools";
import { TitleNews } from "@/components/TitleNews";
import { getTitleNews } from "@/lib/titleNews";
import { ScrollMemory } from "@/components/ScrollMemory";
import { TabPager } from "@/components/TabPager";
import { CommunityPagerProvider, CommunityTabs } from "@/components/CommunityPager";
import { OneTimeHint } from "@/components/OneTimeHint";


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
/* 🆕 `Tab`/`asTab` في `core/communityParams.ts` (M0) — الصفحةُ والبابُ يقرآن معاملاً واحداً. */

/**
 * **«عرض الكل» — قسمٌ واحدٌ بعشرة صفوف** (D-264، طلبُ أحمد).
 *
 * **ومفتاحٌ مجهولٌ يسقط إلى اللوحة كاملةً** لا إلى شاشة خطأ: الرابطُ
 * قد يُكتب بيد، **وقارئٌ متسامح خيرٌ من `404` على معاملٍ زائد** (D-179).
 */
/* 🆕 `asAll` في `core/communityParams.ts` (M0) — القارئُ نفسُه للباب. */

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
    /* ⚠️ **و`sort` سقط بلا بديل** (D-280) — **ورابطٌ قديمٌ يحمله يهبط على
       الخطّ نفسِه ولا يُخطئ**: لم يكن خلفه محتوًى يختفي **بل ترتيبٌ صار
       واحداً**. وهذا ما يفرّقه عن `?tab=all` الذي يُخفى ولا يُحذف لأن
       خلفه غرفةً حيّة (D-219). */
    all?: string;
    c?: string;
    with?: string;
    /* 🆕 `?feed=all` (D-884 · `LOOPZ-AUD-0069`): خطُّ النشاط يُرسم على
       الخادم عشرين صفّاً ثمّ «المزيد»؛ **والمزيدُ رابطٌ إلى هذه القيمة**
       لا حالةَ عميل — الحالةُ في العنوان كبقيّة الصفحة (D-051/D-054). */
    feed?: string;
  }>;
}) {
  /* ⚖️ 🆕 **البوّابةُ سقطت — الكوميونيتي مفتوحٌ للضيف** (D-627):
     `user` يبقى يُقرأ وقد يكون null — التبويباتُ الشخصيّةُ محروسةٌ
     بشرط `user` أدناه كما كانت، **و`meId` فارغةٌ للزائر فلا يطابق
     صفَّ أحدٍ** (لا «أنا» قبل حساب)، والكتابةُ خلف `requireUser`. */
  const user = await getUser();

  const { locale, t } = await getT();
  const tabPrefs = await getTabPrefs("community");
  /* 🆕 **صفوفُ «الأعضاء» المخفيّة** (D-874) — كصفوف اكتشف والمكتبة:
     الكاملةُ إلى اللوح، ومجموعةُ `community:` وحدَها إلى الصفوف.
     ⚠️ **وفي «عرض الكل» لا تسري**: من فتح رابطَ صفٍّ مباشرةً يريده
     (نفسُ حجّة D-827 لصفحات الأبواب). */
  const hiddenAll = await getHiddenRails();
  const hiddenRails = railsHiddenFor(hiddenAll, "community");
  /* **من يظهر في «النشاط»** (D-255) — كوكي يُقرأ قبل أوّل رسمة، فلا
     يومض صفُّ غريبٍ ثم يختفي */
  const showStrangers = await getFeedStrangers();
  /* 🆕 **تفضيلا D-306** — كوكيان يُقرآن على الخادم قبل أوّل رسمة */
  const feedSort = await getFeedSort();
  const talkFollowedOnly = await getTalkFollowedOnly();
  /* 🆕 D-1201 — ترتيبُ «النقاشات» (الأحدث · الأكثر تفاعلاً) */
  const talkSort = await getTalkSort();
  const translateOn = await getTranslateEnabled();

  const {
    tab: tabParam,
    scope: sParam,
    all: allParam,
    c: cParam,
    with: withParam,
    feed: feedParam,
  } = await searchParams;
  /* **الروابط القديمة لا تموت** (D-187): `‎/people?tab=inbox` كان يُشارَك
     في محادثاتٍ ويُحفظ في المتصفّحات. يُحوَّل إلى بيته الجديد ومعه الخيط
     المفتوح إن كان — تحويلٌ دائم، فالمسار انتقل ولم يتعطّل. */
  if (tabParam === "inbox") {
    redirect(withParam ? `/messages?with=${encodeURIComponent(withParam)}` : "/messages");
  }
  const tab = tabParam ? asTab(tabParam) : asTab(defaultTab(tabPrefs, "activity"));
  /* **⚠️ وبحثُ الأشخاص حُذف من هذا التبويب في يومه** (D-267، طلبُ أحمد):
     **بحثُ الشريط العلويّ فيه تبويبُ «أشخاص» أصلاً** — وسطحان لسؤالٍ
     واحد هو ما تمنعه D-222. **و`?who=` ماتت قبل أن يشاركها أحد.** */
  /* **و«عرض الكل» لا يعيش إلا داخل تبويب «الناس»** — معاملٌ على تبويبٍ
     آخر يُتجاهَل صامتاً ولا يُغيّر شيئاً */
  const allView = tab === "people" ? asAll(allParam) : null;
  /* **نطاقُ «الأعمال»: الكلُّ افتراضاً** (D-187، طلب أحمد: «أحتاج الكل
     يقدر يتفاعل مع الآخر»). دائرةُ المستخدم الجديد فارغة، **وخطٌّ مشروطٌ
     بمتابعاتٍ لم تُبنَ بعد يبدو تطبيقاً ميّتاً لا تبويباً فارغاً**.
     ⚠️ **وتصحيحٌ يُقال:** ظننتُ `community_activity` مبنيّةً في القاعدة
     فكتبتُ ذلك، **والفحصُ على `pg_proc` أثبت أنها غير موجودة** — ملفُّها
     `supabase/community_feed.sql` (الهجرة ٢٧) مكتوبٌ ولم يُشغَّل قطّ.
     فحتى تُشغَّل، يرتدّ `getCommunityFeed` إلى خطّ المتابَعين (انظر
     تعليقه)، **ولا هجرةَ جديدة ولا سياسة قراءةٍ خامسة** حين تُشغَّل:
     الدالّة تُخفي الاسم في SQL وتستثني المبلَّغ عنه وصاحبَ الحساب. */
  /* 🆕 **والزائرُ على «الكل» دائماً** (D-628): «المتابَعون» نطاقُ هويّةٍ
     لا يملكها — ورابطٌ محفوظٌ بـ`s=following` كان سيريه فراغاً كاذباً. */
  const scope: "all" | "following" = user && sParam === "following" ? "following" : "all";

  /**
   * ⚠️ **ونُقضت D-240 كاملةً — الرقاقاتُ الثلاث حُذفت** (D-280، طلبُ أحمد:
   * «الفلاتر الثلاث في الاكتيفتي أحتاج حلّاً عشان أتخلّص منها»).
   *
   * ================= الرقمُ الذي حسمها =================
   *
   * **«لك» كانت تعرض ٤٢ صفّاً و«الأحدث» ٤٤** (قياسٌ مباشر على الصفحة
   * الحيّة، ١٥ أغسطس) — **صفّان من أربعةٍ وأربعين.** **وصفُّ الرقاقات
   * يأكل ٥٤px من الرأس اللاصق**، أي في كلِّ لحظةٍ من التمرير لا في أوّل
   * الصفحة وحدَها. **وخيارٌ يكلّف ٥٤px دائمةً ويغيّر ٤٫٥٪ ليس خياراً،
   * هو ضريبةٌ تُدفع بلا مقابل** (D-217: أداةٌ تعد بما لا تعطي).
   *
   * ================= ولماذا بقي الزمنُ لا «لك» =================
   *
   * **«لك» تطرح، والزمنُ لا يطرح شيئاً.** فحذفُ الرقاقات مع إبقاء «لك»
   * كان يترك الخطَّ منقوصاً **بلا بابٍ يُفتح لرؤية الباقي** — **وفي
   * مجتمعٍ من ٢٩ عضواً كلُّ طرحٍ خسارة** (قِسْ قبل أن تحكم: `04`).
   * **ولأن المطروح صفّان، فما خسرناه بحذف «لك» لا شيء تقريباً.**
   *
   * ⚠️ **والشخصنةُ لم تُحذف، بل رجعت إلى مكانها**: مفتاح «أظهِر من لا
   * أتابعهم» (D-255) باقٍ في أدوات المجتمع — **إعدادٌ يُضبط مرّةً، لا
   * رقاقةٌ تسرق رأسَ الشاشة في كلّ فتحة.**
   */
  /* **وسقطا قبلهما مع خطّ البطاقات (D-187):** مرشِّحُ نوع الحدث (`?k=`) —
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
  /* ⚠️ **وصار خطُّ الآراء لتبويب «النشاط» وحده** (D-257): كان يُقرأ
     لتبويب «نقاش» أيضاً ليُجمَّع بالعمل، **وغرفُ النقاش لم تعد تُبنى
     منه** — فنداءٌ ثقيلٌ سقط عن تبويبٍ لا يعرضه. */
  /* ⚠️ **سقط اشتراطُ التبويب عن نداءات الثلاثة** (D-276): `pagerTab`
     تعني «هذا تبويبٌ من الصفّ» — **والثلاثةُ تُرسم معاً فتُقرأ معاً.**
     **وهو نقضٌ مسجَّلٌ لـD-194 باختيار أحمد بعد أن قُرئ عليه الثمن.** */
  const pagerTab = tab === "activity" || tab === "talk" || tab === "people";
  /* 🆕 **موجاتُ التبويبات الثلاثة في `lib/communityCore.ts`** (Phase 11-M · M0): انتقلت
     من هنا كما هي — الشروطُ والتوازي والسقوف — كي يقرأها `/api/v1/community` أيضاً بلا
     نسخةٍ ثانية (نهجُ `homeCore` في 11-H). الحججُ الكاملةُ لكلِّ نداءٍ في تاريخ هذا الملفّ. */
  const core = pagerTab
    ? await buildCommunity({ user, locale, scope, allView, translateOn, talkFollowedOnly, talkSort })
    : null;
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

  /* غرف الأعمال الحيّة (D-140) — لتبويب الدليل وحده وحين لا غرفة مفتوحة */
  const titleRoomsRaw =
    tab === "all" && !openCommunityRaw ? await getTitleRooms(12) : [];

  /* اسمُ غرفة العمل بلغة القارئ (D-147) */
  const titleRooms = await localizeTitleRooms(titleRoomsRaw, locale);
  const openCommunity = openCommunityRaw
    ? (await localizeTitleRooms([openCommunityRaw], locale))[0]
    : null;

  const localized = core?.localized ?? [];
  const feedTranslations = core?.feedTranslations ?? {};
  const rooms = core?.rooms ?? [];
  const roomsShown = core?.roomsShown ?? [];
  const pins = core?.pins ?? null;
  const globalPins = core?.globalPins ?? null;
  const amAdmin = core?.amAdmin ?? false;
  const featured = core?.featured ?? [];
  const board = core?.board ?? [];
  const topReviews = core?.topReviews ?? [];
  const savedLists = core?.savedLists ?? [];
  const boardFollowing = core?.boardFollowing ?? new Set<string>();
  const talkedAbout = core?.talkedAbout ?? null;
  const peopleEmpty = core?.peopleEmpty ?? true;

  /* الأخبار للتبويب الرابع وحده: قسم «جديد فنّانيك» يكلّف نداءات TMDB */
  const news = tab === "news" ? await getTitleNews() : [];
  /* التجديدُ بحركة المرور (D-210/D-261) — بعد إرسال الصفحة */
  await refreshCommunityAfter(pagerTab);

  const followed = core?.followed ?? new Set<string>();
  const libState = core?.libState;
  const postLikes = core?.postLikes ?? { counts: {}, mine: new Set<string>() };
  const followingIds = core?.followingIds ?? new Set<string>();
  const newsForMe = core?.newsForMe ?? [];
  const newsReplies = core?.newsReplies ?? new Map<string, number>();
  const reviewReplies = core?.reviewReplies ?? new Map<string, number>();
  const listSocial = core?.listSocial ?? new Map();
  const viewCounts = core?.viewCounts ?? new Map<string, number>();

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
    /* **و«الناس» ثالثاً بعد أن عُرف محتواه** (D-262، طلبُ أحمد: «الناس
       يكون تبويب ثالث في كومينتي»). **ومحتواه اكتشافُ أشخاصٍ باختياره** —
       والمكوّنُ `PeopleToFollow` مبنيٌّ منذ D-126 وغيرُ مركَّب، **فهذه
       دفعةُ تركيبٍ لا دفعةُ بناء** (قاعدة ٥: أعِد الاستعمال قبل أن تُنشئ). */
    { key: "people", href: "/people?tab=people", label: t.communityTabPeople },
  ];


  /* التبويبات المخفيّة (D-177) — من الكوكي على الخادم، فلا يومض تبويبٌ
     ثم يختفي. **والتبويب المفتوح لا يُخفى من نفسه**: من أخفى تبويباً وهو
     واقفٌ فيه يبقى يراه حتى يغادره، وإلا اختفت الصفحة تحت قدميه. */
  const visibleTabs = applyTabPrefs(tabs, tabPrefs, tab);

  /* **والسحبُ الأفقيُّ يتبع الصفَّ الظاهر لا قائمةَ التبويبات كلَّها**
     (D-274، طلبُ أحمد): من أخفى تبويباً لا يمرّ به سحبُه، **والإيماءةُ
     تعد بما يراه لا بما في الشيفرة.**
     ⚠️ **و`-1` تعني «لا سحبَ هنا»**: `?tab=all` و`?tab=news` سطحان
     يُفتحان بالرابط بلا شريحة (D-219)، **وسحبٌ منهما كان سيقفز بالقارئ
     إلى مكانٍ لم يدخل منه.** */
  const swipeTabs = visibleTabs.filter((x): x is (typeof visibleTabs)[number] & { href: string } =>
    !!x.href,
  );
  const swipeHrefs = swipeTabs.map((x) => x.href);
  /* 🆕 **والمفاتيحُ بجانب الروابط** (D-522): المزوّدُ يقرأ `?tab=` عند
     الرجوع، **ولا يعرف أيَّ مفتاحٍ يقابل أيَّ فهرس إلا بهذا الصفّ.** */
  const swipeKeys = swipeTabs.map((x) => x.key);
  const swipeIndex = swipeTabs.findIndex((x) => x.key === tab);

  /* ⚠️ **ولا صفَّ رقاقاتٍ في الرأس بعد اليوم** (D-280): خانةُ `extra` في
     `PageTabs` باقيةٌ لصفّ بحث المكتبة، **ولا يُمرَّر إليها من هنا شيء**
     — **فيقصر الرأسُ اللاصق ٥٤px في كلِّ تمريرة.**
     (وحجّةُ D-245 «الفرزُ في الرأس لا تحته» بقيت صحيحةً حتى آخر يومها:
     المكانُ كان صواباً، **والخيارُ نفسُه هو ما لم يستحقّ المكان.**) 

  /* ============================================================
     لوحاتُ التبويبات الثلاث — تُبنى كلُّها ثم تُسلَّم إلى `TabPager`
     ============================================================
     **وهذا ثمنُ الانزلاق الذي قُرئ على أحمد قبل أن يُبنى** (D-276):
     **صفحةٌ تنزلق تحتاج جارَها مرسوماً قبل أن يُلمَس**، فسقط اشتراطُ
     كلِّ نداءٍ بتبويبه (D-194) وصارت كلُّ فتحةٍ تدفع الثلاثة.
     ⚠️ **و«أخبارُ أعمالك» و«المجتمعات» خارج هذا كلِّه** — سطحا رابطٍ بلا
     شريحة (D-219)، **ولا يُدفع نداؤهما إلا لمن وصل بالرابط.**

     **وعمودُ القراءة على كلِّ لوحة لا على الحاوية** (D-263): `mx-auto`
     مع السقف لا بعده، **ووصفةٌ تُنسخ ناقصةً هي عطلٌ لا أسلوب** — فهي
     هنا ثابتٌ واحد. */
  const READING = "max-w-[680px] mx-auto";

  /* 🆕 **سقفُ الرسم الخادميّ لخطّ النشاط** (D-884 · `LOOPZ-AUD-0069`):
     كانت وثيقةُ `/people` ≈ 1,067 KB مفكوكةً (49 KB على السلك) لأنّ
     الخطَّ يُرسم كاملاً — 65 صفّاً للزائر × ≈ 7 KB — **ثمّ يُضاعَف في
     حمولة RSC للترطيب.** عشرون صفّاً هي ما يُقرأ قبل أوّل تمريرةٍ ونصف؛
     **والباقي خلف «المزيد» رابطاً** (`?feed=all`) **لا إجراءَ خادمٍ**:
     لا جزيرةَ جديدة، ولا صفَّ نداءاتٍ ثانياً يعيد بناءَ الخطّ، والرجوعُ
     من منشورٍ يعيد ما رآه القارئ لأنّ العنوانَ يحمله (D-522).
     ⚠️ **لا يُمسّ استعلامٌ ولا حدُّ الدالّة SQL** — القصُّ في الرسم فقط. */
  const FEED_PAGE = 20;
  const feedAll = feedParam === "all";
  const feedMoreHref = `/people?${new URLSearchParams({
    ...(tabParam ? { tab: tabParam } : {}),
    ...(sParam ? { scope: sParam } : {}),
    feed: "all",
  }).toString()}`;

  const activityBody = (
    <section className={READING}>
            <ActivityFeed
              comments={localized}
              /* 🆕 **المرشَّحةُ لا الخام** (D-360) — والخبرُ الذي لا يخصّك
                 لا يُرسَم، ولا يُعدّ في فراغ الخطّ. */
              news={newsForMe}
              meId={user?.id ?? ""}
              followed={followed}
              libState={libState}
              postLikes={postLikes}
              views={viewCounts}
              followingIds={followingIds}
              newsReplies={newsReplies}
              /* ✅ **والنصفُ الثاني من الترجيح** (D-289، الهجرة ٨٩) */
              reviewReplies={reviewReplies}
              /* 🆕 **وذيلُ صفِّ القائمة** (D-370) — قلبٌ ورقمُ ردود */
              listSocial={listSocial}
              /* **مفتاحُ «من يظهر»** (D-255) — يُقرأ من الكوكي على الخادم
                 **وهو الشخصنةُ الباقية وحدَها** بعد D-280. */
              showStrangers={showStrangers}
              /* 🆕 والزائرُ على «الأفضل» (D-629): أعلى المراجعات
                 تقييماً تتصدّر — وكوكي ترتيبِ العضو لا شأنَ له به */
              sort={user ? feedSort : "top"}
              translations={feedTranslations}
              /* **وجملةُ الفراغ فعلٌ لا اعتذار** (D-181): تقول ماذا تفعل
                 ليمتلئ، **لا «لا يوجد شيء»**.
                 ⚖️ **وعادت `feedEmptyForYou`** (D-283): صار الخطُّ يرشّح
                 بالدائرة والمكتبة، **فالفراغُ هنا معناه «دائرتُك فارغة»
                 لا «لا أحدَ يتكلّم»** — وجملةٌ تقول الثاني تكذب. */
              emptyText={t.feedEmptyForYou}
              locale={locale}
              limit={feedAll ? undefined : FEED_PAGE}
              moreHref={feedAll ? null : feedMoreHref}
            />
    </section>
  );

  const peopleBody = (
    <section className={READING}>
      {
            (/* **وفراغُ التبويب يُعلَن مرّةً واحدة** (D-181): كان الشرطُ
               على الاقتراحات وحدها، **والصفحةُ صارت خمسةَ أقسام** — فلو
               بقي كما كان لاختفت اللوحةُ وأعلى التعليقات ومكتباتُ الناس
               خلف اقتراحٍ فارغ. **وكلُّ قسمٍ يخفي نفسَه عند فراغه**،
               **والجملةُ لا تُقال إلا حين تفرغ الخمسةُ معاً.**
               ⚠️ **وفي «عرض الكل» الشرطُ على القسم المفتوح وحده** —
               الأربعةُ الباقية لم تُنادَ أصلاً، **فلو بقي الشرطُ على
               الخمسة لأعلن الفراغَ دائماً.** */
            peopleEmpty ? (
              <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
                {t.peopleTabEmpty}
              </p>
            ) : allView ? (
              /* ===== «عرض الكل»: قسمٌ واحدٌ بعشرة ===== */
              <>
                {/* **بابُ رجوعٍ نصّيّ لا زرٌّ عائم**: `BackButton` يعود
                    بتاريخ المتصفّح، **ومن دخل بالرابط مباشرةً ليس له
                    تاريخٌ يعود إليه** — فالرابطُ إلى التبويب أصدق. */}
                <Link
                  href="/people?tab=people"
                  prefetch={false}
                  className="inline-block mb-4 text-12 text-muted hover:text-accent transition"
                >
                  ‹ {t.backAria}
                </Link>
                {allView === "featured" && (
                  <PeopleLeaderboard
                    rows={featured}
                    locale={locale}
                    mode="featured"
                    limit={10}
                    meId={user?.id ?? ""}
                    following={boardFollowing}
                    /* **والفعلُ هنا وحدَه** (D-281، حكمُ أحمد): المعاينةُ
                       تُقرأ و«عرض الكل» يُعمل فيه. */
                    follow
                  />
                )}
                {allView === "top" && (
                  <PeopleLeaderboard
                    rows={board}
                    locale={locale}
                    mode="top"
                    limit={10}
                    meId={user?.id ?? ""}
                    following={boardFollowing}
                    /* **والفعلُ هنا وحدَه** (D-281، حكمُ أحمد): المعاينةُ
                       تُقرأ و«عرض الكل» يُعمل فيه. */
                    follow
                  />
                )}
                {allView === "reviews" && <TopReviews rows={topReviews} locale={locale} />}
                {allView === "lists" && <TopSavedLists cards={savedLists} locale={locale} />}
                {allView === "rising" && (
                  <PeopleLeaderboard
                    rows={board}
                    locale={locale}
                    mode="rising"
                    limit={10}
                    meId={user?.id ?? ""}
                    following={boardFollowing}
                    /* **والفعلُ هنا وحدَه** (D-281، حكمُ أحمد): المعاينةُ
                       تُقرأ و«عرض الكل» يُعمل فيه. */
                    follow
                  />
                )}
              </>
            ) : (
              /* **أربعةُ أقسامٍ بترتيب أحمد** (D-270، بالحرف: «نفس
                 العناوين في الصورة المرسلة ما نبغى — People to follow ·
                 Added to their libraries — وضِف بأوّل شي Featured
                 Members»): **مميّزون · الأكثرُ مشاركةً هذا الأسبوع ·
                 أعلى التعليقات · نجومٌ صاعدون.**

                 **وقسما «يشبهون ذوقك» و«أضافوها إلى مكتباتهم» حُذفا
                 كاملَين** — **لا أُخفيا**: حكمُ صاحبِ المنتج على قسمٍ
                 يعمل هو حكمٌ نافذ، **وقسمٌ يُخفى بشرطٍ يبقى شيفرةً
                 تُقرأ ولا تُرسم** (D-214: ما لا قارئَ له يُحذف).

                 ⚠️ **وقيل لأحمد قبل اختياره إن «المميّزين» سيكرّرون
                 وجوهَ «الأكثر مشاركة»** — واختار، **وحجّتُه أن الصدارةَ
                 على تسعين يوماً غيرُ صدارةِ سبتٍ واحد** وهي صحيحة. */
              <>
                {/* D-874: **الصفُّ المطفأُ يغيب بعنوانه** — الشرطُ هنا لا
                    داخل المكوّن، **كصفوف اكتشف حرفاً** (`railOff`). */}
                {!railOff(hiddenRails, "featured") && (
                <PeopleLeaderboard
                  rows={featured}
                  locale={locale}
                  mode="featured"
                  seeAllHref="/people?tab=people&all=featured"
                  meId={user?.id ?? ""}
                  following={boardFollowing}
                />
                )}
                {!railOff(hiddenRails, "topweek") && (
                <PeopleLeaderboard
                  rows={board}
                  locale={locale}
                  mode="top"
                  seeAllHref="/people?tab=people&all=top"
                  meId={user?.id ?? ""}
                  following={boardFollowing}
                />
                )}
                {!railOff(hiddenRails, "topreviews") && (
                <TopReviews
                  rows={topReviews}
                  locale={locale}
                  seeAllHref="/people?tab=people&all=reviews"
                />
                )}
                {/* 🆕 **وقبل الرفّ: بطاقةُ العمل الذي يدور حوله الكلام**
                    (D-291). **وموضعُها فوق رفِّ القوائم كما كُتب الاقتراح**:
                    الثلاثةُ فوقها ترتيباتُ أشخاص، **وهي وما تحتها ليسا
                    شخصين** — فتُفتح بهما نافذةٌ واحدةٌ في اللوحة بدل
                    كسرَين متباعدين يقطعان الأشخاصَ مرّتين.
                    **والحجمُ يكسر ثم الاتّجاهُ يكسر**، **وآخرُ قسمٍ يعود
                    إلى الوجوه** فتُقفل اللوحةُ على ما فُتحت عليه. */}
                {!railOff(hiddenRails, "talked") && (
                  <TalkedAboutWork room={talkedAbout} locale={locale} />
                )}
                {/* 🆕 **والخامسُ: أكثرُ القوائم حفظاً** (D-289).
                    **وموضعُه بعد «أعلى التعليقات» وقبل «الصاعدين»**:
                    الثلاثةُ فوقه أشخاصٌ يُرتَّبون، **وهذا شيءٌ صنعه
                    شخص** — فيفصل بين ترتيبين للناس بدل أن يذيّلهما. */}
                {!railOff(hiddenRails, "savedlists") && (
                <TopSavedLists
                  cards={savedLists}
                  locale={locale}
                  seeAllHref="/people?tab=people&all=lists"
                />
                )}
                {!railOff(hiddenRails, "rising") && (
                <PeopleLeaderboard
                  rows={board}
                  locale={locale}
                  mode="rising"
                  seeAllHref="/people?tab=people&all=rising"
                  meId={user?.id ?? ""}
                  following={boardFollowing}
                />
                )}
              </>
            ))
      }
    </section>
  );

  const talkBody = (
    <section className={READING}>
      {/* 🆕 D-1201 — «الكل · أعمالي» وسطرُ الترتيب (التصميمُ B) — للعضو وحدَه: تفضيلاتُ حسابٍ لا معنى لها عند الزائر (D-629) */}
      {user && rooms.length > 0 ? (
        <TalkFilters locale={locale} mine={talkFollowedOnly} sort={talkSort} count={roomsShown.length} />
      ) : null}
      {rooms.length > 0 && roomsShown.length === 0 ? (
        <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
          {t.talkMineEmpty}
        </p>
      ) : rooms.length === 0 ? (
            /* **وفراغٌ واحدٌ لا اثنان** (D-259): كان لكل رقاقةٍ جملتُها —
               «لم يكتب أحدٌ بعد» و«دائرتُك صامتة». **وبسقوط الرقاقتين
               سقطت الثانية**: لا نطاقَ يُدلّ عليه، **والجملةُ الباقية هي
               الصادقة** — لا غرفةَ حيّةً بعد، فكن أوّلَ من يفتح واحدة. */
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
              {t.talkRoomsEmpty}
            </p>
          ) : (
            <WorksTalk
              rooms={roomsShown}
              locale={locale}
              pins={pins ?? undefined}
              globalPins={globalPins ?? undefined}
              admin={amAdmin}
              activity={!!user && talkSort === "active"}
            />
        )}
    </section>
  );

  /* **اللوحاتُ بترتيب الصفّ الظاهر** — من أخفى تبويباً لا يمرّ به سحبُه
     (D-274)، **والإيماءةُ تعد بما يراه لا بما في الشيفرة.** */
  const paneOf: Record<string, React.ReactNode> = {
    activity: activityBody,
    talk: talkBody,
    people: peopleBody,
  };
  const panes = visibleTabs.map((x) => paneOf[x.key] ?? null);

  return (
    <div className="space-y-5">
      {/* ذاكرة موضع التمرير — العائد من ملف صديقٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* العنوان مخفيٌّ بصريّاً وباقٍ لقارئ الشاشة — أُزيلت كلمة «المجتمع»
          المرئية، وانتقل عدّادا المتابعة وزرّ الإضافة إلى صفّ الترتيب أسفل
          التبويبات (طلب المالك) */}
      <h1 className="sr-only">{t.peopleTitle}</h1>
      {/* 🆕 وللزائر يصمت (D-628): نصُّه وعدُ عضوٍ — «تابع لترى» — والزائرُ
          يرى بلا متابعة، فالسطرُ عنده ضجيجٌ فوق ترويسةٍ مزدحمة أصلاً */}
      {user && <OneTimeHint id="people-intro" text={t.hintPeople} closeLabel={t.closeLabel} />}

      {/* ===== رأس التبويبات =====
          `PageTabs` المشترك (D-134): نفس الموضع الرأسيّ في المكتبة
          واكتشف، وخطٌّ فاصلٌ **واحد**. وصفُّ الفرز والمرشِّح الذي كان
          تحته **حُذف** بطلب أحمد — انظر تعليق `newest`/`kind`. */}
      {/* 🆕 **والفهرسُ يملكه العميلُ من هنا** (D-522): الشريطُ واللوحاتُ
          يقرآن رقماً واحداً، **فتبديلُ التبويبات الثلاثة لا يمسّ الخادمَ
          أصلاً** — والحجّةُ كاملةً في `CommunityPager`. */}
      <CommunityPagerProvider initialIndex={swipeIndex} keys={swipeKeys} hrefs={swipeHrefs}>
      <CommunityTabs
        items={visibleTabs}
        fallbackActive={tab}
        ariaLabel={t.communityTabsGroup}
        /* رمزُ الأدوات (D-177) — نفس الزرّ ونفس المقاس في المكتبة واكتشف */
        /* 🆕 وأدواتُ الصفحة للعضو وحدَه (D-629): كلُّها تفضيلاتُ حسابٍ —
           ترتيبُ الخطّ صار مفروضاً «الأفضل» للزائر، والبقيّةُ كوكيزُ
           عضوٍ لا معنى لها عنده — **وزرٌّ يفتح ورقةَ خياراتٍ لا تعمل
           أسوأُ من غيابه** (D-217) */
        action={
          user ? (
            <CommunityTools
              locale={locale}
              prefs={tabPrefs}
              hiddenRails={[...hiddenAll]}
              labels={Object.fromEntries(tabs.map((x) => [x.key, x.label]))}
              activeTab={tab}
              strangers={showStrangers}
              feedSort={feedSort}
              translate={translateOn}
            />
          ) : undefined
        }
        /* ⚠️ **ولا `extra` هنا** — انظر D-280 أعلاه */
      />

      {/* ===== محتوى التبويب ===== */}
      {tab === "news" ? (
        /* **«أخبارُ أعمالك» وحدها** — أخبارُنا انتقلت إلى «النشاط»
           (انظر رأس الملفّ). **وفرعٌ بلا شريحة كفرع «المجتمعات»**:
           يُفتح بالرابط فلا يموت رابطٌ مشارَك، ولا يُدفع ثمنُ نداءات
           TMDB في التبويب الافتراضيّ. */
        <div>
          <h2 className="text-15 font-bold mb-2">{t.communityTabNews}</h2>
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
        /* ===== ثلاثُ لوحاتٍ تنزلق مع الإصبع ===== (D-276)
           **المفتوحةُ وحدَها في التدفّق وجاراتُها مطلقاتٌ مخفيّات** —
           فلا صندوقَ تمريرٍ ثانٍ، **وينجو الرأسُ اللاصق والسحبُ للتحديث
           وذاكرةُ التمرير والشريطُ السفليّ بلا سطرٍ يمسّها.** */
        <TabPager panes={panes} rtl={locale !== "en"} />
      )}
      </CommunityPagerProvider>
    </div>
  );
}
