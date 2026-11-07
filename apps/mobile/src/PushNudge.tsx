import { useEffect, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { useApp } from "./state";
import { Button, Text } from "./ui";
import { Icon } from "./icons";
import { Sheet } from "./library/Sheet";
import { push } from "./push";
import { session } from "./session";
import { haptic } from "./haptics";

/**
 * ====== 🆕 T348 — ورقةُ «الإشعارات موقوفة» (أحمد ٧ نوفمبر: «اطلب من الكل يعطي صلاحية للاشعارات … غلط كبير ننتظره يدخل
 * الاعدادات ويسويها»، ثمّ «١ ج»: مرّةً واحدةً بعد التحديث) ======
 *
 * 🔑 **لمن لا تُعرض له نافذةُ النظام**: النظامان لا يعيدانها بعد رفضٍ نهائيّ (آيفون من أوّل «عدم السماح»، وأندرويد بعد
 * رفضين). فالورقةُ تشرح ما يفوته بنصوص صفوف «الإشعارات» نفسِها، وزرُّها يفتح صفحةَ Loopz في إعدادات الجهاز مباشرةً — أو
 * نافذةَ النظام إن كان ما زال يقدر أن يسأل. **ومن سُئل بنافذة النظام في هذا الدور لا تأتيه** (`push.ts` يختمها عند السؤال).
 *
 * ⚖️ الورقةُ الواحدة (`library/Sheet`) بموضعها السفليّ كما اعتُمدت صورتُها، وزرُّ المصنع الواحد. تُختم لحظةَ العرض: من أغلق
 * التطبيقَ وهي أمامه لا تعود إليه. وتنتظر أربع ثوانٍ بعد آخر تبدّلٍ في حالة الإذن، والتطبيقُ في الواجهة، فلا تقفز فوق إقلاعٍ
 * لم يرسم ولا فوق نافذة النظام.
 */
const ROWS = [
  { icon: "tv", label: "pushEpisodes", hint: "pushEpisodesSub" },
  { icon: "chat", label: "pushMessages", hint: "pushMessagesSub" },
  { icon: "person-check", label: "pushFollows", hint: "pushFollowsSub" },
] as const;
const WAIT_MS = 4000;

export function PushNudge() {
  const { t, tokens } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (AppState.currentState !== "active" || !push.nudgeDue()) return;
        push.markNudged();
        setOpen(true);
      }, WAIT_MS);
    };
    const offPush = push.subscribe(check);
    const offSession = session.onWelcome(check);
    check();
    return () => {
      if (timer) clearTimeout(timer);
      offPush();
      offSession();
    };
  }, []);

  if (!open) return null;
  const close = () => setOpen(false);
  return (
    <Sheet
      title={t.pushNudgeTitle}
      onClose={close}
      header={
        <View style={{ flex: 1, alignItems: "center", gap: 10, paddingTop: 4 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
            <Icon name="bell" size={26} color={tokens.accent} />
          </View>
          <Text size={20} weight="800" style={{ textAlign: "center" }}>
            {t.pushNudgeTitle}
          </Text>
          <Text size={14} muted style={{ textAlign: "center" }}>
            {t.pushNudgeSub}
          </Text>
        </View>
      }
    >
      <View style={{ gap: 2, marginTop: 4 }}>
        {ROWS.map((r) => (
          <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
              <Icon name={r.icon} size={18} color={tokens.fg} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="700">
                {t[r.label]}
              </Text>
              <Text size={13} muted>
                {t[r.hint]}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: 8, marginTop: 16 }}>
        <Button
          label={t.pushNudgeOpen}
          onPress={() => {
            haptic.pick();
            close();
            if (push.canAskNow()) void push.refresh(true);
            else void Linking.openSettings().catch(() => {});
          }}
        />
        <Button label={t.pushNudgeLater} variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}
