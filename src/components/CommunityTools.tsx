"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchCommunities, setFeedStrangers } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import type { TabPref } from "@/lib/tabPrefs";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import {
  sheetScroll,
  sheetMenuItem,
  sheetMenuDivider,
  segmentedTrackFull,
  segmentedItem,
} from "./ui/controls";
import { FilterIconButton } from "./ui/FilterIconButton";
import { CreateCommunitySheet, CommunityRow } from "./Communities";
import { TabsPrefs } from "./TabsPrefs";

/**
 * أدوات المجتمع خلف رمزٍ واحد (D-177، وموسَّعةٌ بطلب أحمد ١١ أغسطس).
 *
 * **الطلب الأصليّ:** «الفلتر في الكوميونتي يسمح لك إنشاء مجتمع، إرسال رسالة
 * لصديق، أو حتى إخفاء تيوب من تيوبات الكوميونتي».
 * **والطلب الجديد بلقطتين مشطوبتين بالأحمر:** صفُّ البحث في تبويب الرسائل،
 * وصفُّ «ابحث في المجتمعات + أنشئ مجتمعاً» في تبويب المجتمع — **الصفُّ
 * يذهب خلف الرمز**، نفسُ ما فعله D-177 بصفّ المكتبة.
 *
 * **ولماذا «أدوات» لا «فلتر»:** ما خلفه **أفعالٌ** لا ترشيح — يبحث ويُنشئ
 * ويُرسل ويُرتّب ويُخفي. والاسمُ الصادق يمنع من يفتحها من توقّع فلترةٍ لا
 * توجد (D-155).
 *
 * **وأربعةُ صفوفٍ بأربعة سلوكيات، وكلٌّ اختير لا صودف:**
 *
 *  ١) **ابحث عن مجتمع** — **نزل من الصفحة إلى هنا كاملاً** بنتائجه: زرُّ
 *     «أنشئ» الذي كان بجانبه مكرَّرٌ في هذه الورقة منذ D-177، فسقط بلا
 *     بديل. **والبحثُ لم يسقط** لأنه **البابُ الوحيد** لاكتشاف مجتمعٍ
 *     بالاسم — وما بقي في الصفحة (مجتمعاتي · الدعوات · غرف الأعمال) لا
 *     يجد لك مجتمعاً لا تعرفه. **ونتائجُه هنا لا تحته:** حقلٌ في ورقةٍ
 *     ونتائجُه خلفها يجعل الورقةَ تحجب ما تبحث عنه.
 *
 *  ٢) **أنشئ مجتمعاً** — ورقةٌ حقيقية تُفتح فوق هذه: `CreateCommunitySheet`
 *     نفسُها التي في دليل المجتمعات، **مُصدَّرةً لا منسوخة** (D-145).
 *
 *  ٣) **راسل صديقاً** — **ينتقل إلى تبويب الوارد ولا يفتح ورقة**، وهذا
 *     قصدٌ: إرسالُ رسالةٍ يبدأ باختيار شخص، **ومنتقي الأشخاص يعيش في
 *     الوارد أصلاً** (D-055).
 *
 *  ٤) **التبويبات: الترتيب والإظهار** — `TabsPrefs` المشترك، بلا نسخةٍ
 *     ثانية من منطقٍ صار في أربع أوراق.
 *
 * ================= 🆕 D-292 — الورقةُ صارت تبويبين =================
 *
 * **طلبُ أحمد بلقطةٍ عليها كلمةُ «Tabs» بخطّ اليد:** «اعملها ٢ تبويب،
 * حطّ التاب وترتيبها في تبويب منفصل · وحدّث المصطلحات ورتّبها بما يتناسب
 * مع كل قسم في الكومينتي · واختصر خيارات الأكتيفتي فيد والشرح».
 *
 * **١ · ولماذا تبويبان لا قسمان بخطٍّ بينهما:** الورقةُ صارت تحمل
 * **سؤالين مختلفين**: «ماذا أفعل؟» (أبحث · أُنشئ · أُراسل) و**«ماذا
 * أرى؟»** (من يظهر في النشاط · ترتيبُ التبويبات وإظهارُها).
 * **وخمسةُ صفوفٍ بفواصلَ رمادية تُقرأ قائمةً واحدةً طويلة** — **وهي
 * حجّةُ D-290 نفسُها في سطحٍ آخر.** **والمقسّمُ يقول الفرقَ قبل أن
 * يُقرأ سطر.**
 * **⚠️ والعائلةُ عائلةُ `segmented` القائمة** (`segmentedTrackFull` +
 * `segmentedItem`) **لا شكلٌ ثالث** (القاعدة ٣) — **وهي العائلةُ نفسُها
 * التي في رأس الصفحة تحت هذه الورقة**، فالإصبعُ يعرفها.
 *
 * **٢ · والمصطلحاتُ صارت أسماءَ أقسام المجتمع نفسِها** (طلبُ أحمد):
 * **«المجتمعات» فوق البحث والإنشاء · «الرسائل» فوق راسل صديقاً ·
 * «النشاط» فوق مفتاح من يظهر** — **وبترتيب ظهور التبويبات في الرأس.**
 * **والحجّة: ورقةٌ تسمّي الشيءَ باسمٍ غيرِ اسمه في الشاشة تُعلّم القارئَ
 * مفردتين لمعنًى واحد** (D-220: تبويبٌ يُعاد تسميته يُعاد في مكانين).
 * **✅ وبلا قاموسٍ ثانٍ**: العناوينُ هي `communityTab*` عينُها التي يقرؤها
 * الرأس و`TabsPrefs` — **مصدرٌ واحدٌ لا ثلاثة** (D-002).
 *
 * **٣ · واختُصر خيارُ النشاط وشرحُه** — انظر `feedShowStrangersHint`.
 */
