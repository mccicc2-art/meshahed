import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { myLibraryGrants, setLibraryGrant } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { LibraryGrantBody, PeoplePayload } from "@/core/contracts/settings";

/**
 * `GET /api/v1/me/settings/library-access` — من مُنحوا مكتبتي (`LibraryAccessList`).
 * المرشَّحون للمنح هم متابِعيّ — من `GET /me/follows?dir=followers` القائم، لا بابٌ ثانٍ.
 */
export async function GET() {
  return handle<PeoplePayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    return ok({ people: await myLibraryGrants() });
  });
}

/** `POST` — منحٌ أو سحب (`setLibraryGrant`؛ منحُ نفسِك يرمي والغلافُ يترجم) */
export const POST = bodyRoute<LibraryGrantBody, { done: true }>(
  async (b) => {
    await setLibraryGrant(String(b.user_id), !!b.grant);
    return { done: true };
  },
  () => [],
);
