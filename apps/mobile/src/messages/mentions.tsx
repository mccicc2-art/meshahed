import React, { useCallback, useMemo } from "react";
import { Pressable, type TextInput, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { haptic } from "../haptics";
import { Avatar } from "../community/CommunityCards";
import { displayNameOf, type PersonLite } from "@/core/people";

/**
 * ====== المنشن في خانة الكتابة — القروبُ والنقاش (D-1436 · 🆕 D-1443) ======
 *
 * الكلمةُ الأخيرةُ في الحقل تبدأ بـ`@` ⇒ قائمةُ من يطابقها (المعرّفُ من أوّله أو الاسمُ من أيِّ موضع) حتى خمسة، فوق الخانة؛
 * اللمسةُ تكمل `@اسم` ومسافةً بعده. وُلدت في القروب وخرجت إلى هنا حين طلبها أحمد في النقاش — نسخةٌ واحدة.
 * `people`: من يُمنشَن (أعضاءُ القروب · من كتبوا في النقاش) — مخفيُّ الاسم وصاحبُ الجهاز لا يُعرضان.
 */
const TAIL = /(^|\s)@([A-Za-z0-9_]*)$/;

export function useMentions(text: string, setText: (fn: (cur: string) => string) => void, people: PersonLite[], inputRef: React.RefObject<TextInput | null>) {
  const usable = useMemo(() => people.filter((p) => !!p.username && !p.hide_name), [people]);
  const names = useMemo(() => new Set(usable.map((p) => (p.username ?? "").toLowerCase())), [usable]);
  const q = TAIL.exec(text)?.[2] ?? null;
  const hits = useMemo(() => {
    if (q === null) return [];
    const k = q.toLowerCase();
    return usable.filter((p) => (p.username ?? "").toLowerCase().startsWith(k) || displayNameOf(p, "").toLowerCase().includes(k)).slice(0, 5);
  }, [q, usable]);
  const pick = useCallback(
    (username: string) => {
      haptic.pick();
      setText((cur) => cur.replace(TAIL, (_m, pre: string) => `${pre}@${username} `));
      inputRef.current?.focus();
    },
    [setText, inputRef],
  );
  return { names, hits, pick };
}

export function MentionList({ hits, onPick, pad = 16 }: { hits: PersonLite[]; onPick: (username: string) => void; pad?: number }) {
  const { t, tokens } = useApp();
  if (!hits.length) return null;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.bg, paddingVertical: 4 }}>
      {hits.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPick(p.username ?? "")}
          accessibilityRole="button"
          accessibilityLabel={`@${p.username}`}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: pad, paddingVertical: 8, backgroundColor: pressed ? tokens.surface2 : "transparent" })}
        >
          <Avatar uri={p.avatar_url} size={30} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={14} weight="600" numberOfLines={1}>{displayNameOf(p, t.anonymousUser)}</Text>
            <Text size={12} muted numberOfLines={1}>@{p.username}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
