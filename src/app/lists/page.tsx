import { redirect } from "next/navigation";
import { getUser, getMyLists } from "@/lib/data";
import { getT } from "@/lib/locale";
import { ListManager } from "@/components/ListManager";

/**
 * قوائمي.
 *
 * القوائم تُقرأ باستدعاء واحد يرجّع الاسم والعدد وثلاثة ملصقات — لا استعلام
 * لكل قائمة ولا طلب TMDB واحد، فالصفحة تفتح فوراً مهما كثرت القوائم.
 */
export default async function ListsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const lists = await getMyLists();

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">{t.listsTitle}</h1>
      <p className="text-xs text-muted mb-5">{t.listsSub}</p>
      <ListManager lists={lists} locale={locale} />
    </div>
  );
}
