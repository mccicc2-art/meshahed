import React, { useEffect, useRef, useState } from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
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
  const dragY = useRef(new Animated.Value(0)).current;
  const sheetH = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        const h = sheetH.current || 400;
        if (g.dy > h * 0.25 || g.vy > 0.5) {
          Animated.timing(dragY, { toValue: h, duration: 160, useNativeDriver: true }).start(() => closeRef.current());
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start(),
    }),
  ).current;
  const grab = center ? {} : pan.panHandlers;

  return (
    <Modal transparent animationType={center ? "fade" : "slide"} visible onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: center ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.6)" }]} onPress={onClose} accessibilityLabel={t.closeLabel} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={center ? { flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: (kb > 0 ? kb : insets.bottom) + 12 } : { flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityLabel={header ? title : undefined}
          onLayout={(e) => {
            sheetH.current = e.nativeEvent.layout.height;
          }}
          style={{
            transform: [{ translateY: dragY }],
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
          }}
        >
          {center ? null : (
            <View {...grab} style={{ height: 44, alignItems: "center", justifyContent: "center", marginBottom: -16 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: tokens.border }} />
            </View>
          )}
          <View {...grab} style={{ flexDirection: "row", alignItems: header ? "center" : "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: center ? 18 : 20, paddingTop: center ? 18 : 16, paddingBottom: 12 }}>
            {header ? <View style={{ flex: 1, minWidth: 0 }}>{header}</View> : <Text size={15} weight="700" numberOfLines={2} style={{ flex: 1 }}>{title}</Text>}
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t.closeLabel} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 }}>
              <Icon name="close" size={18} color={tokens.muted} />
            </Pressable>
          </View>
          {center ? (
            /* هاتفٌ قصيرٌ ولوحةُ مفاتيحٍ مفتوحة: ما لا يتّسع يُمرَّر داخل الصندوق — زرُّ الحفظ لا يُقصّ أبداً */
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 20 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ paddingHorizontal: 16, gap: 20 }}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
