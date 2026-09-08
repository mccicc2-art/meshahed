import React from "react";
import { I18nManager, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useApp } from "../state";
import { Icon, type IconName } from "../icons";
import { Text } from "../ui";
import { radius } from "../theme";
import type { CardItem } from "./PosterCard";

/**
 * ====== قائمةُ الضغط المطوَّل — نسخةُ `HoldMenu` في `LibraryGrid.tsx` ======
 * (Phase 11 · B3، D-936 — B0 §٣.٢ G5: ستّةُ صفوفٍ مرئيّة بالترتيب نفسِه)
 *
 * 🔑 **منسدلةٌ لا ورقة** (D-376): لوحٌ `min-w-52 rounded-2xl` بحدِّ `border` على
 * `elevated/95` وظلّ، صفوفٌ `px-4 py-2.5 gap-3 text-14`، الرمزُ ١٨ بلونه
 * (`muted` محايداً · `success` · `error`). الرموزُ من `src/icons.tsx`
 * (مساراتُ `Icon.tsx` نفسُها).
 *
 * 🔑 **الصفوفُ بشرط الويب حرفاً**: موقوفٌ ⇢ «تابع من جديد» وحدَه · مسلسلٌ غيرُ
 * مكتمل ⇢ «الحلقة التالية» · مكتمل ⇢ «أشاهده من جديد» · ثمّ «شاهدته كاملاً»
 * (نجاح) · «تعليقك» (ينتقل إلى صفحة العمل في الـWebView — KNOWN_GAP-9) ·
 * «بطاقة حمراء» (خطر) آخِراً. **والفعلُ نفسُه يجري في الخادم** عبر
 * `/api/v1/track/*` (الحلقةُ التالية وتعليمُ الكلّ وإعادةُ المشاهدة دوالُّ
 * الويب نفسُها — D-145).
 *
 * 📐 **الموضع**: تحت البطاقة محاذيةً لطرفها النهائيّ (`align="end"`) كما في
 * الويب؛ وإن لم تسع الشاشةُ تحتها تُرفع فوقها. **`Modal` شفّاف** لا عنصرٌ
 * داخل الصفّ: الصفُّ الأفقيُّ يقصّ ما يخرج عنه.
 */
export type HoldAction = "resume" | "next" | "rewatch" | "all" | "review" | "drop";

export type Anchor = { x: number; y: number; width: number; height: number };

const PANEL_W = 208; // min-w-52
const ROW_H = 40; // py-2.5 + سطرٌ 14/20
const GAP = 6;

export function HoldMenu({
  item,
  anchor,
  busy,
  onAction,
  onClose,
}: {
  item: CardItem;
  anchor: Anchor;
  busy: boolean;
  onAction: (a: HoldAction) => void;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const { width: W, height: H } = useWindowDimensions();

  const rows: { key: HoldAction; icon: IconName; label: string; tone?: "success" | "danger" }[] =
    item.dropped
      ? [{ key: "resume", icon: "play", label: t.resumeWatching }]
      : [
          ...(item.kind === "tv" && !item.completed ? [{ key: "next" as const, icon: "play" as const, label: t.markNextEp }] : []),
          ...(item.kind === "tv" && item.completed ? [{ key: "rewatch" as const, icon: "repeat" as const, label: t.rewatchBtn }] : []),
          { key: "all", icon: "check-line", label: t.markAllWatched, tone: "success" },
          { key: "review", icon: "star", label: t.reviewSectionTitle },
          { key: "drop", icon: "card", label: t.dropTitle, tone: "danger" },
        ];

  const panelH = rows.length * ROW_H + 8;
  /* محاذاةُ الطرف النهائيّ: في RTL الطرفُ النهائيُّ يسار البطاقة */
  let left = I18nManager.isRTL ? anchor.x : anchor.x + anchor.width - PANEL_W;
  left = Math.max(8, Math.min(left, W - PANEL_W - 8));
  let top = anchor.y + anchor.height + GAP;
  if (top + panelH > H - 8) top = Math.max(8, anchor.y - panelH - GAP);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.closeLabel} />
      <View
        style={{
          position: "absolute",
          left,
          top,
          width: PANEL_W,
          paddingVertical: 4,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tokens.border,
          backgroundColor: tokens.elevated,
          shadowColor: "#000",
          shadowOpacity: 0.45,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        {rows.map((r) => {
          const color = r.tone === "success" ? tokens.success : r.tone === "danger" ? tokens.error : tokens.muted;
          const disabled = busy && r.key !== "review";
          return (
            <Pressable
              key={r.key}
              disabled={disabled}
              onPress={() => onAction(r.key)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                minHeight: ROW_H,
                backgroundColor: pressed ? tokens.surface2 : "transparent",
                opacity: disabled ? 0.5 : 1,
                borderRadius: radius.sm,
              })}
            >
              <Icon name={r.icon} size={18} color={color} />
              <Text size={14}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}
