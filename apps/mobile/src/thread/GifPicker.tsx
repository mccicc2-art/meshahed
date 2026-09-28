import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { FlashList } from "@shopify/flash-list";
import * as SecureStore from "expo-secure-store";
import { api } from "../api";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { span } from "../perfMarks";
import { gifUrl, GIF_ID_RE } from "@/core/media";
import type { Dict } from "@/core/i18n";
import type { GifHitLite, GifPayload } from "../contracts";

/**
 * ====== منتقي الـGIF الأصليّ — `GifPicker.tsx` (الويب) مُحسَّناً · Phase 11-M · M3 (خطّة §٣-أ) ======
 *
 * 🔑 **ما لا يتغيّر**: المفتاحُ في الخادم (`/api/v1/gif`) · `pg-13` · **المعرّفُ وحدَه يخرج** (D-362) والرابطُ من قالب
 * `gifUrl` · «مدعوم بـGIPHY» ظاهرٌ (شرطُ المزوّد) · الحقلُ الفارغُ الرائج · البحثُ بعد ٣٥٠ms سكوناً.
 *
 * 🆕 **ما يزيد على الويب** (بكلمة أحمد: «ضيفه مع الإضافتين»):
 * - **`webp` لا `.gif`** (`200w.webp`) عبر `expo-image` — أصغرُ بكثيرٍ وأنعمُ حركة.
 * - **تمريرٌ بلا نهاية** (`FlashList` بعمودين، `offset` عند بلوغ الآخر) — والخادمُ يسقف الإزاحة كي لا يُحرق المفتاح.
 * - **الحركةُ للمرئيّ وحدَه**: القائمةُ الافتراضيّةُ لا ترسم ما خرج من نافذتها فلا يتحرّك في الخلفيّة.
 * - **«استعملته مؤخّراً»**: آخرُ ١٢ معرّفاً **على الجهاز وحدَه** (SecureStore، لا القاعدة) — معرّفاتٌ لا روابط.
 * - **تصنيفاتٌ سريعة**: رقائقُ من العائلة الواحدة (`Chip`)، **النصُّ من القاموس والمصطلحُ المرسَلُ ثابتٌ هنا** — فـ«ضحك»
 *   تجد ضحكاً بأيِّ لغةٍ للواجهة.
 * - **الورقةُ الواحدة** (`Sheet`): سحبٌ للإغلاق · لوحةُ المفاتيح لا تغطّي النتائج (D-1005) · اهتزازٌ خفيفٌ عند الاختيار.
 */

const RECENT_KEY = "loopz.gif.recent";
const RECENT_MAX = 12;

/** المصطلحُ الإنجليزيُّ ثابتٌ عمداً: Giphy أغنى به، والرقاقةُ تقول معناه بلغة القارئ */
const GIF_CATS: { term: string; label: (t: Dict) => string }[] = [
  { term: "lol", label: (t) => t.gifCatLaugh },
  { term: "shocked", label: (t) => t.gifCatShock },
  { term: "sad", label: (t) => t.gifCatSad },
  { term: "applause", label: (t) => t.gifCatClap },
  { term: "love", label: (t) => t.gifCatLove },
  { term: "angry", label: (t) => t.gifCatAngry },
  { term: "congratulations", label: (t) => t.gifCatCongrats },
  { term: "nope", label: (t) => t.gifCatNo },
];

/**
 * صورةُ GIF متحرّكة — `webp` أوّلاً، **وعند فشله `200w.gif`** (خطّة §٧: معرّفٌ قديمٌ قد لا تملك Giphy له `webp`).
 * مكوّنٌ واحدٌ للمنتقي وللسطر في الخيط.
 */
