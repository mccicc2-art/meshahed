"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHiddenCommunityTabs } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { Icon } from "./Icon";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { sheetScroll, sheetMenuItem, sheetMenuDivider } from "./ui/controls";
import { FilterIconButton } from "./ui/FilterIconButton";
import { CreateCommunitySheet } from "./Communities";

/** مفاتيح تبويبات المجتمع — نفس ترتيب الرأس */
const TABS = ["mine", "all", "inbox", "news"] as const;
type TabKey = (typeof TABS)[number];

/**
 * أدوات المجتمع خلف رمزٍ واحد (D-177، طلب أحمد).
 *
 * **الطلب بنصّه:** «الفلتر في الكوميونتي يسمح لك إنشاء مجتمع، إرسال رسالة
 * لصديق، أو حتى إخفاء تيوب من تيوبات الكوميونتي (أخبار، أكتفيتي،
 * كوميونتي)».
 *
 * **ولماذا «أدوات» لا «فلتر»:** ما خلفه **أفعالٌ** لا ترشيح — يُنشئ ويُرسل
 * ويُخفي. والاسمُ الصادق يمنع من يفتحها من توقّع فلترةٍ لا توجد (D-155).
 *
 * **وثلاثةُ صفوفٍ بثلاثة سلوكياتٍ مختلفة، وكلٌّ اختير لا صودف:**
 *
 *  ١) **أنشئ مجتمعاً** — ورقةٌ حقيقية تُفتح فوق هذه: `CreateCommunitySheet`
 *     نفسُها التي في دليل المجتمعات، **مُصدَّرةً لا منسوخة** (D-145).
 *
 *  ٢) **راسل صديقاً** — **ينتقل إلى تبويب الوارد ولا يفتح ورقة**، وهذا
 *     قصدٌ: إرسالُ رسالةٍ يبدأ باختيار شخص، **ومنتقي الأشخاص يعيش في
 *     الوارد أصلاً** (D-055). فبناءُ منتقٍ ثانٍ هنا نسخةٌ من محرّكٍ كامل —
 *     والبابُ إلى حيث يعيش الفعل أصدقُ من إعادة بنائه في مكانين.
 *
 *  ٣) **إخفاء تبويب** — مفاتيح، تُحفظ في كوكي (D-014) ويقرؤها الخادم قبل
 *     أوّل رسمة. **ولا يُسمح بإخفاء الأخير:** الصفحة بلا تبويبٍ واحد
 *     صفحةٌ بلا باب — والمفتاح الأخير يُعطَّل بدل أن يُقبل ثم يُرفض.
 */
export function CommunityTools({
  locale,
  hidden,
  labels,
}: {
  locale: Locale;
  /** المخفيّة الآن — تأتي من الخادم فلا يومض شيء */
  hidden: string[];
  /** أسماء التبويبات كما تُعرض في الرأس — مصدرٌ واحد لا قاموسٌ ثانٍ */
  labels: Record<string, string>;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [create, setCreate] = useState(false);
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<string[]>(hidden);

  function toggle(key: TabKey) {
    const next = local.includes(key) ? local.filter((k) => k !== key) : [...local, key];
    /* آخرُ تبويبٍ ظاهر لا يُخفى — الحارس هنا وفي الخادم معاً */
    if (next.length >= TABS.length) return;
    tap(8);
    setLocal(next);
    start(async () => {
      await setHiddenCommunityTabs(next);
      router.refresh();
    });
  }

  return (
    <>
      <FilterIconButton
        onClick={() => setOpen(true)}
        label={t.communityToolsTitle}
        active={local.length > 0}
        expanded={open}
      />

      {open && !create && (
        <Sheet
          open
          variant="bottom"
          onClose={() => setOpen(false)}
          closeLabel={t.closeLabel}
          labelledBy="comm-tools-title"
        >
          <SheetHeader
            id="comm-tools-title"
            title={t.communityToolsTitle}
            closeLabel={t.closeLabel}
            onClose={() => setOpen(false)}
          />
          <div className={`${sheetScroll} pb-4`}>
            <button
              type="button"
              onClick={() => {
                tap(8);
                setCreate(true);
              }}
              className={sheetMenuItem}
            >
              <Icon name="people" size={18} />
              <span>{t.commCreateTitle}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                tap(8);
                setOpen(false);
                router.push("/people?tab=inbox");
              }}
              className={sheetMenuItem}
            >
              <Icon name="comment" size={18} />
              <span>{t.communityToolsMessage}</span>
            </button>

            <div className={sheetMenuDivider} />

            <p className="px-4 pt-3 pb-2 text-[13px] font-bold text-muted">
              {t.communityToolsHideGroup}
            </p>
            {TABS.map((key) => {
              const isHidden = local.includes(key);
              /* المفتاح الأخير الظاهر يُعطَّل: منعُ الفعل قبل وقوعه أصدقُ
                 من قبوله ثم ردّه بلا سبب مرئيّ */
              const last = !isHidden && local.length >= TABS.length - 1;
              return (
                <button
                  key={key}
                  type="button"
                  role="switch"
                  aria-checked={!isHidden}
                  disabled={last || pending}
                  onClick={() => toggle(key)}
                  className={`${sheetMenuItem} justify-between disabled:opacity-45`}
                >
                  <span className="flex items-center gap-3">
                    <Icon name={isHidden ? "eye-off" : "eye"} size={18} />
                    <span>{labels[key] ?? key}</span>
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 h-5 w-9 rounded-full transition relative ${
                      isHidden ? "bg-border" : "bg-accent"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--background)] transition-all ${
                        isHidden ? "start-0.5" : "start-[18px]"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {create && (
        <CreateCommunitySheet
          t={t}
          onClose={() => {
            setCreate(false);
            setOpen(false);
          }}
          onCreated={(id) => {
            setCreate(false);
            setOpen(false);
            router.push(`/people?tab=all&c=${id}`);
          }}
        />
      )}
    </>
  );
}
