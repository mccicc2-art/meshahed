import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { seasonQuery } from "../title/SeasonAccordion";
import { backdropUrl } from "@/core/media";
import { formatDateShort } from "@/core/when";
import { airedEpisodes, episodeTitle } from "@/core/talkEpisodes";
import type { TitleSeason } from "../contracts";

/**
 * ====== 🆕 R58 — «أي حلقة؟» في «بوست جديد» (أحمد ٢١ أكتوبر — الصور ⑦ · ⑨ · ⑫) ======
 *
 * الورقةُ الواحدة (`Sheet`) وفيها **قائمةُ «الحلقات» في النقاش نفسُها**: رقمُ TMDB والعنوانُ (ما لم يكرّر الرقم) والصورةُ
 * (مغبّشةٌ لما لم تشاهده) و✓ لما شاهدته — ونفسُ `seasonQuery` فالكاشُ مشترك مع صفحة العمل.
 *
 * 🔑 **تفتح على مكانك** («اذا واصل حلقة ٥٢٥ … يوديه مباشرة للحلقة اللي هو واصلها، ف يقدر على طول يحدد اللي بعدها أو
 * يبقى عليها»): موسمُ آخر حلقةٍ شاهدتها، وفي رأس القائمة «التالية» ثمّ «وصلت هنا» — والأحدثُ منهما خلف سطرٍ يفتحها.
 * ومن خلّص المسلسل تفتح على آخر موسمٍ وآخر حلقةٍ فيه («الأخيرة» إن اكتمل الموسم، وإلّا «آخر حلقة»).
 */
export type PenEpisode = { season: number; episode: number; name: string | null; myRating: number | null };

export function PenEpisodeSheet({
  showId,
  seasons,
  watched,
  at,
  done,
  onPick,
  onGeneral,
  onClose,
}: {
  showId: number;
  seasons: TitleSeason[];
  /** مفاتيحُ `s:e` لما شاهده */
  watched: ReadonlySet<string>;
  /** آخرُ حلقةٍ شاهدها (خارجَ الموسم صفر) — `null` لمن لم يبدأ */
  at: { season: number; episode: number } | null;
  /** خلّص المسلسل — المرساةُ آخرُ حلقةٍ بُثّت */
  done: boolean;
  onPick: (e: PenEpisode) => void;
  onGeneral: () => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const real = useMemo(() => seasons.filter((s) => s.season_number > 0 && s.aired > 0), [seasons]);
  const last = real[real.length - 1] ?? null;
  const [season, setSeason] = useState<number>(() => (at && !done ? at.season : last?.season_number ?? at?.season ?? 1));
  const info = real.find((s) => s.season_number === season) ?? null;
  const sq = useQuery({ ...seasonQuery(showId, season), enabled: !!info });
  const eps = useMemo(() => (sq.data ? airedEpisodes(sq.data.episodes) : []), [sq.data]);

  /* المرساة: من شاهد بعضه ⇒ حلقتُه (والتالية فوقها)؛ من خلّصه ⇒ آخرُ حلقةٍ بُثّت في آخر موسم */
  const anchor = done ? (season === last?.season_number ? eps[0]?.episode_number ?? null : null) : at && at.season === season ? at.episode : null;
  const finale = !!info && info.aired >= info.episode_count;
  const [expanded, setExpanded] = useState(false);
  const cut = !done && anchor != null && !expanded ? eps.findIndex((e) => e.episode_number <= anchor + 1) : 0;
  const hiddenNewer = cut > 0 ? cut : 0;
  const shown = hiddenNewer ? eps.slice(hiddenNewer) : eps;

  return (
    <Sheet title={t.penWhichEp} onClose={onClose}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {[...real].reverse().map((s) => (
          <Chip key={s.season_number} size="md" label={t.talkSeasonLabel(s.season_number)} active={s.season_number === season} onPress={() => { setSeason(s.season_number); setExpanded(false); }} />
        ))}
      </ScrollView>
      {hiddenNewer ? (
        <Pressable onPress={() => setExpanded(true)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ transform: [{ rotate: "180deg" }] }}>
            <Icon name="chevron-down" size={14} color={tokens.muted} />
          </View>
          <Text size={13} weight="600" muted>{t.talkEpisodeLabel(eps[0]?.episode_number ?? 0)} …</Text>
        </Pressable>
      ) : null}
      {!info ? null : sq.isPending ? (
        <Text size={13} muted style={{ paddingVertical: 16, textAlign: "center" }}>…</Text>
      ) : (
        shown.map((e) => {
          const n = e.episode_number;
          const k = `${season}:${n}`;
          const seen = watched.has(k);
          const name = episodeTitle(e.name);
          const still = e.still_path ? backdropUrl(e.still_path, "w300") : null;
          const here = anchor === n;
          const next = !done && anchor != null && n === anchor + 1;
          const tag = here ? (done ? (finale ? t.penFinale : t.penLast) : t.penHere) : next ? t.penNext : null;
          return (
            <Pressable
              key={k}
              onPress={() => onPick({ season, episode: n, name, myRating: e.my_rating ?? null })}
              accessibilityRole="button"
              accessibilityLabel={[t.talkEpisodeLabel(n), name, tag].filter(Boolean).join(" · ")}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: here ? 8 : 0, marginHorizontal: here ? -8 : 0, borderRadius: here ? radius.md : 0, backgroundColor: here ? tokens.accent + "14" : "transparent", borderBottomWidth: here ? 0 : 1, borderBottomColor: tokens.divider, opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 96, height: 54, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                {still ? <Image source={{ uri: still }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" blurRadius={seen ? 0 : 18} cachePolicy="memory-disk" recyclingKey={k} /> : null}
                {seen ? null : (
                  <>
                    {still ? <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.35)" }} /> : null}
                    <Icon name="eye-off" size={16} color={still ? "#fff" : tokens.muted} />
                  </>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text size={14} weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>{t.talkEpisodeLabel(n)}</Text>
                  {tag ? (
                    <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: here ? tokens.accent : "transparent", borderWidth: here ? 0 : 1, borderColor: tokens.accent }}>
                      <Text size={10} weight="700" color={here ? tokens.onAccent : tokens.accent}>{tag}</Text>
                    </View>
                  ) : null}
                </View>
                {name ? <Text size={12} numberOfLines={1}>{name}</Text> : null}
                {e.air_date ? <Text size={11} muted>{formatDateShort(e.air_date, t)}</Text> : null}
              </View>
              {seen ? <Icon name="check" size={16} color={tokens.success} /> : null}
            </Pressable>
          );
        })
      )}
      <Pressable onPress={onGeneral} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
        <Text size={13} weight="600" muted>{t.penNoEp}</Text>
      </Pressable>
    </Sheet>
  );
}
