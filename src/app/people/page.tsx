import { redirect } from "next/navigation";
import { after } from "next/server";
import Link from "next/link";
import {
  getUser,
  getLoopzNews,
  getNewsGenStale,
  refreshLoopzNews,
  getTalkBulletinStale,
  refreshTalkBulletins,
  getCommunityFeed,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getTitleRooms,
  getTalkRooms,
  getFollows,
  getReactions,
  getFollowingIds,
  getNewsReplyCounts,
  getPostViewCounts,
  getPeopleFeatured,
  getPeopleLeaderboard,
  getPeopleTopReviews,
} from "@/lib/data";
import { getT, getTabPrefs, getFeedStrangers } from "@/lib/locale";
import { WorksTalk } from "@/components/WorksTalk";
import { PeopleLeaderboard, TopReviews } from "@/components/PeopleBoard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { commentViewKey, newsViewKey } from "@/lib/postKeys";
import { applyTabPrefs, defaultTab } from "@/lib/tabPrefs";
import { localizeRows, localizeTitleRooms, localizeTalkRooms } from "@/lib/localize";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { PageTabs } from "@/components/ui/PageTabs";
import { CommunityTools } from "@/components/CommunityTools";
import { TitleNews } from "@/components/TitleNews";
import { getTitleNews } from "@/lib/titleNews";
import { ScrollMemory } from "@/components/ScrollMemory";
import { TabSwipe } from "@/components/TabSwipe";


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
type Tab = "activity" | "talk" | "people" | "news" | "all";
function asTab(v: string | undefined): Tab {
  /* **`comments` وريثُه `activity` حرفاً** — نفسُ التعليقات ومعها الأخبار.
     ورابطٌ محفوظٌ أو مشاركٌ في محادثةٍ لا يجوز أن يموت بتغييرِ اسم. */
  if (v === "activity" || v === "comments") return "activity";
  /* المفاتيحُ القديمة (`works` · `mine` · `reviews`) تسقط إلى «نقاش» —
     **وهو وريثُها حرفاً**: نفسُ `WorksTalk` ونفسُ التجميع. **وروابطُ
     محفوظةٌ ومشاركةٌ في محادثات لا يجوز أن تموت بتغييرِ تبويب** (D-187). */
  return v === "news" || v === "all" || v === "people" ? v : "talk";
}

/**
 * **«عرض الكل» — قسمٌ واحدٌ بعشرة صفوف** (D-264، طلبُ أحمد).
 *
 * **ومفتاحٌ مجهولٌ يسقط إلى اللوحة كاملةً** لا إلى شاشة خطأ: الرابطُ
 * قد يُكتب بيد، **وقارئٌ متسامح خيرٌ من `404` على معاملٍ زائد** (D-179).
 */
