import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import type { ToastHostRef } from "../HoldHost";
import { SettingsScreen, RowsSkeleton } from "../settings/ui";
import { timeAgo } from "@/core/when";
import type { StremioSignal } from "@/core/contracts/stremio";
import { episodeLabel, useStremio } from "./api";
import { useStremioAnswer } from "./useAnswer";
import { SignalStill } from "./StremioCard";

const STILL_W = 96;
const CIRCLE = 40;

/** يومُ الإشارة بتقويم الجهاز: ٠ اليوم · ١ أمس · ٢ هذا الأسبوع · ٣ أقدم */
function bucketOf(iso: string, now: Date): 0 | 1 | 2 | 3 {
  const d = new Date(iso);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return 0;
  if (t >= start - 86_400_000) return 1;
  if (t >= start - 6 * 86_400_000) return 2;
  return 3;
}

/**
 * ====== 🆕 «من Stremio» — قائمةُ «عرض الكل» (خطّةُ Stremio، ٢٢ أكتوبر) ======
 *
 * كلُّ ما ينتظر جوابَه، مجموعاً باليوم (اليوم · أمس · هذا الأسبوع · أقدم — الإشارةُ تبقى حتى يُجاب عنها، قرار ٣).
 * صفٌّ لكلِّ إشارة: لقطةٌ ٩٦ واسمٌ وحلقةٌ ووقت، ثمّ ✕ (دائرةٌ شفّافة) و✓ (دائرةٌ بلون التمييز) بقطر ٤٠.
 * الصفُّ المُجاب عنه يختفي فوراً و«تراجع» يعيده (`useStremioAnswer`)، **وحين تفرغ القائمةُ تعود إلى الرئيسيّة** —
 * لا شاشةَ فارغةَ تنتظر شيئاً.
 */
export function StremioListScreen() {
  const { t, tokens } = useApp();
  const router = useRouter();
  const toast = useRef<ToastHostRef>(null);
  const q = useStremio();
  const { hidden, answer } = useStremioAnswer(toast);
  const items = useMemo(() => (q.data?.items ?? []).filter((s) => !hidden.has(s.id)), [q.data, hidden]);
  const left = Math.max(0, (q.data?.count ?? 0) - hidden.size);

  /* فرغت ⇒ رجوع (بعد مهلة الإشعار، كي يُرى «تراجع» على آخر صفّ) */
  const empty = !!q.data && items.length === 0;
  useEffect(() => {
    if (!empty) return;
    const id = setTimeout(() => (router.canGoBack() ? router.back() : router.replace("/web")), 4600);
    return () => clearTimeout(id);
  }, [empty, router]);

  const groups = useMemo(() => {
    const now = new Date();
    const out: [string, StremioSignal[]][] = [];
    const names = [t.diaryToday, t.diaryYesterday, t.activityThisWeek, t.stremioEarlier];
    for (const s of items) {
      const name = names[bucketOf(s.seen_at, now)];
      const last = out[out.length - 1];
      if (last && last[0] === name) last[1].push(s);
      else out.push([name, [s]]);
    }
    return out;
  }, [items, t]);

  const open = (s: StremioSignal) => router.push({ pathname: "/title/[kind]/[id]", params: { kind: s.kind, id: String(s.tmdb_id) } });

  return (
    <SettingsScreen title={t.stremioFrom} toast={toast}>
      <View style={{ gap: 4, alignItems: "center", paddingHorizontal: 8 }}>
        {q.data ? <Text size={13} weight="700" color={tokens.accent}>{t.stremioWaiting(left)}</Text> : null}
        <Text size={13} muted style={{ textAlign: "center", lineHeight: 20 }}>{t.stremioListLead}</Text>
      </View>
      {!q.data ? <RowsSkeleton rows={4} /> : null}
      {groups.map(([name, rows]) => (
        <View key={name} style={{ gap: 8 }}>
          <Text size={13} weight="700" style={{ color: tokens.disabled }}>{name}</Text>
          {rows.map((s) => {
            const ep = episodeLabel(s, t.stremioMovie);
            return (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8 }}>
                <Pressable onPress={() => open(s)} accessibilityRole="button" accessibilityLabel={`${s.title}، ${ep}`} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1 })}>
                  <SignalStill s={s} width={STILL_W} />
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text size={14} weight="700" numberOfLines={1}>{s.title}</Text>
                    <Text size={12} weight="500" numberOfLines={1}>{ep}</Text>
                    <Text size={11} muted numberOfLines={1}>{timeAgo(s.seen_at, t)}</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => answer(s, false)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.stremioNo} — ${s.title} ${ep}`}
                  style={({ pressed }) => ({ width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="close" size={16} color={tokens.muted} />
                </Pressable>
                <Pressable
                  onPress={() => answer(s, true)}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.stremioYes} — ${s.title} ${ep}`}
                  style={({ pressed }) => ({ width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
                >
                  <Icon name="check" size={18} color={tokens.onAccent} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </SettingsScreen>
  );
}
