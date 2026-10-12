import { assetLinks } from "@/lib/appLinks";

// D-1375 — أندرويد يجلبه مرّةً عند التثبيت ليتحقّق أنّ التطبيقَ يملك النطاق. ثابتٌ حتى يتغيّر الكود.
export const dynamic = "force-static";

export function GET() {
  return Response.json(assetLinks(), {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
