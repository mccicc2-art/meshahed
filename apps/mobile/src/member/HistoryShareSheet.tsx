import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { useQuery } from "@tanstack/react-query";
import { api, downloadTo } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Sheet } from "../library/Sheet";
import { Segmented } from "../library/ToolsSheet";
import { SwitchPill } from "../settings/ui";
import { posterFor } from "../poster";
import { haptic } from "../haptics";
import type { HistoryCardPayload } from "@/core/contracts/profile";

/**
 * ====== 🆕 «شارك سجلّك» — بطاقةُ سجلّ المشاهدة (أحمد ٢٥ و٢٦ نوفمبر: «١ب» الأسبوعُ الحاليّ · «٢ب» الشهرُ من يومه الأوّل ·
 * «٣أ» يُخفي ما لا يريد · «٤ب» الزرُّ في رأس السجلّ · «ن٥ ب» الشكل) ======
 *
 * ورقةٌ واحدة: المدّةُ (عائلةُ المقسّم)، ثمّ أعمالُها بترتيب البطاقة ومفتاحٌ لكلٍّ منها، ثمّ «شارك البطاقة». الصورةُ تُرسم على
 * الخادم (`/api/v1/me/history-card/image`) بما بقي مُشعلاً، وتُكتب في الكاش ثمّ تُسلَّم لورقة المشاركة — وصفةُ «شارك تقريرك».
 */
export function HistoryShareSheet({ onClose }: { onClose: () => void }) {
  const { t, tokens } = useApp();
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["me:history-card", period],
    queryFn: async () => (await api<HistoryCardPayload>(`/api/v1/me/history-card?p=${period}`)).data,
    staleTime: 60_000,
  });
  /* مدّةٌ أخرى: ما أُخفي في الأولى ليس قرارَ الثانية */
  useEffect(() => {
    setHidden(new Set());
    setError(null);
  }, [period]);

  const titles = q.data?.titles ?? [];
  const shown = titles.filter((x) => !hidden.has(x.key));
  const heroKey = shown[0]?.key;

  const toggle = useCallback((k: string) => {
    haptic.pick();
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  const share = useCallback(async () => {
    if (busy || !shown.length) return;
    haptic.pick();
    setBusy(true);
    setError(null);
    try {
      for (const f of Paths.cache.list()) {
        if (f instanceof File && f.name.startsWith("loopz-history-")) f.delete();
      }
      const file = new File(Paths.cache, `loopz-history-${period}-${Date.now()}.png`);
      const hide = [...hidden].join(",");
      await downloadTo(`/api/v1/me/history-card/image?p=${period}${hide ? `&hide=${encodeURIComponent(hide)}` : ""}`, file);
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
      await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t.historyShareTitle });
    } catch {
      setError(t.shareFailed);
    } finally {
      setBusy(false);
    }
  }, [busy, shown.length, hidden, period, t]);

  return (
    <Sheet title={t.historyShareTitle} onClose={onClose}>
      <View style={{ gap: 12, paddingBottom: 8 }}>
        <Segmented
          items={[
            { id: "week", label: t.historyShareWeek },
            { id: "month", label: t.historyShareMonth },
          ]}
          value={period}
          onChange={(v) => setPeriod(v === "month" ? "month" : "week")}
        />
        {q.data?.range ? <Text size={13} muted>{`${q.data.range} · ${t.historyShareHint}`}</Text> : null}
        {!q.data ? (
          <ActivityIndicator color={tokens.accent} style={{ paddingVertical: 28 }} />
        ) : !titles.length ? (
          <Text muted style={{ textAlign: "center", paddingVertical: 28 }}>{t.historyShareEmpty}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 2 }}>
            {titles.map((x) => {
              const on = !hidden.has(x.key);
              const uri = posterFor(x.poster_path, 54);
              return (
                <Pressable
                  key={x.key}
                  onPress={() => toggle(x.key)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={x.title}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 6, opacity: on ? 1 : 0.5 }}
                >
                  <View style={{ width: 34, aspectRatio: 2 / 3, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={15} weight="600" numberOfLines={1}>{x.title}</Text>
                    {x.key === heroKey ? <Text size={12} weight="700" color={tokens.accent}>{t.historyShareHero}</Text> : null}
                  </View>
                  <SwitchPill checked={on} />
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {error ? <Text size={13} color={tokens.error}>{error}</Text> : null}
        <Button label={busy ? t.shareBusy : t.historyShareCta} onPress={() => void share()} disabled={busy || !shown.length} />
      </View>
    </Sheet>
  );
}
