import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { fail, handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getFollows, getFollowsOf, getProfile, getProfileByUsername } from "@/lib/data";
import { loadTasteMatch } from "@/lib/memberStatsCore";
import { loopzArt } from "@/lib/curatedArt";
import { createClient } from "@/lib/supabase/server";
import { posterUrl } from "@/core/media";
import { getT } from "@/lib/locale";
import { ogFonts } from "@/lib/og";
import { dataUrl } from "@/lib/fetchableImage";
import { SITE_URL } from "@/lib/site";
import { MATCH_CARD, matchCardElement, matchVerdict } from "@/lib/matchCard";

export const runtime = "nodejs";

/**
 * `GET /api/v1/me/match-card/image?u=<username>` — 🆕 T596 **صورةُ تطابق الذوق للقصص** (ن٧ «ص٨» · س٩ «أ»).
 * - **التطابقُ تطابقُ الملفّ نفسُه** (`loadTasteMatch` — حصصُ الأنواع، والقراءاتُ محروسةٌ بـ`can_view_profile`): لا يُرسم لنفسك،
 *   ولا لحسابٍ خاصٍّ أو مكتبةٍ أقلَّ من أن تُقارَن (٤٠٩).
 * - **اسمُ الصديق وصورتُه بإذنه** (`match_card_name_ok`، الهجرة ٢٧٣) — وقبل الهجرة يُعدّ الجوابُ «لا» فيُكتب «صديق».
 * - **«شاهدناها معاً»**: أوّلُ أربعةٍ في المكتبتين بترتيب مكتبتك، باسمها وملصقها بقاعدة لوبز (`loopzArt`).
 */
export async function GET(req: NextRequest) {
  const gate = await handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:match-image:${auth.user.id}`, 8, 60_000);
    if (lim) return lim;
    return ok({ id: auth.user.id });
  });
  if (!gate.ok) return gate;
  const meId = ((await gate.clone().json()) as { data: { id: string } }).data.id;

  const handleParam = (req.nextUrl.searchParams.get("u") ?? "").trim();
  const [{ locale }, target, me] = await Promise.all([getT(), getProfileByUsername(handleParam).catch(() => null), getProfile()]);
  if (!target || target.id === meId) return handle(async () => fail("not_found"));
  const tm = await loadTasteMatch(meId, target.id, locale);
  if (!tm) return handle(async () => fail("conflict"));

  const [mine, theirs, allowed] = await Promise.all([
    getFollows(),
    getFollowsOf(target.id),
    createClient()
      .then((sb) => sb.rpc("match_card_name_ok", { target: target.id }))
      .then((r) => r.data === true)
      .catch(() => false),
  ]);
  const theirKeys = new Set(theirs.map((f) => `${f.media_type}-${f.tmdb_id}`));
  const both = mine.filter((f) => theirKeys.has(`${f.media_type}-${f.tmdb_id}`)).slice(0, 4);
  const art = await Promise.all(both.map((f) => loopzArt({ tmdbId: f.tmdb_id, mediaType: f.media_type, title: null, posterPath: f.poster_path }).catch(() => null)));
  const together = await Promise.all(both.map((f, i) => dataUrl(posterUrl(art[i]?.posterPath ?? f.poster_path, "w342"))));
  const except = art[0]?.title || both[0]?.title || null;

  const abs = (u: string | null | undefined) => (!u ? null : u.startsWith("/") ? `${SITE_URL}${u}` : u);
  const pic = (u: string | null) => (u?.startsWith(SITE_URL) ? Promise.resolve(u) : dataUrl(u));
  const initialOf = (u: string | null | undefined) => (u ?? "L").replace(/[^A-Za-z0-9]/g, "").slice(0, 1).toUpperCase() || "L";
  const meHidden = !!me?.hide_name;
  const [myAvatar, theirAvatar] = await Promise.all([meHidden ? null : pic(abs(me?.avatar_url)), allowed ? pic(abs(target.avatar_url)) : null]);

  const el = await matchCardElement({
    locale,
    pct: tm.match.pct,
    verdict: matchVerdict(tm.match.pct, locale, except),
    me: { handle: !meHidden && me?.username ? `@${me.username}` : locale === "en" ? "me" : "أنا", avatar: myAvatar, initial: initialOf(meHidden ? null : me?.username) },
    friend: allowed && target.username ? { handle: `@${target.username}`, avatar: theirAvatar, initial: initialOf(target.username) } : null,
    together,
  });
  return new ImageResponse(el, {
    ...MATCH_CARD,
    fonts: await ogFonts(),
    headers: { "cache-control": "private, max-age=0, must-revalidate" },
  });
}
