import type { Metadata } from "next";
import { normalizeLocale } from "@/core/i18n";
import { getLocale } from "@/lib/locale";
import { TermsDoc } from "@/components/legal/TermsDoc";

/**
 * `/app/terms` — **الوثيقةُ عاريةً لشاشة الدخول الأصليّة** (D-1345).
 *
 * العطل (تسجيلُ أحمد ١٠ أكتوبر): الرابطُ في شاشة الدخول فتح `/terms` — صفحةَ الموقع بشريطه السفليّ
 * ورابطِ «‹ Loopz» — فتصفّح الموقعَ كلَّه من داخل التطبيق قبل أن يسجّل. هذه النسخةُ نصٌّ فقط: لا شريطَ
 * علويّاً ولا سفليّاً (`hidesAppHeader` + قائمةُ `BottomNav`) ولا رابطَ يخرج منها (`bare`).
 *
 * 🔑 **`?lang=`**: المتصفّحُ المصغَّر لا يشارك الـWebView كعكاتِها، فلا يعرف اللغةَ التي اختارها في شاشة
 * الدخول — تحملها الشاشةُ في العنوان. بلا الوسم ⇒ حكمُ الموقع المعتاد (الكعكة ثمّ لغةُ الجهاز).
 *
 * ⚖️ **`/terms` العامّة باقيةٌ كما هي**: هي الرابطُ المسجَّل في شاشة موافقة Google وفي المتجرين.
 */
export const metadata: Metadata = { title: "Terms of Use", robots: { index: false, follow: false } };

export default async function BareTermsDocPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { lang } = await searchParams;
  const locale = lang === "ar" || lang === "en" ? normalizeLocale(lang) : await getLocale();
  return (
    /* لا شريطَ تطبيقٍ هنا وهو من كان يحجز حافّةَ الشاشة العليا — فتحجزها الصفحة (كما في `/welcome`) */
    <div className="pt-[var(--safe-top)]">
      <TermsDoc locale={locale} bare />
    </div>
  );
}
