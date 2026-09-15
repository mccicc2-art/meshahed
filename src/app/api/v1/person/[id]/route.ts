import type { NextRequest } from "next/server";
import { getPerson, getPersonCredits, isTvProgram } from "@/lib/tmdb";
import { isFollowingArtist, getUserId } from "@/lib/data";
import { displayPersonName } from "@/lib/wikidata";
import { getT } from "@/lib/locale";
import { titleOf, yearOf } from "@/core/media";
import { handle, positiveInt, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import type { PersonPayload, PersonWork } from "@/core/contracts/person";

/**
 * `GET /api/v1/person/{id}` — صفحةُ الشخص للتطبيق في ردٍّ واحد (D-983).
 *
 * 🔑 **المصادرُ مصادرُ الصفحة الويبيّة نفسُها** (`person/[id]/page.tsx`): `getPerson` +
 * `getPersonCredits` + الاسمُ العربيُّ من ويكي‑بيانات (D-171) + المهنةُ مترجمةً؛ **والتقسيمُ
 * الثلاثيّ للأعمال يُحسب هنا** (`isTvProgram`) فلا يكتبه التطبيقُ مرّةً ثانية.
 *
 * 🔑 **الأعمالُ مع الترويسة لا بعدها**: الويبُ يبثّها تحت الطيّة (Suspense) لأنّ
 * `combined_credits` ثقيل — والتطبيقُ يطلب مرّةً ويعرض هيكلاً حتى تصل؛ نداءان من
 * الهاتف أغلى من ثانيةٍ على الخادم.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(
    async () => {
      const { id } = await ctx.params;
      const personId = positiveInt(id);
      if (!personId) return fail("invalid_input");

      const uid = await getUserId();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:person:${uid ?? ip}`, 120, 60_000);
      if (lim) return lim;

      const { locale, t } = await getT();
      const [person, credits, following] = await Promise.all([
        getPerson(personId),
        getPersonCredits(personId),
        uid ? isFollowingArtist(personId) : false,
      ]);
      if (!person) return fail("not_found");
      const name = await displayPersonName(personId, person.name, locale);

      const works: PersonWork[] = credits.map((w) => ({
        kind: w.media_type === "tv" ? "tv" : "movie",
        id: w.id,
        title: titleOf(w),
        poster_path: w.poster_path ?? null,
        year: yearOf(w),
        group: w.media_type === "tv" ? (isTvProgram(w) ? "show" : "tv") : "movie",
      }));

      const dep = person.known_for_department;
      const department =
        dep === "Acting" ? t.depActing : dep === "Directing" ? t.depDirecting : dep === "Writing" ? t.depWriting : dep === "Production" ? t.depProduction : dep || null;

      const payload: PersonPayload = {
        id: personId,
        name,
        profile_path: person.profile_path ?? null,
        department,
        birthday: person.birthday ?? null,
        deathday: person.deathday ?? null,
        place_of_birth: person.place_of_birth ?? null,
        biography: person.biography ?? "",
        biography_is_fallback: !!person.biographyIsFallback,
        me: { following },
        works,
      };
      return ok(payload);
    },
    /* D-986 — يحمل `me.following`: لا يُخزَّن */
    { cacheControl: "private, no-store" },
  );
}
