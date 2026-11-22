import React from "react";
import { ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { num } from "@/core/i18n";
import { importRunCounts, importRunTitle, importRunWhen, type ImportRun } from "@/core/importer";

/**
 * ====== 🆕 T507 — «استيراداتك» (نسخةُ `ImportHistorySheet.tsx` في الويب) ======
 *
 * أحمد ٢٢ نوفمبر «١ أ — واذا ضغط عليه تظهر له استيراداته»: صفٌّ لكلِّ استيراد (`import_runs`، هجرة ٢٥٧) — المصدرُ، ويومُه
 * وساعتُه، والسطحُ، وحصيلتُه، و«أُوقف» إن أوقفه صاحبُه. **الورقةُ الواحدة (`Sheet`)** ولونُ النجاح الواحد للحال — لا مكوّنَ ثانٍ.
 */
export function ImportHistorySheet({ runs, onClose }: { runs: ImportRun[]; onClose: () => void }) {
  const { t, tokens, locale } = useApp();
  return (
    <Sheet title={t.importRunsTitle} onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
        <Text size={12} muted style={{ lineHeight: 19, marginBottom: 12 }}>{runs.length ? t.importRunsHint : t.importRunsEmpty}</Text>
        {runs.length ? (
          <View style={{ borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, overflow: "hidden" }}>
            {runs.map((run, i) => (
              <View key={run.id} style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: tokens.divider }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text size={14} weight="600" numberOfLines={1} style={{ flex: 1 }}>{importRunTitle(run.source, t)}</Text>
                  {/* حالٌ لا زرّ: نصٌّ بلون النجاح الواحد لا رقاقةٌ تُضغط فلا تفعل شيئاً */}
                  <Text size={12} weight="600" color={run.status === "done" ? tokens.success : tokens.muted}>
                    {run.status === "done" ? t.importRunDone : t.importRunCancelled}
                  </Text>
                </View>
                <Text size={12} muted style={{ marginTop: 2 }}>
                  {importRunWhen(run.createdAt, locale === "en" ? "en" : "ar")} · {run.platform === "app" ? t.importRunApp : t.importRunWeb}
                </Text>
                <Text size={12} style={{ marginTop: 2, lineHeight: 18 }}>{importRunCounts(run, t, (n) => num(n, locale))}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
