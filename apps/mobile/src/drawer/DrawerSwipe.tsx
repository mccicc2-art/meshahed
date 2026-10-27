import React, { useMemo } from "react";
import { I18nManager, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { makeMutable, withTiming, Easing } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { NativeRoot } from "../shell";
import { DRAWER_MS, drawerP, drawerStore, drawerWidth } from "./store";

/**
 * ====== 🆕 D-1506 — سحبةُ فتح القائمة الجانبيّة (أحمد ٢٧ أكتوبر: «إذا سويت إيماء في الرئيسية لليمين تظهر، وفي العربي لليسار») ======
 *
 * يلفّ شاشةً جذراً (الرئيسيّة اليوم). **الإصبعُ يحرّك `drawerP` نفسَها** فاللوحُ يتبعه على خيط الواجهة، والإفلاتُ يحسم: ثلثُ
 * العرض أو سرعةٌ > ٤٠٠px/s نحو الداخل ⇒ تُفتح، وإلّا تعود.
 *
 * 🔑 **عتباتُ D-953 حرفاً** (قفلُ `TabSlide`): لا سؤالَ قبل ٢٠px، والأفقُ يغلب العمودَ بـ١٫٦ — فالتمريرُ العموديُّ يكسب إن تحرّك
 * أوّلاً. **والاتّجاهُ شرطُ القفل**: الاتّجاهُ المعاكس يُسقط الإيماءةَ فوراً (لا تتنازع مع شيء).
 * ⚖️ **صفوفُ البوسترات الأفقيّة تكسب اللمسةَ التي تبدأ فوقها** (`requestDisallowInterceptTouchEvent` — كما في `TabSlide`)، فالسحبةُ
 * تفتح من الرأس وعناوين الأقسام والبطاقات العريضة والفراغ بين الصفوف. وفرضُها فوق الصفوف يكسر تمريرَها — رفضناه.
 * ⚖️ **وفي أندرويد بالإيماءات**: السحبُ من حافّة الشاشة نفسِها «رجوعُ» النظام ولا يصل التطبيق — يبدأ الإصبعُ داخلَها قليلاً.
 */
const LOCK_DX = 20;
const TILT = 1.6;
const FLING = 400;

export function DrawerSwipe({ from, enabled, children }: { from: NativeRoot; enabled: boolean; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  /* اتّجاهُ الفتح: نحو داخل الشاشة من طرف القائمة — يمينٌ في الإنجليزيّة (+)، يسارٌ في العربيّة (−) */
  const dir = I18nManager.isRTL ? -1 : 1;
  const gesture = useMemo(() => {
    const W = drawerWidth(width);
    const x0 = makeMutable(0);
    const y0 = makeMutable(0);
    return Gesture.Pan()
      .enabled(enabled)
      .manualActivation(true)
      .onTouchesDown((e, m) => {
        const t = e.changedTouches[0];
        if (t) {
          x0.value = t.absoluteX;
          y0.value = t.absoluteY;
        }
        /* القائمةُ مفتوحةٌ أو تتحرّك: اللوحُ وحجابُه يأخذان اللمس، لا هذه */
        if (drawerP.value > 0.01) m.fail();
      })
      .onTouchesMove((e, m) => {
        const t = e.allTouches[0];
        if (!t) return;
        const dx = t.absoluteX - x0.value;
        const dy = t.absoluteY - y0.value;
        if (!(Math.abs(dx) > LOCK_DX && Math.abs(dx) > TILT * Math.abs(dy))) return;
        if (dx * dir <= 0) {
          m.fail();
          return;
        }
        m.activate();
      })
      .onStart(() => {
        scheduleOnRN(drawerStore.beginDrag, from);
      })
      .onUpdate((e) => {
        /* القفلُ بعد ٢٠px: تُطرح كي لا يقفز اللوحُ عند القفل */
        const d = Math.max(0, e.translationX * dir - LOCK_DX);
        drawerP.value = Math.min(1, d / W);
      })
      .onEnd((e) => {
        const p = drawerP.value;
        const v = e.velocityX * dir;
        if (p > 1 / 3 || v > FLING) {
          drawerP.value = withTiming(1, { duration: Math.round(DRAWER_MS * (1 - p)) + 60, easing: Easing.out(Easing.cubic) });
        } else {
          drawerP.value = withTiming(0, { duration: Math.round(DRAWER_MS * p) + 60, easing: Easing.out(Easing.cubic) }, (done) => {
            if (done) scheduleOnRN(drawerStore.settled);
          });
        }
      });
  }, [width, dir, enabled, from]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1 }} collapsable={false}>
          {children}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
