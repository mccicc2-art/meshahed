import type { NextRequest } from "next/server";
import { platformGET, platformPOST } from "@/lib/platformRoute";

/**
 * 🆕 `GET · POST /api/v1/me/links/netflix` — ربطُ نتفليكس ومزامنتُه وفكُّه و«ما دخل» (هجرة ٢٦٥، خطّة `PLAN-NETFLIX-SYNC.md`).
 * المنطقُ كلُّه في `lib/platformRoute.ts` — بابٌ واحدٌ لكلِّ منصّة (المهمّة ٥٥٧)؛ هنا اسمُ المنصّة وحده.
 */
export async function GET() {
  return platformGET("netflix");
}

export async function POST(req: NextRequest) {
  return platformPOST("netflix", req);
}
