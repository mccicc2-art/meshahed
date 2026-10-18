import React from "react";
import * as WebBrowser from "expo-web-browser";
import { Text } from "./ui";
import { loopzPath, richTokens } from "@/core/richText";

/**
 * ====== 🆕 D-1443 — النصُّ الغنيّ في التطبيق: الرسائلُ والنقاشُ برسمٍ واحد ======
 *
 * المسحُ في `core/richText` (للويب أيضاً)، والرسمُ هنا: مقاطعُ `Text` داخل `Text` — كلُّ مقطعٍ يأخذ خطَّ حروفه (عربيّ/لاتينيّ)
 * كالنصّ الكامل. وُلد في فقاعة الرسالة (D-1436 · D-1439) وانتقل إلى هنا حين طلبه أحمد في النقاش («كل المزايا اللي عملناها في
 * الرسائل الخاصة اعملها في المناقشات») — نسخةٌ ثانيةٌ في الغرفة كانت ستفترق عن الأولى في أوّل إصلاح.
 * - الرابطُ: لوبز ⇒ الشاشةُ الأصليّة (`onPath`)، وغيرُه متصفّحٌ داخل التطبيق يُغلق بسحبة. لونُه `linkColor` مسطّراً.
 * - المنشن: من في `mentions` وحدهم — بوزنٍ أثقل ومسطَّراً بلون النصّ نفسِه، ولمستُه `onMention`.
 */
export function openLink(href: string, onPath?: (path: string) => void) {
  const path = loopzPath(href);
  if (path && onPath) return onPath(path);
  try {
    new URL(href);
  } catch {
    return;
  }
  void WebBrowser.openBrowserAsync(href).catch(() => {});
}

type Weight = "400" | "500" | "600" | "700";

export function richNodes(
  str: string,
  o: {
    size: number;
    weight?: Weight;
    color: string;
    linkColor: string;
    chat?: boolean;
    content?: boolean;
    mentions?: ReadonlySet<string>;
    onMention?: (username: string) => void;
    onPath?: (path: string) => void;
  },
): React.ReactNode {
  const tokens = richTokens(str, (n) => !!o.mentions?.has(n));
  if (tokens.length === 1 && tokens[0].kind === "text") return str;
  const base = { size: o.size, weight: o.weight, chat: o.chat, content: o.content };
  return tokens.map((tk, i) =>
    tk.kind === "text" ? (
      <Text key={i} {...base} color={o.color}>
        {tk.text}
      </Text>
    ) : tk.kind === "mention" ? (
      <Text key={i} {...base} weight="700" color={o.color} style={{ textDecorationLine: "underline" }} onPress={o.onMention ? () => o.onMention!(tk.name) : undefined}>
        {tk.text}
      </Text>
    ) : (
      <Text key={i} {...base} color={o.linkColor} style={{ textDecorationLine: "underline" }} onPress={() => openLink(tk.href, o.onPath)}>
        {tk.text}
      </Text>
    ),
  );
}
