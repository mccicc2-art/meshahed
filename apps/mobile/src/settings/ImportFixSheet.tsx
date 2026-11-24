import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "../library/Sheet";
import { write } from "../api";
import { num } from "@/core/i18n";
import type { FixItem } from "@/core/importFix";
import { Group, Row } from "./ui";

/**
 * ====== 🆕 T537 — ورقةُ «أعمال دخلت بالغلط سابقاً» ======
 *
 * **لماذا**: استيرادٌ سابقٌ بالاسم أدخل غيرَ ما في ملفّه («Harmony and Me» مكان «Harmony» ٢٠١٠)، وإعادةُ رفع الملفّ نفسِه
 * تعرف ذلك (`core/importFix`). أحمد ٢٤ نوفمبر «١أ»: لا يُنقل شيءٌ بلا تأكيده — فكلُّ سطرٍ بعلامةٍ يرفعها إن أراد إبقاءه.
 * **كيف**: صفوفُ الإعدادات نفسُها (`Row`، والعلامةُ في طرفها)، وزرٌّ أساسيٌّ واحد، و«لا، اتركها» شبحيّ. والتصحيحُ على الخادم
 * (`import/fix`) يعيد الشروطَ قبل أن يكتب.
 */
export function ImportFixSheet({ items, onClose }: { items: FixItem[]; onClose: (done: { fixed: number; failed: number } | null) => void }) {
  const { t, tokens, locale } = useApp();
  const [on, setOn] = useState<Set<number>>(() => new Set(items.map((x) => x.wrongId)));
  const [busy, setBusy] = useState(false);
  const chosen = items.filter((x) => on.has(x.wrongId));

  const toggle = (id: number) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      const r = await write<{ fixed: number; failed: number }>("/api/v1/me/import/fix", {
        apply: true,
        pairs: chosen.map(({ wrongId, rightId, rightTitle, rightPoster }) => ({ wrongId, rightId, rightTitle, rightPoster })),
      });
      onClose({ fixed: Number(r?.fixed) || 0, failed: Number(r?.failed) || 0 });
    } catch {
      onClose({ fixed: 0, failed: chosen.length });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t.importFixTitle} onClose={() => onClose(null)}>
      <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
        <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{t.importFixHint(num(items.length, locale))}</Text>
        <Group>
          {items.map((x) => (
            <Row
              key={x.wrongId}
              title={x.rightTitle || x.wrongTitle}
              subtitle={t.importFixWas(x.wrongTitle)}
              onPress={() => toggle(x.wrongId)}
              trailing={<Icon name={on.has(x.wrongId) ? "check" : "minus"} size={20} color={on.has(x.wrongId) ? tokens.accent : tokens.muted} />}
            />
          ))}
        </Group>
        <View style={{ marginTop: 16, gap: 8 }}>
          <Button label={t.importFixApply(num(chosen.length, locale))} busy={busy} disabled={!chosen.length} onPress={() => void apply()} />
          <Button label={t.importFixSkip} variant="ghost" disabled={busy} onPress={() => onClose(null)} />
        </View>
      </ScrollView>
    </Sheet>
  );
}
