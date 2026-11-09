import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { StarRow } from "../title/StarRow";
import { write } from "../api";
import { haptic } from "../haptics";
import type { RateBody } from "../contracts";
import { Icon } from "../icons";
import { radius } from "../theme";
import { SectionHeader, PAGE_PAD } from "../home/Section";
import { backdropUrl } from "@/core/media";
import { timeAgo } from "@/core/when";
import { SIGNAL_SOURCE_NAME, type StremioSignal } from "@/core/contracts/stremio";
import { episodeLabel } from "./api";

/** عرضُ اللقطة 16:9 (قرار ٦: ١١٦ نقطة) — والنصُّ بجانبها بارتفاعها */
const STILL_W = 116;
const STILL_H = Math.round((STILL_W * 9) / 16);

/** لقطةُ الحلقة (أو خلفيّةُ العمل) — صورةٌ فشلت يحلّ محلَّها رمزُ النوع كـ`MediaRow` (D-1323) */
export function SignalStill({ s, width }: { s: StremioSignal; width: number }) {
  const { tokens } = useApp();
  const [failed, setFailed] = useState<string | null>(null);
  const uri = s.image_path && failed !== s.image_path ? backdropUrl(s.image_path, "w300") : null;
  return (
    <View style={{ width, height: Math.round((width * 9) / 16), borderRadius: radius.sm, overflow: "hidden", backgroundColor: tokens.surface2 }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" onError={() => setFailed(s.image_path)} />
      ) : (
        <View style={styles.center}><Icon name={s.kind === "movie" ? "film" : "tv"} size={18} color={tokens.muted} /></View>
      )}
    </View>
  );
}

/**
 * ====== 🆕 «من أجهزتك» — بطاقةُ الرئيسيّة (خطّةُ Stremio، تصميم «٣»، ٢٢ أكتوبر · وسيرفراتُ البيت منذ هجرة ٢٣٥) ======
 *
 * ⚖️ **قسمٌ واحدٌ لكلِّ الأجهزة** (أحمد ٤ نوفمبر، البطاقة «أ»): أسئلةُ Stremio وPlex وJellyfin وEmby جدولٌ واحد، والمصدرُ
 * اسمٌ في سطر الوقت — لا قسمٌ لكلِّ مصدرٍ يكدّس الرئيسيّة.
 *
 * إشارةٌ واحدةٌ — الأحدث — بلقطتها وسؤالها، وتحتها نصفان بعرض البطاقة: ✓ شفتها (أساسيّ) و✕ لا (شفّاف). الجوابُ يُظهر
 * التي بعدها وينقص العدد، **وبلا إشارةٍ منتظرةٍ يختفي القسمُ كلُّه** (قرار ٥: لا حالةَ فارغةَ في الرئيسيّة) — فالمكوّنُ
 * يعيد `null` والرئيسيّةُ لا تعرف عنه شيئاً.
 * ⚖️ الزرّان من مصنع الأزرار (`Button` حجمَ `sm`) لا رسمٌ ثانٍ؛ ارتفاعُهما ٣٤ ليتّسع الإبهام في نصف بطاقة.
 * والألوانُ رموزُ الثيم كلُّها (فُحصت التصاميمُ في Loopz والنهاريّ والمحيط والقرمزيّ).
 */
