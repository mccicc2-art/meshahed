"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { Icon } from "./Icon";
import { getDict, type Locale } from "@/lib/i18n";
import { backdateSeasonWatches } from "@/lib/actions";
import { coalescedRefresh } from "@/lib/refresh";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * ============ متى شاهدتَ هذا الموسم؟ (D-798) ============
 *
 * **حكمُ أحمد**: «أيّ شخص يؤشّر على موسم كامل يجيه سؤال بسيط بخيارات…
 * **المهم ما يطلع إلّا للي يحدّد موسماً كاملاً تم مشاهدته أو عدّة
 * مواسم**».
 *
 * 🔑 **والشرطُ في الباب لا في الورقة**: تُستدعى من مسار «الموسم كامل»
 * وحدَه — **وحلقةٌ واحدةٌ لا تفتحها أبداً.** **وسؤالٌ يظهر مع كلِّ ضغطة
 * تأشيرٍ يصير ضجيجاً يُغلق بلا قراءة**، وهو ما يقتل الميزةَ لا يبنيها.
 *
 * ⚖️ **والسؤالُ بعد الفعل لا قبله**: التأشيرُ وقع فوراً — **والورقةُ
 * تصحّح التاريخَ ولا تحجز الإصبع** (D-217). **ومن أغلقها بلا اختيارٍ
 * بقي على تاريخ اليوم**، وهو السلوكُ القائم قبل هذه الجولة كلِّها.
 *
 * ⚖️ **وخياران لا ثلاثة**: **«وقت نزوله» و«الآن» يغطّيان الحالتين
 * الحقيقيّتين** — **ومنتقي تاريخٍ حرٌّ لموسمٍ من عشرين حلقةً يسأل عن
 * عشرين تاريخاً** ويقع في يد من أراد ضغطتين.
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
  const [busy, setBusy] = useState<"aired" | null>(null);

  function chooseAired() {
    if (pending) return;
    tap(8);
    setBusy("aired");
    start(async () => {
      try {
        const { updated } = await backdateSeasonWatches({ showTmdbId, seasons });
        /* **والحصيلةُ تُقال بالعدد** — **«تمّ» بلا رقمٍ لا يُطمئن من علّم
           مئتَي حلقة**، ومن لم يتغيّر عنده شيءٌ يستحقّ أن يعرف. */
        toast(updated > 0 ? t.seasonWhenDone : t.artReset, { tone: "success" });
        coalescedRefresh(router);
      } catch (e) {
        flashError((e as Error).message);
      } finally {
        setBusy(null);
        onClose();
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      closeLabel={t.closeLabel}
      variant="center"
      labelledBy="season-when-title"
    >
      <SheetHeader
        id="season-when-title"
        title={seasons.length > 1 ? t.seasonWhenTitleMany : t.seasonWhenTitle}
        closeLabel={t.closeLabel}
        onClose={onClose}
      />
      <div className="px-5 pt-2 pb-5 flex flex-col gap-3">
        <p className="text-12 text-muted leading-relaxed">{t.seasonWhenHint}</p>

        <button
          type="button"
          disabled={pending}
          onClick={chooseAired}
          className="w-full flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-start transition active:opacity-70 disabled:opacity-50"
        >
          <Icon name="calendar" size={18} className="text-accent shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-bold leading-tight">{t.seasonWhenAired}</span>
            <span className="block text-12 text-muted mt-0.5">{t.seasonWhenAiredHint}</span>
          </span>
          {busy === "aired" && (
            <span
              aria-hidden
              className="shrink-0 w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin"
            />
          )}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            tap(6);
            onClose();
          }}
          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-start transition active:opacity-70 disabled:opacity-50"
        >
          <Icon name="clock" size={18} className="text-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-15 font-bold leading-tight">{t.seasonWhenNow}</span>
            <span className="block text-12 text-muted mt-0.5">{t.seasonWhenNowHint}</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
