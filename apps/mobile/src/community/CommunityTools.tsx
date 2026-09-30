import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { Sheet } from "../library/Sheet";
import { Segmented, Switch, ViewPrefsPane } from "../library/ToolsSheet";
import type { CommunityPagerTab } from "@/core/communityParams";
import type { CommunityPrefsBody } from "@/core/communityParams";
import type { TabPref } from "@/core/tabPrefs";
import type { CommunityPrefs } from "../contracts";

/**
 * ====== أدواتُ «المجتمع» — نسخةُ `CommunityTools.tsx` (الويب) · Phase 11-M · M2 ======
 *
 * 🔑 **الورقةُ الواحدة بتبويبيها** (D-325): **«أدوات»** سياقيّةٌ للتبويب المفتوح (D-306) — «مجتمعي»: الغرباءُ وتلميحُه ·
 * الترتيبُ «ذكيّ/الأحدث» **مقسّماً لا مفتاحين** (D-016) · الترجمةُ التلقائيّة (D-309)؛ «الأعمال»: «أعمالي المتابَعة فقط» ·
 * الترجمة؛ ثمّ «راسل صديقاً» في كلِّ سياق (D-306). **«عرض»** — ترتيبُ التبويبات وإخفاؤها وصفوفُ «الناس» (D-874) بالمكوّن
 * نفسِه الذي في المكتبة (`ViewPrefsPane`). و«مسح الكل» يظهر حين يخالف شيءٌ افتراضَه — وفي «أدوات» وحدَها (D-325/D-457).
 *
 * 🔑 **الكتابةُ بيد المستدعي** (`onPrefs` · `onTabs` · `onRails`): تفاؤليّةٌ في كاش الصفحة ثمّ `me/prefs/*` — **الكوكيزُ نفسُها
 * التي يقرؤها الويب** (جرّةٌ مشتركة، D-997)، فما يُضبط هنا يراه الويبُ (قائمةُ خالد M2). **وكلُّ مفتاحٍ يبدّل ويُبقي الورقة
 * مفتوحة** كالويب — الورقةُ تُغلق بيد صاحبها.
 */
type Pane = "do" | "see";

function SwitchRow({ icon, label, on, onToggle }: { icon: IconName; label: string; on: boolean; onToggle: () => void }) {
  const { tokens } = useApp();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={onToggle}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, paddingVertical: 8 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
        <Icon name={icon} size={18} color={tokens.fg} />
        <Text size={15} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Text>
      </View>
      <Switch on={on} />
    </Pressable>
  );
}

/** ما يخالف افتراضَه في التبويب المفتوح — الغرباءُ ظاهرون · «ذكيّ» · الترجمةُ تعمل (شريحتا «النقاشات» فوق الغرف لا هنا — D-1201) */
export function toolsOnFor(tab: CommunityPagerTab, p: CommunityPrefs | null): number {
  if (!p) return 0;
  const axes = tab === "activity" ? [!p.strangers, p.sort !== "smart", !p.translate] : tab === "talk" ? [!p.translate] : [];
  return axes.filter(Boolean).length;
}

export function CommunityTools({
  tab,
  tabTitle,
  prefs,
  tabLabels,
  onPrefs,
  onTabs,
  onRails,
  onMessage,
  onClose,
}: {
  tab: CommunityPagerTab;
  tabTitle: string;
  prefs: CommunityPrefs;
  tabLabels: Record<string, string>;
  onPrefs: (patch: CommunityPrefsBody) => void;
  onTabs: (next: TabPref[]) => void;
  onRails: (next: string[]) => void;
  onMessage: () => void;
  onClose: () => void;
}) {
  const { t, tokens, locale } = useApp();
  /* «أدوات» أوّلاً في كلِّ فتحة — تبويبُ الورقة حالةُ فتحتها لا تفضيلٌ يُحفظ (D-152/D-278) */
  const [pane, setPane] = useState<Pane>("do");
  const on = toolsOnFor(tab, prefs);

  const clearAll = () => {
    const patch: CommunityPrefsBody = {};
    if (tab === "activity") {
      if (!prefs.strangers) patch.strangers = true;
      if (prefs.sort !== "smart") patch.sort = "smart";
      if (!prefs.translate) patch.translate = true;
    } else if (tab === "talk") {
      if (!prefs.translate) patch.translate = true;
    }
    if (Object.keys(patch).length) onPrefs(patch);
  };

  const head = (text: string) => (
    <Text size={12} weight="700" muted style={{ marginBottom: 4, marginTop: 4 }}>{text}</Text>
  );

  return (
    <Sheet title={t.communityToolsTitle} onClose={onClose}>
      <Segmented
        items={[
          { id: "do", label: t.communityToolsTabDo },
          { id: "see", label: t.communityToolsTabSee },
        ]}
        value={pane}
        onChange={(v) => setPane(v as Pane)}
      />
      <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingTop: 12 }} showsVerticalScrollIndicator={false}>
        {pane === "do" ? (
          <View>
            {tab === "activity" ? (
              <View>
                {head(tabTitle)}
                <SwitchRow icon={prefs.strangers ? "eye" : "eye-off"} label={t.feedShowStrangers} on={prefs.strangers} onToggle={() => onPrefs({ strangers: !prefs.strangers })} />
                <Text size={12} muted style={{ lineHeight: 18, marginBottom: 12 }}>{t.feedShowStrangersHint}</Text>
                <Segmented
                  items={[
                    { id: "smart", label: t.feedSortSmart },
                    { id: "latest", label: t.feedSortLatest },
                  ]}
                  value={prefs.sort}
                  onChange={(v) => v !== prefs.sort && onPrefs({ sort: v as "smart" | "latest" })}
                />
                <View style={{ height: 8 }} />
                <SwitchRow icon="sparkles" label={t.autoTranslate} on={prefs.translate} onToggle={() => onPrefs({ translate: !prefs.translate })} />
              </View>
            ) : tab === "talk" ? (
              <View>
                {head(tabTitle)}
                {/* 🗑️ D-1201 — «أعمالي المتابَعة فقط» صار شريحةَ «أعمالي» فوق الغرف (أحمد: «احذفها ما نحتاجها») — بابان لفعلٍ واحدٍ خلل */}
                <SwitchRow icon="sparkles" label={t.autoTranslate} on={prefs.translate} onToggle={() => onPrefs({ translate: !prefs.translate })} />
              </View>
            ) : null}
            {tab !== "people" ? <View style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 10 }} /> : null}
            {head(t.communityTabInbox)}
            {/* «راسل صديقاً» — بابُ الرسائل (يبقى ويبيّاً حتى M4) */}
            <Pressable onPress={onMessage} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 8 }}>
              <Icon name="comment" size={18} color={tokens.fg} />
              <Text size={15}>{t.communityToolsMessage}</Text>
            </Pressable>
          </View>
        ) : (
          <ViewPrefsPane
            tab="community"
            tabs={prefs.tabs}
            tabLabels={tabLabels}
            onTabs={onTabs}
            hiddenRails={prefs.hidden_rails}
            onRails={onRails}
            railsTitle={locale === "en" ? `${t.communityTabPeople} rows` : `صفوف «${t.communityTabPeople}»`}
          />
        )}
      </ScrollView>
      {pane === "do" && on > 0 ? (
        <View style={{ borderTopWidth: 1, borderTopColor: tokens.divider, paddingTop: 12, marginTop: 8, flexDirection: "row" }}>
          <Button label={t.browseClearAll} variant="ghost" onPress={clearAll} />
        </View>
      ) : null}
    </Sheet>
  );
}
