import React, { useState } from "react";
import { I18nManager, Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { navHeight } from "../BottomNav";
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
export type HoldAction = "resume" | "next" | "rewatch" | "all" | "review" | "drop" | "towatch" | "dismiss";

/**
 * 🆕 D-978 — **القائمةُ نفسُها لبطاقات «اكتشف»** (بلاغُ أحمد بلقطة: «في الويب إذا
 * ضغطت مطوّلاً تظهر خيارات، في الأصليّة لا تظهر» — D-229: قاعدةٌ على أيّ بوستر
 * في Loopz). صفوفُها صفوفُ `PosterHold` الويب الأربعة: «للمشاهدة» (بحالتيه) ·
 * «شاهدته كلّه» · «تعليقك» · «غير مهتمّ» — **ولا «بطاقة حمراء»** (الإيقافُ فعلُ من
 * يتابع، ومن يتابع في المكتبة). **لوحٌ واحد لا ثانٍ**: `variant` يقرّر الصفوف.
 */
export type HoldVariant = "library" | "discover" | "list";

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
  variant = "library",
  inList = false,
}: {
  item: CardItem;
  anchor: Anchor;
  busy: boolean;
  onAction: (a: HoldAction) => void;
  onClose: () => void;
  /** D-978 — صفوفُ المكتبة (الافتراض) أم صفوفُ «اكتشف» */
  variant?: HoldVariant;
  /** «اكتشف» وحدَه: هل العملُ في «للمشاهدة» الآن؟ يقلب الصفَّ الأوّل */
  inList?: boolean;
}) {
  const { t, tokens } = useApp();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const rows: { key: HoldAction; icon: IconName; label: string; tone?: "success" | "danger" }[] =
    variant === "discover" || variant === "list"
      ? [
          { key: "towatch", icon: inList ? "check-line" : "plus", label: inList ? t.quickAddRemove : t.quickAddLabel },
          { key: "all", icon: "check-line", label: t.markAllWatched, tone: "success" },
          { key: "review", icon: "star", label: t.reviewSectionTitle },
          /* D-1036 — `list`: صفوفُ «اكتشف» **بلا «غير مهتمّ»** — صاحبُ القائمة اختار العملَ، وإخفاؤه من
             قائمة غيري ليس لي */
          ...(variant === "discover" ? [{ key: "dismiss" as const, icon: "eye-off" as const, label: t.notInterested }] : []),
        ]
      : item.dropped
      ? [{ key: "resume", icon: "play", label: t.resumeWatching }]
      : [
          ...(item.kind === "tv" && !item.completed ? [{ key: "next" as const, icon: "play" as const, label: t.markNextEp }] : []),
          ...(item.kind === "tv" && item.completed ? [{ key: "rewatch" as const, icon: "repeat" as const, label: t.rewatchBtn }] : []),
          { key: "all", icon: "check-line", label: t.markAllWatched, tone: "success" },
          { key: "review", icon: "star", label: t.reviewSectionTitle },
          { key: "drop", icon: "card", label: t.dropTitle, tone: "danger" },
        ];

  const panelH = rows.length * ROW_H + 8;
  /* 🔴 D-977 — **أرضيّةُ القائمة فوق الشريط السفليّ، وعرضُها على قدر سطرها** (بلاغُ
     أحمد بتسجيل على 1.8.5): القائمةُ كانت تهبط فوق شريط التنقّل وتكسر «الحلقة
     التالية +1» سطرين — الشاشةُ كلُّها كانت أرضيّتَها، والعرضُ ٢٠٨ ثابتاً. الأرضيّةُ
     الآن حافّةُ الشريط (`navHeight` نفسُه الذي يرفع التوست)، والعرضُ يبدأ من ٢٠٨
     ويتّسع للسطر الأطول حتّى حافّتَي الشاشة — كما تفعل `min-w-52` في الويب. */
  const floor = H - navHeight(insets.bottom) - 8;
  /* 🔴 D-990 — **القائمةُ تُقاس ثمّ تُوضع، ولا تخرج من الشاشة** (بلاغُ أحمد بلقطة، ١٦
     سبتمبر: بطاقةٌ على الطرف والقائمةُ مقطوعةٌ من اليسار): D-977 ربطت الحافّةَ النهائيّةَ
     بالبطاقة وتركت العرضَ يتّسع — فعلى بطاقةِ الطرف يتّسع خارجَ الشاشة. الآن العرضُ يُقاس
     (`onLayout`) ثمّ يُحسب اليسارُ ويُقصّ إلى `[8, W − عرض − 8]`، وأوّلُ إطارٍ قبل القياس
     غيرُ مرئيّ كي لا يقفز. */
  const [panelW, setPanelW] = useState<number | null>(null);
  const pw = panelW ?? PANEL_W;
  let left = I18nManager.isRTL ? anchor.x : anchor.x + anchor.width - pw;
  left = Math.max(8, Math.min(left, W - pw - 8));
  let top = anchor.y + anchor.height + GAP;
  if (top + panelH > floor) top = Math.max(8, anchor.y - panelH - GAP);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t.closeLabel} />
      <View
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w !== panelW) setPanelW(w);
        }}
        style={{
          position: "absolute",
          left,
          top,
          opacity: panelW === null ? 0 : 1,
          minWidth: PANEL_W,
          maxWidth: W - 16,
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
              <Text size={14} numberOfLines={1}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}
