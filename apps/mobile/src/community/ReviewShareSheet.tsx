import React from "react";
import { View } from "react-native";
import { useApp } from "../state";
import { Button } from "../ui";
import { Sheet } from "../library/Sheet";

/**
 * ====== 🆕 T530 — «المراجعة كاملة» أم «التقييم فقط»؟ (أحمد ٢٣ نوفمبر «١أ») ======
 *
 * من يشارك رابطَ مراجعةٍ فيها نصٌّ يختار ما تعرضه صورتُها في X: النصّ والتقييم، أو التقييم وحده (`?card=rating` — الصفحةُ
 * تختار صورتَها منه). الرابطُ نفسُه يفتح المراجعةَ كاملةً في الحالتين. رأيٌ بلا نصّ لا يُسأل عنه: صورتُه التقييمُ أصلاً.
 * ورقةٌ في الوسط كتأكيد الحذف في `FeedMenu` — زرّان بوصفة الزرّ الواحدة.
 */
export const ratingOnlyPath = (path: string): string => `${path}${path.includes("?") ? "&" : "?"}card=rating`;

export function ReviewShareSheet({ onPick, onClose }: { onPick: (ratingOnly: boolean) => void; onClose: () => void }) {
  const { t } = useApp();
  return (
    <Sheet title={t.shareReviewTitle} onClose={onClose} placement="center">
      <View style={{ gap: 10 }}>
        <Button label={t.shareReviewFull} onPress={() => onPick(false)} />
        <Button label={t.shareReviewRating} variant="ghost" onPress={() => onPick(true)} />
      </View>
    </Sheet>
  );
}
