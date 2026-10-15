import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ApiError, filePart, postForm } from "../api";
import { shrinkForUpload } from "../imageShrink";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { Sheet } from "../library/Sheet";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { MSG_TEXT_MAX } from "@/core/contracts/messages";
import type { MsgImagePayload } from "../contracts";

/**
 * ====== خانةُ الكتابة في المحادثة — واحدةٌ للخاص والقروب ======
 *
 * 🔑 **منقولةٌ بحرفها من `ConversationScreen`** (D-1380 · D-1387 · D-1403) لتقرأها شاشةُ القروب أيضاً — نسخةٌ ثانيةٌ من الخانة
 * كانت ستفترق عن الأولى في أوّل إصلاح. الحالةُ تبقى في الشاشة (النصُّ · الصورة · الاقتباس)، وهنا الرسمُ والرفعُ ولوحةُ المفاتيح.
 */
export type ChatPic = { local: string; path: string | null };

/** ما يغطّيه لوحُ المفاتيح أسفلَ الشاشة فعلاً — بقياس موضع الجذر (يعمل سواءٌ صغّر النظامُ النافذةَ أم لا) */
export function useKeyboardInset(rootRef: React.RefObject<View | null>): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, (e) => {
      const top = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setKb(Math.max(0, Math.round(y + h - top))));
    });
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, [rootRef]);
  return kb;
}

/** صورةُ الرسالة: تُصغَّر وتُرفع فورَ اختيارها (`path` حين يعود الخادم)، والفشلُ يقول سببه */
export function usePicUpload(say: (m: string) => void) {
  const { t } = useApp();
  const [pic, setPic] = useState<ChatPic | null>(null);
  const pickImage = useCallback(async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if (a.mimeType && !a.mimeType.startsWith("image/")) return say(t.errPickImage);
    let local: string | null = null;
    try {
      local = await shrinkForUpload(a.uri);
      const mine = local;
      setPic({ local: mine, path: null });
      const form = new FormData();
      form.append("file", filePart(mine, "dm.jpg", "image/jpeg"));
      const out = await postForm<MsgImagePayload>("/api/v1/me/messages/image", form);
      /* أُزيلت أو استُبدلت وهي تُرفع ⇒ لا تعود */
      setPic((cur) => (cur && cur.local === mine ? { ...cur, path: out.path } : cur));
    } catch (e) {
      setPic((cur) => (cur && cur.local === local ? null : cur));
      const api = e instanceof ApiError ? e : null;
      const known = api ? (t as unknown as Record<string, unknown>)[api.error.message_key] : null;
      const reason = typeof known === "string" ? known : api ? `${api.error.code} ${api.status}` : e instanceof Error ? e.message.slice(0, 80) : "";
      say(api?.error.message_key === "apiImageTooLarge" ? t.errTooLarge : `${t.errUpload}${reason}`);
    }
  }, [say, t]);
  return { pic, setPic, pickImage };
}

