import { PosterCard } from "./PosterCard";
import { CinemaRail, type CinemaSlot } from "./CinemaRail";
import { getCinema } from "@/lib/cinemaTitles";
import { getLibState } from "@/lib/libState";
import { formatDateShort } from "@/core/when";
import { PRIVACY_HINT } from "@/core/privacyNotice";
import type { CinemaCard } from "@/core/contracts/discover";
import type { Dict, Locale } from "@/core/i18n";

/**
 * ====== قسمُ السينما — نصفُه الخادميّ (T512) ======
 *
 * **البطاقاتُ تُرسم هنا والتبديلُ هناك**: الملصقُ بقائمة ضغطه المطوَّل وخيط حالته يحتاج مكتبتَك (`getLibState` — دالّةٌ
 * لا تعبر إلى العميل، D-238)، **فيُرسم كلُّ ملصقٍ مرّةً على الخادم** ويُسلَّم للعميل عُقدةً جاهزة، والعميلُ (`CinemaRail`)
 * يختار أيَّها يُظهر بحسب «الآن/قريباً» ورقاقة المنشأ. فلا وصفةَ بطاقةٍ ثانية (القاعدة ٣) ولا نداءَ عند كلِّ ضغطة.
 *
 * - الرئيسيّةُ: الاسمُ داخل الملصق كسائر صفوفها · «اكتشف»: تحته كسائر صفوفه (قرارُ أحمد ٢٢ نوفمبر).
 * - «قريباً»: تاريخُ النزول في السعودية شارةً على الملصق — **وقائمةُ الضغط تُخفي «شاهدته» لفيلمٍ لم ينزل** (T474).
 */
export async function CinemaSection({
  place,
  locale,
  t,
}: {
  place: "home" | "discover";
  locale: Locale;
  t: Dict;
}) {
  const [data, lib] = await Promise.all([getCinema().catch(() => ({ now: [], soon: [] })), getLibState()]);
  if (data.now.length === 0 && data.soon.length === 0) return null;

  const slot = (c: CinemaCard, soon: boolean): CinemaSlot => {
    const st = lib.of(c.id, "movie");
    return {
      id: c.id,
      origin: c.origin,
      node: (
        <PosterCard
          href={`/movie/${c.id}`}
          title={c.title}
          posterPath={c.poster_path}
          /* التاريخُ بمنسّق التواريخ الواحد (`formatDateShort`) — نفسُه في التطبيق */
          badge={soon && c.sa_date ? formatDateShort(c.sa_date, t) : undefined}
          titleBelow={place === "discover"}
          /* T518 — التقييمُ على ملصقات «الآن» وحدها: القادمُ لم يُعرض فلا رقمَ له، وشارتُه تاريخُه */
          rating={soon ? undefined : { imdb: c.imdb_rating, tmdb: c.vote_average }}
          saved={st.added}
          watched={st.watched}
          hold={{
            tmdbId: c.id,
            mediaType: "movie",
            added: st.added,
            watched: st.watched,
            progress: st.progress,
            dropped: st.dropped,
            release: soon ? c.sa_date : undefined,
            locale,
          }}
        />
      ),
    };
  };

  return (
    <CinemaRail
      now={data.now.map((c) => slot(c, false))}
      soon={data.soon.map((c) => slot(c, true))}
      place={place}
      hintAfter={place === "home" ? PRIVACY_HINT : "discover-power"}
      labels={{
        now: t.cinemaNow,
        soon: t.cinemaSoon,
        inSaudi: t.cinemaInSaudi,
        all: t.allWord,
        seeAll: place === "discover" ? t.seeAll : t.allWord,
        arabic: t.cinemaArabic,
        foreign: t.cinemaForeign,
        switchLabel: t.cinemaSwitch,
        hint: t.cinemaHint,
        close: t.closeLabel,
        empty: t.browseEmpty,
        prev: t.railPrev,
        next: t.railNext,
      }}
    />
  );
}
