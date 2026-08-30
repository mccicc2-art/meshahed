import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * ============ المعاينةُ المموّهة لغير المشترك (D-809) ============
 *
 * **شرطُ أحمد المكتوب في مواصفة D-799 بحرفه**: «**معاينة محدودة/مموّهة
 * جزئياً لغير المشترك**» و«**لا تعرض بيانات وهمية للمستخدم غير
 * المشترك**».
 *
 * 🔑 **والمموَّهُ بياناتُه هو**، لا أرقامٌ مخترعة. **وهذا ليس تفصيلاً
 * أخلاقيّاً وحدَه، هو الفرقُ بين معاينةٍ تبيع ومعاينةٍ تكذب**: **رقمٌ
 * مخترعٌ خلف الضباب يُقرأ عرضاً**، **ورقمُه هو يُقرأ «هذا أنت، وهذا ما
 * لا تراه».** **والشاشةُ الفارغةُ التي كانت هنا لا تبيع شيئاً**: من لم
 * يرَ ما يشتريه لا يشتريه (حجّةُ D-633 في مربّعات الثيمات، مطبَّقةً على
 * صفحةٍ كاملة).
 *
 * ⚖️ **والفتحةُ أوّلُ حقيقةٍ لا صفر**: **الرقمُ الكبيرُ وسطرُه مكشوفان**
 * — **ومعاينةٌ لا تُعطي شيئاً ليست معاينةً، هي قفلٌ بضبابٍ عليه.**
 * **وما تحتهما مموَّه**: الأعمدةُ والأكثرُ مشاهدةً واللمحةُ والذوق.
 *
 * ⚠️ **والثمنُ يُقال ولا يُخبَّأ**: **النصُّ المموَّه في الصفحة**،
 * **ومن فتح أدواتِ المطوّر قرأه.** **وهي أرقامُه هو لا أرقامُ غيره**،
 * **فلا تسريبَ خصوصيّةٍ هنا — تحايلٌ على قفلِ عرضٍ لا غير.**
 * **والبديلُ الوحيدُ المانعُ هو ألّا تُحسب أصلاً**، **وحينها تصير
 * المعاينةُ مستطيلاتٍ رماديّةً لا تبيع** — **والمقايضةُ مأخوذةٌ بعينها.**
 *
 * ⚠️ **والمموَّهُ خارجُ شجرةِ التنقّل**: `aria-hidden` و
 * `pointer-events-none` و`select-none` — **ورابطٌ لا يُقرأ ولا يُضغط
 * ليس رابطاً**، **وقارئُ الشاشة لا يُقاد إلى ضباب.**
 */
export function PlusPreview({
  locale,
  open,
  locked,
}: {
  locale: Locale;
  /** ما يُرى كاملاً — أوّلُ حقيقةٍ تُعطى بلا ثمن */
  open?: React.ReactNode;
  /** ما يُموَّه — بياناتُه الحقيقيّة، لا بديلَ مخترع */
  locked: React.ReactNode;
}) {
  const t = getDict(locale);
  const ar = locale !== "en";
  return (
    <>
      {open}
      <div className="relative mt-6">
        {/* **والقناعُ يذيب الحافّة**: **قطعٌ حادٌّ يُقرأ صفحةً مكسورة**،
            **وتلاشٍ يقول «هناك المزيد» بلا كلمة.** */}
        <div
          aria-hidden
          className="pointer-events-none select-none max-h-[340px] overflow-hidden blur-[7px] opacity-70 [mask-image:linear-gradient(to_bottom,black_0%,black_55%,transparent_100%)]"
        >
          {locked}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 text-center px-4 pb-1">
          <Icon name="sparkle-star" size={26} className="text-accent" />
          <p className="text-15 font-bold leading-tight">{t.plusGateTitle}</p>
          <p className="text-12 text-muted leading-relaxed max-w-sm">
            {ar
              ? "تقريرك كاملاً — الأعمدة وأكثر ما شاهدت وذوقك وعاداتك. وإحصاءاتك في صفحة الإحصائيات تبقى مجّانيةً كما هي."
              : "Your full report — the chart, what you watched most, your taste and your habits. Your stats page stays free exactly as it is."}
          </p>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <p className="text-15 font-bold leading-none">{t.plusPrice}</p>
            <p className="mt-1 text-12 text-muted leading-none">{t.plusPriceRenew}</p>
            <p className="mt-1.5 text-12 text-muted leading-none">{t.plusSoon}</p>
          </div>
          <Link href="/plus" className="text-12 font-bold text-accent hover:underline">
            {t.plusLearnMore}
          </Link>
        </div>
      </div>
    </>
  );
}
