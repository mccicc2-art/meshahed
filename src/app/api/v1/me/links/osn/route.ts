import type { NextRequest } from "next/server";
import { platformGET, platformPOST } from "@/lib/platformRoute";

/**
 * 🆕 `GET · POST /api/v1/me/links/osn` — ربطُ OSN+ ومزامنتُه وفكُّه و«ما دخل» (هجرة ٢٦٨، المهمّة ٥٥٧). البابُ نفسُه لنتفليكس
 * (`lib/platformRoute.ts`): لا جلسةَ ولا سجلَّ يصل الخادم — الدخولُ والقراءةُ في متصفّح التطبيق على جهاز العضو.
 */
export async function GET() {
  return platformGET("osn");
}

export async function POST(req: NextRequest) {
  return platformPOST("osn", req);
}
