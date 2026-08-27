"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveHomeSectionOrder } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import {
  HOME_SECTIONS,
  homeSectionMeta,
  type HomeSection,
} from "@/lib/homePrefs";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import { Icon } from "./Icon";
import { SettingsArrangeSheet } from "./settings/SettingsArrangeSheet";

/**
 * 🆕 **ترتيبُ أقسام الرئيسية من رأس كلِّ قسم** (D-595، حكمُ أحمد بلقطةٍ
 * دوّر فيها عناوينَ «أكمل المشاهدة» و«للمشاهدة» و«قوائمي»: «حتى في
 * الهوم أي شي أضغط عليه من هذي يخلّيني أرتّبها — من الأوّل ومن الثاني
 * وكذا»).
 *
 * ================= زرٌّ في كلِّ رأسٍ وورقةٌ واحدة =================
 *
 * **المقبضُ «☰» في طرف كلِّ قسمٍ** — أخو مقبضِ أقسام الملفّ (D-581)
 * بالشكل والموضع، **والعنوانُ نفسُه يبقى باباً**: «أكمل المشاهدة»
 * رابطُه `/library` منذ D-422، **وقلبُه زرَّ ترتيبٍ كان سيُسقط باباً
 * قائماً** (D-378) — فالمقبضُ بجواره لا مكانه.
 *
 * ⚠️ **والورقةُ واحدةٌ تُركَّب مرّةً** (`HomeOrderSheetHost` في رأس
 * الصفحة) **والأزرارُ تناديها بحدث نافذة** — نمطُ قلمِ
 * `TitleRatingsCard` (D-538): **عشرةُ أقسامٍ تبثّ كلٌّ في `Suspense`
 * خاصّته، وتمريرُ الترتيب لكلِّ واحدٍ خيطٌ يُجرّ عبر عشرة مكوّنات؛
 * والحدثُ يقطعه.**
 *
 * **والورقةُ هي ورقةُ التخصيص نفسُها** (`SettingsArrangeSheet` بسجلّ
 * `homeSectionMeta` المشترك) **والكاتبُ كاتبُها** (`home_prefs.order`)
 * — **بابان لحقلٍ واحدٍ لا حقلان** (D-462)، **وفيها العينُ أيضاً**:
 * إخفاءُ قسمٍ وإظهارُه من المكان نفسِه.
 */

export const HOME_ORDER_EVENT = "loopz:home-order";

/** المقبضُ — في `action` كلِّ قسمٍ بجوار «الكلّ» */
export function HomeOrderButton({
  label,
  word,
}: {
  label: string;
  /** ⚖️ 🆕 كلمةٌ بدل المقبض (D-624) — نفسُ عقد `QueueOrderButton` حرفاً */
  word?: string;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      onClick={() => {
        tap(6);
        window.dispatchEvent(new Event(HOME_ORDER_EVENT));
      }}
      /* **وصفةُ مقبضِ الملفّ حرفاً** (D-581) — مقبضان بمظهرين لمعنًى
         واحدٍ هما العطلُ الذي تمنعه القاعدة ٦ */
      className="shrink-0 grid place-items-center h-9 min-w-9 px-1 rounded-full text-muted hover:text-accent active:scale-90 transition"
    >
      {word ? (
        <span className="text-14 font-semibold leading-none">{word}</span>
      ) : (
        <Icon name="grip" size={18} />
      )}
    </button>
  );
}

/** مضيفُ الورقة — يُركَّب مرّةً في رأس الرئيسية ويملك الحالةَ والكاتب */
export function HomeOrderSheetHost({
  locale,
  order,
}: {
  locale: Locale;
  /** الترتيبُ الحاليُّ من الخادم — بذرةُ الورقة عند كلِّ فتحة */
  order: HomeSection[];
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(HOME_ORDER_EVENT, onOpen);
    return () => window.removeEventListener(HOME_ORDER_EVENT, onOpen);
  }, []);

  return (
    <SettingsArrangeSheet
      open={open}
      title={t.custArrange}
      hint={t.custOrderHint}
      all={HOME_SECTIONS}
      picked={order}
      meta={homeSectionMeta(t)}
      labels={{
        up: t.custMoveUp,
        down: t.custMoveDown,
        hide: t.custHide,
        show: t.custShow,
        drag: t.custReorder,
      }}
      onCancel={() => setOpen(false)}
      onDone={(next) => {
        setOpen(false);
        start(async () => {
          try {
            await saveHomeSectionOrder(next);
            /* الرسمُ خادميٌّ — التحديثُ يُعيد الأقسامَ بترتيبها الجديد
               بلا صفحةٍ بيضاء (نمطُ `router.refresh` المعتاد) */
            router.refresh();
          } catch (err) {
            flashError((err as Error).message);
          }
        });
      }}
      cancelLabel={t.cancelLabel}
      doneLabel={t.doneLabel}
    />
  );
}
