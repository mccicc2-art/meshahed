import type { NextRequest } from "next/server";
import { getTrailerFeed } from "@/lib/trailers";
import { getLocale } from "@/lib/locale";
import { handle, limited, requireUser } from "@/lib/v1";
import { routeName } from "@/lib/reqTrace";
import { ok } from "@/core/contracts/result";
import type { TrailerCard, TrailersRailPayload } from "@/core/contracts/discover";

/**
 * `GET /api/v1/discover/trailers?tab=shows|movies|anime` — صفُّ التريلرات
 * للشاشة الأصليّة (D-958 · ١٤ سبتمبر ٢٠٢٦).
 *
 * 🔑 **الوصفةُ وصفةُ الصفحة** (`getTrailerFeed` — المصدرُ الواحد، بالحدّ نفسِه ٩
 * كما `TrailersSection` بعد D-756). ⚖️ **وقرارُ C3 نُقض بأمر أحمد (D-959)**:
 * **الضغطُ يشغّل في مكانه** بمشغّلٍ أصليٍّ فوق `react-native-youtube-iframe`،
 * **و`href` صار احتياطاً** يُفتح حين تُرفض المفاتيحُ كلُّها. ولذلك يحمل الردُّ
 * `video_keys` (سلسلةُ البدائل، D-743) لا مفتاحاً واحداً.
 * 🔴 🆕 **للعضو وحدَه** (D-1486، نقضُ «مفتوحٌ للضيف»): طلبٌ بلا جلسة (رمزٌ لم يصل بعد أو انتهى) كان يُجاب
 * كضيفٍ بقائمةٍ فارغةٍ **ناجحة** — أفلامٌ ٠ ومسلسلاتٌ ٠ وأنمي ٩ — فيحفظها التطبيقُ ويعرضها أيّاماً (تسجيلُ أحمد ٢٠ أكتوبر).
 * الآن «غير مسجّل» كأخيه `discover/personal`، فيعيد التطبيقُ الطلبَ حين يصل الرمز. والضيفُ لا يصل «اكتشف» أصلاً (الدخولُ
 * أوّلاً، ١٠ أكتوبر). والحدُّ بالعضو لا بعنوان الشبكة.
 * ⚠️ **`private`**: الاقتراحاتُ تطيع المصروفَ والمُشاهَد لكلِّ قارئ.
 */
export async function GET(req: NextRequest) {
  return handle(
    async () => {
      routeName("discover/trailers");
      const auth = await requireUser();
      if (!auth.ok) return auth;
      const lim = limited(`v1:discover:trailers:${auth.user.id}`, 60, 60_000);
      if (lim) return lim;
      const tabRaw = req.nextUrl.searchParams.get("tab");
      const tab = tabRaw === "movies" ? "movies" : tabRaw === "anime" ? "anime" : "shows";
      const locale = await getLocale();
      /* الصمتُ عند الفشل مقصودٌ كما في الصفحة: صفٌّ زائد لا يُسقط «اكتشف» */
      const items = await getTrailerFeed(9, locale, tab).catch(() => []);
      const seeAll = `/trailers?scope=${tab}&from=${encodeURIComponent(`/news?tab=${tab}`)}`;
      const cards: TrailerCard[] = items.map((i) => ({
        kind: i.mediaType,
        id: i.tmdbId,
        title: i.title,
        year: i.year,
        genre: i.genre,
        country: i.country,
        poster_path: i.posterPath,
        backdrop: i.backdrop,
        video_key: i.videoKey,
        /* D-959: سلسلةُ البدائل كما تبنيها `getTrailerFeed` — المشغّلُ الأصليُّ يجرّبها بالترتيب */
        video_keys: i.videoKeys,
        /* مفتاحُ `?at=` بصيغة `trailerKeyOf` حرفاً (`{mediaType}-{tmdbId}`) — لا استيرادَ منها:
           `trailerCard.ts` وحدةُ عميل، واستدعاؤها من الخادم كان يُسقط المسارَ بـ500 (١٤ سبتمبر) */
        href: `${seeAll}&at=${i.mediaType}-${i.tmdbId}`,
      }));
      const payload: TrailersRailPayload = { tab, see_all: seeAll, items: cards };
      return ok(payload);
    },
    { cacheControl: "private, max-age=300" },
  );
}
