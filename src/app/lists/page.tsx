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
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.listsTitle}</h1>
      <ListManager lists={lists} locale={locale} />
    </div>
  );
}