type BoardAll = "featured" | "top" | "reviews" | "rising";
function asAll(v: string | undefined): BoardAll | null {
  /* ⚠️ **و`people` و`watching` سقطتا مع قسميهما** (D-270) — **ورابطٌ
     قديمٌ بهما يهبط على اللوحة كاملةً لا على `404`**: هو نفسُ القارئ
     المتسامح أعلاه، **والقسمُ الذي كان يُفتح لم يعد موجوداً فلا بديلَ
     له يُحوَّل إليه.** */
  return v === "featured" || v === "top" || v === "reviews" || v === "rising" ? v : null;
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
    sort?: string;
    all?: string;
    c?: string;
    with?: string;
  }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const tabPrefs = await getTabPrefs("community");
  /* **من يظهر في «النشاط»** (D-255) — كوكي يُقرأ قبل أوّل رسمة، فلا
     يومض صفُّ غريبٍ ثم يختفي */
  const showStrangers = await getFeedStrangers();

  const {
    tab: tabParam,
    scope: sParam,
    sort: sortParam,
    all: allParam,
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
  const scope: "all" | "following" = sParam === "following" ? "following" : "all";

  /**
   * **فرزُ خطّ النشاط** (D-240) — ثلاثُ رقاقات: **لك · الأحدث · الأكثر
   * تفاعلاً**، و«لك» هي الافتراضية.
   *
   * **ولماذا لم تبقَ «الكل/من أتابع» هنا:** «الكل» تعني حرفياً **«كلَّ من
   * في Loopz»**، وهي ليست ما يريده أحد؛ **و«من أتابع» تُقصي كلامَ غريبٍ
   * عن مسلسلٍ في مكتبتك وهو أقربُ إليك من كلام صديقك عن عملٍ لا تعرفه.**
   * **فـ«لك» تجمع الاثنين**: دائرتُك **ومكتبتُك**.
   *
   * ⚠️ **والرقاقتان القديمتان تبقيان لتبويب «نقاش»**: هناك الصفُّ **عملٌ**
   * لا حدث، **وترتيبٌ بالتفاعل على بطاقةِ عملٍ ليس له معنى** — سؤالُ ذاك
   * التبويب «كلامُ مَن» لا «أيُّ كلامٍ أوّلاً». **رقاقتان بمعنيين في
   * سطحين، لا رقاقةٌ واحدة تكذب في أحدهما.**
   *
   * **ولا `sort=top` قبل أن يكون تفاعل**: انظر تحذيري لأحمد — خطٌّ
   * أكثرُ إعجاباته صفر يُرتَّب بالإعجاب فيبدو عشوائياً. **يبقى الخيار
   * لأن `views` تملؤه من أوّل يوم بعد الهجرة ٧٤**، وهي مقياسٌ يتحرّك.
   */
  const feedSort: "for-you" | "latest" | "top" =
    sortParam === "latest" ? "latest" : sortParam === "top" ? "top" : "for-you";
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
  /* ⚠️ **وصار خطُّ الآراء لتبويب «النشاط» وحده** (D-257): كان يُقرأ
     لتبويب «نقاش» أيضاً ليُجمَّع بالعمل، **وغرفُ النقاش لم تعد تُبنى
     منه** — فنداءٌ ثقيلٌ سقط عن تبويبٍ لا يعرضه. */
  const followingFeed = tab === "activity" ? await getCommunityFeed(scope) : [];
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

  /* **وخطُّ الآراء لتبويب «النشاط» وحده الآن** (D-257): كان يخدم «نقاش»
     معه بعد تجميعه بالعمل (`groupByWork`) — **وذلك هو اللبسُ الذي صحّحه
     أحمد**: «النقاش ليس الريفيو، يختلف». **فغرفُ النقاش صار لها مصدرُها**
     (`title_talk_rooms`)، وسقط التجميعُ ومعه `getTalkStats`. */
  const localized = tab === "activity" ? await localizeRows(followingFeed, locale) : [];

  /* **غرفُ النقاش الحيّة** (الهجرة ٧٨) — نداءٌ واحد للتبويب كلِّه، ولا
     يُدفع في غيره. **والعنوانُ والملصقُ يأتيان مع الصفّ** فلا نداءَ
     TMDB لكل بطاقة (D-164).

     ⚠️ **ورقاقتا «الكل / من أتابع» سقطتا** (D-259، سؤالُ أحمد: «احذف
     الفلاتر في النقاش، ما أعتقد يحتاجها — ولا وش رأيك؟» — **ورأيي أنه
     محقّ، بثلاثة أسباب تُقال**):
     **(١) الغرفةُ ليست شخصاً.** «من أتابع» سؤالٌ عن صاحب الكلام، **وللغرفة
     خمسةُ أصحاب** — فكان الترشيحُ يقول «غرفةٌ تكلّم فيها من أتابع»، وهي
     جملةٌ لا يسألها أحد.
     **(٢) والقائمةُ قصيرة.** الغرفُ عشراتٌ لا آلاف، **ومرشِّحٌ على قائمةٍ
     تُمسَح بنظرةٍ يزيد ضغطةً ولا يوفّر بحثاً** — وهو نفسُ سببِ إسقاط
     مرشِّح نوع الحدث في D-187.
     **(٣) وأكثرُ نتائجه فراغ.** دائرةُ المتابعة عندنا صغيرة، **فرقاقةٌ
     أغلبُ ضغطاتها تُنتج شاشةً فارغة تُقرأ عطلاً لا ترشيحاً** (D-181).
     **والبديلُ قائمٌ ولم يُحذف:** الترتيبُ بأحدث مشاركة يرفع الحيَّ
     تلقائياً. */
  /* **واسمُ الغرفة بلغة القارئ** (D-273، بلاغُ أحمد «كيف طلع الاسم
     بالعربي؟»): `title_posts.title` يُكتب مرّةً بلغة أوّل من فتح الغرفة،
     **والغرفةُ صفٌّ واحدٌ يراه كل الناس** — **وهي حجّةُ D-147 نفسُها،
     وقد نُسي هذا السطحُ يومَها.** والصفحةُ هي من تملك `locale` لا طبقةُ
     البيانات (D-048). */
  const rooms = tab === "talk" ? await localizeTalkRooms(await getTalkRooms(40), locale) : [];

  /* ⚠️ **وأربعةُ نداءاتٍ متوازيةٌ لا متتابعة** (D-263): كلُّها دوالُّ
     `definer` خفيفةٌ تقرأ صفوفاً قائمة **ولا واحدةَ منها تحتاج نتيجةَ
     الأخرى** — **فتسلسلُها كان يجمع زمنَها أربعَ مرّات بلا سبب** (نفسُ
     درس `Promise.all` في D-164). **ولا نداءَ TMDB في القسم كلِّه**:
     العنوانُ والملصقُ على الصفوف (D-048).

     **🆕 و«عرض الكل» فرعٌ في التبويب نفسِه لا صفحةٌ جديدة** (D-264، طلبُ
     أحمد «عرض الكل تظهر لي ١٠ من كل شيء»): **الرأسُ اللاصق والتبويباتُ
     هي هي**، فلا رأسَ ثانٍ يُخترع (D-136) **ولا شاشةَ تُعاد بناءً**.
     **والحالةُ في الرابط** فتُشارَك ويعود منها الظهر (D-051/D-054).

     ⚠️ **ولا يُدفع إلا نداءُ القسم المفتوح**: في «عرض الكل» الأقسامُ
     الأربعةُ الباقية لا تُرسم، **فنداؤها ثمنٌ بلا قارئ** (D-194).
     **ولوحةُ النشاط استثناءٌ مقصود**: نداؤها الواحد يخدم «الأكثر»
     و«الصاعدين» معاً (D-198). */
  const wantAll = allView !== null;
  const need = (k: BoardAll) => !wantAll || allView === k;
  const peopleTab =
    tab === "people"
      ? await Promise.all([
          /* **و٣ في القسم و١٠ في «عرض الكل»**: البطاقةُ تُقرأ بنظرة،
             **وصفٌّ من اثني عشر وجهاً في لوحةٍ ليس تمييزاً بل دليل.** */
          need("featured") ? getPeopleFeatured(90, wantAll ? 10 : 3) : [],
          /* **نداءٌ واحدٌ يخدم قسمَي الأسبوع** (D-198) — الدالّةُ تُرجع
             النافذتين معاً، **والواجهةُ تطرح.** */
          need("top") || need("rising") ? getPeopleLeaderboard(20) : [],
          /* **ثلاثةٌ لا واحد** (D-264، الهجرة ٨٢) */
          need("reviews") ? getPeopleTopReviews(30, wantAll ? 10 : 3) : [],
        ])
      : null;
  /* **ومن أتابعهم — نداءٌ واحدٌ مخزَّنٌ للتبويب** (D-275): الأقسامُ تعرض
     الناسَ كلَّهم لا الغرباءَ وحدهم، **و«متابعة» تحت اسمِ من تتابعه كذبةٌ
     يراها صاحبُها في الحال** (D-216). **ولا يُدفع في تبويبٍ آخر.**
     ⚠️ **وخارجَ `Promise.all` عمداً**: `getFollowingIds` مخزَّنةٌ
     (`cache`) ويقرؤها تبويبُ «النشاط» أيضاً، **فالنداءُ واحدٌ للصفحة لا
     نداءان** (D-205/D-223). */
  const boardFollowing = tab === "people" ? await getFollowingIds() : new Set<string>();
  const featured = peopleTab?.[0] ?? [];
  const board = peopleTab?.[1] ?? [];
  const topReviews = peopleTab?.[2] ?? [];
  /* **وفراغُ «الصاعدين» ليس فراغَ اللوحة**: النداءُ واحدٌ للقسمين، **فقد
     تعود اللوحةُ ممتلئةً ولا يكون فيها صاعدٌ واحد** — ولو قيس هذا القسمُ
     بطول `board` لبقي «عرض الكل» صفحةً فيها بابُ رجوعٍ ولا شيء تحته.
     **يُقاس القسمُ بما يعرضه هو، لا بما نُودي له** (D-181). */
  const peopleEmpty =
    allView === "rising"
      ? board.every((r) => r.total - r.prevTotal <= 0)
      : featured.length === 0 && board.length === 0 && topReviews.length === 0;

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
     ⚠️ **وكان يسقط في «من أتابع»** بحجّة أن خبرَنا ليس كلامَ من تتابع.
     **والرقاقاتُ الثلاث نقضت الحجّة** (D-240): «لك» ليست «كلامُ مَن»
     بل **«ما يخصّك»**، **ونشرتُنا تخصّك بحكم فتحك التطبيق**. فيُدفع
     للتبويب كلِّه، **والترشيحُ في `ActivityFeed` يقرّر بقاءَه.** */
  const genNews = tab === "activity" ? await getLoopzNews(12) : [];
  /* **التجديدُ بحركة المرور** (اختيارُ أحمد في D-210، ويُعاد هنا): من فتح
     التبويب بعد عشر دقائق يُطلق دورةَ رصدٍ **بعد إرسال الصفحة** فلا
     ينتظرها — ولا صفَّ cron ولا سرَّ في البيئة.
     **والبوّابةُ زمنٌ لا حركة**: انتقالُها إلى التبويب الافتراضيّ يزيد
     عددَ من يمرّ بها ولا يزيد عددَ الدورات — أوّلُ مارٍّ بعد العشر
     دقائق يُطلقها، ومن بعده يجدها غيرَ مستحقّة. */
  if (tab === "activity" && (await getNewsGenStale(10))) {
    after(() => refreshLoopzNews());
  }

  /* **ونشرةُ الغرفة على البوّابة نفسِها** (D-261) — **وفي التبويبين معاً
     لا في «نقاش» وحده**: الغرفةُ التي يفتحها Loopz لا توجد بعد،
     **وبوّابةٌ لا تُطرق إلا من التبويب الذي تملؤه هي حلقةٌ لا تبدأ.**
     **والثمنُ نداءُ بوّابةٍ واحدٌ** يُرجع منطقياً، والدورةُ كلُّها
     `after` فلا ينتظرها قارئ (D-215). */
  if (await getTalkBulletinStale(180)) {
    after(() => refreshTalkBulletins());
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

  /* **ردودُ نشراتنا** (D-236): نداءٌ واحد لمفاتيح الخطّ كلِّها، **وسقوطُه
     صامتٌ قبل الهجرة ٧٣** فتُخفى الأرقام ويبقى الخطُّ مقروءاً. */
  const newsReplies = genNews.length
    ? await getNewsReplyCounts(genNews.map((n) => n.key))
    : new Map<string, number>();

  /* **مشاهداتُ منشورات الخطّ** (D-237): نداءٌ واحد لمفاتيح النوعين معاً
     — **والمفاتيحُ تُبنى هنا بنفس دالّتَي `postKeys`** التي تكتبها
     الواجهةُ في `data-post-key`، فلا صيغتان تفترقان.
     **وسقوطُه صامتٌ قبل الهجرة ٧٤**: تُخفى الخانةُ ويبقى الخطُّ. */
  const viewCounts =
    tab === "activity"
      ? await getPostViewCounts([
          ...localized
            .filter((a) => a.review?.trim())
            .map((a) => commentViewKey(a.person.id, a.media_type, a.tmdb_id)),
          ...genNews.map((n) => newsViewKey(n.key)),
        ])
      : new Map<string, number>();

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
  const swipeHrefs = visibleTabs.map((x) => x.href).filter((h): h is string => !!h);
  const swipeIndex = visibleTabs.findIndex((x) => x.key === tab);

  /**
   * **رقاقاتُ الفرز داخل الرأس اللاصق لا تحته** (D-245، بلاغُ أحمد
   * بلقطتين: «ليه هيدر الصفحة ما يكون ثابت مثل تويتر» و«في مساحة كبيرة
   * فوق الفلتر»).
   *
   * **والعيبان كانا عيباً واحداً:** الرقاقاتُ كانت أوّلَ المحتوى — تحت
   * الرأس بمسافة `space-y-5` — **فتُترك فجوةٌ فوقها وتغادر الشاشةَ مع
   * أوّل تمريرة**. وتويتر يضع صفَّ الفرز **في الرأس الملتصق نفسِه**:
   * تُبدِّل الترتيبَ من أيّ عمقٍ في الخطّ بلا صعود. و`PageTabs` تملك
   * خانةَ `extra` لهذا بالضبط (بُنيت لصفّ بحث المكتبة) — **فلا رأسَ
   * ثانٍ يُخترع.**
   *
   * **ولا رقاقاتَ لتبويبَي الرابط** («أخبار» و«مجتمعات»): فرزُهما ليس
   * سؤالاً هناك، وخانةٌ فارغة خيرٌ من خياراتٍ لا تنطبق (D-217).
   */
  /* ⚠️ **ورقاقاتُ «نقاش» سقطت في D-259** — الحجّةُ الثلاثية عند نداء
     `getTalkRooms` أعلاه. **وبقي فرزُ «النشاط» وحدَه.** */
  const filterChips =
    tab === "activity" ? (
      /* والحشوُ حول الصفّ ملكُ `PageTabs` لا ملكُنا — حشوٌ ثانٍ هنا
         يُضاعِفه (نفسُ درس الخطّين في D-134) */
      <div className="flex items-center gap-2">
        {(
          [
            { key: "for-you", label: t.feedForYou, href: `/people?tab=${tab}` },
            { key: "latest", label: t.feedLatest, href: `/people?tab=${tab}&sort=latest` },
            { key: "top", label: t.feedTop, href: `/people?tab=${tab}&sort=top` },
          ] as const
        ).map((c) => {
          const on = feedSort === c.key;
          return (
            <Link
              key={c.key}
              href={c.href}
              aria-current={on ? "true" : undefined}
              className={
                on
                  ? "px-3.5 py-1.5 rounded-full text-[13px] font-bold bg-accent text-black"
                  : "px-3.5 py-1.5 rounded-full text-[13px] font-semibold border border-border text-muted hover:text-foreground transition"
              }
            >
              {c.label}
            </Link>
          );
        })}
      </div>
    ) : undefined;

  return (
    <div className="space-y-5">
      {/* ذاكرة موضع التمرير — العائد من ملف صديقٍ يهبط حيث كان (تدقيق 8 Aug م٢) */}
      <ScrollMemory />
      {/* **إيماءةٌ صامتة تعيد `null`** — انظر `TabSwipe` (D-274) */}
      <TabSwipe hrefs={swipeHrefs} index={swipeIndex} rtl={locale !== "en"} />
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
            strangers={showStrangers}
          />
        }
        /* صفُّ الفرز داخل الرأس اللاصق — انظر `filterChips` أعلاه (D-245) */
        extra={filterChips}
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
        /* ⚠️ **و`mx-auto` معه لا بعده** (بلاغُ أحمد: «طريقة العرض في متصفح
            البي سي سيئة… خلّ المحتوى متوازي مثل قبل»). **السقفُ وحدَه
            يقصّ ولا يوسّط**: الحاوية الأمّ `max-w-6xl` متوسّطةٌ (١١٥٢px)
            **فعمودٌ ٦٨٠ داخلها بلا توسيطٍ يلتصق بالبداية ويترك ٤٧٠px
            فراغاً في الطرف الآخر** — والعينُ تقرأ الصفحةَ مائلة.
            **والدليلُ أن السطر ناقصٌ لا مقصود:** `/post` و`/review`
            تكتبان `max-w-[680px] mx-auto` معاً منذ D-239/D-242 —
            **وثلاثةُ أسطحٍ لعمودِ قراءةٍ واحد تُكتب واحداً** (قاعدة ٦).
            **وهذا التعليقُ نصٌّ لا JSX** — D-250: تعليقُ JSX لا يقف بين
            `? (` وعنصرها، **وقد وقعتُ فيها هنا فعلاً قبل أن يمسكها `tsc`.** */
        <section className="max-w-[680px] mx-auto">
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
              views={viewCounts}
              sort={feedSort}
              followingIds={followingIds}
              newsReplies={newsReplies}
              /* **مفتاحُ «من يظهر»** (D-255) — يُقرأ من الكوكي على الخادم */
              showStrangers={showStrangers}
              /* **وفراغُ «لك» جملتُه فعلٌ لا اعتذار** (D-240): يقول ماذا
                 تفعل ليمتلئ، **لا «لا يوجد شيء»** — والفراغُ الافتراضيّ
                 يُقرأ عطلاً ما لم يقل سببَه (D-181). */
              emptyText={
                feedSort === "for-you"
                  ? t.feedEmptyForYou
                  : scope === "all"
                    ? t.worksEmptyAll
                    : t.worksEmptyFollowing
              }
              locale={locale}
            />
          ) : tab === "people" ? (
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
                  className="inline-block mb-4 text-[13px] text-muted hover:text-accent transition"
                >
                  ‹ {t.backAria}
                </Link>
                {allView === "featured" && (
                  <PeopleLeaderboard
                    rows={featured}
                    locale={locale}
                    mode="featured"
                    limit={10}
                    meId={user.id}
                    following={boardFollowing}
                  />
                )}
                {allView === "top" && (
                  <PeopleLeaderboard
                    rows={board}
                    locale={locale}
                    mode="top"
                    limit={10}
                    meId={user.id}
                    following={boardFollowing}
                  />
                )}
                {allView === "reviews" && <TopReviews rows={topReviews} locale={locale} />}
                {allView === "rising" && (
                  <PeopleLeaderboard
                    rows={board}
                    locale={locale}
                    mode="rising"
                    limit={10}
                    meId={user.id}
                    following={boardFollowing}
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
                <PeopleLeaderboard
                  rows={featured}
                  locale={locale}
                  mode="featured"
                  seeAllHref="/people?tab=people&all=featured"
                  meId={user.id}
                  following={boardFollowing}
                />
                <PeopleLeaderboard
                  rows={board}
                  locale={locale}
                  mode="top"
                  seeAllHref="/people?tab=people&all=top"
                  meId={user.id}
                  following={boardFollowing}
                />
                <TopReviews
                  rows={topReviews}
                  locale={locale}
                  seeAllHref="/people?tab=people&all=reviews"
                />
                <PeopleLeaderboard
                  rows={board}
                  locale={locale}
                  mode="rising"
                  seeAllHref="/people?tab=people&all=rising"
                  meId={user.id}
                  following={boardFollowing}
                />
              </>
            ))
          ) : rooms.length === 0 ? (
            /* **وفراغٌ واحدٌ لا اثنان** (D-259): كان لكل رقاقةٍ جملتُها —
               «لم يكتب أحدٌ بعد» و«دائرتُك صامتة». **وبسقوط الرقاقتين
               سقطت الثانية**: لا نطاقَ يُدلّ عليه، **والجملةُ الباقية هي
               الصادقة** — لا غرفةَ حيّةً بعد، فكن أوّلَ من يفتح واحدة. */
            <p className="text-sm text-muted bg-surface border border-dashed border-border rounded-xl py-10 px-5 text-center">
              {t.talkRoomsEmpty}
            </p>
          ) : (
            <WorksTalk rooms={rooms} locale={locale} />
          )}
        </section>
      )}
    </div>
  );
}
