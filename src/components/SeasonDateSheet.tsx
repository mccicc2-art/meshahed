"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetGrabHandle,
  SheetHeader,
  useSheetDragToDismiss,
} from "./ui/Sheet";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { backdateSeasonWatches } from "@/lib/actions";
import { coalescedRefresh } from "@/lib/refresh";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * ============ متى شاهدتَ هذا الموسم؟ (D-798 → 🆕 D-802) ============
 *
 * **حكمُ أحمد الأوّل** (D-798): «أيّ شخص يؤشّر على موسم كامل يجيه سؤال
 * بسيط بخيارات… **المهم ما يطلع إلّا للي يحدّد موسماً كاملاً**».
 * **وحكمُه الثاني** (D-802، بلقطتين): «**هذي غيّرها إلى كذا تصميم
 * ومحتوى وموقع**».
 *
 * 🔑 **والشرطُ في الباب لا في الورقة**: تُستدعى من مسار «الموسم كامل»
 * وحدَه — **وحلقةٌ واحدةٌ لا تفتحها أبداً.** **وسؤالٌ يظهر مع كلِّ ضغطة
 * تأشيرٍ يصير ضجيجاً يُغلق بلا قراءة**، وهو ما يقتل الميزةَ لا يبنيها.
 *
 * ⚖️ **والسؤالُ بعد الفعل لا قبله**: التأشيرُ وقع فوراً — **والورقةُ
 * تصحّح التاريخَ ولا تحجز الإصبع** (D-217). **ومن أغلقها بلا اختيارٍ
 * بقي على تاريخ اليوم.**
 *
 * ================= 🆕 والموضعُ والشكلُ بتصميمه (D-802) =================
 *
 * **١) ترتفع من القاع بمقبض.** ⚖️ **وهذا توسيعٌ لحدِّ D-558 لا نقضٌ
 * له**: ذلك الحدُّ لم يكن «صفحاتُ الإعدادات» بل **صنفُ الورقة** —
 * «**حوارُ التزامٍ لا لوحةُ تصفّح**» بنصّه — **وهذه حوارُ التزامٍ
 * بعينه**: سؤالٌ له جوابان يُثبِّت أحدُهما أو يُترك. **فالعضويّةُ في
 * الصنف نمت، والحدُّ نفسُه لم يتحرّك** — **والمرساةُ تبقى خاصّيّةً في
 * `Sheet` لا صنفاً يُكتب عند المستدعي.**
 *
 * **٢) والعنوانُ يلتفّ ولا يُبتر**: لقطتُه أظهرت «When did you watch
 * these sea…» — **وسؤالٌ يُقطع في منتصفه لا يُجاب.**
 *
 * **٣) وعلامةُ الصحّ تقول أين أنت الآن لا أين يُنصح بك.**
 * 🔴 **وهذا موضعُ خلافي الوحيد مع الصورة، وأقوله**: الصورةُ تضع الصحَّ
 * على «وقت عرضها» **قبل أن يُضغط شيء** — **والحلقاتُ في تلك اللحظة
 * مؤرَّخةٌ بتاريخ اليوم فعلاً.** **وصحٌّ على خيارٍ لم يُطبَّق يَعِد بما
 * لم يقع** (D-217): **من أغلق الورقةَ بالحجاب خرج وقد رأى صحّاً على
 * حالةٍ ليست حالته.** **فالصحُّ يفتح على «الآن» — وهو الصادق — وينتقل
 * في اللحظة التي يقع فيها الفعل.** **وإن أردتَها توصيةً فالتوصيةُ
 * كلمةٌ تحت الخيار لا صحٌّ في طرفه** (عرفُ D-557 في هذا التطبيق).
 *
 * ⚖️ **وبطاقتان لا صفّا راديو**: صفُّ الراديو العاري لغةُ صفحات
 * الإعدادات (D-557)، **وهذان خياران بأيقونةٍ وشرحٍ داخل بطاقةٍ محدودة**
 * — **وهو شكلُ بلاطة `SettingsPickerSheet` نفسُه** (بطاقةٌ + قرصُ صحٍّ
 * ممتلئ)، **لا عائلةٌ ثالثة.**
 */
