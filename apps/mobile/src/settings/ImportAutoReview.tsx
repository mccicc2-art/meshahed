import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { Segmented } from "../library/ToolsSheet";
import { num } from "@/core/i18n";
import { AUTO_ROLES, needsMedia, type AutoOptions, type AutoRole, type AutoTable } from "@/core/importAuto";

/**
 * ====== 🆕 T500 — «هكذا فهمنا ملفّك» (مراجعةُ المستورد العامّ — نسخةُ `ImportAutoReview.tsx` في الويب) ======
 *
 * أحمد ٢١ نوفمبر «1أ 2أ نفذ»: ملفٌّ من تطبيقٍ لا نعرفه تُخمَّن معاني أعمدته (`core/importAuto`) — **والتخمينُ الخاطئ يكتب في مكتبة
 * صاحبه**، فلا يُكتب شيءٌ قبل أن يرى ما فهمناه ويصحّحه. لكلِّ عمودٍ صفّ: اسمُه وقيمتان منه ومعناه رقاقة؛ الضغطُ يفتح رقاقاتِ المعاني
 * كلَّها، والمعنى لعمودٍ واحد. وفوقها سؤالان حين يلزمان: نوعُ الأعمال لملفٍّ لا يقوله، ومعنى صفٍّ بلا حالة.
 * **الورقةُ الواحدة (`Sheet`) والعائلتان وحدهما**: المقسّمُ (`Segmented`) للسؤالين والرقاقةُ (`Chip`) للمعاني، والزرُّ من المصنع.
 */
export function ImportAutoReview({
  tables: initial,
  skipped,
  onCancel,
  onImport,
}: {
  tables: AutoTable[];
  skipped: string[];
  onCancel: () => void;
  onImport: (tables: AutoTable[], opts: AutoOptions) => void;
}) {
  const { t, tokens, locale } = useApp();
  const [tables, setTables] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [media, setMedia] = useState<AutoOptions["media"] | null>(null);
  const [status, setStatus] = useState<AutoOptions["status"]>("watched");
  const named = (x: AutoTable) => x.roles.some((r) => r === "title" || r === "show" || r === "imdb" || r === "tmdb" || r === "tvdb");
  const usable = tables.filter(named);
  const askMedia = usable.some(needsMedia);
  const ready = usable.length > 0 && (!askMedia || media != null);

  const setRole = (ti: number, col: number, role: AutoRole) =>
    setTables((all) => all.map((x, i) => (i !== ti ? x : { ...x, roles: x.roles.map((r, c) => (c === col ? role : role !== "skip" && r === role ? "skip" : r)) })));

  return (
    <Sheet title={t.importAutoReviewTitle} onClose={onCancel}>
      <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 16, paddingBottom: 8 }}>
          <Text size={12} muted style={{ lineHeight: 19 }}>{t.importAutoReviewHint}</Text>
          {askMedia ? (
            <View style={{ gap: 4 }}>
              <Text size={12} weight="600" muted>{t.importAutoMediaLabel}</Text>
              <Segmented items={[{ id: "movie", label: t.importAutoMovies }, { id: "tv", label: t.importAutoShows }]} value={media ?? ""} onChange={(v) => setMedia(v as AutoOptions["media"])} />
            </View>
          ) : null}
          <View style={{ gap: 4 }}>
            <Text size={12} weight="600" muted>{t.importAutoStatusLabel}</Text>
            <Segmented items={[{ id: "watched", label: t.importAutoWatched }, { id: "plan", label: t.importAutoPlan }]} value={status} onChange={(v) => setStatus(v as AutoOptions["status"])} />
          </View>
          {askMedia && media == null ? <Text size={12} color={tokens.error}>{t.importAutoNeedMedia}</Text> : null}

          {tables.map((x, ti) => (
            <View key={x.file} style={{ borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.divider }}>
                <Text size={12} weight="700" numberOfLines={1} style={{ flex: 1, writingDirection: "ltr" }}>{x.file}</Text>
                <Text size={11} muted>{t.importAutoRows(num(x.rows.length, locale))}</Text>
              </View>
              {!named(x) ? <Text size={12} color={tokens.error} style={{ paddingHorizontal: 12, paddingTop: 8 }}>{t.importAutoNoName}</Text> : null}
              {x.headers.map((h, col) => {
                const key = `${ti}:${col}`;
                const role = x.roles[col];
                const samples = x.rows.map((r) => r[col]).filter(Boolean).slice(0, 2);
                return (
                  <View key={key} style={{ borderTopWidth: col ? 1 : 0, borderTopColor: tokens.divider }}>
                    <Pressable
                      onPress={() => setOpen(open === key ? null : key)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open === key }}
                      accessibilityLabel={`${h}: ${t.importAutoRoles[role]}`}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size={14} weight="600" numberOfLines={1}>{h || "—"}</Text>
                        <Text size={12} muted numberOfLines={1}>{samples.join(" · ") || "—"}</Text>
                      </View>
                      <Chip label={t.importAutoRoles[role]} active={role !== "skip"} onPress={() => setOpen(open === key ? null : key)} />
                    </Pressable>
                    {open === key ? (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 12 }}>
                        {AUTO_ROLES.map((r) => (
                          <Chip
                            key={r}
                            label={t.importAutoRoles[r]}
                            active={role === r}
                            onPress={() => {
                              setRole(ti, col, r);
                              setOpen(null);
                            }}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          {skipped.length ? <Text size={11} muted>{t.importAutoSkipped(skipped.join(" · "))}</Text> : null}
        </View>
      </ScrollView>
      <View style={{ paddingTop: 12 }}>
        <Button label={t.importAutoGo} disabled={!ready} onPress={() => ready && onImport(usable, { media: media ?? "movie", status })} style={{ opacity: ready ? 1 : 0.5 }} />
      </View>
    </Sheet>
  );
}
