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
      {/* الرجوع إلى تبويب «القوائم» في المكتبة لا إلى المسار المنفصل:
          هو المكان الذي جاء منه المستخدم فعلاً بعد نقل القوائم إليه (D-042) */}
      <Link
        href="/library?filter=list"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition mb-3 -ms-1 px-1 py-1"
      >
        <span aria-hidden>‹</span>
        {t.listsTitle}
      </Link>
      <ListDetail
        listId={data.list.id}
        name={data.list.name}
        subtitle={data.list.subtitle}
        isPublic={data.list.is_public}
        kind={data.list.kind}
        items={data.items}
        ratings={data.ratings}
        isOwner={data.list.user_id === user.id}
        locale={locale}
      />
    </div>
  );
}