export function StremioCard({
  items,
  count,
  onAnswer,
  onAll,
  onOpen,
}: {
  /** المنتظرةُ بعد إخفاء ما أُجيب عنه */
  items: StremioSignal[];
  count: number;
  onAnswer: (s: StremioSignal, watched: boolean) => void;
  onAll: () => void;
  onOpen: (s: StremioSignal) => void;
}) {
  const { t, tokens } = useApp();
  const s = items[0];
  if (!s) return null;
  const ep = episodeLabel(s, t.stremioMovie);
  const src = s.source ?? "stremio";
  /* 🆕 T361 — ما سجّله Loopz بنفسه (أحمد ١٠ نوفمبر «١ أ و ج»): «✓ أضفناه لمكتبتك»، والفيلمُ بنجومه والحلقةُ بـ«حسناً» */
  if (s.auto) return <AutoCard key={s.id} s={s} count={count} ep={ep} onDone={(x) => onAnswer(x, true)} onAll={onAll} onOpen={onOpen} />;
  return (
    <View>
      <SectionHeader
        title={t.devicesFrom}
        icon="play"
        onTitle={onAll}
        action={<Text size={12} weight="700" color={tokens.accent}>{String(count)}</Text>}
        seeAll={t.allWord}
        onSeeAll={onAll}
      />
      <View style={{ marginHorizontal: PAGE_PAD, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => onOpen(s)}
          accessibilityRole="button"
          accessibilityLabel={`${s.title}، ${ep}، ${t.stremioAsk}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <SignalStill s={s} width={STILL_W} />
          <View style={{ flex: 1, minWidth: 0, height: STILL_H, justifyContent: "space-between" }}>
            <Text size={15} weight="700" numberOfLines={1}>{s.title}</Text>
            <Text size={13} weight="500" numberOfLines={1}>{`${ep} · ${t.stremioAsk}`}</Text>
            {/* 🆕 هجرة ٢٣٥ — «من أجهزتك» (البطاقة «أ»): المصدرُ اسمٌ في السطر، و«شغّلتها» لـStremio و«خلّصتها» لسيرفر البيت */}
            <Text size={12} muted numberOfLines={1}>{`${SIGNAL_SOURCE_NAME[src]} · ${src === "stremio" ? t.stremioOpened : t.serverFinished} ${timeAgo(s.seen_at, t)}`}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={t.stremioYes} size="sm" style={styles.half} onPress={() => onAnswer(s, true)} />
          <Button label={t.stremioNo} size="sm" variant="ghost" style={styles.half} onPress={() => onAnswer(s, false)} />
        </View>
      </View>
    </View>
  );
}

/**
 * ====== 🆕 T361 — ما سُجّل تلقائياً في البطاقة نفسِها (هجرة ٢٤٢) ======
 * القسمُ ورأسُه واللقطةُ وسطرُ المصدر كما هي — **سطرُ الحالة وحده يتغيّر** («✓ أضفناه لمكتبتك» بلون النجاح)، وتحت الصفّ:
 * - **فيلم**: «قيّمه» وعشرُ نجومٍ بعرض البطاقة — صفُّ النجوم نفسُه في ورقة الاحتفال (`StarRow spread`)، والحفظُ فعلُ التقييم
 *   نفسُه (`track/rate`). حُفظ ⇒ يخرج من البطاقة (`onDone` = «رأيتُه»).
 * - **حلقة**: «حسناً» بعرض البطاقة من مصنع الأزرار.
 * ⚖️ لا «تراجع»: لا جوابَ هنا يُعكس — المشاهدةُ محفوظةٌ قبل أن تُرسم البطاقة.
 */
function AutoCard({ s, count, ep, onDone, onAll, onOpen }: { s: StremioSignal; count: number; ep: string; onDone: (s: StremioSignal) => void; onAll: () => void; onOpen: (s: StremioSignal) => void }) {
  const { t, tokens } = useApp();
  const [stars, setStars] = useState(0);
  const src = s.source ?? "stremio";
  const movie = s.kind === "movie";
  const rate = async (n: number) => {
    if (stars || n < 1) return;
    setStars(n);
    haptic.pick();
    try {
      await write<unknown>("/api/v1/track/rate", { tmdbId: s.tmdb_id, mediaType: "movie", rating: n, review: "", title: s.title, posterPath: s.poster_path ?? null } satisfies RateBody);
      haptic.success();
      onDone(s);
    } catch {
      setStars(0);
    }
  };
  const added = movie ? t.autoAddedMovie : t.autoAddedEpisode;
  return (
    <View>
      <SectionHeader
        title={t.devicesFrom}
        icon="play"
        onTitle={onAll}
        action={<Text size={12} weight="700" color={tokens.accent}>{String(count)}</Text>}
        seeAll={t.allWord}
        onSeeAll={onAll}
      />
      <View style={{ marginHorizontal: PAGE_PAD, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => onOpen(s)}
          accessibilityRole="button"
          accessibilityLabel={`${s.title}، ${movie ? "" : `${ep}، `}${added}`}
          style={({ pressed }) => ({ flexDirection: "row", gap: 12, opacity: pressed ? 0.85 : 1 })}
        >
          <SignalStill s={s} width={STILL_W} />
          <View style={{ flex: 1, minWidth: 0, height: STILL_H, justifyContent: "space-between" }}>
            <Text size={15} weight="700" numberOfLines={1}>{s.title}</Text>
            <Text size={13} weight="500" numberOfLines={1}>
              {movie ? "" : `${ep} · `}
              <Text size={13} weight="700" color={tokens.success}>{"✓ "}</Text>
              {added}
            </Text>
            <Text size={12} muted numberOfLines={1}>{`${SIGNAL_SOURCE_NAME[src]} · ${t.serverFinished} ${timeAgo(s.seen_at, t)}`}</Text>
          </View>
        </Pressable>
        {movie ? (
          <View style={{ gap: 6, paddingHorizontal: 4, paddingBottom: 2 }}>
            <Text size={13} weight="700" muted>{t.autoRate}</Text>
            <View pointerEvents={stars ? "none" : "auto"}>
              <StarRow spread size={22} value={stars || null} onChange={(n) => void rate(n ?? 0)} />
            </View>
          </View>
        ) : (
          <Button label={t.autoOk} size="sm" style={{ minHeight: 34 }} onPress={() => onDone(s)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  half: { flex: 1, minHeight: 34 },
});
