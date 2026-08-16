"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFeedStrangers, setFeedSort, setTalkFollowedOnly, setTranslateEnabled } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import type { TabPref } from "@/lib/tabPrefs";
import { Icon, type IconName } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import {
  sheetScroll,
  sheetMenuItem,
  sheetMenuDivider,
  segmentedTrackFull,
  segmentedItem,
} from "./ui/controls";
import { FilterIconButton } from "./ui/FilterIconButton";
import { TabsPrefs } from "./TabsPrefs";

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
      className="w-full flex items-center justify-between gap-3 min-h-11 px-5 py-2 text-start text-[15px] hover:bg-surface-2 disabled:opacity-45 transition"
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
  labels,
  activeTab = "activity",
  strangers: strangersInitial,
  feedSort: feedSortInitial = "smart",
  talkFollowedOnly: followedInitial = false,
  translate: translateInitial = true,
}: {
  locale: Locale;
  /** تفضيلات التبويبات — تأتي من الخادم فلا يومض شيء */
  prefs: TabPref[];
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
  const sectionTitle = labels[activeTab] ?? t.communityToolsTitle;

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.communityToolsTitle}
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
          <div className={segmentedTrackFull} role="tablist" aria-label={t.communityToolsTitle}>
            {(["do", "see"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`comm-tools-tab-${k}`}
                aria-selected={tab === k}
                aria-controls={`comm-tools-panel-${k}`}
                onClick={() => {
                  tap(6);
                  setTab(k);
                }}
                className={segmentedItem(tab === k, "flex-1")}
              >
                {k === "do" ? t.communityToolsTabDo : t.communityToolsTabSee}
              </button>
            ))}
          </div>

          <div className={`${sheetScroll} pb-4`}>
            {tab === "do" ? (
              <div role="tabpanel" id="comm-tools-panel-do" aria-labelledby="comm-tools-tab-do">
                {/* ===== أدواتُ التبويب المفتوح (D-306) ===== */}
                {activeTab === "activity" && (
                  <>
                    <p className="px-5 pt-3 pb-2 text-[13px] font-bold text-muted">
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
                    <p className="px-5 pb-3 text-[12px] text-muted leading-relaxed">
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
                    <p className="px-5 pt-3 pb-2 text-[13px] font-bold text-muted">
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
                <p className="px-5 pt-3 pb-2 text-[13px] font-bold text-muted">
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
              </div>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
