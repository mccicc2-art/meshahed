import type { NextRequest } from "next/server";
import { handle, limited, requireUser } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getLocale } from "@/lib/locale";
import { getProfile } from "@/lib/data";
import { loadMyAnalysis } from "@/components/LibraryAnalysis";
import type { MyStatsPayload, MyStatsRange } from "@/core/contracts/memberStats";

/**
 * `GET /api/v1/me/stats?range=all|year|month` — **إحصائياتي أنا للتطبيق** (🆕 D-1214، طلبُ أحمد: «نفّذ الإحصائيات»).
 *
 * 🔑 **ما ترسمه صفحةُ `/stats` حرفاً** — `loadMyAnalysis` نفسُها التي تحت `LibraryAnalysis`، **والمدى في الاستعلام كما هو في
 * رابط الصفحة** (D-438/D-463). والحمولةُ **شكلُ إحصاءات العضو** (`MemberStatsPayload`) فتلبسها الشاشةُ الأصليّةُ الواحدة.
 * ⚠️ **لا يُخزَّن**: أرقامُ صاحب الجلسة.
 */
export async function GET(req: NextRequest) {
  return handle<MyStatsPayload>(
    async () => {
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:my-stats:${auth.user.id}`, 30, 60_000);
      if (lim) return lim;

      const raw = req.nextUrl.searchParams.get("range");
      const range: MyStatsRange = raw === "year" || raw === "month" ? raw : "all";
      const locale = await getLocale();
      const [data, me] = await Promise.all([loadMyAnalysis(locale, range), getProfile()]);

      const person = {
        id: auth.user.id,
        nickname: me?.nickname ?? null,
        username: me?.username ?? null,
        avatar_url: me?.avatar_url ?? null,
        hide_name: !!me?.hide_name,
        plan: me?.plan ?? null,
        founder: me?.founder ?? null,
        verified_at: me?.verified_at ?? null,
      };
      if (!data) {
        return ok({
          person: { ...person, bio: null, followers: null },
          locked: false,
          empty: true,
          totals: { minutes: 0, episodes: 0, movies: 0, shows: 0, reviews: 0 },
          hero_posters: [],
          taste: null,
          match: null,
          range,
          range_label: "",
        });
      }
      return ok({
        person: { ...person, bio: data.hero?.bio ?? null, followers: data.hero?.followers ?? null },
        locked: false,
        empty: false,
        totals: { minutes: data.minutes, episodes: data.episodes, movies: data.movies, shows: data.shows, reviews: data.reviews },
        hero_posters: data.heroPosters,
        taste: data.taste,
        match: null,
        range,
        range_label: data.rangeLabel,
      });
    },
    { cacheControl: "private, no-store" },
  );
}
