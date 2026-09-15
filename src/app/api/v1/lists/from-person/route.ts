import { createListFromPerson } from "@/lib/actions";
import { bodyRoute } from "@/lib/v1body";
import type { ListFromPersonBody, ListFromPersonResult } from "@/core/contracts/person";

/** `POST /api/v1/lists/from-person` — «أضِف أعماله إلى قائمة» أصليّاً (D-983): نفسُ `createListFromPerson` */
export const POST = bodyRoute<ListFromPersonBody, ListFromPersonResult>(
  async (b) => createListFromPerson(Number(b.personId)),
  () => ["me:lists", "me:library"],
);
