import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getUser,
  getCommunityFeed,
  getMyCommunities,
  getMyCommunityInvites,
  getCommunityRoom,
  getTitleRooms,
  getTalkStats,
} from "@/lib/data";
import { getT, getTabPrefs } from "@/lib/locale";
import { WorksTalk, groupByWork } from "@/components/WorksTalk";
import { applyTabPrefs, defaultTab } from "@/lib/tabPrefs";
import { localizeRows, localizeTitleRooms } from "@/lib/localize";
import { CommunityDirectory, CommunityRoom } from "@/components/Communities";
import { PageTabs } from "@/components/ui/PageTabs";
import { CommunityTools } from "@/components/CommunityTools";
import { TitleNews } from "@/components/TitleNews";
import { getTitleNews } from "@/lib/titleNews";
import { ScrollMemory } from "@/components/ScrollMemory";


type Tab = "works" | "all" | "news";
function asTab(v: string | undefined): Tab {
  /* المفاتيح القديمة (`mine` · `reviews` · `inbox`) تسقط إلى «الأعمال»
     بدل أن تُعيد صفحةً فارغة: روابطُ محفوظةٌ ومشاركةٌ في محادثات لا
     يجوز أن تموت بتغييرِ تبويب (D-187). و`inbox` له تحويلٌ حقيقيّ أدناه. */
  return v === "all" || v === "news" ? v : "works";
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
  const tab = tabParam ? asTab(tabParam) : asTab(defaultTab(tabPrefs, "works"));
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
  const [followingFeed, myCommunities, myInvites] = await Promise.all([
    getCommunityFeed(scope),
    getMyCommunities(),
    // دعواتي المعلّقة (هجرة 42) — قسم «دعوات» فوق مجتمعاتي في الدليل
    getMyCommunityInvites(),
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

  /* **الرسائل غادرت هذه الصفحة إلى `/messages`** (D-187) — ومعها
     `getConversations` و`myMutualFollows` وترجمةُ أحداث المشاركة، **نقلاً
     لا نسخاً**. والرابط القديم `?tab=inbox` يُحوَّل أعلاه. */

  /* **الأعمال لا الآراء** (D-187): الخطّ يُجمَّع بالعمل في `groupByWork`،
     فيقرأ المستخدم «عن ماذا يتكلّم الناس» لا «من تكلّم». والترجمة قبل
     التجميع لا بعده: العنوان مفتاحُ العرض، ولو جُمّع بالعنوان المخزَّن
     لانقسم العملُ الواحد بين لغتين (D-048). */
  const works =
    tab === "works"
      ? groupByWork(await localizeRows(followingFeed, locale))
      : [];

  /* أرقامُ البطاقة (D-193): الردودُ ومن شاهد — **نداءٌ واحد للأعمال كلّها**
     (`title_talk_stats`) لا نداءٌ لكل صفّ. ولا يُدفع إلا في تبويبه، ولا
     يُدفع لخطٍّ فارغ. **وسقوطُه لا يُسقط الصفّ**: الدالّة تُرجع خريطةً
     فارغة فتُخفى الأرقام ويبقى الكلامُ مقروءاً. */
  const talkStats = works.length ? await getTalkStats() : undefined;

  /* «أشخاص لمتابعتهم» (D-126) — تُطلب حين يكون الخطّ هزيلاً لا فارغاً
     وحده: دائرةٌ من شخصين تُنتج خطّاً صامتاً كدائرةٍ من صفر، والفرق أن
     الأولى لا تُظهر حالةً فارغة فتبدو الصفحة معطوبة لا ناقصة.
     ونداءٌ ثانٍ مشروط لا يدخل `Promise.all`: أكثر الحسابات دائرتُها
     نشطة، فلا يُدفع ثمنُه إلا من يحتاجه. والمرشِّح يُلغيه — فراغُ
     مرشِّحٍ ليس فراغ دائرة (نفس تفريق D-106). */
  /* الأخبار للتبويب الرابع وحده: قسم «جديد فنّانيك» فيها يكلّف نداءات
     TMDB، ودفعُها في كل فتحةٍ للمجتمع ثمنٌ يدفعه من لم يفتح التبويب */
  const news = tab === "news" ? await getTitleNews() : [];

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
    /* **ثلاثةٌ بعد خمسة (D-187).** «الأعمال» أوّلاً لأنها السؤال الذي
       يفتح المستخدمُ المجتمعَ لأجله: «عن ماذا يتكلّم الناس؟». */
    { key: "works", href: "/people", label: t.communityTabWorks },
    { key: "all", href: "/people?tab=all", label: t.communityTabAll, count: allCount },
    /* **بلا عدّاد**: عددُ الأخبار ليس مهمّةً تنتظر، وشارةٌ تُلحّ على ما لا
       يُطلب فعلاً تُدرِّب العين على تجاهل الشارات كلّها */
    { key: "news", href: "/people?tab=news", label: t.communityTabNews },
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
        <TitleNews items={news} locale={locale} />
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
          {/* رقاقتان لا تبويبان (D-187): «الكل» و«من أتابع» سؤالٌ واحد
              بنطاقين، **وتبويبان لخطّين رفيعين يجعلان كليهما يبدو ميّتاً**.
              وهما روابطُ لا أزرار: الحالة تسكن الرابط فيُشارَك ويعود
              إليه زرُّ الرجوع (D-095). */}
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { key: "all", label: t.worksScopeAll, href: "/people" },
                { key: "following", label: t.worksScopeFollowing, href: "/people?scope=following" },
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

          {works.length === 0 ? (
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
