"use client";

import { useState, useTransition } from "react";
import { useCommunityPager } from "./CommunityPager";
import { useRouter } from "next/navigation";
import { setFeedStrangers, setFeedSort, setTalkFollowedOnly, setTranslateEnabled } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import type { TabPref } from "@/lib/tabPrefs";
import { Icon, type IconName } from "./Icon";
import { Sheet, SheetHeader, SheetTabs } from "./ui/Sheet";
import {
  sheetScroll,
  sheetMenuItem,
  sheetMenuDivider,
  segmentedTrackFull,
  segmentedItem,
} from "./ui/controls";
import { FilterIconButton } from "./ui/FilterIconButton";
import { buttonClass } from "./ui/Button";
import { TabsPrefs } from "./TabsPrefs";
import { RailsPrefs } from "./RailsPrefs";

/**
 * أدوات المجتمع خلف رمزٍ واحد (D-177 → D-292 → **D-306**).
 *
 * ================= 🔴 D-306 — «أدوات» صارت سياقيّة =================
 *
 * **طلبُ أحمد بلقطتَي الورقة:** «الفيو يكون فيه التاب فقط ويكون ثابتاً
 * في الأعضاء والنشاط والنقاشات مثل بعض · والتولز يكون مختلفاً في كل
 * صفحة حسب حاجة الصفحة».
 *
 * **والحجّةُ حجّتُه حرفاً:** ورقةٌ واحدةٌ تعرض أدواتِ الصفحات الثلاث
 * معاً **تُري القارئَ ثلثين لا يخصّانه** — **وأداةُ صفحةٍ تُقرأ من
 * صفحتها** (D-224: الرقمُ يجاور صاحبَه — **والأداةُ كذلك**).
 *
 * - **«عرض» ثابتة**: ترتيبُ التبويبات وإظهارُها وحدهما — **هي الشيءُ
 *   الوحيدُ المشترك فعلاً بين الصفحات الثلاث.**
 * - **«أدوات» تتبع التبويبَ المفتوح** (`activeTab` من الخادم):
 *   **النشاط** = مَن يظهر (الغرباء) + الترتيب (ذكيّ/آخر منشور) ·
 *   **النقاشات** = أعمالي المتابَعة فقط · **الأعضاء** = لا مرشِّحَ
 *   يصدق عليها (أقسامٌ محسوبة) فبقيت لها «راسل صديقاً».
 * - **و«راسل صديقاً» صفٌّ ثابتٌ في ذيل «أدوات» كلِّها** — بابٌ حيٌّ
 *   لا يُقتل بتبديل تبويب (D-219).
 * - **وعنوانُ كلِّ قسمٍ اسمُ تبويبه في الرأس** (`labels`) — **مصدرٌ
 *   واحدٌ، وهي قاعدةُ D-292 نفسُها.**
 *
 * ================= 🔴 وسقط بابُ «الكومينتيز» =================
 *
 * **نصُّ أحمد: «حالياً في بحث على كومينتي، وأصلاً احنا حاذفين
 * الكومينتي — فالمفروض ما أحد يقدر يأسس كومينتي جديد».**
 * **فسقط من هذه الورقة البحثُ والإنشاءُ معاً** — ومعهما `searchCommunities`
 * و`CreateCommunitySheet` من الاستيراد (D-214: يسقط القارئُ فيسقط
 * المفتاح). **وبابُ الإنشاء الثاني في دليل المجتمعات سقط في الدفعة
 * نفسِها** (D-145: موضعا بابٍ واحدٍ يُغلقان معاً).
 * **⚠️ وما أُسّس من مجتمعاتٍ يبقى يُقرأ** — يُخفى البابُ ولا يُمحى ما
 * يقصده رابطٌ حيّ (D-219). **وإغلاقُ الإنشاء في القاعدة (سياسةُ
 * الإدراج) يُعرض على أحمد قبل تشغيله** — تعديلُ سياسةٍ قائمةٍ خارج
 * الإذن الدائم.
 */
type ToolsTab = "do" | "see";

