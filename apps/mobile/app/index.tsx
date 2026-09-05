import { Redirect } from "expo-router";

/** البوّابة: كلُّ شيءٍ في `/web` (D-922) — الجلسةُ تُقرأ هناك قبل أوّل رسمة. */
export default function Index() {
  return <Redirect href="/web" />;
}
