import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";

/**
 * ====== الورقةُ السفليّة الواحدة — نسخةُ `ui/Sheet.tsx` (الويب، `anchor="bottom"`) ======
 *
 * 🔑 **ورقةٌ واحدةٌ في التطبيق** (القاعدة ٣): حجابٌ `black/60` · لوحٌ
 * `rounded-t-sheet` (٢٢) بحدِّ `border` بلا حدٍّ سفليّ على `elevated` ·
 * مقبضٌ `w-9 h-1` بلون الحدّ · رأسٌ `px-5 pt-4 pb-3` بعنوان `text-15 font-bold`
 * · والمحتوى `px-4 pb-5`. **ورقةٌ ثانيةٌ بشكلٍ آخر عيبٌ يُبلَّغ.**
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.6)" }]} onPress={onClose} accessibilityLabel={t.closeLabel} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <View
          style={{
            maxHeight: "88%",
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: tokens.border,
            backgroundColor: tokens.elevated,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View style={{ height: 44, alignItems: "center", justifyContent: "center", marginBottom: -16 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.border }} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <Text size={15} weight="700" numberOfLines={2} style={{ flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 }}>
              <Icon name="close" size={18} color={tokens.muted} />
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 16, gap: 20 }}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
