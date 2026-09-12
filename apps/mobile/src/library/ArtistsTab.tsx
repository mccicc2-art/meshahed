import React from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { api, qk } from "../api";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { radius } from "../theme";
import { Icon } from "../icons";
import { MarqueeText } from "./MarqueeText";
import { profileUrl } from "@/core/media";
import type { LibraryArtistsPayload, LibraryArtist } from "../contracts";

/**
 * ====== تبويبُ «فنّانون» أصليّاً — نسخةُ `ArtistsGrid` (D-128) ======
 * (D-947)
 *
 * 🔑 **البطاقةُ هي بطاقةُ الملصق نفسُها لا شبكةُ صورٍ دائريّة** — حجّةُ
 * `ArtistsGrid.tsx` حرفاً: الشخصُ في هذا التطبيق محتوًى كالعمل، **ودوائرُ
 * هنا لغةٌ بصريّةٌ ثانية** (القاعدة ٣). الصورةُ `w185` بنسبة ٢:٣ ورمزُ
 * `people` حين لا صورة، **والسطرُ تحت الاسم «شاهدتَ له N أعمال» يغيب عند
 * الصفر** (D-219). **والترتيبُ من الخادم** (`getArtistShelf`: بعدد ما شاهدتَه).
 *
 * 📐 الشبكةُ `posterGrid` نفسُها التي ترسمها `LibraryScreen`
 * (`auto-fill minmax(96px,1fr) gap-3`) — المعادلةُ لا رقمٌ ثابت (G1).
 */
const PAGE_PAD = 16;
const GAP = 12;
const MIN_COL = 96;

export function ArtistsTab({ onOpenWeb }: { onOpenWeb: (path: string) => void }) {
  const { t, tokens } = useApp();
  const { width } = useWindowDimensions();
  const data = useQuery({
    queryKey: qk.tag("people"),
    queryFn: async () => (await api<LibraryArtistsPayload>("/api/v1/me/library/artists")).data,
  });
  const inner = width - PAGE_PAD * 2;
  const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_COL + GAP)));
  const cellW = Math.floor((inner - GAP * (cols - 1)) / cols);

  if (data.isLoading)
    return (
      <View style={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={{ width: cellW, aspectRatio: 2 / 3, borderRadius: radius.poster, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, opacity: 0.7 }} />
        ))}
      </View>
    );
  if (data.isError || !data.data)
    return <Empty text={t.apiInternal} cta={t.errorRetry} onCta={() => void data.refetch()} />;
  const items = data.data.items;
  if (items.length === 0) return <Empty text={t.artistsEmpty} cta={t.artistsEmptyCta} onCta={() => onOpenWeb("/search")} />;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
        {items.map((a) => (
          <ArtistCard key={a.person_id} a={a} width={cellW} onPress={() => onOpenWeb(`/person/${a.person_id}`)} />
        ))}
      </View>
    </ScrollView>
  );
}

const VEIL = require("../../assets/poster-veil.png");

function ArtistCard({ a, width, onPress }: { a: LibraryArtist; width: number; onPress: () => void }) {
  const { t, tokens } = useApp();
  const uri = profileUrl(a.profile_path, "w185");
  const note = a.watched_works > 0 ? t.artistWorksWatched(a.watched_works) : null;
  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button" accessibilityLabel={a.name ?? "—"}>
      <View style={{ width, aspectRatio: 2 / 3, borderRadius: radius.poster, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={String(a.person_id)} />
        ) : (
          <Icon name="people" size={28} color={tokens.muted} />
        )}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingBottom: 8, paddingTop: 28 }}>
          <Image source={VEIL} style={StyleSheet.absoluteFill} contentFit="fill" />
          <MarqueeText text={a.name ?? "—"} size={12} weight="600" color="#fff" style={styles.shadow} />
          {/* `text-[10px] text-accent-2/90 mt-0.5` — يمشي حين يفيض كما في الويب (D-100) */}
          {note ? <View style={{ marginTop: 2 }}><MarqueeText text={note} size={10} color={tokens.accent2 + "E6"} style={styles.shadow} /></View> : null}
        </View>
      </View>
    </Pressable>
  );
}

function Empty({ text, cta, onCta }: { text: string; cta: string; onCta: () => void }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 64, paddingHorizontal: PAGE_PAD, gap: 16 }}>
      <Text muted style={{ textAlign: "center" }}>{text}</Text>
      <Button label={cta} onPress={onCta} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
});
