import { revalidatePath } from "next/cache";
import { uniqueTags, type Tag } from "@/core/contracts/tags";

/**
 * ====== ترجمةُ الوسوم إلى مسارات Next — الموضعُ الوحيد (Phase 9 §4.3) ======
 *
 * 🔑 **هذا الملفُّ هو نصفُ الويب من القاعدة ٤**: `core` يعلن ما أبطلته وسوماً،
 * وهنا وحدَه تُترجم إلى `revalidatePath`. **والنصفُ الآخر في غلاف `v1`**: يعيد
 * الوسومَ كما هي فيُسقط التطبيقُ استعلاماتِه المحلّية.
 *
 * ⚠️ **ولمَ جدولٌ لا اشتقاقٌ من الاسم؟** لأنّ العلاقةَ ليست واحداً لواحد:
 * `me:stats` يبطل صفحتين (`/stats` و`/statistics` — بابان لنفس البيانات)،
 * و`admin` يبطل خمساً. **الاشتقاقُ الذكيّ كان سيصمت عن الثانية.**
 *
 * ⚠️ **و`/u/[username]` يُمرَّر بشكله القالبيّ عمداً**: هكذا يبطل Next كلَّ
 * صفحات المستخدمين دفعةً — وهو ما تفعله `actions.ts` اليوم حرفاً، فلا يتغيّر
 * سلوكُ الويب بسطرٍ واحد.
 */

const STATIC: Record<string, readonly string[]> = {
  home: ["/"],
  "me:library": ["/library"],
  "me:lists": ["/lists"],
  "me:stats": ["/stats", "/statistics"],
  "me:ratings": ["/ratings"],
  "me:diary": ["/diary"],
  "me:reports": ["/reports"],
  "me:invites": ["/profile/settings/invites"],
  people: ["/people"],
  news: ["/news"],
  admin: [
    "/admin/users",
    "/admin/verify",
    "/admin/payouts",
    "/admin/partners",
    "/admin/links",
  ],
};

/** وسمٌ واحد ⇠ مساراتُه. مُصدَّرةٌ للاختبار: **قاعدةٌ تُقاس أفضلُ من قاعدةٍ تُصدَّق.** */
export function tagToPaths(tag: Tag): string[] {
  const fixed = STATIC[tag];
  if (fixed) return [...fixed];

  const [head, ...rest] = tag.split(":");
  if (head === "list") return [`/lists/${rest.join(":")}`];
  if (head === "post") return [`/post/${rest.join(":")}`];
  if (head === "user") return ["/u/[username]"];
  if (head === "title") {
    const [kind, id] = rest;
    return [kind === "movie" ? `/movie/${id}` : `/show/${id}`];
  }
  return [];
}

export function revalidateTags(tags: readonly Tag[]): void {
  const paths = new Set<string>();
  for (const tag of uniqueTags(tags)) for (const p of tagToPaths(tag)) paths.add(p);
  for (const p of paths) revalidatePath(p);
}
