import Link from "next/link";
import Image from "next/image";
import { posterUrl } from "@/lib/media";
import { getDict, type Locale } from "@/lib/i18n";
import type { LeaderEntry } from "@/lib/leaderboard";

/** ذهبي/فضّي/برونزي للمراكز الثلاثة الأولى، ورقم باهت لما بعدها */
function Rank({ n }: { n: number }) {
  const medal = n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : null;
  if (medal) {
    return (
      <span className="w-8 shrink-0 text-center text-xl leading-none" aria-label={`#${n}`}>
        {medal}
      </span>
    );
  }
  return (
    <span
      className="w-8 shrink-0 text-center text-sm font-bold text-muted tabular-nums"
      aria-label={`#${n}`}
      dir="ltr"
    >
      {n}
    </span>
  );
}

function Stars({ avg }: { avg: number }) {
  const full = Math.round(avg);
  return (
    <span className="text-accent text-xs tracking-tight" dir="ltr" aria-hidden>
      {"★".repeat(full)}
      <span className="text-muted/50">{"★".repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

export function Leaderboard({
  entries,
  locale,
  metric,
  inLibrary,
}: {
  entries: LeaderEntry[];
  locale: Locale;
  /** أي رقم يتصدّر السطر الثاني */
  metric: "rating" | "watch";
  /** معرّفات الأعمال في مكتبة المستخدم — لوسم «في مكتبتك» */
  inLibrary: string[];
}) {
  const t = getDict(locale);
  const mine = new Set(inLibrary);

  return (
    <ol className="flex flex-col gap-1">
      {entries.map((e, i) => {
        const href = `/${e.mediaType === "tv" ? "show" : "movie"}/${e.tmdbId}`;
        const img = posterUrl(e.posterPath, "w185");
        const owned = mine.has(`${e.mediaType}-${e.tmdbId}`);
        const top3 = i < 3;

        return (
          <li key={`${e.mediaType}-${e.tmdbId}`}>
            <Link
              href={href}
              prefetch={false}
              className={`group flex items-center gap-3 rounded-xl p-2 transition border ${
                top3
                  ? "border-accent/25 bg-accent/[0.04] hover:border-accent/50"
                  : "border-transparent hover:bg-surface hover:border-border"
              }`}
            >
              <Rank n={i + 1} />

              <div className="relative w-11 h-16 shrink-0 rounded-lg overflow-hidden bg-surface-2 border border-border">
                {img ? (
                  <Image src={img} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-lg">🎬</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight line-clamp-1 group-hover:text-accent transition">
                  {e.title}
                </p>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {metric === "rating" && e.community && (
                    <>
                      <Stars avg={e.community.avg} />
                      <span className="text-[11px] text-muted" dir="ltr">
                        {e.community.avg.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-muted">
                        · {t.leaderVotes(e.community.votes)}
                      </span>
                    </>
                  )}

                  {metric === "watch" && e.watchers && (
                    <span className="text-[11px] text-muted">
                      {t.leaderFollowers(e.watchers.followers)}
                      {e.watchers.viewers > 0 && ` · ${t.leaderViewers(e.watchers.viewers)}`}
                      {e.watchers.episodes > 0 && ` · ${t.leaderEpisodes(e.watchers.episodes)}`}
                    </span>
                  )}

                  {/* في لوح «الأكثر مشاهدة» لا يصح أن يكون سطر الصفّ العالمي
                      تقييماً — الرقم الذي أدخله في الترتيب هو الرواج لا التقييم */}
                  {e.source === "global" && (
                    <span className="text-[11px] text-muted">
                      {metric === "watch"
                        ? t.leaderTrending
                        : e.globalRating != null
                          ? t.leaderGlobalRating(e.globalRating)
                          : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                {/* وسم المصدر بلا خلفية: كان أربعة أوسمة خضراء متتالية تسحب
                    العين قبل أسماء الأعمال نفسها */}
                <span
                  className={`text-[10px] font-bold ${
                    e.source === "community" ? "text-accent-2/90" : "text-muted/70"
                  }`}
                >
                  {e.source === "community" ? t.badgeCommunity : t.badgeGlobal}
                </span>
                <span className="text-[10px] text-muted/70">
                  {e.mediaType === "tv" ? t.filterTv : t.filterMovie}
                </span>
                {owned && <span className="text-[10px] text-accent-2">✓ {t.leaderYou}</span>}
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
