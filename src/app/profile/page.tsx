import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/lib/data";

/**
 * `/profile` بابُ ملفّك — **ووجهتُه ملفُّك العامّ** (D-434).
 *
 * **كان يحوّل إلى الجذر** يومَ كانت ترويسةُ الحساب تفتح الرئيسية.
 * **ولمّا غادرت الترويسةُ إلى الملفّ العامّ** (`HomeHeader`) صار التحويلُ
 * إلى الجذر يعيدك من حيث أتيت — **وبابٌ يعيدك إلى مكانك بابٌ معطّل.**
 *
 * ⚠️ **ومن لا اسمَ مستخدمٍ له يذهب إلى الإعدادات**: الملفُّ العامّ
 * عنوانُه الاسمُ نفسُه، **فلا صفحةَ له قبل أن يختاره** — **والإعداداتُ
 * هي المكانُ الذي يُختار فيه**، لا رسالةُ خطأ.
 */
export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  redirect(profile?.username ? `/u/${profile.username}` : "/profile/edit");
}
