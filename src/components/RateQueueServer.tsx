import "server-only";

import { getRateQueue } from "@/lib/rateQueue";
import { RateQueueEntryLink, RateQueueHomeCard } from "@/components/RateQueueCard";
import type { Locale } from "@/core/i18n";

/**
 * 🆕 T530 — بابا «بانتظار تقييمك» على الخادم، كلٌّ في `Suspense` عند مستدعيه: الحسابُ (المكتبة والمشاهدة والتقييمات) لا يؤخّر
 * رسمَ الصفحة. والملخّصُ وحدَه (`summary`): العددُ وأوّلُ ثلاثةٍ مترجمة.
 */
export async function RateQueueEntryServer({ locale, className }: { locale: Locale; className?: string }) {
  const q = await getRateQueue(locale, { summary: true }).catch(() => null);
  return <RateQueueEntryLink total={q?.total ?? 0} locale={locale} className={className} />;
}

export async function RateQueueHomeServer({ locale }: { locale: Locale }) {
  const q = await getRateQueue(locale, { summary: true }).catch(() => null);
  if (!q?.card) return null;
  return <RateQueueHomeCard total={q.total} first={q.items} locale={locale} />;
}
