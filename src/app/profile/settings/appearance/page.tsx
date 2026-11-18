import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { AppearancePane } from "@/components/settings/AppearancePane";

/** المظهرُ واللغة — المحتوى في `AppearancePane` (R260)، وهذه بابُه وحارسُه */
export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/login");
  return <AppearancePane />;
}
