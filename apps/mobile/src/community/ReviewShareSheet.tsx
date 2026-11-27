import React, { useState } from "react";
import { View } from "react-native";
import { File, Paths } from "expo-file-system";
import { downloadTo } from "../api";
import { useApp } from "../state";
import { Button } from "../ui";
import { Sheet } from "../library/Sheet";

/**
 * ====== 🆕 T530 — «المراجعة كاملة» أم «التقييم فقط»؟ (أحمد ٢٣ نوفمبر «١أ») ======
 *
 * من يشارك رابطَ مراجعةٍ فيها نصٌّ يختار ما تعرضه صورتُها في X: النصّ والتقييم، أو التقييم وحده (`?card=rating` — الصفحةُ
 * تختار صورتَها منه). الرابطُ نفسُه يفتح المراجعةَ كاملةً في الحالتين. رأيٌ بلا نصّ لا يُسأل عنه: صورتُه التقييمُ أصلاً.
 * ورقةٌ في الوسط كتأكيد الحذف في `FeedMenu` — زرّان بوصفة الزرّ الواحدة.
 *
 * 🆕 ن٧ (أحمد ٢٧ نوفمبر «اكمل المتبقي ونفذها») — **«صورة للقصص»**: الرأيُ نفسُه صورةً ١٠٨٠×١٩٢٠ لقصّة إنستغرام وسناب وحالة واتساب
 * (`…/card?format=story`)، تُشارَك صورةً لا رابطاً. تظهر لكلِّ رأيٍ له درجة — ولو بلا نصّ: صورتُه التقييمُ وحده.
 */
export const ratingOnlyPath = (path: string): string => `${path}${path.includes("?") ? "&" : "?"}card=rating`;

/** صورةُ القصّة من رابط المراجعة: `/review/…` ⇒ `/review/…/card?format=story` (ويبقى `card=rating` إن اختير) */
export async function shareReviewStory(sharePath: string, dialogTitle: string): Promise<void> {
  const [path, query] = sharePath.split("?");
  /* صورُ المرّات السابقة تُمسح — الكاشُ لا يتضخّم بصورةٍ لكلِّ مشاركة (كسجلّ المشاهدة) */
  for (const f of Paths.cache.list()) {
    if (f instanceof File && f.name.startsWith("loopz-review-")) f.delete();
  }
  const file = new File(Paths.cache, `loopz-review-${Date.now()}.png`);
  await downloadTo(`${path}/card?format=story${query ? `&${query}` : ""}`, file);
  /* استيرادٌ عند الحاجة كأخواتها: الوحدةُ الأصليّةُ تُحمَّل حين تُشارَك صورةٌ فقط */
  const Sharing = await import("expo-sharing");
  if (!(await Sharing.isAvailableAsync())) throw new Error("sharing unavailable");
  await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle });
}

export function ReviewShareSheet({
  onPick,
  onClose,
  choose = true,
  onStory,
}: {
  onPick: (ratingOnly: boolean) => void;
  onClose: () => void;
  /** رأيٌ فيه نصٌّ بلا حرق ⇒ «كاملة» أم «التقييم فقط»؛ وإلّا زرُّ الرابط وحده */
  choose?: boolean;
  /** يُمرَّر حيث تُشارَك المراجعة (لا النسخ): «صورة للقصص» */
  onStory?: () => Promise<void>;
}) {
  const { t, locale } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={t.shareReviewTitle} onClose={onClose} placement="center">
      <View style={{ gap: 10 }}>
        {choose ? (
          <>
            <Button label={t.shareReviewFull} onPress={() => onPick(false)} />
            <Button label={t.shareReviewRating} variant="ghost" onPress={() => onPick(true)} />
          </>
        ) : (
          <Button label={t.shareLinkLabel} onPress={() => onPick(false)} />
        )}
        {onStory ? (
          <Button
            label={locale === "en" ? "Image for stories" : "صورة للقصص"}
            variant="ghost"
            busy={busy}
            onPress={() => {
              if (busy) return;
              setBusy(true);
              void onStory().finally(() => setBusy(false));
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
