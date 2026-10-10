import type { NextRequest } from "next/server";
import { checkUsername } from "@/lib/actions";
import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { WelcomeUsernamePayload } from "@/core/contracts/welcome";

/**
 * `GET /api/v1/welcome/username?u=` — فحصُ الاسم وهو يُكتب (D-1347). غلافٌ على `checkUsername` نفسِها:
 * مجاملةٌ لا حكم — القاضي الفهرسُ الفريد عند الحفظ، و`unknown` (شبكة · حدُّ المعدّل) لا يقفل الزرّ.
 */
export async function GET(req: NextRequest) {
  return handle<WelcomeUsernamePayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      return ok({ state: await checkUsername(req.nextUrl.searchParams.get("u") ?? "") });
    },
    { open: true },
  );
}
