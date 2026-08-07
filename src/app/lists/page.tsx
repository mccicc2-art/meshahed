import { redirect } from "next/navigation";
import { getUser, getMyLists, getSavedLists } from "@/lib/data";
import { getT } from "@/lib/locale";
import { ListManager } from "@/components/ListManager";
import { PublicListsRail } from "@/components/PublicListsRail";

/**
 * قوائمي.
 *
 * القوائم تُقرأ باستدعاء واحد يرجّع الاسم والعدد وثلاثة ملصقات — لا استعلام
 * لكل قائمة ولا طلب TMDB واحد، فالصفحة تفتح فوراً مهما كثرت القوائم.
 *
 * وتحت قوائمي: «قوائم محفوظة» (D-068) — مراجعُ حيّة إلى قوائم أصحابها،
 * بطاقتها بطاقة اكتشف نفسها بسطر صاحبها: هي قوائم غيرك لا قوائمك، وموضعها
 * بعد صنعك لا بينه.
 */
export default async function ListsPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const { locale, t } = await getT();
  const [lists, saved] = await Promise.all([getMyLists(), getSavedLists()]);

  return (
    <div className="space-y-8">
      {/* العنوان مخفيٌّ بصريًّا وباقٍ لقارئ الشاشة — أُزيلت الترويسة والوصف */}
      <h1 className="sr-only">{t.listsTitle}</h1>
      <ListManager lists={lists} locale={locale} />
      <PublicListsRail lists={saved} locale={locale} title={t.savedListsSection} />
    </div>
  );
}
