import type { NextRequest } from "next/server";
import { buildSection, isSectionKey, isSectionMedia, type SectionMedia } from "@/lib/sections";
import { browseToFilter } from "@/lib/smartLists";
import { parseBrowse, parseRailWin } from "@/core/browse";
import { getLocale, getWatchRegion } from "@/lib/locale";
import { dateOfResult } from "@/lib/discoverRails";
import { handle, limited, fail } from "@/lib/v1";
import { ok } from "@/core/contracts/result";
import { titleOf } from "@/core/media";
import type { CuratedCard, SectionPayload } from "@/core/contracts/discover";

const LIMIT = 60;
const MAX_PAGES = 5;

/**
 * `GET /api/v1/discover/section?s=&m=&pg=&…` — «الكلّ ←» أصليّاً (D-994، Phase 11-C4).
 *
 * **الوصفةُ وصفةُ `discover/[section]/page.tsx` حرفاً**: `browseToFilter` للقاعدة، `buildSection`
 * بحدٍّ أكبر (`LIMIT × pg`)، والنافذةُ `w`. المعاملاتُ هي التي يحملها `see_all` في ردّ الصفّ،
 * فالتطبيقُ يمرّرها كما هي ولا يعرف عن الأقسام شيئاً.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
      const lim = limited(`v1:discover:section:${ip}`, 60, 60_000);
      if (lim) return lim;
      const sp = req.nextUrl.searchParams;
      const section = sp.get("s") ?? "";
      if (!isSectionKey(section)) return fail("invalid_input", { field: "s" });
      const mRaw = sp.get("m") ?? undefined;
      const media: SectionMedia = isSectionMedia(mRaw) ? mRaw : "movie";
      const params = Object.fromEntries(sp.entries());
      const browse = parseBrowse({ ...params, type: media === "anime" ? "all" : media });
      const [locale, region] = await Promise.all([getLocale(), getWatchRegion()]);
      const { base, genreIds } = await browseToFilter(browse, { media, watchRegion: region });
      const page = Math.min(MAX_PAGES, Math.max(1, Number(sp.get("pg")) || 1));
      const want = LIMIT * page;
      const win = parseRailWin(sp.get("w") ?? undefined);
      const todayStr = new Date().toISOString().slice(0, 10);
      const back30 = new Date();
      back30.setUTCDate(back30.getUTCDate() - 30);
      const winRange = win === "month" ? { from: back30.toISOString().slice(0, 10), to: todayStr } : null;
      const rows = await buildSection(section, { media, base, genreIds, active: browse.active, win, winRange, locale }, want);
      /* 🔴 D-1046 (Phase 11-F · F5) — **الردُّ شريحةُ الصفحة لا ما تراكم قبلها**: البنّاءُ يحتاج `want = LIMIT × pg`
         صفّاً ليصل إلى الصفحة (وصفتُه تُعيد الترتيبَ من أوّلها)، **لكنّ الردَّ كان يحمل الصفوفَ كلَّها** — الصفحةُ
         الخامسةُ ٣٠٠ عنصرٍ لأجل ٦٠ جديدة، والتطبيقُ يُسقط المكرَّر. الآن تُقصّ هنا. **التطبيقُ وحدَه ينادي هذا
         المسار** (تحقّقٌ بالبحث)، وإصداراتُه القديمة تُسقط المكرَّر بمفتاحه فتعمل مع الشريحة كما هي. */
      const fresh = rows.slice(LIMIT * (page - 1));
      const items: CuratedCard[] = fresh
        .filter((r) => r.media_type === "tv" || r.media_type === "movie")
        .map((r) => ({
          kind: r.media_type === "tv" ? "tv" : "movie",
          id: r.id,
          title: titleOf(r),
          poster_path: r.poster_path,
          vote_average: r.vote_average ?? 0,
          year: dateOfResult(r).slice(0, 4) || null,
          imdb_rating: typeof r.imdb_rating === "number" ? r.imdb_rating : null,
          date: dateOfResult(r) || null,
        }));
      const payload: SectionPayload = {
        section,
        media,
        page,
        /* كما في الصفحة: صفحةٌ تالية إن بقي نصفُ الحدّ على الأقلّ ولم نبلغ السقف */
        has_more: page < MAX_PAGES && rows.length - LIMIT * (page - 1) >= LIMIT / 2,
        items,
      };
      return ok(payload);
    },
    { cacheControl: "private, max-age=300" },
  );
}
