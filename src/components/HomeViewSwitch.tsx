"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeView } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { flashError } from "@/lib/toast";
import type { HomeView } from "@/lib/homePrefs";
import { Icon } from "./Icon";

/**
 * مبدّلُ وضع عرض الرئيسية (D-434).
 *
 * **والزرُّ يحمل اسمَ الوجهة لا اسمَ الحال** — «مختصر» وأنت في البصريّ،
 * و«بصري» وأنت في المختصر. **وهو عرفُ المبدّلات ذات الحالتين**: زرٌّ
 * يكتب حالتَك الراهنة يُقرأ لافتةً لا فعلاً، **فيضغطه من أراد ما هو فيه
 * أصلاً.**
 *
 * **والحفظُ في الحساب لا في الجهاز** (طلبُ أحمد: «عند العودة للتطبيق
 * يظهر آخر View اختاره المستخدم»): كوكيٌّ يضيع بتبديل الجهاز أو المتصفّح،
 * **والاختيارُ صفةُ حسابٍ لا صفةُ متصفّح.**
 *
 * ⚠️ **والاسمُ يتبدّل قبل ردّ الخادم** (`optimistic`): الحفظُ رحلةُ شبكة،
 * **وزرٌّ لا يتغيّر تحت الإصبع يُقرأ معطّلاً فيُضغط مرّتين.** ويعود إلى
 * حاله إن سقط النداء، **مع رسالةٍ صريحة** — لا صمت.
 */
export function HomeViewSwitch({
  view,
  locale,
}: {
  view: HomeView;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [optimistic, setOptimistic] = useState<HomeView | null>(null);
  const [pending, start] = useTransition();

  const current = optimistic ?? view;
  const next: HomeView = current === "visual" ? "compact" : "visual";
  const label = next === "compact" ? t.viewCompact : t.viewVisual;

  function switchTo() {
    tap(8);
    setOptimistic(next);
    start(async () => {
      try {
        await setHomeView(next);
        router.refresh();
      } catch (e) {
        setOptimistic(null);
        flashError(t.errSave + (e as Error).message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={switchTo}
      disabled={pending}
      aria-label={t.viewSwitchAria}
      title={t.viewSwitchAria}
      className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border bg-surface ps-3.5 pe-4 h-11 text-[13px] font-bold transition hover:border-accent/50 active:scale-95 disabled:opacity-60"
    >
      {/* الرمزُ يصف الوجهةَ كما يصفها النصّ: شبكةٌ للبصريّ وقائمةٌ للمختصر */}
      <Icon
        name={next === "compact" ? "list" : "grid"}
        size={17}
        strokeWidth={2}
        style={{ color: "var(--accent)" }}
      />
      {label}
    </button>
  );
}
