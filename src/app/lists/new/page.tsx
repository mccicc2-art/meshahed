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
  searchParams: Promise<{ from?: string; tab?: string; add?: string; edit?: string }>;
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

  /* 🆕 T454 — **`?edit=<id>` يفتح الصفحةَ نفسَها على شرط قائمةٍ ذكيّةٍ قائمة** (أحمد «أ»): مكانٌ واحدٌ للإنشاء والتعديل
     بدل ورقة المكتبة ووضع «حدّث» في «اكتشف». لصاحبها وحدَه، ومصدرُها من صفِّها (مكتبةٌ أو كتالوج) لا من الرابط. */
  let editing: { id: string; name: string; rule: Record<string, string> } | null = null;
  let editSource: "library" | "catalog" | null = null;
  if (sp.edit) {
    const data = await getList(sp.edit);
    const rule = data?.list.rule;
    if (!data || data.list.user_id !== user.id || data.list.kind !== "smart" || !rule || typeof rule !== "object") {
      redirect(data ? `/lists/${sp.edit}` : "/lists");
    }
    editing = {
      id: data.list.id,
      name: data.list.name,
      rule: Object.fromEntries(Object.entries(rule as Record<string, unknown>).filter(([, v]) => typeof v === "string")) as Record<string, string>,
    };
    editSource = data.list.rule_source === "library" ? "library" : "catalog";
  }

  const items = await getPickerItems(locale);
  return (
    <NewListFlow
      /* صفحتا تعديلٍ متتاليتان على المسار نفسِه لا تتقاسمان حالة */
      key={editing?.id ?? addTo?.id ?? "new"}
      locale={locale}
      from={editSource ? (editSource === "library" ? "library" : "discover") : sp.from === "library" ? "library" : "discover"}
      initialTab={editing || sp.tab === "smart" ? "smart" : "list"}
      addTo={addTo}
      editing={editing}
      items={items}
    />
  );
}
