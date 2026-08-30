"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getDict, num, type Locale } from "@/lib/i18n";
import { repairImpossibleDays } from "@/lib/actions";
import { coalescedRefresh } from "@/lib/refresh";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * ============ اليومُ المستحيل (D-801 — حكمُ أحمد) ============
 *
 * **نصُّه**: «**أيّ يوم عنده ساعات أكثر من ٢٤ ساعة معناته فيه مشكلة —
 * لازم وقت المشاهدة يتغيّر ونحطّه في نفس وقت الإصدار**».
 *
 * 🔑 **والبطاقةُ تحت الرقم لا فوقه**: **الرقمُ الكبيرُ هو ما يراه القارئُ
 * أوّلاً**، **وشرحٌ يسبق ما يشرحه شرحٌ بلا سؤال.** فيقرأ «٢٩٠١ ساعة»
 * ثمّ يجد سببَها وزرَّها في السطر التالي مباشرة.
 *
 * ⚖️ **ولا تظهر إلّا حين تستحيل**: يومٌ دون ٢٤ ساعةً لا بطاقةَ له —
 * **وتحذيرٌ دائمٌ يُقرأ زينةً ويُغلق بلا نظر** (درسُ D-798 نفسُه).
 *
 * ⚖️ **والفعلُ بيد صاحبه لا بيدي**: **الصفوفُ تاريخُه هو**، **وترميمٌ
 * يقع بلا ضغطةٍ منه يُقرأ فقداناً للبيانات لا إصلاحاً** — فالزرُّ ظاهرٌ
 * والقرارُ له.
 */
export function ImpossibleDayCard({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function repair() {
    if (pending) return;
    tap(8);
    start(async () => {
      try {
        const { moved, remaining, stuck } = await repairImpossibleDays();
        /* **والحصيلةُ تُقال بالعدد وبما بقي** (D-217): **«تمّ» بعد نصفِ
           عملٍ وعدٌ لا يُسلَّم** — فمن بقيت مكتبتُه يعرف أنّ عليه ضغطةً
           أخرى، ومن بقيت أعمالُه بلا تاريخِ عرضٍ يعرف لماذا. */
        if (moved > 0) {
          toast(`${t.impossibleDone} · ${num(moved, locale)}`, { tone: "success" });
          if (remaining > 0) toast(t.impossibleMore, { tone: "info" });
          else if (stuck > 0) toast(t.impossibleStuck, { tone: "info" });
          setDone(remaining === 0);
          coalescedRefresh(router);
        } else {
          toast(stuck > 0 ? t.impossibleStuck : t.artReset, { tone: "info" });
        }
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-surface px-3.5 py-3">
      <p className="flex items-center gap-2 text-14 font-bold leading-tight">
        <Icon name="clock" size={16} className="text-accent shrink-0" />
        {t.impossibleTitle}
      </p>
      <p className="mt-1.5 text-12 text-muted leading-relaxed">{t.impossibleBody}</p>
      <button
        type="button"
        onClick={repair}
        disabled={pending || done}
        className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3.5 py-1.5 text-12 font-bold text-accent transition active:opacity-70 disabled:opacity-50"
      >
        {pending && (
          <span
            aria-hidden
            className="w-3.5 h-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin"
          />
        )}
        {t.impossibleCta}
      </button>
    </div>
  );
}
