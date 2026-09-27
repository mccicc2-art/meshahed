import React, { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
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
/**
 * 🆕 D-1032 — **`placement="center"`: الورقةُ نفسُها منبثقةً في وسط الشاشة** (طلبُ أحمد بعد ثلاثة
 * تصاميم: «أبغى انبثاق في وسط الشاشة مع كتابة تعليق»). لم يكن في التطبيق انبثاقٌ وسطيّ — فهو
 * **موضعٌ ثانٍ للورقة الواحدة لا ورقةٌ ثانية**: الحجابُ وزرُّ الرجوع ومعالجةُ لوحة المفاتيح (D-1005)
 * واحدة؛ يتبدّل الموضعُ (وسطٌ بهامش ٢٠) والزوايا (٢٠ كلُّها بحدٍّ كامل، بلا مقبض — لا يُسحب ما في
 * الوسط) والحركةُ (تلاشٍ لا انزلاق). و`header` يحلّ محلَّ سطر العنوان لمن رأسُه أغنى من نصّ.
 *
 * ⚖️ **متى أيّهما** (قاعدةٌ تُسجَّل في `07`، وإلّا صار الاختيارُ مزاجاً): **الوسطُ لسؤالٍ يقاطع بعد
 * فعل** (التقييمُ بعد «شاهدته») ولكلِّ ما يشاركه المحتوى (فالتقييمُ شكلٌ واحدٌ أينما فُتح)؛
 * **والسفليّةُ لما يفتحه صاحبُه بنفسه** — الأدواتُ والفلاترُ والقوائم.
 * 🔑 لوحةُ المفاتيح في الوسط: ارتفاعُها حشوةٌ أسفلَ حاويةِ التوسيط فيتوسّط الصندوقُ ما بقي فوقها.
 */
/** نابضُ الارتداد — `Animated.spring({ bounciness: 4 })` محوَّلاً (انظر أعلى الإيماءة) */
const SPRING_BACK = { stiffness: 342.1, damping: 30.49, mass: 1 } as const;

/** الرأسُ يُسحب في الورقة السفليّة وحدَها — الوسطيّةُ لا تُسحب (D-1032) */
function Grab({ on, gesture, children }: { on: boolean; gesture: ReturnType<typeof Gesture.Pan>; children: React.ReactElement }) {
  return on ? <GestureDetector gesture={gesture}>{children}</GestureDetector> : children;
}

export function Sheet({
  title,
  onClose,
  children,
  placement = "bottom",
  header,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  placement?: "bottom" | "center";
  /** بديلُ سطر العنوان — يُرسم مكانَه وبجواره زرُّ الإغلاق نفسُه؛ و`title` يبقى اسمَها للقارئ الآليّ */
  header?: React.ReactNode;
}) {
  const { t, tokens } = useApp();
  const insets = useSafeAreaInsets();
  /**
   * 🔴 D-1005 — **الورقةُ ترتفع فوق لوحة المفاتيح على أندرويد** (بلاغُ أحمد بتسجيل على 1.9.1:
   * «لوحة المفاتيح تغطّي فما أشوف وش أكتب»): `KeyboardAvoidingView` يعمل على iOS، أمّا على
   * أندرويد فـ`Modal` بـ`statusBarTranslucent` لا يصله تصغيرُ النافذة (`adjustResize`) —
   * فتُقرأ اللوحةُ من حدثها وتُضاف حشوةً أسفل الورقة، فيبقى الحقلُ والزرُّ مرئيّين.
   */
  const center = placement === "center";
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  /**
   * 🆕 D-1045 (Phase 11-F · F5) — **المقبضُ يُسحب فيُغلق** (دَينٌ معلَنٌ في `05`: «مقبضٌ مرسومٌ ولا يُسحب — عنصرٌ
   * يوحي بما لا يفعل»). السحبُ من **المقبض وسطر العنوان وحدَهما**: محتوى الورقة قد يمرَّر عموديّاً (قائمةُ
   * الغلاف، ورقةُ الترتيب) ومن يسرق سحبَه يكسره. يُغلق عند ربع الارتفاع أو سرعةٍ > ٠٫٥، وإلّا يرتدّ بنابض.
   * الوسطيّةُ لا تُسحب (بلا مقبض — D-1032). **الورقةُ واحدةٌ كما كانت**: حركةٌ تُضاف لا مكوّنٌ ثانٍ.
   */
  /* 🆕 K2 — **السحبُ على خيط الواجهة** (`Gesture.Pan` + Reanimated): كان `PanResponder` يمرّر كلَّ حركةٍ للإصبع عبر
     JS. **الأرقامُ كما كانت حرفاً**: القفلُ بعد ٦px نزولاً والعمودُ يغلب الأفق · الإغلاقُ عند ربع الارتفاع أو ٠٫٥px/ms
     (= ٥٠٠px/s في وحدة RNGH) · الخروجُ ١٦٠ms بمنحنى `Animated.timing` الافتراضيّ · والارتدادُ نابضُ `bounciness: 4`
     نفسُه محوَّلاً بمعادلة React Native (`fromBouncinessAndSpeed(4, 12)` ⇒ صلابةٌ ٣٤٢٫١ · تخميدٌ ٣٠٫٤٩). */
  const dragY = useSharedValue(0);
  const sheetH = useSharedValue(0);
  const y0 = useSharedValue(0);
  const x0 = useSharedValue(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const grab = useMemo(() => {
    const close = () => closeRef.current();
    /* مقبضٌ ورأسٌ عنصران — لكلٍّ إيماءتُه (RNGH لا يشارك إيماءةً بين كاشفَين)، والمنطقُ واحد */
    const make = () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e) => {
          const t0 = e.changedTouches[0];
          if (t0) {
            x0.value = t0.absoluteX;
            y0.value = t0.absoluteY;
          }
        })
        .onTouchesMove((e, m) => {
          const t0 = e.allTouches[0];
          if (!t0) return;
          const dx = t0.absoluteX - x0.value;
          const dy = t0.absoluteY - y0.value;
          if (dy > 6 && Math.abs(dy) > Math.abs(dx)) m.activate();
          else if (Math.abs(dx) > 6 && Math.abs(dx) >= Math.abs(dy)) m.fail();
        })
        .onUpdate((e) => {
          dragY.value = Math.max(0, e.translationY);
        })
        .onEnd((e, ok) => {
          const h = sheetH.value || 400;
          if (ok && (e.translationY > h * 0.25 || e.velocityY > 500)) {
            dragY.value = withTiming(h, { duration: 160, easing: Easing.inOut(Easing.ease) }, (fin) => {
              if (fin) scheduleOnRN(close);
            });
          } else {
            dragY.value = withSpring(0, SPRING_BACK);
          }
        });
    return { handle: make(), head: make() };
  }, [dragY, sheetH, x0, y0]);
  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  return (
    <Modal transparent animationType={center ? "fade" : "slide"} visible onRequestClose={onClose} statusBarTranslucent>
      {/* K2 — الإيماءاتُ داخل `Modal` تحتاج جذرَها (نافذةٌ أخرى على أندرويد) */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: center ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.6)" }]} onPress={onClose} accessibilityLabel={t.closeLabel} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={center ? { flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: (kb > 0 ? kb : insets.bottom) + 12 } : { flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Reanimated.View
          accessibilityViewIsModal
          accessibilityLabel={header ? title : undefined}
          onLayout={(e) => {
            sheetH.value = e.nativeEvent.layout.height;
          }}
          style={[panel, {
            maxHeight: center ? "100%" : "88%",
            borderTopLeftRadius: center ? 20 : 22,
            borderTopRightRadius: center ? 20 : 22,
            borderBottomLeftRadius: center ? 20 : 0,
            borderBottomRightRadius: center ? 20 : 0,
            borderWidth: 1,
            borderBottomWidth: center ? 1 : 0,
            borderColor: tokens.border,
            /* D-1019 — **الورقةُ سوداءُ كالشاشة** (طلبُ أحمد بثلاث لقطات، ١٨ سبتمبر): كانت
               `elevated` (رماديٌّ داكن) فتبدو لوحاً طافياً بلونٍ آخر؛ السوادُ نفسُه مع الحدِّ
               العلويِّ والسِّترِ خلفها يكفيان لفصلها عمّا تحتها. */
            backgroundColor: tokens.bg,
            paddingBottom: center ? 16 : (kb > 0 ? kb : insets.bottom) + 20,
          }]}
        >
          {center ? null : (
            <GestureDetector gesture={grab.handle}>
              <View style={{ height: 44, alignItems: "center", justifyContent: "center", marginBottom: -16 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.border }} />
              </View>
            </GestureDetector>
          )}
          <Grab on={!center} gesture={grab.head}>
          <View style={{ flexDirection: "row", alignItems: header ? "center" : "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: center ? 18 : 20, paddingTop: center ? 18 : 16, paddingBottom: 12 }}>
            {header ? <View style={{ flex: 1, minWidth: 0 }}>{header}</View> : <Text size={15} weight="700" numberOfLines={2} style={{ flex: 1 }}>{title}</Text>}
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 }}>
              <Icon name="close" size={18} color={tokens.muted} />
            </Pressable>
          </View>
          </Grab>
          {center ? (
            /* هاتفٌ قصيرٌ ولوحةُ مفاتيحٍ مفتوحة: ما لا يتّسع يُمرَّر داخل الصندوق — زرُّ الحفظ لا يُقصّ أبداً */
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 20 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 20 }}>{children}</View>
          )}
        </Reanimated.View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