export function SeasonDateSheet({
  showTmdbId,
  seasons,
  locale,
  onClose,
}: {
  showTmdbId: number;
  /** أرقامُ المواسم التي عُلّمت للتوّ — والعددُ يقرّر صيغةَ السؤال */
  seasons: number[];
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  /** **الحالةُ الحقيقيّةُ عند الفتح**: الصفوفُ بتاريخ اليوم */
  const [mode, setMode] = useState<"now" | "aired">("now");
  const { handleProps, panelProps } = useSheetDragToDismiss(onClose);

  function chooseAired() {
    if (pending || mode === "aired") return;
    tap(8);
    start(async () => {
      try {
        const { updated } = await backdateSeasonWatches({ showTmdbId, seasons });
        /* **والحصيلةُ تُقال بالعدد** — **«تمّ» بلا رقمٍ لا يُطمئن من علّم
           مئتَي حلقة**، ومن لم يتغيّر عنده شيءٌ يستحقّ أن يعرف. */
        if (updated > 0) setMode("aired");
        toast(updated > 0 ? t.seasonWhenDone : t.artReset, { tone: "success" });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
      } finally {
        onClose();
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      closeLabel={t.closeLabel}
      anchor="bottom"
      labelledBy="season-when-title"
      className={panelProps.className}
      panelStyle={panelProps.panelStyle}
    >
      <SheetGrabHandle {...handleProps} />

      <SheetHeader
        id="season-when-title"
        title={seasons.length > 1 ? t.seasonWhenTitleMany : t.seasonWhenTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
        divider={false}
      >
        <p className="text-12 text-muted leading-relaxed mt-1">{t.seasonWhenHint}</p>
      </SheetHeader>

      <div
        role="radiogroup"
        aria-label={seasons.length > 1 ? t.seasonWhenTitleMany : t.seasonWhenTitle}
        className="px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] flex flex-col gap-3"
      >
        <ChoiceCard
          icon="calendar"
          title={t.seasonWhenAired}
          hint={t.seasonWhenAiredHint}
          selected={mode === "aired"}
          busy={pending}
          disabled={pending}
          onSelect={chooseAired}
        />
        <ChoiceCard
          icon="clock"
          title={t.seasonWhenNow}
          hint={t.seasonWhenNowHint}
          selected={mode === "now"}
          disabled={pending}
          onSelect={() => {
            tap(6);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
}

/**
 * بطاقةُ خيار — **أيقونةٌ · اسمٌ وشرحٌ · قرصُ صحٍّ في الطرف.**
 *
 * ⚠️ **وخانةُ الصحِّ محجوزةٌ في الحالتين**: **قرصٌ يظهر ويختفي يزحف
 * بالنصِّ عند كلِّ اختيار** (عرفُ `SettingsOptionRow` نفسُه).
 */
function ChoiceCard({
  icon,
  title,
  hint,
  selected,
  busy = false,
  disabled = false,
  onSelect,
}: {
  icon: "calendar" | "clock";
  title: string;
  hint: string;
  selected: boolean;
  busy?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`w-full flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-start transition active:opacity-80 disabled:opacity-50 disabled:pointer-events-none ${
        selected ? "border-accent bg-accent/10" : "border-border bg-surface"
      }`}
    >
      <Icon
        name={icon}
        size={26}
        className={selected ? "text-accent shrink-0" : "text-muted shrink-0"}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-15 font-bold leading-tight" dir="auto">
          {title}
        </span>
        <span className="block text-12 text-muted leading-tight mt-0.5" dir="auto">
          {hint}
        </span>
      </span>
      <span aria-hidden className="shrink-0 grid place-items-center w-6 h-6">
        {busy ? (
          <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        ) : selected ? (
          <span className="grid place-items-center w-6 h-6 rounded-full bg-accent">
            <Icon
              name="check"
              size={14}
              strokeWidth={2.6}
              className="text-[color:var(--on-accent)]"
            />
          </span>
        ) : null}
      </span>
    </button>
  );
}
