import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUser, getList } from "@/lib/data";
import { getT } from "@/lib/locale";
import { ListDetail } from "@/components/ListDetail";

/**
 * قائمة واحدة.
 *
 * العناوين والملصقات مخزّنة مع عناصر القائمة، فلا طلب TMDB هنا إطلاقاً —
 * قائمة فيها مئة عمل تُعرض بسرعة قائمة فيها ثلاثة.
 */
export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const { id } = await params;

  const data = await getList(id);
  if (!data) notFound();

  return (
    <div>
      <Link
        href="/lists"
        className="inline-block text-xs text-muted hover:text-foreground transition mb-3"
      >
        ‹ {t.listsTitle}
      </Link>
      <ListDetail
        listId={data.list.id}
        name={data.list.name}
        isPublic={data.list.is_public}
        items={data.items}
        isOwner={data.list.user_id === user.id}
        locale={locale}
      />
    </div>
  );
}
