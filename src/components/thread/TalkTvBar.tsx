"use client";

import { getDict, type Locale } from "@/core/i18n";
import { talkEpisodeKey, type EpisodeRef, type EpisodeStat } from "@/core/talkEpisodes";
import { timeAgoShort } from "@/core/when";
import { tap } from "@/lib/haptics";
import { Icon } from "../Icon";
import { chipClass, segmentedItem, segmentedTrackFull } from "../ui/controls";

export type TalkTvEpisode = { name: string | null; vote: string | null; runtime: string | null };

/**
 * ====== 🆕 D-1508 — رأسُ غرفة المسلسل بمستوييه (الويب) ======
 *
 * نظيرُ `TvTalkHead` في التطبيق (أحمد ٢١ أكتوبر: «عام اذا بيتكلمون عن المسلسل بشكل عام ويناقشونه سوى .. حلقات لحلقة حلقة»):
 * - «عام» | «الحلقات» — مسارُ `segmented` الواحد (القاعدة ٣).
 * - **«عام»**: سطرُ «آخر حلقة» مكانَ نشرات لوبز في الخيط — لمستُه تفتح غرفتَها.
 * - **«الحلقات»**: شرائحُ المواسم (`chipClass`)، والحلقاتُ من الأحدث بعدد ما قيل وآخره؛ ما لم يشاهده القارئُ بعينٍ مغلقة.
 * - **غرفةُ الحلقة**: «‹ كل الحلقات»، وبطاقتُها مكانَ النشرة، وشريطُ «لم تشاهدها» بزرِّ «شاهدتها».
 * الحالةُ عند `ThreadReplies` (هي التي تصفّي الخيط)، وهذا رسمٌ ونداءات.
 */