/**
 * **صفُّ مفتاحٍ واحدٌ للورقة كلِّها** (D-306) — كان مكتوباً مرّةً لمفتاح
 * الغرباء، **وقارئُه الثاني (المتابَعةُ فقط) هو لحظةُ الاستخراج** —
 * محلّيٌّ لأن قارئيه في هذا الملفّ وحدَه.
 */
function SwitchRow({
  icon,
  label,
  on,
  busy,
  onToggle,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 min-h-11 px-5 py-2 text-start text-15 hover:bg-surface-2 disabled:opacity-45 transition"
    >
      <span className="min-w-0 flex items-center gap-3">
        <Icon name={icon} size={18} />
        <span className="truncate">{label}</span>
      </span>
      <span
        aria-hidden
        className={`shrink-0 h-5 w-9 rounded-full transition relative ${
          on ? "bg-accent" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${
            on ? "start-[18px]" : "start-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function CommunityTools({
  locale,
  prefs,
  hiddenRails = [],
  labels,
  activeTab: activeTabProp = "activity",
  strangers: strangersInitial,
  feedSort: feedSortInitial = "smart",
  talkFollowedOnly: followedInitial = false,
  translate: translateInitial = true,
}: {
  locale: Locale;
  /** تفضيلات التبويبات — تأتي من الخادم فلا يومض شيء */
  prefs: TabPref[];
  /** صفوفُ «الأعضاء» المخفيّة — كاملةً بمفاتيح `tab:key` (D-874)؛ اختياريّةٌ حتّى يصل قارئُها (D-028) */
  hiddenRails?: string[];
  /** أسماء التبويبات كما تُعرض في الرأس — مصدرٌ واحد لا قاموسٌ ثانٍ */
  labels: Record<string, string>;
  /** 🆕 **التبويبُ المفتوح — سياقُ «أدوات»** (D-306).
   * ⚠️ **اختياريٌّ لأن المكوّن يسبق مستهلكَه بدفعة** (D-028) —
   * والافتراضُ تبويبُ الفتح الافتراضيّ. */
  activeTab?: string;
  /** **هل يُظهر الخطُّ من لا يتابعهم؟** (D-255) — من الخادم كأخواتها */
  strangers: boolean;
  /** 🆕 ترتيبُ الخطّ (D-306) — اختياريٌّ بنفس حجّة `activeTab` */
  feedSort?: "smart" | "latest";
  /** 🆕 «النقاشات»: أعمالي المتابَعة فقط (D-306) — اختياريٌّ كذلك */
  talkFollowedOnly?: boolean;
  /** 🆕 **الترجمةُ التلقائيّة** (D-309) — تفضيلٌ واحدٌ يظهر في أدوات
   * السطحين اللذين يترجمان (النشاط والنقاشات): **بابان لمفتاحٍ واحد
   * أهونُ من مفتاحٍ في صفحةٍ لا تعرضه** (D-217). اختياريٌّ (D-028). */
  translate?: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* **والافتراضُ «أدوات»** (D-292) — وهي الآن أدواتُ صفحتك بعينها */
  const [tab, setTab] = useState<ToolsTab>("do");
  /* **تفاؤليٌّ بلا ارتداد**: كتابةُ كوكي لا تفشل عملياً، **والارتدادُ
     على مفتاحٍ في ورقةٍ مفتوحة يومض أكثر ممّا يُصلح** */
  const [strangers, setStrangers] = useState(strangersInitial);
  const [feedSort, setFeedSortLocal] = useState(feedSortInitial);
  const [followedOnly, setFollowedOnly] = useState(followedInitial);
  const [translate, setTranslate] = useState(translateInitial);
  const [saving, save] = useTransition();

  function close() {
    setOpen(false);
    /* **والتبويبُ يعود إلى «أدوات» مع الإغلاق** — **حالةُ ورقةٍ تُغلق
       ليست تفضيلاً يُحفظ** (D-152/D-278). */
    setTab("do");
  }

  /** عنوانُ قسم الأدوات = اسمُ التبويب المفتوح في الرأس (D-292/D-306) */
  /* 🆕 **والأدواتُ تتبع التبويبَ المرئيَّ لا قيمةَ الخادم** (D-522):
     التبويباتُ الثلاثة تُبدَّل في العميل الآن، **وأدواتٌ تصف تبويباً
     غادره القارئُ تَعِد بما لا تفعل** (D-217). والقيمةُ من الخادم تبقى
     احتياطاً لِمن لا مزوّدَ له (`?tab=news` و`?tab=all`). */
  /* 🔴 🆕 **ويقرأ الوجهةَ لا الوصول** (D-526، تسجيلُ أحمد بثلاثين إطاراً
     في الثانية: **اللوحةُ تستقرّ عند الإطار ٣٧، والعدّادُ يبقى «١» في
     ٣٧–٣٩ ثمّ يصير «٢» عند ٤٠**).
     **والسببُ ليس أثراً متأخّراً ولا ترطيباً ولا تفضيلاً**: العدّادُ
     مشتقٌّ من `pager.index`، **والفهرسُ يُقلب في نهاية الرحلة بمؤقّت** —
     **وبين انتهاء الحركة (يديرها المؤلِّف) ووقوع المؤقّت (يديره الخيط
     الرئيسيّ) فجوةٌ قِيست بثلاثة إطارات على الجهاز.** فيُقرأ رقمُ
     التبويب المغادَر على صفحةٍ استقرّت.
     **والعلاجُ أن يقرأ ما لا يتحرّك الوجهةَ**: الأدواتُ ليست في الحركة،
     **والسحبةُ التي التزمت وجهتُها معلومةٌ من أوّل إطارٍ فيها** —
     **فالرقمُ النهائيُّ جاهزٌ قبل أوّل إطارٍ مستقرّ لا بعده.**
     ⚠️ **والشريطُ الأصفرُ يبقى على `index`**: هو **في** الحركة، وقيمتُه
     تُرسم من `tabDrag` (D-524) — **ومن قرأ الوجهةَ منهما قفز.** */
  const pager = useCommunityPager();
  const activeTab =
    pager && pager.ready && pager.aimed >= 0
      ? (pager.keys[pager.aimed] ?? activeTabProp)
      : activeTabProp;
  const sectionTitle = labels[activeTab] ?? t.communityToolsTitle;

  /* 🔴 🆕 **وزرُّ المجتمع كان صامتاً وحدَه من بين الأربعة** (D-452):
     `active` لم تُمرَّر إليه قطّ — **فأربعةُ مفاتيحَ خلفه تُبدَّل ولا
     يتغيّر فيه شيء.** ومن أطفأ «إظهار الغرباء» ثم عاد بعد يومٍ يرى خطّاً
     أقصرَ **ولا شيءَ في الشاشة يقول لماذا** (وهو حرفياً عطلُ D-030:
     زرٌّ يُخفي أثراً بلا علامةٍ ظاهرة يكذب).

     **والافتراضاتُ من `tabPrefs.ts` لا مخمَّنةٌ هنا**: الغرباءُ ظاهرون
     (`parseFeedStrangers`: الغيابُ إظهار) · الترتيبُ «ذكيّ» · «متابَعون
     فقط» مطفأة · والترجمةُ تعمل. **وما خالف افتراضَه يُعدّ.**
     ⚠️ **ويُقرأ من الحالة المحلّية لا من الخاصّيّة**: الورقةُ تُبدّل
     تفاؤليّاً، **وعدّادٌ ينتظر رحلةَ الخادم يتخلّف عن المفتاح تحته.** */
  /* 🔴 🆕 **والعدُّ لتبويبه لا للأربعة** (D-457، **تصحيحُ D-452 قبل أن
     يُشتكى منه**): الورقةُ **سياقيّة** — تعرض أدواتِ التبويب المفتوح
     وحدَه (D-306) — **وعدٌّ يشمل الأربعة كان يقول «٢» ثم تُفتح الورقةُ
     فلا يُرى إلا واحد.** **ورقمٌ يشير إلى ما لا تعرضه الشاشةُ أسوأ من
     لا رقم**: النقطةُ كانت تقول «هناك شيء» بلا وعدٍ، والرقمُ يَعِد بعدد.
     **فالمحاورُ تُجمع لهذا التبويب**، والمسحُ يقع عليها وحدَها. */
  const axes: boolean[] =
    activeTab === "activity"
      ? [!strangers, feedSort !== "smart", !translate]
      : activeTab === "talk"
        ? [followedOnly, !translate]
        : [];
  const toolsOn = axes.filter(Boolean).length;

  /**
   * 🆕 **«مسح الكل» — البابُ الراجع** (D-457، توحيدُ المرحلة ٨).
   *
   * **وكان في اكتشف وحدَه**: من قلّب ثلاثةَ مفاتيحَ هنا يعيدها **واحداً
   * واحداً**، **ويتذكّر أيَّها بدّل أصلاً** — وهو ما يعرفه العدّادُ ولا
   * يعرفه صاحبُه. **وزرٌّ يعرف الافتراضَ أصدقُ من ذاكرة.**
   *
   * ⚠️ **ولا يُكتب إلا ما تبدّل**: كلُّ مفتاحٍ كوكي ورحلةُ خادم،
   * **ومسحٌ يكتب أربعةً ليُعيد واحداً يدفع ثمنَ ثلاثةٍ بلا أثر.**
   */
  function clearAll() {
    tap(8);
    const jobs: Promise<unknown>[] = [];
    if (activeTab === "activity") {
      if (!strangers) { setStrangers(true); jobs.push(setFeedStrangers(true)); }
      if (feedSort !== "smart") { setFeedSortLocal("smart"); jobs.push(setFeedSort("smart")); }
      if (!translate) { setTranslate(true); jobs.push(setTranslateEnabled(true)); }
    } else if (activeTab === "talk") {
      if (followedOnly) { setFollowedOnly(false); jobs.push(setTalkFollowedOnly(false)); }
      if (!translate) { setTranslate(true); jobs.push(setTranslateEnabled(true)); }
    }
    if (!jobs.length) return;
    save(async () => {
      await Promise.all(jobs);
      router.refresh();
    });
  }

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.communityToolsTitle}
        active={toolsOn > 0}
        /* ⚖️ 🆕 **ولا رقمَ في المجتمع** (D-554، حكمُ أحمد بلقطةٍ للزرّ:
           «هذا في الكوميونيتي دائماً لا يظهر رقم لأنه مزعج»).

           **ونقطةٌ تبقى مكانَه**: `FilterIconButton` يرسم النقطةَ متى
           غاب العدُّ وكان الزرُّ مفعَّلاً — **فالمعلومةُ «هناك شيءٌ
           مشتغل» باقية، والذي سقط كمُّه لا وجودُه.**

           ⚠️ **وهذا ما كان مكتوباً في المكوّن أصلاً** («يغيب فتبقى
           النقطة — المكتبةُ والمجتمعُ والقوائم لا تعدّ محاورَها»)
           **والكودُ كان يخالف توثيقَه منذ D-447** — **فالتصحيحُ
           يُعيدهما إلى قولٍ واحد.**

           **واكتشفُ وحدَه يبقى بعدّاده**: محاورُه سبعةٌ تُجمع، **وثلاثةٌ
           مفعّلةٌ هناك خبرٌ يستحقّ رقماً** — وهو الفرقُ الذي وُلد
           العدّادُ لأجله (D-447).

           ⚖️ 🆕 **والنقطةُ سقطت أيضاً** (D-592، حكمُه بلقطة: «وهذي
           النقطة لا تظهر في المجتمع») — **ثالثُ تجريدٍ للزرّ نفسِه**:
           اللونُ (D-492) فالرقمُ (D-554) فالنقطة. **والحالةُ باقيةٌ في
           لون الأيقونة** (`active` يجعلها بلون الواجهة لا الباهت)
           **وفي رقائق الورقة.** */
        dot={false}
        expanded={open}
      />

      {open && (
        <Sheet
          open
          variant="top"
          onClose={close}
          closeLabel={t.closeLabel}
          labelledBy="comm-tools-title"
        >
          <SheetHeader
            id="comm-tools-title"
            title={t.communityToolsTitle}
            closeLabel={t.closeLabel}
            onClose={close}
          />
          {/* 🆕 **الشريطُ من `SheetTabs`** (D-397) — كان مكتوباً هنا وفي
              اكتشف بيدين، **والثالثةُ (المكتبة) كانت ستكون نسخةً ثالثة.** */}
          <SheetTabs
            prefix="comm-tools"
            label={t.communityToolsTitle}
            tab={tab}
            onTab={setTab}
            doLabel={t.communityToolsTabDo}
            seeLabel={t.communityToolsTabSee}
          />

          <div className={`${sheetScroll} pb-4`}>
            {tab === "do" ? (
              <div role="tabpanel" id="comm-tools-panel-do" aria-labelledby="comm-tools-tab-do">
                {/* ===== أدواتُ التبويب المفتوح (D-306) ===== */}
                {activeTab === "activity" && (
                  <>
                    <p className="px-5 pt-3 pb-2 text-12 font-bold text-muted">
                      {sectionTitle}
                    </p>
                    <SwitchRow
                      icon={strangers ? "eye" : "eye-off"}
                      label={t.feedShowStrangers}
                      on={strangers}
                      busy={saving}
                      onToggle={() => {
                        tap(8);
                        const next = !strangers;
                        setStrangers(next);
                        save(async () => {
                          await setFeedStrangers(next);
                          router.refresh();
                        });
                      }}
                    />
                    <p className="px-5 pb-3 text-12 text-muted leading-relaxed">
                      {t.feedShowStrangersHint}
                    </p>
                    {/* **والترتيبُ مقسّمٌ من عائلتنا لا مفتاحان** (D-016):
                        خياران يتنافيان يركبان مقسّماً — **ومفتاحان
                        منفصلان يسمحان بحالةٍ رابعةٍ تكذب.** */}
                    <div className="px-5 pb-3">
                      <div
                        className={segmentedTrackFull}
                        role="group"
                        aria-label={sectionTitle}
                      >
                        {(["smart", "latest"] as const).map((k) => (
                          <button
                            key={k}
                            type="button"
                            aria-pressed={feedSort === k}
                            disabled={saving}
                            onClick={() => {
                              if (feedSort === k) return;
                              tap(6);
                              setFeedSortLocal(k);
                              save(async () => {
                                await setFeedSort(k);
                                router.refresh();
                              });
                            }}
                            className={segmentedItem(feedSort === k, "flex-1")}
                          >
                            {k === "smart" ? t.feedSortSmart : t.feedSortLatest}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 🆕 **مفتاحُ الترجمة التلقائيّة** (D-309، طلبُ أحمد:
                        «ضيف خيار بالتولز لإلغاء الترجمة التلقائية») —
                        **كوكي واحدٌ يظهر في أدوات السطحين اللذين
                        يترجمان** — بابان لمفتاحٍ واحد (D-217/D-306). */}
                    <SwitchRow
                      icon="sparkles"
                      label={t.autoTranslate}
                      on={translate}
                      busy={saving}
                      onToggle={() => {
                        tap(8);
                        const next = !translate;
                        setTranslate(next);
                        save(async () => {
                          await setTranslateEnabled(next);
                          router.refresh();
                        });
                      }}
                    />
                  </>
                )}

                {activeTab === "talk" && (
                  <>
                    <p className="px-5 pt-3 pb-2 text-12 font-bold text-muted">
                      {sectionTitle}
                    </p>
                    {/* **«أعمالي المتابَعة فقط»** (D-306، نصُّ أحمد:
                        «إخفاء النقاشات اللي ما يتابعها») — **والصياغةُ
                        إيجابيّةٌ كعُرف الكوكي**: مفتاحٌ اسمُه «أخفِ»
                        بقيمة «لا» يحتاج قراءتين. */}
                    <SwitchRow
                      icon="bookmark"
                      label={t.talkFollowedOnly}
                      on={followedOnly}
                      busy={saving}
                      onToggle={() => {
                        tap(8);
                        const next = !followedOnly;
                        setFollowedOnly(next);
                        save(async () => {
                          await setTalkFollowedOnly(next);
                          router.refresh();
                        });
                      }}
                    />
                    {/* 🆕 **مفتاحُ الترجمة التلقائيّة** (D-309، طلبُ أحمد:
                        «ضيف خيار بالتولز لإلغاء الترجمة التلقائية») —
                        **كوكي واحدٌ يظهر في أدوات السطحين اللذين
                        يترجمان** — بابان لمفتاحٍ واحد (D-217/D-306). */}
                    <SwitchRow
                      icon="sparkles"
                      label={t.autoTranslate}
                      on={translate}
                      busy={saving}
                      onToggle={() => {
                        tap(8);
                        const next = !translate;
                        setTranslate(next);
                        save(async () => {
                          await setTranslateEnabled(next);
                          router.refresh();
                        });
                      }}
                    />
                  </>
                )}

                {/* ===== «راسل صديقاً» — الصفُّ الثابت (D-306) =====
                    بابٌ حيٌّ في كلِّ سياق: **ينقل إلى تبويب الوارد بعينه**
                    (D-055) فاسمُ وجهته عنوانُه الصادق (D-292). */}
                {(activeTab === "activity" || activeTab === "talk") && (
                  <div className={sheetMenuDivider} />
                )}
                <p className="px-5 pt-3 pb-2 text-12 font-bold text-muted">
                  {t.communityTabInbox}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    tap(8);
                    close();
                    router.push("/people?tab=inbox");
                  }}
                  className={sheetMenuItem}
                >
                  <Icon name="comment" size={18} />
                  <span>{t.communityToolsMessage}</span>
                </button>
              </div>
            ) : (
              <div role="tabpanel" id="comm-tools-panel-see" aria-labelledby="comm-tools-tab-see">
                {/* 🆕 **«عرض» صارت التبويباتِ وحدَها** (D-306): **هي
                    الشيءُ الوحيدُ الثابتُ بين الصفحات الثلاث** — ومفتاحُ
                    الغرباء رحل إلى أدوات «النشاط» لأنه خيارُ صفحةٍ لا
                    خيارُ عرضٍ عامّ. */}
                <TabsPrefs
                  locale={locale}
                  surface="community"
                  prefs={prefs}
                  labels={labels}
                  title={t.tabsPrefsGroup}
                />
                {/* 🆕 **وصفوفُ «الأعضاء» تحت التبويبات** (D-874، حكمُ أحمد:
                    «نعم، للاثنين») — **نفسُ مكوّن اكتشف والمكتبة**، والنطاقُ
                    `community:`. **وهي صفوفُ تبويبٍ واحد** لأن «النشاط»
                    خطٌّ لا صفوف، و«الأعمال» غرفٌ — **فلا يُعرض ما لا
                    يُطفأ** (D-219). **واسمُ التبويب من مفتاحه** (D-703). */}
                <RailsPrefs
                  locale={locale}
                  tab="community"
                  hidden={hiddenRails}
                  title={
                    locale === "en"
                      ? `${t.communityTabPeople} rows`
                      : `صفوف «${t.communityTabPeople}»`
                  }
                />
              </div>
            )}
          </div>
          {/* **شريطُ المسح — نفسُ وصفة ورقة اكتشف بالبكسل** (D-457):
              حدٌّ علويّ وسطحٌ مرتفعٌ وزرٌّ شبحيّ. **ويغيب حين لا شيءَ
              يُمسح** — **وزرٌّ لا يفعل شيئاً يُقرأ معطّلاً** (D-044).
              ⚠️ **وفي «أدوات» وحدَها**: تبويبُ «عرض» ترتيبُ تبويباتٍ لا
              فلاتر، **و«مسح الكل» فوقه يَعِد بفعلٍ لا يقع** (D-325). */}
          {tab === "do" && toolsOn > 0 && (
            <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-t border-[color:var(--divider)] bg-[color:var(--elevated)]">
              <button
                type="button"
                disabled={saving}
                onClick={clearAll}
                className={buttonClass({ variant: "ghost", size: "md" })}
              >
                {t.browseClearAll}
              </button>
            </div>
          )}

        </Sheet>
      )}
    </>
  );
}
