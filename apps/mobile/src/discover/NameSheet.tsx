import React, { useState } from "react";
import { TextInput, View } from "react-native";
import { useApp } from "../state";
import { Button } from "../ui";
import { radius } from "../theme";
import { Sheet } from "../library/Sheet";
import { FILTER_NAME_MAX, sanitizeFilterName } from "@/core/savedFilters";

/**
 * تسميةُ فلترٍ محفوظ أو قائمةٍ ذكيّة من فلتر «اكتشف» (D-993) — الورقةُ المشتركة وحقلٌ
 * واحد، بالحدود نفسِها (`FILTER_NAME_MAX` · `sanitizeFilterName`) التي في
 * `SavedFiltersRow` الويب و`SmartListSheet` المكتبة.
 */
export function NameSheet({ title, placeholder, busy, onSubmit, onClose }: { title: string; placeholder: string; busy: boolean; onSubmit: (name: string) => void; onClose: () => void }) {
  const { tokens, locale } = useApp();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const clean = sanitizeFilterName(name);
  return (
    <Sheet title={title} onClose={onClose}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          onSubmitEditing={() => clean && onSubmit(clean)}
          maxLength={FILTER_NAME_MAX}
          placeholder={placeholder}
          placeholderTextColor={tokens.muted}
          returnKeyType="done"
          style={{ flex: 1, minHeight: 40, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 12, fontSize: 14, color: tokens.fg }}
        />
        <Button label={ar ? "حفظ" : "Save"} busy={busy} disabled={!clean} onPress={() => clean && onSubmit(clean)} />
      </View>
    </Sheet>
  );
}