export function TalkTvBar({
  locale,
  seasons,
  tab,
  onTab,
  pick,
  onPick,
  season,
  onSeason,
  stats,
  latest,
  episodeOf,
  watched,
  signedIn,
  onWatched,
}: {
  locale: Locale;
  seasons: { season: number; episodes: number }[];
  tab: "general" | "episodes";
  onTab: (x: "general" | "episodes") => void;
  pick: EpisodeRef | null;
  onPick: (p: EpisodeRef | null) => void;
  season: number | null;
  onSeason: (n: number) => void;
  stats: Map<string, EpisodeStat>;
  latest: EpisodeRef | null;
  episodeOf: (p: EpisodeRef) => TalkTvEpisode | null;
  watched: ReadonlySet<string>;
  signedIn: boolean;
  onWatched: (p: EpisodeRef) => void;
}) {
  const t = getDict(locale);

  if (pick) {
    const ep = episodeOf(pick);
    const seen = watched.has(talkEpisodeKey(pick.season, pick.episode));
    const facts = [t.talkEpShort(pick.season, pick.episode), ep?.vote ? `★ ${ep.vote}` : null, ep?.runtime ?? null].filter(Boolean).join(" · ");
    /* 🆕 R53 — **غرفةُ الحلقة صفٌّ واحد** (أحمد ٢١ أكتوبر: «ماخذ مساحة كبيرة ولازم انزل تحت اشوف الكتابات»؛ «ب» المعتمد) —
       رجوعٌ دائريّ · «م٢ · ح٣ · ★ · المدّة» فوق الاسم · «شاهدتها» في الطرف. كانت ثلاثةَ صفوفٍ وشريطاً منقّطاً، و«مغطّاة» صارت في سطر العدد */
    return (
      <div className="mt-3 mb-1 flex items-center gap-2.5 overflow-hidden rounded-2xl border border-border bg-background p-2.5">
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-label={t.talkAllEpisodes}
          className="w-9 h-9 shrink-0 rounded-full border border-border bg-surface-2 grid place-items-center active:scale-95 transition"
        >
          <Icon name="chevron-down" size={15} className="rotate-90 rtl:-rotate-90" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-12 font-bold text-accent truncate" dir="auto">{facts}</p>
          <p className="text-16 font-bold truncate" dir="auto">{ep?.name ?? t.talkEpisodeLabel(pick.episode)}</p>
        </div>
        {seen ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-12 font-bold text-[color:var(--success)]">
            <Icon name="check" size={13} />
            {t.talkEpWatched}
          </span>
        ) : signedIn ? (
          <button
            type="button"
            onClick={() => {
              tap([12, 30]);
              onWatched(pick);
            }}
            className={`${chipClass(true)} inline-flex items-center gap-1.5 shrink-0`}
          >
            <Icon name="check" size={14} />
            {t.talkMarkEpWatched}
          </button>
        ) : null}
      </div>
    );
  }

  const cur = season ?? latest?.season ?? seasons[seasons.length - 1]?.season ?? 1;
  const info = seasons.find((x) => x.season === cur) ?? null;
  const latestInfo = latest ? episodeOf(latest) : null;

  return (
    <div className="mb-2">
      <div className={`${segmentedTrackFull} mt-3`} role="tablist">
        {(["general", "episodes"] as const).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            onClick={() => {
              tap(6);
              onTab(x);
            }}
            className={segmentedItem(tab === x, "flex-1")}
          >
            {x === "general" ? t.talkTabGeneral : t.talkTabEpisodes}
          </button>
        ))}
      </div>

      {tab === "general" ? (
        latest ? (
          <button
            type="button"
            onClick={() => onPick(latest)}
            className="mt-3 w-full flex items-center gap-2.5 rounded-2xl border border-accent bg-surface px-3 py-2.5 text-start active:scale-[0.99] transition"
          >
            <span className="flex-1 min-w-0 truncate text-14">
              <span className="font-bold text-accent">{t.talkLatestEpisode(latest.season, latest.episode)}</span>
              {latestInfo?.name ? <span dir="auto">{` «${latestInfo.name}»`}</span> : null}
              {latestInfo?.vote ? <span dir="ltr">{` · ★ ${latestInfo.vote}`}</span> : null}
            </span>
            <span className="shrink-0 text-12 text-muted">{t.talkComments(stats.get(talkEpisodeKey(latest.season, latest.episode))?.count ?? 0)}</span>
            <Icon name="chevron-down" size={14} className="shrink-0 text-muted -rotate-90 rtl:rotate-90" />
          </button>
        ) : null
      ) : (
        <div>
          <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...seasons].reverse().map((x) => (
              <button key={x.season} type="button" onClick={() => onSeason(x.season)} className={`${chipClass(x.season === cur)} shrink-0`}>
                {t.talkSeasonLabel(x.season)}
              </button>
            ))}
          </div>
          {info
            ? Array.from({ length: info.episodes }, (_, i) => info.episodes - i).map((n) => {
                const k = talkEpisodeKey(cur, n);
                const st = stats.get(k);
                const seen = watched.has(k);
                const name = episodeOf({ season: cur, episode: n })?.name ?? null;
                const sub = [seen ? t.talkEpWatched : null, st?.last ? timeAgoShort(st.last, t) : null].filter(Boolean).join(" · ");
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onPick({ season: cur, episode: n })}
                    className="w-full flex items-center gap-3 py-2.5 border-b border-[color:var(--divider)] text-start active:opacity-70 transition"
                  >
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-surface-2 grid place-items-center">
                      <Icon name={seen ? "check" : "eye-off"} size={16} className={seen ? "text-[color:var(--success)]" : "text-muted"} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-14 font-bold truncate">
                        {t.talkEpisodeLabel(n)}
                        {name ? <span className="font-medium" dir="auto">{` · ${name}`}</span> : null}
                      </span>
                      <span className="block text-12 text-muted truncate">{sub || " "}</span>
                    </span>
                    <span className={`shrink-0 text-12 font-bold ${st?.count ? "text-accent" : "text-muted"}`}>
                      {t.talkComments(st?.count ?? 0)}
                    </span>
                  </button>
                );
              })
            : null}
        </div>
      )}
    </div>
  );
}
