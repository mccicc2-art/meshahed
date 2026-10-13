import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAmAdmin } from "@/lib/data";
import { getTrailerKeys } from "@/lib/tmdb";
import { YtMarkTest } from "./YtMarkTest";

/**
 * 🧪 **صفحةُ تجربةٍ مؤقّتة** (أحمد ١٣ أكتوبر: «نفذ وارفع .. وانتبه من الاخطاء ما ابغى شيء يتأثر»).
 * السؤالُ: هل يوجد طريقةُ تشغيلٍ لا يرسم فيها يوتيوب علامةَ ⏸ العريضةَ في وسط المقطع؟
 *
 * 🔑 **لا تلمس شيئاً مشتركاً**: لا متحكّمَ التريلرات ولا صفحتَها — المشغّلاتُ هنا نسخٌ داخل هذا المجلّد وحدَه،
 * فحذفُ المجلّد يعيد الموقعَ حرفاً كما كان. **ومقفلةٌ على الإدارة** (`getAmAdmin`): غيرُ المدير يرى «غير موجود».
 * ⚠️ **تُحذف بعد التجربة** — مسجَّلةٌ في ملفّات المشروع كي لا تُنسى.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/* مفتاحٌ صالحٌ من الكتالوج نفسِه (Breaking Bad، TMDB 1396) — لا مفتاحَ مكتوباً قد لا يقبل التضمين */
const FALLBACK_TV_ID = 1396;

export default async function YtMarkTestPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (!(await getAmAdmin())) notFound();
  const sp = await searchParams;
  const asked = typeof sp.v === "string" && /^[A-Za-z0-9_-]{11}$/.test(sp.v) ? sp.v : null;
  const key = asked ?? (await getTrailerKeys("tv", FALLBACK_TV_ID).catch(() => null))?.keys[0] ?? null;
  if (!key) notFound();
  return <YtMarkTest videoKey={key} />;
}
