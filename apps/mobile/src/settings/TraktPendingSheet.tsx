import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Sheet } from "../library/Sheet";
import { StarRow } from "../title/StarRow";
import { write } from "../api";
import { num } from "@/core/i18n";

/** تعليقٌ من Trakt بلا تقييم — كما يعيده `/api/v1/me/import/trakt` في `pending` */
export type TraktPending = { kind: "tv" | "movie"; tmdbId: number; title: string; posterPath: string | null; text: string; at: string; spoiler: boolean };

/**
 * ====== 🆕 T516 — ورقةُ نجوم تعليقات Trakt ======
 *
 * **لماذا**: تعليقُه في Trakt بلا تقييم لا يُكتب مراجعةً (التقييمُ إلزاميّ في Loopz)، فكان يُترك صامتاً — تعليقُ أحمد على
 * موبلاند (٢٢ نوفمبر)، ثمّ اختار «٢أ»: بعد الاستيراد تُسأل عن نجوم كلِّ واحدٍ ثمّ يُحفظ.
 * **كيف**: واحدٌ واحدٌ بترتيبه، صفُّ النجوم نفسُه الذي في انبثاق التقييم (`StarRow spread`)، واختيارُ النجمة هو الحفظ — كما في
 * بطاقة Stremio. «تخطَّ» تتركه. والكتابةُ على الخادم بطريق الاستيراد نفسِه (`import/review`): بيوم كتابته، خارجَ نشاط الأصدقاء.
 */
export function TraktPendingSheet({ items, onClose }: { items: TraktPending[]; onClose: (saved: number) => void }) {
  const { t, tokens, locale } = useApp();
  const [i, setI] = useState(0);
  const [saved, setSaved] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const item = items[i];

  const next = (count: number) => {
    setFailed(false);
    if (i + 1 >= items.length) onClose(count);
    else setI(i + 1);
  };

  const save = async (stars: number | null) => {
    if (!item || busy || !stars) return;
    setBusy(true);
    try {
      const r = await write<{ saved: boolean; kept: boolean }>("/api/v1/me/import/review", { ...item, rating: stars });
      const count = saved + (r?.saved ? 1 : 0);
      setSaved(count);
      next(count);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!item) return null;
  return (
    <Sheet title={t.importPendingTitle} onClose={() => onClose(saved)}>
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{t.importPendingHint}</Text>
        {items.length > 1 ? (
          <Text size={12} weight="600" muted style={{ marginBottom: 6 }}>{t.importPendingStep(num(i + 1, locale), num(items.length, locale))}</Text>
        ) : null}
        <View style={{ borderRadius: 14, backgroundColor: tokens.surface2, padding: 14, gap: 8 }}>
          <Text size={15} weight="600" numberOfLines={2}>{item.title}</Text>
          <Text size={13} style={{ lineHeight: 20 }} numberOfLines={8}>{item.text}</Text>
        </View>
        <View style={{ marginTop: 16, opacity: busy ? 0.5 : 1 }} pointerEvents={busy ? "none" : "auto"}>
          <StarRow spread size={22} value={null} onChange={(n) => void save(n)} />
        </View>
        {failed ? <Text size={12} color={tokens.error} style={{ marginTop: 8 }}>{t.importPendingFailed}</Text> : null}
        <Button label={t.importPendingSkip} variant="ghost" disabled={busy} onPress={() => next(saved)} style={{ marginTop: 16 }} />
      </ScrollView>
    </Sheet>
  );
}
