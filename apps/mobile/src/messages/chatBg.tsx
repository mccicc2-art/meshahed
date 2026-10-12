import React, { useCallback, useState } from "react";
import { Image as RNImage, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api, queryClient, write } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { backdropUrl } from "@/core/media";
import { themeById, themeScheme } from "@/core/themes";
import {
  CHAT_BG_DOODLE_OPACITY,
  CHAT_BG_TITLE_BLUR,
  CHAT_BG_TITLE_VEIL,
  DEFAULT_CHAT_BG,
  sameChatBg,
  type ChatBg,
} from "@/core/chatBg";
import type { ChatBgBody, ChatBgPayload, ChatBgResult } from "../contracts";

/**
 * ====== 🆕 D-1382 — خلفيّةُ المحادثات (التطبيق) ======
 *
 * • `useChatBg` — ما يُرسم تحت الخيط (`shown`)؛ قراءةٌ خفيفةٌ بلا مفضّلات، تُخبَّأ طويلاً لأنّ لا كاتبَ لها
 *   إلّا صاحبُها من هذه الورقة نفسِها (أو من الويب — فتُعاد عند العودة إلى التطبيق).
 * • `ChatBackdrop` — الطبقةُ نفسُها: الرسومُ مكرَّرةً (صورتان: بيضاءُ للداكن وسوداءُ للنهاريّ — بلا `tintColor` على
 *   صورةٍ مكرّرة، فسلوكُه على أندرويد غيرُ مضمون)، أو خلفيّةُ العمل مضبّبةً تحت غشاءٍ بلون خلفيّة الثيم.
 * • `ChatBgSheet` — المنتقي (ماكيتُ أحمد): Loopz · بلا رسوم · «من مفضّلاتك» بشارة Loopz+. يُطبَّق لحظةَ اللمس
 *   ولا تُغلق الورقة؛ وغيرُ المشترك يرى أعمالَه باهتةً بقفلٍ وزرّاً إلى البلس. **والحارسُ في الخادم.**
 */
export const CHAT_BG_KEY = ["me:chat-bg"] as const;
const CHOICES_KEY = ["me:chat-bg", "choices"] as const;

const DOODLE_LIGHT_STROKES = require("../../assets/chat-doodle.png");
const DOODLE_DARK_STROKES = require("../../assets/chat-doodle-dark.png");

export function useChatBg(): ChatBg {
  const q = useQuery({
    queryKey: CHAT_BG_KEY,
    queryFn: async () => (await api<ChatBgPayload>("/api/v1/me/prefs/chat-bg")).data,
    staleTime: 10 * 60_000,
  });
  return q.data?.shown ?? DEFAULT_CHAT_BG;
}

export function ChatBackdrop({ bg }: { bg: ChatBg }) {
  const { tokens, themeId } = useApp();
  if (bg.k === "plain") return null;
  if (bg.k === "loopz") {
    const light = themeScheme(themeById(themeId)) === "light";
    return (
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: CHAT_BG_DOODLE_OPACITY }]}>
        <RNImage source={light ? DOODLE_DARK_STROKES : DOODLE_LIGHT_STROKES} resizeMode="repeat" style={{ width: "100%", height: "100%" }} />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <Image source={{ uri: backdropUrl(bg.path, "w780") ?? undefined }} blurRadius={CHAT_BG_TITLE_BLUR} contentFit="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.15 }] }]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tokens.bg, opacity: CHAT_BG_TITLE_VEIL }]} />
    </View>
  );
}