export function GifImage({ id, size = "small", style }: { id: string; size?: "small" | "full"; style?: React.ComponentProps<typeof Image>["style"] }) {
  const [fmt, setFmt] = useState<"webp" | "gif">("webp");
  const uri = gifUrl(id, size, fmt);
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={style ?? { width: "100%", height: "100%" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      autoplay
      onError={() => fmt === "webp" && setFmt("gif")}
    />
  );
}

function readRecent(): string[] {
  try {
    const raw = SecureStore.getItem(RECENT_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && GIF_ID_RE.test(x)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** يُنادى بعد «أرسل» لا عند الاختيار — ما لم يُرسل لم يُستعمل */
export function rememberGif(id: string): void {
  if (!GIF_ID_RE.test(id)) return;
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, RECENT_MAX);
  SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(next)).catch(() => {});
}

export function GifPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const { t, tokens } = useApp();
  const { height, width } = useWindowDimensions();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [hits, setHits] = useState<GifHitLite[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [recent] = useState(readRecent);
  const term = (cat ?? q).trim();
  const seq = useRef(0);
  const [endOpen] = useState(() => span("gif.open"));
  const opened = useRef(false);

  const load = useCallback(async (query: string, offset: number) => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = (await api<GifPayload>(`/api/v1/gif?q=${encodeURIComponent(query)}&offset=${offset}`)).data;
      if (my !== seq.current) return;
      setHits((h) => (offset === 0 ? r.hits : [...h, ...r.hits.filter((x) => !h.some((y) => y.id === x.id))]));
      setNext(r.next);
      if (!opened.current) {
        opened.current = true;
        endOpen();
      }
    } catch {
      if (my === seq.current && offset === 0) setHits([]);
      setNext(null);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [endOpen]);

  /* الحقلُ الفارغُ فورٌ (الرائج)، والكتابةُ بعد ٣٥٠ms سكوناً — والتصنيفُ ضغطةٌ لا كتابة فيُطلب فوراً */
  useEffect(() => {
    const timer = setTimeout(() => void load(term, 0), term && !cat ? 350 : 0);
    return () => clearTimeout(timer);
  }, [term, cat, load]);

  const pick = (id: string) => {
    haptic.pick();
    onPick(id);
    onClose();
  };
  const colW = Math.floor((width - 32 - 8) / 2);
  const listH = Math.round(height * 0.5);
  const recentRow = useMemo(() => (term ? [] : recent), [term, recent]);

  return (
    <Sheet title={t.gifTitle} onClose={onClose}>
      <View style={{ gap: 10 }}>
        <TextInput
          value={q}
          onChangeText={(v) => {
            setCat(null);
            setQ(v.slice(0, 60));
          }}
          placeholder={t.gifSearch}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.gifSearch}
          autoCorrect={false}
          returnKeyType="search"
          style={{ minHeight: 44, backgroundColor: tokens.surface2, borderWidth: 1, borderColor: tokens.border, borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: tokens.fg, textAlign: "left" }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
          {GIF_CATS.map((c) => (
            <Chip
              key={c.term}
              label={c.label(t)}
              active={cat === c.term}
              onPress={() => {
                haptic.pick();
                setQ("");
                setCat(cat === c.term ? null : c.term);
              }}
            />
          ))}
        </ScrollView>
        {recentRow.length ? (
          <View style={{ gap: 6 }}>
            <Text size={12} weight="700" muted>{t.gifRecent}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {recentRow.map((id) => (
                <Pressable key={id} onPress={() => pick(id)} style={{ width: 72, height: 72, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}>
                  <GifImage id={id} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        <View style={{ height: listH }}>
          <FlashList
            data={hits}
            numColumns={2}
            masonry
            keyExtractor={(g) => g.id}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (!loading && next !== null && hits.length) void load(term, next);
            }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item.id)}
                accessibilityLabel={item.alt}
                style={{ width: colW, height: Math.round(colW / (item.ratio || 1)), margin: 2, borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.surface2 }}
              >
                <GifImage id={item.id} />
              </Pressable>
            )}
            ListEmptyComponent={
              <Text size={12} muted style={{ textAlign: "center", paddingTop: 24 }}>
                {loading ? t.gifLoading : term ? t.gifNone : t.gifOff}
              </Text>
            }
          />
        </View>
        <Text size={10} muted style={{ textAlign: "center" }}>{t.gifCredit}</Text>
      </View>
    </Sheet>
  );
}
