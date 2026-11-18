import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/locale";
import { LinksView } from "@/components/links/LinksView";
import { LINK_WORDS } from "@/components/links/linksApi";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.linksTitle, robots: { index: false } };
}

/**
 * 🆕 **«الربط» — مدارُ الأجهزة في الويب** (T409، التصميم «أ»). صفحةُ العضو وحده: الحالةُ من `GET /api/v1/me/links` بالكوكي،
 * والكتابةُ من الأبواب نفسِها التي يكتب منها التطبيق — فما يُربط هنا يظهر في جوّاله، وبالعكس.
 */
export default async function LinksPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const { locale, t } = await getT();
  const w = LINK_WORDS[locale === "en" ? "en" : "ar"];
  return (
    <div className="pb-6">
      <header className="mb-5">
        <h1 className="text-2xl font-extrabold md:text-[28px]">{t.linksTitle}</h1>
        <p className="mt-1 text-sm text-muted">{w.sub}</p>
      </header>
      <LinksView locale={locale} />
    </div>
  );
}
