import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { myBlocksList, unblockUser } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { UnblockBody, PeoplePayload } from "@/core/contracts/settings";

/** `GET /api/v1/me/settings/blocked` — المحظورون (`BlockedList`) */
export async function GET() {
  return handle<PeoplePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    return ok({ people: await myBlocksList() });
  });
}

/** `POST` — رفعُ الحظر وحدَه؛ الحظرُ نفسُه من صفحة الشخص (ويب) */
export const POST = bodyRoute<UnblockBody, { done: true }>(
  async (b) => {
    await unblockUser(String(b.user_id));
    return { done: true };
  },
  () => ["people", "home"],
);
