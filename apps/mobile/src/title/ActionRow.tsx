import React from "react";
import { Pressable, View } from "react-native";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon, type IconName } from "../icons";
import { radius } from "../theme";

/**
 * ====== صفُّ الأفعال في صفحة العمل — D-1014 (١٨ سبتمبر ٢٠٢٦) ======
 *
 * **تصميمُ أحمد بعد جولةِ نماذج**: أربعةُ أفعالٍ في **إطارٍ واحدٍ ثابتِ اللون** بلا فواصل
 * ولا خلفيّةٍ للخانة النشطة — **الذي يتبدّل هو الأيقونةُ والكلمة**. حلَّ محلَّ أربعة أزرارٍ
 * في صفَّين (متابعة · شاهدته · إيقاف · قائمة) كانت تملأ نصفَ الشاشة.
 *
 * - 👁️ **للمشاهدة** — مفتاحٌ يضيف ويزيل من «للمشاهدة» (`follow`/`unfollow`)؛ وهي **ليست من
 *   قوائم المستخدم** ولا تظهر في ورقة «إلى قائمة».
 * - 🔖 **إلى قائمة** — يفتح ورقةَ قوائمِه (السؤالُ الوحيد الذي يحتاج جواباً)، ويقرأ «في قائمة»
 *   حين يكون العملُ في واحدةٍ منها. **مستقلٌّ تماماً عن «للمشاهدة»** (تصحيحُ أحمد).
 * - ❤️ **مفضّلة** — أحمر، بلا ورقة.
 * - ✅ **شاهدته** — أخضرُ النجاح (لونٌ واحدٌ للنجاح في النظام)، ويعلّم الحلقاتِ كلَّها.
 *
 * ⚖️ **البطاقةُ الحمراء في الضغطة المطوّلة على العين وحدَها** — لا «أوقف المتابعة» معها:
 * الضغطةُ القصيرةُ على العين **هي** إيقافُ المتابعة (`unfollow` نفسُها)، وفعلٌ يكرّر ما تفعله
 * الضغطةُ فوقه ازدواجٌ لا معنى له (حكمُ أحمد في النقاش).
 */
export type ActionKey = "watch" | "list" | "favorite" | "watched";

export function ActionRow({
  inWatch,
  inList,
  favorite,
  watched,
  busy,
  onPress,
  onHoldWatch,
}: {
  inWatch: boolean;
  inList: boolean;
  favorite: boolean;
  watched: boolean;
  busy?: ActionKey | null;
  onPress: (k: ActionKey) => void;
  /** البطاقةُ الحمراء — تغيب للأفلام */
  onHoldWatch?: () => void;
}) {
  const { t, tokens } = useApp();
  const cells: { key: ActionKey; icon: IconName; label: string; on: boolean; color: string }[] = [
    { key: "watch", icon: "eye", label: t.toWatchAction, on: inWatch, color: tokens.accent },
    { key: "list", icon: "bookmark", label: inList ? t.inListAction : t.toListAction, on: inList, color: tokens.accent },
    { key: "favorite", icon: favorite ? "heart-filled" : "heart", label: t.favoriteAction, on: favorite, color: tokens.error },
    { key: "watched", icon: "check-line", label: t.watchedAction, on: watched, color: tokens.success },
  ];
  return (
    <View style={{ flexDirection: "row", borderWidth: 1, borderColor: tokens.border, borderRadius: radius.card, overflow: "hidden" }}>
      {cells.map((c) => (
        <Pressable
          key={c.key}
          onPress={() => onPress(c.key)}
          onLongPress={c.key === "watch" ? onHoldWatch : undefined}
          delayLongPress={400}
          accessibilityRole="button"
          accessibilityState={{ selected: c.on, busy: busy === c.key }}
          accessibilityLabel={c.label}
          style={({ pressed }) => ({ flex: 1, paddingVertical: 10, alignItems: "center", opacity: pressed || busy === c.key ? 0.55 : 1 })}
        >
          <Icon name={c.icon} size={18} color={c.on ? c.color : tokens.fg} />
          <Text size={11} numberOfLines={1} color={c.on ? c.color : tokens.fg} style={{ marginTop: 3 }}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
