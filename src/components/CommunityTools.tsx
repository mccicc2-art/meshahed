"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchCommunities } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { tabPrefsTouched, type TabPref } from "@/lib/tabPrefs";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { sheetScroll, sheetMenuItem, sheetMenuDivider } from "./ui/controls";
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
 */
export function CommunityTools({
  locale,
  prefs,
  labels,
}: {
  locale: Locale;
  /** تفضيلات التبويبات — تأتي من الخادم فلا يومض شيء */
  prefs: TabPref[];
  /** أسماء التبويبات كما تُعرض في الرأس — مصدرٌ واحد لا قاموسٌ ثانٍ */
  labels: Record<string, string>;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [create, setCreate] = useState(false);

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
  }

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.communityToolsTitle}
        active={tabPrefsTouched("community", prefs)}
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
          <div className={`${sheetScroll} pb-4`}>
            <div className="px-5 pt-1 pb-3">
              <label
                htmlFor="comm-tools-q"
                className="block text-[13px] font-bold text-muted mb-2"
              >
                {t.communityToolsSearchGroup}
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

            <div className={sheetMenuDivider} />

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

            <div className={sheetMenuDivider} />

            <TabsPrefs
              locale={locale}
              surface="community"
              prefs={prefs}
              labels={labels}
              title={t.tabsPrefsGroup}
            />
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
