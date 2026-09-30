import { getDict, type Locale } from "@/core/i18n";
import { AnalysisView } from "./LibraryAnalysis";
import { loadMemberAnalysis } from "@/lib/memberStatsCore";

/**
 * 🆕 **إحصائياتُ عضوٍ أزوره** (D-649، طلبُ أحمد: «كل الحسابات خلي الكارد
 * الأساسي فيها مسلسلات أفلام احصائيات»).
 *
 * 🔴 **ولماذا لم تُوجَّه الخانةُ إلى `/stats` وحسب**: تلك الصفحةُ تقرأ
 * **صاحبَ الجلسة** — **فزائرٌ يضغط «إحصائيات» في ملفِّ مشعل كان سيرى
 * أرقامَ نفسِه ويظنّها أرقامَه** (D-217: **بابٌ يَعِد بما لا يعطي أسوأُ
 * من بابٍ غائب**). **فالسطحُ جديدٌ والقارئُ هدفٌ صريح.**
 *
 * 🔑 **والوجهُ وجهُ `/stats` نفسُه** (`AnalysisView`) — **لا نسخةَ
 * ثانيةً منه** (القاعدة ٣/D-145): **المختلفُ القارئُ لا الرسم.**
 *
 * ⚠️ **وما لا تعطيه الدوالُّ العامّةُ يغيب لا يُصفَّر** (D-217):
 * — **لا سطرَ «منذ يناير»**: `user_watch_stats` تجمع بالمسلسل لا
 *   بالحلقة، **فلا تاريخَ حلقةٍ يُقرأ** — **وسطرٌ بأصفارٍ يقول «لم
 *   يشاهد شيئاً هذا العام» وهو كذب.**
 * — **ولا تبويباتُ مدى** للسبب نفسِه: **الرقمُ هنا كلُّ العمر، وقوسُ
 *   الحلقة كاملٌ لأنه الكلّ.**
 * — **و«جارٍ» للأفلام لا يُحسب**: `movie_progress` مقصورٌ على صاحبه،
 *   **فالفيلمُ عنده «شوهد» أو «لم يبدأ»** — والمسلسلاتُ بأقسامها الثلاثة.
 */
export async function MemberAnalysis({
  userId,
  locale,
  tasteAction,
}: {
  userId: string;
  locale: Locale;
  tasteAction?: React.ReactNode;
}) {
  const t = getDict(locale);
  /* 🆕 11-N · N4 — القراءةُ والاشتقاقُ في `lib/memberStatsCore.ts` بحرفهما (تقرؤهما شاشةُ التطبيق أيضاً — D-1192) */
  const data = await loadMemberAnalysis(userId, locale);
  if (!data) {
    return <p className="text-sm text-muted text-center py-10">{t.analysisEmptyOther}</p>;
  }
  return <AnalysisView locale={locale} tasteAction={tasteAction} data={data} />;
}
