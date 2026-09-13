import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { personalRails, dateOfResult } from "@/lib/discoverRails";
import { sectionHref } from "@/lib/sections";
import { getProfile } from "@/lib/data";
import { sanitizeUiState } from "@/lib/uiState";
import { filtersOf } from "@/core/savedFilters";
import { parseMyRows, MY_ROWS_COOKIE } from "@/core/myRows";
import { getLocale, getWatchRegion } from "@/lib/locale";
import { handle, requireUser, limited } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { getDict } from "@/core/i18n";
import { titleOf } from "@/core/media";
import type { SearchResult } from "@/lib/tmdb";
import type { PersonalRailsPayload, CuratedCard } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/personal?tab=shows|movies|anime` — «مقترحٌ لك» · صفوفي ·
 * «من فنّانيك» · رقاقاتُ الفلاتر المحفوظة، في ردٍّ واحد (Phase 11-C · C2 · D-955).
 *
 * 🔑 **الوصفةُ وصفةُ `PersonalRails`/`MyRowsRails`/`SavedFiltersHost`** عبر
 * `personalRails` (المصدرُ الواحد). **صفوفي من كوكي `loopz-myrows` نفسِه** — يصل
 * مع `fetch` الأصليّ لأنّ الكوكي مشتركٌ مع الـWebView (D-947). **وسببُ الاقتراح
 * يُصاغ هنا بلغة القارئ** (`recoFrom`/`recoFromGenre`) لا في الشاشة.
 * **`no-store`**: شخصيٌّ ومخلوطٌ عشوائيّاً في كلِّ مرّة كما في الصفحة.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth.ok) return auth;
    const lim = limited(`v1:discover:personal:${auth.user.id}`, 30, 60_000);
    if (lim) return lim;
    const tabRaw = req.nextUrl.searchParams.get("tab");
    const tab = tabRaw === "movies" ? "movies" : tabRaw === "anime" ? "anime" : "shows";
    const [locale, region, store, profile] = await Promise.all([getLocale(), getWatchRegion(), cookies(), getProfile().catch(() => null)]);
    const t = getDict(locale);
    const myRows = parseMyRows(store.get(MY_ROWS_COOKIE)?.value);
    const r = await personalRails(tab, { locale, region, myRows });
    const card = (x: SearchResult): CuratedCard => ({
      kind: x.media_type === "tv" ? "tv" : "movie",
      id: x.id,
      title: titleOf(x),
      poster_path: x.poster_path,
      vote_average: x.vote_average ?? 0,
      year: dateOfResult(x).slice(0, 4) || null,
      imdb_rating: typeof x.imdb_rating === "number" ? x.imdb_rating : null,
      date: dateOfResult(x) || null,
    });
    const payload: PersonalRailsPayload = {
      tab,
      foryou: r.foryou.map((s) => ({ ...card(s.result), note: s.seedTitle ? t.recoFrom(s.seedTitle) : t.recoFromGenre })),
      myrows: r.myrows.map((m) => ({ key: m.key, title: m.title, items: m.items.map(card), see_all: m.see_all })),
      artists: r.artists.map(card),
      artists_see_all: r.artists.length ? sectionHref("from-artists", "movie") : null,
      filters: profile ? filtersOf(sanitizeUiState(profile.ui_state).filters, tab).map((f) => ({ name: f.name, q: f.q })) : [],
    };
    return ok(payload);
  });
}
