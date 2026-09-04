import { Redirect } from "expo-router";
import { useAuth } from "../src/auth";
import { Loading, Screen } from "../src/ui";

/** البوّابة: داخلٌ ⇢ التبويبات، وإلا ⇢ الدخول. لا وميضَ قبل قراءة المخزن. */
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  return <Redirect href={session ? "/(tabs)/home" : "/login"} />;
}
