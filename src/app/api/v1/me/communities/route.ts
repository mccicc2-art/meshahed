import { handle, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { myCommunitiesList } from "@/lib/actions";
import type { CommunitiesPayload } from "@/core/contracts/library";

/** `GET /api/v1/me/communities` — مجتمعاتي (Phase 11-G · G6؛ `my_communities` كما في الويب) للنشر فيها */
export async function GET() {
  return handle<CommunitiesPayload>(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const rooms = await myCommunitiesList();
    return ok({ rooms: rooms.map((c) => ({ id: c.id, name: c.name, member_count: c.member_count, photo_url: c.photo_url ?? null })) });
  });
}
