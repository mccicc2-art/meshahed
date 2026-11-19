import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser, getList } from "@/lib/data";
import { getT } from "@/lib/locale";
import { getPickerItems } from "@/lib/listPicker";
import { NewListFlow } from "@/components/NewList/NewListFlow";

/**
 * 🆕 T450 — «قائمة جديدة»: صفحةٌ لا ورقة (أحمد: «هل نترك الانبثاق ذا وندخل على صفحة»).
 *
 * - `?from=library` يقيّد الصفحةَ بمكتبتك (بلا «للمشاهدة» ولا بحثٍ في الكتالوج)، وغيابُه = «اكتشف».
 * - `?tab=smart` يفتح على «قائمة ذكيّة».
 * - `?add=<id>` = «أضف أعمالاً» إلى قائمةٍ قائمة — الخطوةُ الأولى وحدَها، **والصلاحيّةُ لـRLS** (المالكُ والمحرّرون):
 *   الصفحةُ لا تقرّر من يُضيف، وإن لم تُقرأ القائمةُ أو كانت ذكيّةً عادت إليها.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.listNewGroup, robots: { index: false } };
}

export default async function NewListPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; tab?: string; add?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [{ locale }, sp] = await Promise.all([getT(), searchParams]);

  let addTo: { id: string; name: string } | null = null;
  if (sp.add) {
    const data = await getList(sp.add);
    if (!data || data.list.kind === "smart" || data.list.rule) redirect(sp.add && data ? `/lists/${sp.add}` : "/lists");
    addTo = { id: data.list.id, name: data.list.name };
  }

  const items = await getPickerItems(locale);
  return (
    <NewListFlow
      locale={locale}
      from={sp.from === "library" ? "library" : "discover"}
      initialTab={sp.tab === "smart" ? "smart" : "list"}
      addTo={addTo}
      items={items}
    />
  );
}