/** الخانة: الاقتباسُ فوقها · الصورةُ قبل الإرسال · «+» · الحقلُ الممتدّ · «أرسل» */
export function ChatDock({
  text,
  onText,
  pic,
  onClearPic,
  quote,
  inputRef,
  kb,
  bottomInset,
  sending,
  canSend,
  onAttach,
  onSend,
  onRestingHeight,
}: {
  text: string;
  onText: (v: string) => void;
  pic: ChatPic | null;
  onClearPic: () => void;
  /** الاقتباسُ المرسوم (`ReplyQuote`) أو لا شيء */
  quote: React.ReactNode;
  inputRef: React.RefObject<TextInput | null>;
  kb: number;
  bottomInset: number;
  sending: boolean;
  canSend: boolean;
  onAttach: () => void;
  onSend: () => void;
  /** ارتفاعُ الخانة بلا لوحة مفاتيح وبسطرٍ واحد — الخلفيّةُ تُمطّ إلى حافّتها (D-1386) */
  onRestingHeight?: (h: number) => void;
}) {
  const { t, tokens } = useApp();
  /* 🆕 D-1387 — الحقلُ سطرٌ واحدٌ بارتفاع «أرسل» (٤٠) ويكبر ٢٢ مع كلِّ سطرٍ حتى أربعة: النموُّ من الحقل نفسِه (`minHeight`/`maxHeight`)
     لا من `contentSize` — أندرويد يعدّ الحشوَ فيه فكان يُضاف مرّتين فيولد السطرُ الواحدُ بارتفاع ٥٨ (لقطةُ أحمد ١٤ أكتوبر) */
  const [oneLine, setOneLine] = useState(true);
  return (
    <View
      onLayout={(e) => {
        if (kb === 0 && oneLine && !pic && !quote) onRestingHeight?.(Math.round(e.nativeEvent.layout.height));
      }}
      style={{ gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: (kb > 0 ? kb : bottomInset) + 10, borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.bg }}
    >
      {/* 🆕 D-1403 — المقتبَسُ فوق الحقل كالواتس، و✕ يلغيه */}
      {quote}
      {/* 🆕 D-1387 — الصورةُ قبل الإرسال: مصغّرةٌ فوق الحقل و✕ يلغيها؛ ودائرةُ انتظارٍ عليها وهي تُرفع */}
      {pic ? (
        <View style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", backgroundColor: tokens.surface2 }}>
          <Image source={{ uri: pic.local }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          {!pic.path ? (
            <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
          <Pressable
            onPress={onClearPic}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t.talkRemoveImage}
            style={{ position: "absolute", top: 3, end: 3, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" }}
          >
            <Icon name="close" size={11} color="#fff" />
          </Pressable>
        </View>
      ) : null}
      {/* يلزم الزرّان قاعَ الحقل وهو ينمو (`items-end`) */}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {/* 🆕 D-1387 — زرٌّ واحدٌ «+» (أحمد: «مكان الزر واحد») يفتح ورقةً بخيارين: صورة · GIF */}
        <Pressable
          onPress={() => {
            haptic.pick();
            onAttach();
          }}
          disabled={sending}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t.msgAttach}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name="plus" size={18} color={tokens.fg} />
        </Pressable>
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          ref={inputRef}
          value={text}
          onChangeText={(v) => onText(v.slice(0, MSG_TEXT_MAX))}
          multiline
          maxLength={MSG_TEXT_MAX}
          placeholder={t.shareReplyPlaceholder}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={t.shareReplyPlaceholder}
          onLayout={(e) => setOneLine(e.nativeEvent.layout.height < 50)}
          style={{ flex: 1, minWidth: 0, minHeight: 22 + 18, maxHeight: 4 * 22 + 18, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left", textAlignVertical: "center" }}
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t.shareReplySend}
          style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: canSend ? 1 : 0.4, transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <Text size={12} weight="700" color={tokens.onAccent}>{t.shareReplySend}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** 🆕 D-1387 — ورقةُ «+»: الورقةُ الواحدة بخيارين — «صورة» تفتح الاستوديو و«GIF» المنتقي */
export function AttachSheet({ onClose, onImage, onGif }: { onClose: () => void; onImage: () => void; onGif: () => void }) {
  const { t, tokens } = useApp();
  return (
    <Sheet title={t.msgAttach} onClose={onClose}>
      <Pressable
        onPress={() => {
          onClose();
          /* 🔴 D-1404 (مقطعُ مشعل على الآيفون، ١٥ أكتوبر: «صورة» تقفل الورقةَ ولا يفتح الاستوديو، والـGIF يعمل): iOS لا يعرض
             نافذةً من النظام والورقةُ (`Modal`) ما زالت تُغلق — يتجاهل الطلبَ بصمت. الاستوديو يُفتح بعد انتهاء
             إغلاقها (حركةُ الانزلاق ~٣٠٠ms)؛ والـGIF نافذتُنا نحن فلا يمسّه ذلك، وأندرويد لا قيدَ عليه */
          if (Platform.OS === "ios") setTimeout(onImage, 450);
          else onImage();
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
          <Icon name="image" size={17} color={tokens.fg} />
        </View>
        <View>
          <Text size={15}>{t.msgPickImage}</Text>
          <Text size={12} muted>{t.msgPickImageSub}</Text>
        </View>
      </Pressable>
      <View style={{ height: 1, backgroundColor: tokens.divider }} />
      <Pressable
        onPress={() => {
          onClose();
          onGif();
        }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
          <Text size={11} weight="800">GIF</Text>
        </View>
        <View>
          <Text size={15}>{t.msgPickGif}</Text>
          <Text size={12} muted>{t.msgPickGifSub}</Text>
        </View>
      </Pressable>
    </Sheet>
  );
}
