"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import { backdropUrl } from "@/core/media";
import { formatDateShort } from "@/core/when";
import { airedEpisodes, episodeTitle } from "@/core/talkEpisodes";
import type { SeasonEpisode, SeasonPayload, TitleSeason } from "@/core/contracts/title";
import { Sheet, SheetHeader } from "./ui/Sheet";
import { segmentedItem, segmentedTrackFull } from "./ui/controls";
import { Icon } from "./Icon";
import { v1Get } from "./InboxComposer";

export type PenEpisode = { season: number; episode: number; name: string | null; myRating: number | null };

/**
 * 🆕 R255 — **«أي حلقة؟» في صندوق النشر على الويب** — توأمُ `PenEpisodeSheet` في التطبيق (R58 — أحمد «حلقة ›»).
 *
 * كان صندوقُ الويب يسأل «شاهدته؟» بـ«كله · لسه» وحدهما، فلا يقدر عضوُ الحاسوب أن يكتب عن حلقةٍ بعينها ولا أن يقيّمها — والتطبيقُ
 * يقدر منذ R58. والورقةُ بقواعده حرفاً: **تفتح على مكانه** (آخرُ موسمٍ بدأه، وحلقتُه موسومةٌ «وصلت هنا» والتي بعدها «التالية»)؛
 * **وما فوق التالية مطويٌّ** خلف سطرٍ واحد كي لا تقع عينُه على عنوان حلقةٍ لم يرها؛ **وصورةُ ما لم يشاهده مموَّهة** بعين مشطوبة؛
 * والمسلسلُ المخلَّص تفتح على آخر موسمٍ من أعلاه («الأخيرة» / «الختام»). و«بدون حلقة — النقاش العام للعمل» آخرُها.
 * والورقةُ هي `Sheet` الواحدة (`anchor="bottom"`): من الأسفل على الجوّال، ووسطَ الشاشة على الحاسوب.
 */
export function PenEpisodeSheet({
  showId,
  seasons,
  at,
  done,
  locale,
  onPick,
  onGeneral,
  onClose,
}: {
  showId: number;
  seasons: TitleSeason[];
  at: { season: number; episode: number } | null;
  done: boolean;
  locale: Locale;
  onPick: (e: PenEpisode) => void;
  onGeneral: () => void;
  onClose: () => void;
}) {
  const t = getDict(locale);
  const real = useMemo(() => seasons.filter((s) => s.season_number > 0 && s.aired > 0), [seasons]);
  const last = real[real.length - 1] ?? null;
  const [season, setSeason] = useState<number>(() => (at && !done ? at.season : last?.season_number ?? at?.season ?? 1));
  const info = real.find((s) => s.season_number === season) ?? null;
  const [loaded, setLoaded] = useState<{ season: number; eps: SeasonEpisode[] } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!info) return;
    let alive = true;
    /* `?r=1` لتقييمي للحلقة (`my_rating`): حلقةٌ قيّمتُها لا تعرض نجوماً ثانية — قاعدةُ التطبيق */
    v1Get<SeasonPayload>(`/api/v1/title/tv/${showId}/season/${season}?r=1`).then((d) => {
      if (alive) setLoaded({ season, eps: d?.episodes ?? [] });
    });
    return () => {
      alive = false;
    };
  }, [showId, season, info]);

  const pending = !!info && loaded?.season !== season;
  const eps = useMemo(() => (loaded && loaded.season === season ? airedEpisodes(loaded.eps) : []), [loaded, season]);
  const anchor = done ? (season === last?.season_number ? eps[0]?.episode_number ?? null : null) : at && at.season === season ? at.episode : null;
  const finale = !!info && info.aired >= info.episode_count;
  const cut = !done && anchor != null && !expanded ? eps.findIndex((e) => e.episode_number <= anchor + 1) : 0;
  const hiddenNewer = cut > 0 ? cut : 0;
  const shown = hiddenNewer ? eps.slice(hiddenNewer) : eps;

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} variant="bottom" anchor="bottom" labelledBy="pen-ep-title">
      <SheetHeader id="pen-ep-title" title={t.penWhichEp} closeLabel={t.closeLabel} onClose={onClose} />
      {/* «ت٥أ» (أحمد ٢٦ نوفمبر): المواسمُ عائلةُ المقسّم بخطٍّ أصفر تتمرّر — لا كبسولات */}
      <div className={`${segmentedTrackFull} overflow-x-auto mx-5 mt-2 mb-2 [scrollbar-width:none]`}>
        {[...real].reverse().map((s) => (
          <button
            key={s.season_number}
            type="button"
            aria-pressed={s.season_number === season}
            className={segmentedItem(s.season_number === season, "shrink-0")}
            onClick={() => {
              setSeason(s.season_number);
              setExpanded(false);
            }}
          >
            {t.talkSeasonLabel(s.season_number)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
        {hiddenNewer ? (
          <button type="button" onClick={() => setExpanded(true)} className="flex w-full items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold text-muted hover:text-foreground transition">
            <Icon name="chevron-down" size={14} className="rotate-180" />
            {t.talkEpisodeLabel(eps[0]?.episode_number ?? 0)} …
          </button>
        ) : null}
        {pending ? (
          <p className="py-6 text-center text-12 text-muted">…</p>
        ) : (
          shown.map((e) => {
            const n = e.episode_number;
            const name = episodeTitle(e.name);
            const still = e.still_path ? backdropUrl(e.still_path, "w300") : null;
            const here = anchor === n;
            const next = !done && anchor != null && n === anchor + 1;
            const tag = here ? (done ? (finale ? t.penFinale : t.penLast) : t.penHere) : next ? t.penNext : null;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onPick({ season, episode: n, name, myRating: e.my_rating ?? null })}
                aria-label={[t.talkEpisodeLabel(n), name, tag].filter(Boolean).join(" · ")}
                className={`flex w-full items-center gap-3 px-2 py-2.5 text-start transition hover:opacity-80 ${
                  here ? "rounded-xl bg-[color:var(--accent)]/10" : "border-b border-[color:var(--divider)]"
                }`}
              >
                <span className="relative grid h-[54px] w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                  {still ? <Image src={still} alt="" fill sizes="96px" className={`object-cover ${e.watched ? "" : "blur-md scale-110"}`} /> : null}
                  {e.watched ? null : (
                    <>
                      {still ? <span className="absolute inset-0 bg-black/35" /> : null}
                      <Icon name="eye-off" size={16} className={`relative ${still ? "text-white" : "text-muted"}`} />
                    </>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-14 font-bold">{t.talkEpisodeLabel(n)}</span>
                    {tag ? (
                      <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-bold ${here ? "bg-accent text-[color:var(--on-accent)]" : "border border-[color:var(--accent)] text-accent"}`}>
                        {tag}
                      </span>
                    ) : null}
                  </span>
                  {name ? <bdi className="block truncate text-12">{name}</bdi> : null}
                  {e.air_date ? <span className="block text-[11px] text-muted">{formatDateShort(e.air_date, t)}</span> : null}
                </span>
                {e.watched ? <Icon name="check" size={16} className="shrink-0 text-[color:var(--success)]" /> : null}
              </button>
            );
          })
        )}
      </div>
      <button type="button" onClick={onGeneral} className="border-t border-[color:var(--divider)] py-3.5 text-[13px] font-semibold text-muted hover:text-foreground transition">
        {t.penNoEp}
      </button>
    </Sheet>
  );
}
