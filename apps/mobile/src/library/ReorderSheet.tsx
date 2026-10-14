import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "./Sheet";
import { DragList } from "./DragList";
import { posterFor } from "../poster";
import type { QueueItem } from "../contracts";

/**
 * ====== ورقةُ الترتيب — نسخةُ `ReorderSheet.tsx` (الويب، D-605/D-719) ======
 * (D-948 — البندُ الثاني: «ترتيبُ طابور «للمشاهدة» بالسحب»)
 *
 * 🔑 **المقبضُ وحدَه يمسك السحب** (حجّةُ الويب حرفاً): لو أمسكه الصفُّ كلُّه
 * لتنازع مع تمرير الورقة — فالـ`PanResponder` على زرِّ المقبض (`w-11 h-11`)،
 * والتمريرُ يُقفل ما دام السحبُ جارياً. الصفُّ `ROW` ٦٨ (`h = ROW - 8`)،
 * الملصقُ `w-9 h-[54px] rounded-md`، الاسمُ `text-14 font-semibold` بسطرين،
 * والموضعُ `text-12 text-muted` تحته. **المسحوبُ يرتفع** (`bg-surface-2` ·
 * ظلٌّ · `scale 1.02`) **والباقي ينزاح بمقدار صفٍّ** (`shift`) — الحسبةُ
 * نفسُها: `to = from + round(dy / ROW)`.
 *
 * 🔑 **والتمريرُ الذاتيُّ عند الحافّة** (٥٦ بكسل من طرفَي الجسد، ٨ بكسل كلَّ
 * إطار): بلا هذا لا يبلغ صفٌّ من آخر القائمة أوّلَها إلّا بعشر سحبات.
 * **وما تحرّك فعلاً يُضاف إلى الإزاحة** حتى لا يقفز الصفُّ المسحوب.
 *
 * «تمّ» يعيد المفاتيحَ بترتيبها، والكتابةُ (`saveHomeQueueOrder`) بيد المستدعي.
 *
 * 🆕 **K2 — السحبُ كلُّه على خيط الواجهة**. كان كلُّ إطارٍ يكتب `dy` في حالة React فيُعاد رسمُ الصفوف كلِّها
 * والإصبعُ يتحرّك، والتمريرُ الذاتيُّ مؤقّتٌ على JS. الآن **مواضعُ الصفوف نفسُها قيمٌ على خيط الواجهة**
 * (`slots`: مفتاحٌ ⇐ موضع) — الصفوفُ تُرسم بترتيبها الأوّل ولا تتحرّك إلّا بإزاحتها؛ وعند الإفلات يتبدّل
 * الموضعُ وتُصفَّر الإزاحةُ **في الإطار نفسِه** فلا يقفز صفّ، ثمّ يُبلَّغ React بالترتيب الجديد (للرقم و«تمّ»).
 * **والأرقامُ كما كانت حرفاً**: `ROW` · `EDGE` · `STEP` كلَّ إطار · `to = from + round(dy / ROW)` · والمقبضُ
 * يمسك من أوّل لمسة. React يرسم مرّتين لكلِّ سحبة (الإمساكُ والإفلات) لا في كلِّ إطار.
 */
const ROW = 68;
/* 🆕 ١٤ أكتوبر — المحرّكُ انتقل إلى `DragList` (ترتيبُ التطبيق كلُّه بالسحب، «١أ»)؛ الأرقامُ أعلاه باقيةٌ هناك حرفاً */

export function ReorderSheet({
  items,
  onClose,
  onDone,
}: {
  items: QueueItem[];
  onClose: () => void;
  onDone: (keys: string[]) => void;
}) {
  const { t } = useApp();
  return (
    <Sheet title={t.listReorder} onClose={onClose}>
      <ReorderBody items={items} onDone={onDone} />
    </Sheet>
  );
}

/**
 * 🆕 D-1353 — **جسدُ الترتيب وحدَه** (التلميحُ · «تمّ» · الصفوفُ المسحوبة): ورقةُ «الكلّ» في الرئيسيّة تتحوّل إليه في
 * مكانها (حكمُ أحمد ١١ أكتوبر بالصور: زرُّ «أعد الترتيب» داخل ورقة «الكلّ»، والورقةُ نفسُها تتبدّل) — ورقةٌ فوق ورقةٍ
 * ليست من لغتنا. `ReorderSheet` باقيةٌ بحرفها لمن يفتح الترتيبَ مباشرةً (بطاقةُ «للمشاهدة»).
 */
export function ReorderBody({ items, onDone, maxHeight = 460 }: { items: QueueItem[]; onDone: (keys: string[]) => void; maxHeight?: number }) {
  const { t, tokens } = useApp();
  const byKey = useMemo(() => new Map(items.map((x) => [x.key, x] as const)), [items]);
  const [order, setOrder] = useState<string[]>(() => items.map((x) => x.key));
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -14 }}>
        <Text size={12} muted style={{ flex: 1 }}>{t.listReorderHint}</Text>
        <Button label={t.listDone} onPress={() => onDone(order)} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>
      <DragList
        keys={items.map((x) => x.key)}
        rowHeight={ROW}
        maxHeight={maxHeight}
        onOrder={setOrder}
        handleLabel={(k, i) => `${byKey.get(k)?.title ?? ""} — ${t.listPositionOf(i + 1, items.length)}`}
        renderRow={(k, i) => {
          const item = byKey.get(k)!;
          const url = posterFor(item.poster_path, 36);
          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 36, height: 54, borderRadius: 6, overflow: "hidden", backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center" }}>
                {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="card" size={14} color={tokens.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={14} weight="600" numberOfLines={2} style={{ lineHeight: 17 }}>{item.title}</Text>
                <Text size={12} muted style={{ marginTop: 2, fontVariant: ["tabular-nums"] }}>{String(i + 1)}</Text>
              </View>
            </View>
          );
        }}
      />
    </>
  );
}
