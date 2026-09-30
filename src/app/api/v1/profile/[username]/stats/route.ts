import type { NextRequest } from "next/server";
import { getT } from "@/lib/locale";
import { getProfile, getProfileByUsername, getUserId } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { loadMemberAnalysis, loadTasteMatch, genreLabel } from "@/lib/memberStatsCore";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { isPlus } from "@/core/plan";
import { parseProfileHandle } from "@/core/contracts/profile";
import type { MemberStatsPayload } from "@/core/contracts/memberStats";

/**
 * `GET /api/v1/profile/{username}/stats` — إحصاءاتُ العضو للتطبيق (Phase 11-N · N4 · D-1192: «خلها اصلية»).
 *
 * 🔑 **ما ترسمه صفحةُ `/u/{username}/stats` حرفاً** — `loadMemberAnalysis` و`loadTasteMatch` نفسُهما (`lib/memberStatsCore.ts`).
 * 🔒 **الحسابُ الخاصُّ والحظرُ يقفلان** كما في `GET /api/v1/profile/{username}` (N2-fix2): `can_view_profile` و`is_blocked` —
 *   والصفحةُ تعتمد على حراسة الدوالّ وحدَها فتعود أصفاراً؛ هنا يُقال القفلُ صريحاً (لا أصفارٌ تبدو عطلاً).
 * ⚠️ **لا يُخزَّن**: يحمل تطابقَ القارئ.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  return handle(
    async () => {
      const { username } = await ctx.params;
      const h = parseProfileHandle(username);
      if (!h) return fail("invalid_input");

      const { locale } = await getT();
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const uid = await getUserId();
      const lim = limited(`v1:member-stats:${uid ?? ip}`, 30, 60_000);
      if (lim) return lim;

      const profile = await getProfileByUsername(h);
      if (!profile) return fail("not_found");

      const sb = await createClient();
      const [view, blocked] = await Promise.all([
        sb.rpc("can_view_profile", { target: profile.id }),
        uid && uid !== profile.id ? sb.rpc("is_blocked", { a: uid, b: profile.id }) : Promise.resolve({ data: false }),
      ]);
      const locked = uid !== profile.id && (view.data !== true || blocked.data === true);

      const person = {
        id: profile.id,
        nickname: profile.nickname,
        username: profile.username,
        avatar_url: profile.avatar_url,
        hide_name: !!profile.hide_name,
        plan: profile.plan ?? null,
        founder: profile.founder ?? null,
        verified_at: profile.verified_at ?? null,
      };
      const blank: MemberStatsPayload = {
        person: { ...person, bio: null, followers: null },
        locked,
        empty: !locked,
        totals: { minutes: 0, episodes: 0, movies: 0, shows: 0, reviews: 0 },
        hero_posters: [],
        taste: null,
        match: null,
      };
      if (locked) return ok(blank);

      const [data, got, me] = await Promise.all([
        loadMemberAnalysis(profile.id, locale),
        loadTasteMatch(uid, profile.id, locale),
        uid ? getProfile() : Promise.resolve(null),
      ]);
      if (!data) return ok(blank);

      const named = (r: { slug: string; mine: number; theirs: number }) => ({ name: genreLabel(r.slug, locale), mine: r.mine, theirs: r.theirs });
      const payload: MemberStatsPayload = {
        person: { ...person, bio: data.hero?.bio ?? null, followers: data.hero?.followers ?? null },
        locked: false,
        empty: false,
        totals: { minutes: data.minutes, episodes: data.episodes, movies: data.movies, shows: data.shows, reviews: data.reviews },
        hero_posters: data.heroPosters,
        taste: data.taste,
        match: got
          ? { pct: got.match.pct, shared: got.match.shared.map(named), apart: got.match.apart.map(named), picks: got.picks, plus: isPlus(me) }
          : null,
      };
      return ok(payload);
    },
    { cacheControl: "private, no-store" },
  );
}
