import { getT } from "@/lib/locale";
import { SearchScreen } from "@/components/SearchScreen";
import type { SearchScope } from "@/core/searchTypes";

/**
 * **صفحةُ البحث — قشرةٌ خادميّةٌ وحدَها** (D-534، تصميمُ أحمد).
 *
 * **ولا نتيجةَ تُرسم على الخادم هنا، وهذا مقصود:** البحثُ يبدأ بحرفٍ
 * يُكتب لا برابطٍ يُفتح، **وكلُّ ضغطةِ زرٍّ بعده تسأل من جديد** — فرسمُ
 * الجولة الأولى على الخادم يشتري إطاراً واحداً بثمن رحلةٍ كاملة، **ثمّ
 * يتولّى العميلُ الجولاتِ العشرَ التالية على أيّ حال.** ⚖️ **والصفحةُ صارت
 * مفتوحةً للزائر** (D-627) — نقضُ سطر «خلف تسجيل الدخول» هنا: صار
 * للزائر شريطُ بحثٍ في كرومه، وحجّةُ الفهرسة تُحلّ بأن الصفحة قشرةٌ
 * بلا محتوى خادميٍّ أصلاً.
 *
 * **والرابطُ العميق يعمل كاملاً**: `‎/search?q=suits&type=lists` يصل
 * الشاشةَ مكتوباً ومُرشَّحاً، **وهو ما يكتبه العميلُ نفسُه في العنوان
 * أثناء الكتابة** (`replaceState` — D-521).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { locale } = await getT();
  const { q = "", type } = await searchParams;

  const scope: SearchScope =
    type === "titles" || type === "artists" || type === "members" || type === "lists"
      ? type
      : "all";

  return <SearchScreen locale={locale} initialQ={q} initialScope={scope} />;
}
