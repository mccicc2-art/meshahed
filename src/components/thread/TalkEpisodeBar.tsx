"use client";

import { useState } from "react";
import { getDict, type Locale } from "@/core/i18n";
import type { EpisodeRef } from "@/core/talkEpisodes";
import { tap } from "@/lib/haptics";
import { Icon } from "../Icon";
import { chipClass } from "../ui/controls";
import { Dropdown, dropdownItem } from "../ui/Dropdown";
import { SortCycle } from "../ui/SortCycle";

/**
 * ====== أدواتُ غرفة النقاش — الحلقة · «حرق الأحداث» · العددُ و«الأحدث ⌄» (🆕 D-1495/D-1496) ======
 *
 * لقطةُ أحمد ٢٠ أكتوبر، نظيرُ رأس `ThreadScreen` في التطبيق: «الموسم ٣ ⌄» «الحلقة ١٠ ⌄» (أو «كل الحلقات ⌄») في البداية
 * و«حرق الأحداث» في الطرف، ثمّ سطرُ العدد وزرُّ الترتيب الدوّار. الرقاقاتُ عائلةُ `chipClass` والقائمةُ `Dropdown` الواحدة —
 * لا شكلٌ جديد (القاعدة ٣). الحالةُ عند `ThreadReplies` (هي التي تصفّي)، وهذا رسمٌ ونداءات.
 */
export function TalkEpisodeBar({
  locale,
  seasons,
  pick,
  onPick,
  revealAll,
  onReveal,
  count,
  sort,
  onSort,
}: {
  locale: Locale;
  seasons: { season: number; episodes: number }[];
  pick: EpisodeRef | null;
  onPick: (p: EpisodeRef | null) => void;
  revealAll: boolean;
  onReveal: () => void;
  count: number;
  sort: "latest" | "active";
  onSort: (s: "latest" | "active") => void;
}) {
  const t = getDict(locale);
  const [menu, setMenu] = useState<null | "season" | "episode">(null);
  const cur = seasons.find((x) => x.season === pick?.season) ?? null;
  const caret = <Icon name="chevron-down" size={14} className="shrink-0 text-muted" />;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between gap-2 py-3 border-b border-[color:var(--divider)]">
        <div className="flex items-center gap-2 min-w-0">
          {seasons.length ? (
            <>
              <span className="relative">
                <button type="button" aria-expanded={menu === "season"} onClick={() => setMenu(menu === "season" ? null : "season")} className={`${chipClass(false)} inline-flex items-center gap-1.5`}>
                  {pick ? t.talkSeasonLabel(pick.season) : t.talkAllEpisodes}
                  {caret}
                </button>
                <Dropdown open={menu === "season"} onClose={() => setMenu(null)} align="start">
                  {[null, ...seasons].map((x) => (
                    <button
                      key={x ? x.season : "all"}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        tap(6);
                        onPick(x ? { season: x.season, episode: pick?.season === x.season ? pick.episode : 1 } : null);
                        setMenu(x ? "episode" : null);
                      }}
                      className={dropdownItem}
                    >
                      <span className="flex-1">{x ? t.talkSeasonLabel(x.season) : t.talkAllEpisodes}</span>
                      {(x ? pick?.season === x.season : !pick) && <Icon name="check" size={16} className="text-accent" />}
                    </button>
                  ))}
                </Dropdown>
              </span>
              {pick && cur ? (
                <span className="relative">
                  <button type="button" aria-expanded={menu === "episode"} onClick={() => setMenu(menu === "episode" ? null : "episode")} className={`${chipClass(false)} inline-flex items-center gap-1.5`}>
                    {t.talkEpisodeLabel(pick.episode)}
                    {caret}
                  </button>
                  <Dropdown open={menu === "episode"} onClose={() => setMenu(null)} align="start">
                    <div className="max-h-72 overflow-y-auto">
                      {Array.from({ length: cur.episodes }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            tap(6);
                            onPick({ season: pick.season, episode: n });
                            setMenu(null);
                          }}
                          className={dropdownItem}
                        >
                          <span className="flex-1">{t.talkEpisodeLabel(n)}</span>
                          {pick.episode === n && <Icon name="check" size={16} className="text-accent" />}
                        </button>
                      ))}
                    </div>
                  </Dropdown>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        <button type="button" aria-pressed={revealAll} onClick={onReveal} className={`${chipClass(revealAll)} inline-flex items-center gap-1.5 shrink-0`}>
          <Icon name={revealAll ? "eye" : "eye-off"} size={14} className="shrink-0" />
          {t.talkSpoilersToggle}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 py-3 border-b border-[color:var(--divider)]">
        <span className="text-14 text-muted tabular-nums">{t.talkRoomPosts(count)}</span>
        <SortCycle
          label={t.talkSortAria}
          value={sort}
          onChange={onSort}
          options={[
            { key: "latest", label: t.talkSortLatest },
            { key: "active", label: t.talkSortActive },
          ]}
        />
      </div>
    </div>
  );
}
