import type { Metadata } from "next";
import { getT } from "@/lib/locale";
import { GoogleReturn } from "./GoogleReturn";

/**
 * 🆕 T538 — عنوانُ العودة من Google على الآيفون والآيباد (`core/googleRedirect`). الرمزُ في جزء `#` فلا يراه الخادم:
 * الصفحةُ هيكلٌ فقط، والعملُ كلُّه في المتصفّح.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function GoogleReturnPage() {
  const { locale } = await getT();
  return <GoogleReturn locale={locale} />;
}
