import { appleAppSiteAssociation } from "@/lib/appLinks";

// D-1375 — Apple تجلبه عبر شبكتها (لا الجوال) ليتحقّق أنّ التطبيقَ يملك النطاق. بلا امتداد بالاسم الذي تطلبه Apple،
// ولهذا هو مسارٌ لا ملفٌّ في `public/`: الملفُّ بلا امتداد يُخدم `octet-stream`، وApple تريد JSON.
export const dynamic = "force-static";

export function GET() {
  return Response.json(appleAppSiteAssociation(), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
