import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, I18nManager, Modal, Pressable, StatusBar, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { File, Paths } from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { haptic } from "../haptics";
import { stampOf } from "./chatFormat";
import type { MsgImage } from "../contracts";

/**
 * ====== عارضُ صورة الرسالة بملء الشاشة — كالواتس (D-1402) ======
 *
 * 🔑 **الشاشةُ كلُّها للصورة** (كانت ورقةً وسطى بعنوان «صورة» وإطارٍ ٣:٤ يصغّر العريضةَ ويحيطها سواداً — لقطةُ أحمد
 * ١٥ أكتوبر): أسودُ تامّ، والصورةُ بعرض الشاشة كيفما كان شكلُها (`contain`). فوق: رجوعٌ واسمُ المرسِل ويومُ الإرسال
 * ووقتُه، ومشاركة. تحت: التعليقُ إن وُجد، و«رد…» يقفل العارضَ ويقتبس الصورةَ فوق الكتابة.
 *
 * 🔑 **الإيماءاتُ على خيط الواجهة** (Gesture Handler + Reanimated، كـ`TabSlide`): قرصةٌ تكبّر حتى ٤×، ولمستان
 * تبدّلان ١× ↔ ٢٫٥× حول موضع اللمس، والسحبُ يحرّك المكبَّرة؛ وغيرُ المكبَّرة يسحبها الإصبعُ لتحت فتقفل
 * (عتبةُ ١٢٠ أو سرعة). لمسةٌ واحدةٌ تخفي الشريطين وتعيدهما.
 *
 * ⚖️ **المشاركةُ لا «حفظ في الاستوديو»**: الحفظُ المباشر يحتاج إذنَ الصور ومكتبةً أصليّةً جديدة (بناءٌ مدفوع)، وورقةُ
 * المشاركة في النظام فيها «حفظ الصورة» أصلاً — فتصل الآن بتحديثٍ هوائيّ.
 */
const MAX = 4;
const DOUBLE = 2.5;

export function PhotoViewer({
  image,
  who,
  at,
  caption,
  onClose,
  onReply,
  onError,
}: {
  image: MsgImage;
  who: string;
  at: string;
  caption: string;
  onClose: () => void;
  /** غائبٌ ⇒ لا خانةَ «رد…» (رسالةٌ لم تصل الخادمَ بعد) */
  onReply?: () => void;
  onError: (text: string) => void;
}) {
  /* الألوانُ ثابتةٌ هنا لا من الرموز: العارضُ أسودُ في الثيمين كلّهما، كعارض الواتس والاستوديو */
  const { t } = useApp();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const [chrome, setChrome] = useState(true);
  const [sharing, setSharing] = useState(false);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const toggleChrome = useCallback(() => setChrome((c) => !c), []);

  /* الحركةُ لا تخرج الصورةَ من الشاشة: الإزاحةُ حدُّها نصفُ ما زاد عن الإطار */
  const clamp = (v: number, s: number, size: number) => {
    "worklet";
    const lim = Math.max(0, (size * s - size) / 2);
    return Math.min(lim, Math.max(-lim, v));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        tx.value = clamp(savedX.value + e.translationX, scale.value, W);
        ty.value = clamp(savedY.value + e.translationY, scale.value, H);
      } else {
        /* غيرُ المكبَّرة: لتحت فقط، والخلفيّةُ تبهت مع المسافة فيُرى أنّها ستقفل */
        ty.value = Math.max(0, e.translationY);
        fade.value = Math.max(0.25, 1 - ty.value / 500);
      }
    })
    .onEnd((e) => {
      if (savedScale.value > 1) {
        savedX.value = tx.value;
        savedY.value = ty.value;
        return;
      }
      if (ty.value > 120 || e.velocityY > 900) {
        scheduleOnRN(onClose);
        return;
      }
      ty.value = withTiming(0);
      fade.value = withTiming(1);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((e) => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        /* التكبيرُ حول موضع اللمستين لا حول المنتصف */
        const nx = clamp((W / 2 - e.x) * (DOUBLE - 1), DOUBLE, W);
        const ny = clamp((H / 2 - e.y) * (DOUBLE - 1), DOUBLE, H);
        scale.value = withTiming(DOUBLE);
        savedScale.value = DOUBLE;
        tx.value = withTiming(nx);
        ty.value = withTiming(ny);
        savedX.value = nx;
        savedY.value = ny;
      }
    });

  const singleTap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(toggleChrome);
  });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  const share = useCallback(async () => {
    if (sharing) return;
    haptic.pick();
    setSharing(true);
    try {
      /* الرابطُ مؤقّتٌ من مخزنٍ خاصّ: تُنزَّل نسخةٌ إلى ذاكرة التطبيق المؤقّتة ثمّ تُعطى ورقةَ النظام */
      const name = `loopz-${image.key.split("/").pop() ?? "photo.jpg"}`;
      const dest = new File(Paths.cache, name);
      if (dest.exists) dest.delete();
      const file = await File.downloadFileAsync(image.url, dest);
      const Sharing = await import("expo-sharing");
      await Sharing.shareAsync(file.uri, { mimeType: "image/jpeg", UTI: "public.jpeg", dialogTitle: t.msgShareImage });
    } catch (e) {
      onError(e instanceof Error ? e.message.slice(0, 80) : t.apiInternal);
    } finally {
      setSharing(false);
    }
  }, [image, sharing, t, onError]);

  const backRotate = I18nManager.isRTL ? "-90deg" : "90deg";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* الإيماءاتُ داخل `Modal` تحتاج جذرَها — نافذةٌ أخرى على أندرويد (كـ`Sheet`) */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <Reanimated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "#000" }, bgStyle]} />
        <GestureDetector gesture={gesture}>
          <Reanimated.View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, imgStyle]}>
            <Image source={{ uri: image.url, cacheKey: image.key }} style={{ width: W, height: H }} contentFit="contain" cachePolicy="memory-disk" />
          </Reanimated.View>
        </GestureDetector>

        {chrome ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <View style={{ height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, gap: 6 }}>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.convBackAria} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <View style={{ transform: [{ rotate: backRotate }] }}>
                  <Icon name="chevron-down" size={22} color="#fff" />
                </View>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="700" color="#fff" numberOfLines={1}>{who}</Text>
                <Text size={12} color="rgba(255,255,255,0.7)" numberOfLines={1}>{stampOf(at, t)}</Text>
              </View>
              <Pressable
                onPress={() => void share()}
                disabled={sharing}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t.msgShareImage}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: sharing ? 0.5 : 1 }}
              >
                <Icon name="share" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {chrome ? (
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 12, paddingHorizontal: 12, gap: 10, backgroundColor: caption ? "rgba(0,0,0,0.55)" : "transparent", paddingTop: caption ? 12 : 0 }}>
            {caption ? (
              <Text size={15} content color="#fff" style={{ lineHeight: 22, paddingHorizontal: 4 }}>{caption}</Text>
            ) : null}
            {onReply ? (
              <Pressable
                onPress={onReply}
                accessibilityRole="button"
                accessibilityLabel={t.msgReply}
                style={({ pressed }) => ({ height: 48, borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 })}
              >
                <Icon name="reply" size={18} color="rgba(255,255,255,0.75)" />
                <Text size={15} color="rgba(255,255,255,0.75)">{t.msgReplyPlaceholder}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
