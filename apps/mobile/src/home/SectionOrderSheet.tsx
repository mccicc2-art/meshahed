import React, { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useApp } from "../state";
import { Text, Button } from "../ui";
import { Icon } from "../icons";
import { Sheet } from "../library/Sheet";
import { radius } from "../theme";
import { HOME_SECTIONS, homeSectionMeta, type HomeSection } from "@/core/homePrefs";

/**
 * ورقةُ ترتيب أقسام الرئيسية — `HomeSectionsOrder` + `SectionOrderList` الويبيّتان
 * (Phase 11-H · H4، D-595): السجلُّ كاملاً، الظاهرُ بترتيبه أوّلاً وله «أعلى/أسفل»
 * و«إخفاء»، والمخفيُّ مشطوباً في الذيل وله «إظهار» — ولا يُحذف قسمٌ من السجلّ
 * (يعود بضغطة). أسهمٌ لا سحبٌ: زرّان بأسمائهما أسهلُ قراءةً وأمتنُ على الهاتف
 * (وصفةُ الويب على الجوّال حرفاً). الحفظُ للمشترك (D-791): الخادمُ يرفض
 * `needsPlus` والشاشةُ تفتح `/plus`.
 */
export function SectionOrderSheet({ order, onClose, onDone }: { order: HomeSection[]; onClose: () => void; onDone: (next: HomeSection[]) => void }) {
  const { t, tokens } = useApp();
  const meta = homeSectionMeta(t);
  const [picked, setPicked] = useState<HomeSection[]>(order);
  const hidden = HOME_SECTIONS.filter((k) => !picked.includes(k));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= picked.length) return;
    const next = [...picked];
    [next[i], next[j]] = [next[j], next[i]];
    setPicked(next);
  };
  const iconBtn = (name: "chevron-down" | "eye" | "eye-off", label: string, onPress: () => void, disabled = false, flip = false) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel={label} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.3 : 1 }}>
      <View style={flip ? { transform: [{ rotate: "180deg" }] } : undefined}>
        <Icon name={name} size={18} color={tokens.fg} />
      </View>
    </Pressable>
  );
  const row = (k: HomeSection, i: number, shown: boolean) => (
    <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingStart: 12, paddingEnd: 4, borderRadius: radius.md, backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border, opacity: shown ? 1 : 0.55 }}>
      <Icon name={meta[k].icon as never} size={18} color={shown ? tokens.accent : tokens.muted} />
      <Text size={15} weight="600" numberOfLines={1} style={[{ flex: 1 }, shown ? null : { textDecorationLine: "line-through" }]}>{meta[k].label}</Text>
      {shown ? (
        <>
          {iconBtn("chevron-down", t.custMoveUp, () => move(i, -1), i === 0, true)}
          {iconBtn("chevron-down", t.custMoveDown, () => move(i, 1), i === picked.length - 1)}
          {iconBtn("eye-off", t.custHide, () => setPicked(picked.filter((x) => x !== k)), picked.length <= 1)}
        </>
      ) : (
        iconBtn("eye", t.custShow, () => setPicked([...picked, k]))
      )}
    </View>
  );
  return (
    <Sheet title={t.custArrange} onClose={onClose}>
      <Text size={12} muted style={{ paddingHorizontal: 16, marginBottom: 8 }}>{t.custOrderHint}</Text>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {picked.map((k, i) => row(k, i, true))}
        {hidden.map((k) => row(k, -1, false))}
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Button label={t.listDone} onPress={() => onDone(picked)} />
      </View>
    </Sheet>
  );
}