type ToolsTab = "do" | "see";
export function CommunityTools({
  locale,
  prefs,
  labels,
  strangers: strangersInitial,
}: {
  locale: Locale;
  /** تفضيلات التبويبات — تأتي من الخادم فلا يومض شيء */
  prefs: TabPref[];
  /** أسماء التبويبات كما تُعرض في الرأس — مصدرٌ واحد لا قاموسٌ ثانٍ */
  labels: Record<string, string>;
  /** **هل يُظهر الخطُّ من لا يتابعهم؟** (D-255) — من الخادم كأخواتها */
  strangers: boolean;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [create, setCreate] = useState(false);
  /* 🆕 **والافتراضُ «أدوات»** (D-292): **الأفعالُ هي سببُ فتح الورقة في
     الغالب**، **و«عرض» تفضيلٌ يُضبط مرّةً** (D-255/D-152: أيُّ تفضيلٍ
     جديد افتراضُه السلوكُ القائم — **وهذا ما كانت الورقةُ تفتح عليه**). */
  const [tab, setTab] = useState<ToolsTab>("do");
  /* **تفاؤليٌّ بلا ارتداد**: كتابةُ كوكي لا تفشل عملياً، **والارتدادُ
     على مفتاحٍ في ورقةٍ مفتوحة يومض أكثر ممّا يُصلح** */
  const [strangers, setStrangers] = useState(strangersInitial);
  const [savingStrangers, saveStrangers] = useTransition();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchCommunities>> | null>(
    null,
  );
  const [searching, startSearch] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* نفس إيقاع بحث الدليل حرفاً بحرف: حرفان قبل أوّل نداء، و٣٠٠ms بين
     الحرف والنداء — لا نداءَ لكل ضغطة مفتاح */
  function onSearch(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    const term = v.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(() => {
      startSearch(async () => {
        try {
          setResults(await searchCommunities(term));
        } catch {
          setResults([]);
        }
      });
    }, 300);
  }

  function close() {
    setOpen(false);
    setQ("");
    setResults(null);
    /* **والتبويبُ يعود إلى «أدوات» مع الإغلاق** — **حالةُ ورقةٍ تُغلق
       ليست تفضيلاً يُحفظ**، **ومن فتحها ليبحث لا يريد أن يجدها على
       شاشة الإعدادات** (D-278: ما تكتبه بيدك تمسحه بيدك). */
    setTab("do");
  }

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.communityToolsTitle}
        expanded={open}
      />

      {open && !create && (
        <Sheet
          open
          /* فيها حقلُ كتابة، ولوحةُ المفاتيح تأكل نصف الشاشة السفليّ (D-018) */
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
          {/* 🆕 **المقسّم — عائلةُ `segmented` القائمة لا شكلٌ ثالث** (D-292).
              **و`role="tablist"` بدلالته**: هذه لوحتان تتبادلان الموضعَ
              نفسَه، **وهي الدلالةُ التي كُتبت لها العائلةُ أصلاً**
              (`controls.ts`: بعضها `tablist` وبعضها `aria-pressed`). */}
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
            <div
              role="tabpanel"
              id="comm-tools-panel-do"
              aria-labelledby="comm-tools-tab-do"
            >
            {/* 🆕 **والعنوانُ اسمُ القسم في الرأس: «المجتمعات»** (D-292) —
                **ويجمع البحثَ والإنشاءَ لأنهما بابا القسم نفسِه**، وكانا
                مفصولين بخطٍّ يوحي بأنهما شيئان (D-134). */}
            <div className="px-5 pt-3 pb-3">
              <label
                htmlFor="comm-tools-q"
                className="block text-[13px] font-bold text-muted mb-2"
              >
                {t.communityTabAll}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-muted">
                  <Icon name="search" size={16} />
                </span>
                <input
                  id="comm-tools-q"
                  type="search"
                  value={q}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={t.commSearchPlaceholder}
                  autoComplete="off"
                  className="w-full min-h-11 rounded-control bg-surface-2 border border-border ps-9 pe-3 py-2.5 text-base placeholder:text-muted outline-none focus:border-accent transition"
                />
              </div>

              {q.trim().length >= 2 && (
                <div className="mt-2">
                  {searching && results === null ? (
                    <p className="text-sm text-muted text-center py-5">{t.peopleSearching}</p>
                  ) : (results ?? []).length === 0 ? (
                    <p className="text-sm text-muted text-center py-5">{t.commNoResults}</p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--divider)]">
                      {(results ?? []).map((c) => (
                        <CommunityRow
                          key={c.id}
                          c={c}
                          t={t}
                          locale={locale}
                          onNavigate={close}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                tap(8);
                setCreate(true);
              }}
              className={sheetMenuItem}
            >
              <Icon name="people" size={18} />
              <span>{t.communityToolsCreate}</span>
            </button>

            <div className={sheetMenuDivider} />

            {/* 🆕 **وعنوانُ «الرسائل» فوق راسل صديقاً** (D-292): الصفُّ
                **ينقل إلى ذلك التبويب بعينه** (D-055)، **فاسمُ وجهته هو
                عنوانُه الصادق** — ومن قرأ «الرسائل» هنا لن يتفاجأ بالوصول. */}
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
            <div
              role="tabpanel"
              id="comm-tools-panel-see"
              aria-labelledby="comm-tools-tab-see"
            >

            {/* **٥) من يظهر في «النشاط»** (D-255، طلبُ أحمد: «نحتاج تضيف
                خيار إخفاء الأشخاص اللي ما أتابعهم من الأكتيفتي»).
                **وبيتُه هذه الورقة لا رقاقةٌ سادسة في الرأس:** الرقاقاتُ
                الثلاث **ترتيبُ جلسةٍ يُبدَّل كثيراً**، وهذا **تفضيلٌ
                يبقى** — وخلطُهما يُثقل الرأسَ بما لا يُمَسّ (D-245).
                **وهو جارُ «التبويبات» عن قصد:** كلاهما يجيب «ماذا أرى في
                هذه الصفحة»، فيُقرآن قسماً واحداً.
                **🆕 وD-292 نقلتهما معاً إلى تبويب «عرض»** — **فالجوارُ
                الذي كان قصداً صار قسماً كامل.**
                **وعنوانُه صار «النشاط» اسمَ التبويب في الرأس** لا «خطُّ
                النشاط — من يظهر»: **الجملةُ الطويلةُ كانت تشرح ما يقوله
                المفتاحُ تحتها للتوّ** (D-224/D-287). */}
            <p className="px-5 pt-3 pb-2 text-[13px] font-bold text-muted">
              {t.communityTabMine}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={strangers}
              disabled={savingStrangers}
              onClick={() => {
                tap(8);
                const next = !strangers;
                setStrangers(next);
                saveStrangers(async () => {
                  await setFeedStrangers(next);
                  router.refresh();
                });
              }}
              className="w-full flex items-center justify-between gap-3 min-h-11 px-5 py-2 text-start text-[15px] hover:bg-surface-2 disabled:opacity-45 transition"
            >
              <span className="min-w-0 flex items-center gap-3">
                <Icon name={strangers ? "eye" : "eye-off"} size={18} />
                <span className="truncate">{t.feedShowStrangers}</span>
              </span>
              <span
                aria-hidden
                className={`shrink-0 h-5 w-9 rounded-full transition relative ${
                  strangers ? "bg-accent" : "bg-border"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${
                    strangers ? "start-[18px]" : "start-0.5"
                  }`}
                />
              </span>
            </button>
            {/* **جملةٌ تحت المفتاح تقول أثرَه بالضبط**: «لك» تُرشّح أصلاً،
                **فالمفتاحُ يعمل في «الأحدث» و«الأكثر تفاعلاً»** — ومفتاحٌ
                يبدو أنه لم يفعل شيئاً في الرقاقة المفتوحة عطلٌ في عين من
                ضغطه (D-155). */}
            <p className="px-5 pb-3 text-[12px] text-muted leading-relaxed">
              {t.feedShowStrangersHint}
            </p>

            <div className={sheetMenuDivider} />

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

      {create && (
        <CreateCommunitySheet
          t={t}
          onClose={() => {
            setCreate(false);
            close();
          }}
          onCreated={(id) => {
            setCreate(false);
            close();
            router.push(`/people?tab=all&c=${id}`);
          }}
        />
      )}
    </>
  );
}
