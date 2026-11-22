import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View, type TextInputInstance } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { haptic } from "../haptics";
import { Avatar } from "../community/CommunityCards";
import { displayNameOf, type PersonLite } from "@/core/people";
import { api } from "../api";
import type { SearchPayload } from "../contracts";

/**
 * ====== المنشن في خانة الكتابة — القروبُ والنقاش (D-1436 · 🆕 D-1443) ======
 *
 * الكلمةُ الأخيرةُ في الحقل تبدأ بـ`@` ⇒ قائمةُ من يطابقها (المعرّفُ من أوّله أو الاسمُ من أيِّ موضع) حتى خمسة، فوق الخانة؛
 * اللمسةُ تكمل `@اسم` ومسافةً بعده. وُلدت في القروب وخرجت إلى هنا حين طلبها أحمد في النقاش — نسخةٌ واحدة.
 * `people`: من يُمنشَن (أعضاءُ القروب · من كتبوا في النقاش) — مخفيُّ الاسم وصاحبُ الجهاز لا يُعرضان.
 */
const TAIL = /(^|\s)@([A-Za-z0-9_]*)$/;

/**
 * 🆕 T504 — **النقاشُ يُمنشِن أيَّ عضو** (أحمد ٢٢ نوفمبر بمقطع: «ليش يظهر لي منشن عمر فقط · ليه مقدر امنشن شخص ثاني وحنا ف
 * المجتمع؟»، ثمّ «١٢ أ»): `opts.search` — بعد حرفين يُسأل بحثُ «أعضاء» نفسُه (`/api/v1/search?type=members`، debounce ٣٠٠ كالبحث)
 * وتُلحق نتائجُه بعد المحلّيّين (المشاركين ثمّ من أتابعهم، بترتيب `people`). `opts.exclude` يُسقط صاحبَ الجهاز من النتائج البعيدة.
 * القروبُ لا يمرّر `search`: لا يُذكر فيه إلّا أعضاؤه، لأن غيرهم لا يرى المحادثة.
 */
export function useMentions(
  text: string,
  setText: (fn: (cur: string) => string) => void,
  people: PersonLite[],
  inputRef: React.RefObject<TextInputInstance | null>,
  opts: { search?: boolean; exclude?: string | null } = {},
) {
  const usable = useMemo(() => people.filter((p) => !!p.username && !p.hide_name && p.id !== opts.exclude), [people, opts.exclude]);
  const q = TAIL.exec(text)?.[2] ?? null;
  const [remote, setRemote] = useState<{ q: string; people: PersonLite[] } | null>(null);
  const want = opts.search && q !== null && q.length >= 2 ? q.toLowerCase() : null;
  useEffect(() => {
    if (!want) return;
    let live = true;
    const timer = setTimeout(() => {
      api<SearchPayload>(`/api/v1/search?type=members&q=${encodeURIComponent(want)}`)
        .then((r) => {
          if (live) setRemote({ q: want, people: r.data.members ?? [] });
        })
        .catch(() => {});
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [want]);
  /* أسماءُ من ظهروا في الاقتراح تُرسم روابطَ أيضاً — فسطري المتفائلُ لا ينتظر الخادم ليصير اسمُ من ذكرتُه رابطاً */
  const seen = useMemo(() => {
    const all = [...usable];
    for (const p of remote?.people ?? []) if (p.username && !p.hide_name && p.id !== opts.exclude) all.push(p);
    return all;
  }, [usable, remote, opts.exclude]);
  const names = useMemo(() => new Set(seen.map((p) => (p.username ?? "").toLowerCase())), [seen]);
  const hits = useMemo(() => {
    if (q === null) return [];
    const k = q.toLowerCase();
    const local = usable.filter((p) => (p.username ?? "").toLowerCase().startsWith(k) || displayNameOf(p, "").toLowerCase().includes(k));
    const far = remote && want && remote.q === want ? remote.people.filter((p) => p.username && !p.hide_name && p.id !== opts.exclude) : [];
    const out: PersonLite[] = [];
    const ids = new Set<string>();
    for (const p of [...local, ...far]) {
      if (ids.has(p.id)) continue;
      ids.add(p.id);
      out.push(p);
      if (out.length >= 5) break;
    }
    return out;
  }, [q, usable, remote, want, opts.exclude]);
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
