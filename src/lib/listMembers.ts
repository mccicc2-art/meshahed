import "server-only";
import { getListMembers, getPersonLite } from "@/lib/data";
import { displayNameOf } from "@/core/people";
import type { Dict } from "@/core/i18n";
import type { ListMember } from "@/core/contracts/library";

/**
 * ====== أعضاءُ القائمة المشتركة كما تُرسم — قارئٌ واحدٌ للصفحة والتطبيق (هجرة ٢٣٤) ======
 *
 * 🔑 **صفحةُ الويب ومسارُ `GET /api/v1/lists/[id]` يقرآن من هنا** — فلا ترتيبان ولا تسميتان لشيءٍ واحد (D-145):
 * صاحبُها أوّلاً، ثمّ الفعّالون، ثمّ المعلّقون (وهؤلاء لا يصلون إلّا لصاحبها — RLS)، و«أنت» مكانَ اسمي.
 * والقائمةُ بلا أعضاءٍ تعيد `[]` — فلا سطرَ أعضاءٍ لقائمةٍ لم تُشارَك.
 */
export async function shapeListMembers(input: {
  listId: string;
  ownerId: string;
  uid: string | null;
  /** صاحبُها كما يردّه `public_list` للمعلنة — الخاصّةُ تُقرأ بـ`getPersonLite` */
  owner: { nickname: string | null; username: string | null; avatar: string | null } | null;
  t: Dict;
}): Promise<{ members: ListMember[]; my: "active" | "pending" | null }> {
  const rows = await getListMembers(input.listId);
  if (!rows.length) return { members: [], my: null };
  const { t, uid } = input;
  const nameOf = (p: { nickname: string | null; username: string | null }, id: string) =>
    id === uid ? t.listMemberYou : displayNameOf({ nickname: p.nickname, username: p.username, hide_name: !p.nickname && !p.username }, t.anonymousUser);

  const o =
    input.owner ??
    (await getPersonLite(input.ownerId).then((p) => (p ? { nickname: p.nickname, username: p.username, avatar: p.avatar_url } : null)));
  const owner: ListMember = {
    id: input.ownerId,
    name: nameOf({ nickname: o?.nickname ?? null, username: o?.username ?? null }, input.ownerId),
    username: o?.username ?? null,
    avatar: o?.avatar ?? null,
    role: "owner",
  };
  const asMember = (status: "active" | "pending") =>
    rows
      .filter((m) => m.status === status)
      .map((m): ListMember => ({ id: m.id, name: nameOf(m, m.id), username: m.username, avatar: m.avatar_url, role: status === "active" ? "member" : "pending" }));
  const mine = uid ? rows.find((m) => m.id === uid) : undefined;
  return { members: [owner, ...asMember("active"), ...asMember("pending")], my: mine ? mine.status : null };
}
