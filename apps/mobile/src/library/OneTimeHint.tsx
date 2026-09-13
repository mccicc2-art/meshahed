import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { qk, queryClient, write } from "../api";
import type { LibraryPayload, UiStateBody } from "../contracts";

/**
 * ====== تلميحٌ لمرّةٍ واحدة — نسخةُ `OneTimeHint` (الويب) ======
 * (D-954 — «اضغط مطوّلاً على أي بطاقة لإجراءات سريعة» في المكتبة الأصليّة)
 *
 * 🔑 **الحسابُ مصدرُ الحقيقة لا الجهاز** (حكمُ أحمد ١٩ أغسطس، هجرة ١٢١):
 * المقروءُ يصل في `LibraryPayload.hints`، **ولا SecureStore ولا ذاكرةَ جهازٍ
 * ثانية** — فمن قرأه في الويب لا يراه هنا، والعكس. **والتعليمُ عند الإغلاق أو
 * عند مغادرة الشاشة بعد أوّل عرضٍ — أيُّهما أسبق** (كما في الويب) فلا يطارد أحداً.
 *
 * 📐 كما في الويب: `rounded-xl` ١٢ · حدٌّ بلون التمييز ٢٥٪ وأرضيّةٌ ٥٪ ·
 * `px-3 py-2 text-12 text-muted` · أيقونةٌ ١٤ بلون التمييز · زرُّ إغلاقٍ ٢٨.
 * **التفاؤلُ في الكاش**: يُدرج المعرّفُ في `hints` فوراً فلا يعود التلميحُ
 * إن أُعيد الرسم قبل ردّ الخادم.
 */
export function OneTimeHint({ id, text }: { id: string; text: string }) {
  const { t, tokens } = useApp();
  const [gone, setGone] = useState(false);
  const marked = useRef(false);

  const markSeen = () => {
    if (marked.current) return;
    marked.current = true;
    queryClient.setQueryData<LibraryPayload>(qk.tag("me:library"), (prev) =>
      prev ? { ...prev, hints: [...new Set([...(prev.hints ?? []), id])] } : prev,
    );
    /* الفشلُ صامت: سيظهر مرّةً أخرى — أهونُ الشرَّين، كما في الويب */
    void write<{ ok: boolean }>("/api/v1/me/prefs/ui-state", { addHints: [id] } satisfies UiStateBody).catch(() => {});
  };

  /* مغادرةُ الشاشة بعد أوّل عرضٍ تكفي إعلاناً بالقراءة */
  useEffect(() => () => markSeen(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (gone) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: tokens.accent + "40",
        backgroundColor: tokens.accent + "0D",
        paddingStart: 12,
        paddingEnd: 4,
        paddingVertical: 6,
      }}
    >
      <Icon name="sparkle-star" size={14} color={tokens.accent} />
      <Text size={12} muted style={{ flex: 1, lineHeight: 18 }}>{text}</Text>
      <Pressable
        onPress={() => {
          markSeen();
          setGone(true);
        }}
        hitSlop={8}
        accessibilityLabel={t.closeLabel}
        style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="close" size={14} color={tokens.muted} />
      </Pressable>
    </View>
  );
}