export function ChatBgSheet({ onClose, onPlus }: { onClose: () => void; onPlus: () => void }) {
  const { t, tokens, themeId } = useApp();
  const q = useQuery({
    queryKey: CHOICES_KEY,
    queryFn: async () => (await api<ChatBgPayload>("/api/v1/me/prefs/chat-bg?choices=1")).data,
  });
  const [local, setLocal] = useState<ChatBg | null>(null);
  const bg = local ?? q.data?.bg ?? null;
  const plus = q.data?.plus ?? false;
  const choices = q.data?.choices ?? null;
  const light = themeScheme(themeById(themeId)) === "light";

  const pick = useCallback(
    (next: ChatBg) => {
      if (bg && sameChatBg(bg, next)) return;
      haptic.pick();
      const prev = bg;
      setLocal(next);
      write<ChatBgResult>("/api/v1/me/prefs/chat-bg", { bg: next } satisfies ChatBgBody)
        .then((r) => {
          if (r.needsPlus) {
            setLocal(prev);
            onPlus();
            return;
          }
          if (!r.ok) throw new Error("save");
          /* الخيطُ تحت الورقة يتبدّل فوراً: «ما يُرسم» هو المحفوظُ نفسُه — والخادمُ لا يقبل العملَ إلّا من مشترك */
          queryClient.setQueryData<ChatBgPayload>(CHAT_BG_KEY, (old) => ({ bg: r.bg, shown: r.bg, plus: old?.plus ?? plus, choices: null }));
          queryClient.setQueryData<ChatBgPayload>(CHOICES_KEY, (old) => (old ? { ...old, bg: r.bg, shown: r.bg } : old));
        })
        .catch(() => setLocal(prev));
    },
    [bg, onPlus, plus],
  );

  const row = (value: ChatBg, title: string, sub: string, thumb: React.ReactNode) => {
    const on = !!bg && sameChatBg(bg, value);
    return (
      <Pressable
        key={value.k}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        onPress={() => pick(value)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? tokens.accent : tokens.border, backgroundColor: pressed ? tokens.surface2 : tokens.surface })}
      >
        <View style={{ width: 76, height: 46, borderRadius: radius.sm, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.bg }}>{thumb}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={15} weight="700" numberOfLines={1}>{title}</Text>
          <Text size={12} muted numberOfLines={1}>{sub}</Text>
        </View>
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? tokens.accent : tokens.muted, alignItems: "center", justifyContent: "center" }}>
          {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.accent }} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <Sheet title={t.chatBgTitle} onClose={onClose}>
      <View style={{ gap: 10 }} accessibilityRole="radiogroup">
        <Text size={12} muted>{t.chatBgSub}</Text>
        {row(
          { k: "loopz" },
          t.chatBgLoopz,
          t.chatBgLoopzSub,
          <View style={{ flex: 1, opacity: CHAT_BG_DOODLE_OPACITY * 2.5 }}>
            <RNImage source={light ? DOODLE_DARK_STROKES : DOODLE_LIGHT_STROKES} resizeMode="repeat" style={{ width: "100%", height: "100%" }} />
          </View>,
        )}
        {row({ k: "plain" }, t.chatBgPlain, t.chatBgPlainSub, null)}
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text size={15} weight="700">{t.chatBgFavs}</Text>
          <View style={{ borderWidth: 1, borderColor: tokens.accent, borderRadius: radius.pill, paddingHorizontal: 8 }}>
            <Text size={10} weight="700" color={tokens.accent}>{t.plusName}</Text>
          </View>
        </View>

        {choices === null ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flex: 1, aspectRatio: 16 / 10, borderRadius: radius.md, backgroundColor: tokens.surface2 }} />
            ))}
          </View>
        ) : choices.length === 0 ? (
          <Text size={12} muted>{t.chatBgFavsEmpty}</Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {choices.map((c) => {
              const value: ChatBg = { k: "title", type: c.type, id: c.id, path: c.path };
              const on = !!bg && sameChatBg(bg, value);
              return (
                <Pressable
                  key={`${c.type}-${c.id}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={c.title}
                  onPress={() => (plus ? pick(value) : onPlus())}
                  style={({ pressed }) => ({ width: "31%", flexGrow: 1, maxWidth: "33%", transform: [{ scale: pressed ? 0.97 : 1 }] })}
                >
                  <View style={{ aspectRatio: 16 / 10, borderRadius: radius.md, overflow: "hidden", borderWidth: 2, borderColor: on ? tokens.accent : "transparent", backgroundColor: tokens.surface2 }}>
                    <Image source={{ uri: backdropUrl(c.path, "w300") ?? undefined }} contentFit="cover" style={{ width: "100%", height: "100%", opacity: plus ? 1 : 0.45 }} />
                    {on || !plus ? (
                      <View style={{ position: "absolute", top: 6, end: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? tokens.accent : "rgba(0,0,0,0.7)" }}>
                        <Icon name={on ? "check" : "lock"} size={11} color={on ? tokens.onAccent : "#fff"} />
                      </View>
                    ) : null}
                  </View>
                  <Text size={12} muted={!plus} numberOfLines={1} style={{ marginTop: 4 }}>{c.title}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {plus ? (
          choices && choices.length > 0 ? <Text size={12} muted>{t.chatBgFavsHint}</Text> : null
        ) : (
          <Button label={t.chatBgUnlock} onPress={onPlus} />
        )}
      </View>
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
