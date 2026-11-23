import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { getRateQueue } from "@/lib/rateQueue";
import { RateQueue } from "@/components/RateQueue";

/**
 * `/ratings/pending` — 🆕 T530 «بانتظار تقييمك» في الويب: من سطرِ «تقييماتي» والمكتبة، وبطاقةِ الرئيسيّة، والإشعارِ الأسبوعيّ
 * (التطبيقُ يفتح الرابطَ نفسَه أصليّاً). القائمةُ تُحسب هنا (`getRateQueue`) والتفاعلُ في `RateQueue`.
 */
export default async function RateQueuePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const q = await getRateQueue(locale);
  return (
    <div>
      <h1 className="text-20 font-bold mb-1">{t.rateQueueTitle}</h1>
      <p className="text-14 text-muted mb-4">{t.rateQueueSub}</p>
      <RateQueue items={q?.items ?? []} locale={locale} />
    </div>
  );
}
