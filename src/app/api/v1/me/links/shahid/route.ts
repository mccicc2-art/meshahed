import type { NextRequest } from "next/server";
import { platformGET, platformPOST } from "@/lib/platformRoute";

/**
 * 🆕 `GET · POST /api/v1/me/links/shahid` — ربطُ شاهد ومزامنتُه وفكُّه و«ما دخل» (هجرة ٢٧١، المهمّة ٥٦٧). البابُ نفسُه لنتفليكس
 * (`lib/platformRoute.ts`): لا جلسةَ ولا سجلَّ يصل الخادم — الدخولُ والقراءةُ في متصفّح التطبيق على جهاز العضو.
 */
export async function GET() {
  return platformGET("shahid");
}

export async function POST(req: NextRequest) {
  return platformPOST("shahid", req);
}
