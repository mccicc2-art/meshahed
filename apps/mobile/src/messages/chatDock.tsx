import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, TextInput, View, type TextInputInstance, type ViewInstance } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ApiError, filePart, postForm } from "../api";
import { shrinkForUpload } from "../imageShrink";
import { useImageCrop, type CropShape } from "../imageCrop";
import { useApp } from "../state";
import { Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { SYSTEM_FONT_CAP } from "../fontScale";
import { MSG_TEXT_MAX } from "@/core/contracts/messages";
import type { MsgImagePayload, SearchTitle, ThreadImagePayload } from "../contracts";
import { GifPanel, LoopzPanel } from "./PanelModes";

/**
 * ====== خانةُ الكتابة في المحادثة — واحدةٌ للخاص والقروب ======
 *
 * 🔑 **منقولةٌ بحرفها من `ConversationScreen`** (D-1380 · D-1387 · D-1403) لتقرأها شاشةُ القروب أيضاً — نسخةٌ ثانيةٌ من الخانة
 * كانت ستفترق عن الأولى في أوّل إصلاح. الحالةُ تبقى في الشاشة (النصُّ · الصورة · الاقتباس)، وهنا الرسمُ والرفعُ ولوحةُ المفاتيح.
 */
export type ChatPic = { local: string; path: string | null };

/**
 * 🆕 D-1438 — آخرُ ارتفاعٍ للوحة المفاتيح في هذه الجلسة: لوحةُ «+» تأخذه فتحلّ مكانَها بلا قفزة (كالواتس).
 * قبل أوّل ظهورٍ للوحة المفاتيح: ارتفاعٌ قريبٌ من لوحة الهاتف المعتادة.
 */
let lastKb = 0;
const PANEL_FALLBACK = 300;
export const panelHeight = () => (lastKb > 0 ? lastKb : PANEL_FALLBACK);

/** ما يغطّيه لوحُ المفاتيح أسفلَ الشاشة فعلاً — بقياس موضع الجذر (يعمل سواءٌ صغّر النظامُ النافذةَ أم لا) */
export function useKeyboardInset(rootRef: React.RefObject<ViewInstance | null>): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, (e) => {
      const top = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => {
        const v = Math.max(0, Math.round(y + h - top));
        if (v > 120) lastKb = v;
        setKb(v);
      });
    });
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, [rootRef]);
  return kb;
}

/**
 * صورةُ الرسالة: تُصغَّر وتُرفع فورَ اختيارها (`path` حين يعود الخادم)، والفشلُ يقول سببه.
 * 🆕 `crop` — صورةُ القروب: تمرّ بشاشة القصّ أوّلاً (تكبير · تحريك · لفّ)، وتُرسم الشاشةُ بـ`cropUi`.
 */
export function usePicUpload(say: (m: string) => void, opts?: { crop?: CropShape; thread?: boolean }) {
  const { t } = useApp();
  const [pic, setPic] = useState<ChatPic | null>(null);
  const { pickCropped, cropUi } = useImageCrop();
  const crop = opts?.crop;
  /* 🆕 D-1443 — صورةُ النقاش إلى مخزنه العامّ (`/api/v1/thread/image` → رابط)، لا إلى مخزن الرسائل الخاصّ */
  const thread = !!opts?.thread;
  const pickImage = useCallback(async () => {
    let chosen: string | null = null;
    if (crop) {
      chosen = await pickCropped(crop).catch(() => null);
      if (!chosen) return;
    } else {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
      if (r.canceled || !r.assets[0]) return;
      const a = r.assets[0];
      if (a.mimeType && !a.mimeType.startsWith("image/")) return say(t.errPickImage);
      chosen = a.uri;
    }
    let local: string | null = null;
    try {
      local = await shrinkForUpload(chosen);
      const mine = local;
      setPic({ local: mine, path: null });
      const form = new FormData();
      form.append("file", filePart(mine, thread ? "talk.jpg" : "dm.jpg", "image/jpeg"));
      const path = thread
        ? (await postForm<ThreadImagePayload>("/api/v1/thread/image", form)).url
        : (await postForm<MsgImagePayload>("/api/v1/me/messages/image", form)).path;
      /* أُزيلت أو استُبدلت وهي تُرفع ⇒ لا تعود */
      setPic((cur) => (cur && cur.local === mine ? { ...cur, path } : cur));
    } catch (e) {
      setPic((cur) => (cur && cur.local === local ? null : cur));
      const api = e instanceof ApiError ? e : null;
      const known = api ? (t as unknown as Record<string, unknown>)[api.error.message_key] : null;
      const reason = typeof known === "string" ? known : api ? `${api.error.code} ${api.status}` : e instanceof Error ? e.message.slice(0, 80) : "";
      say(api?.error.message_key === "apiImageTooLarge" ? t.errTooLarge : `${t.errUpload}${reason}`);
    }
  }, [say, t, crop, pickCropped, thread]);
  return { pic, setPic, pickImage, cropUi: crop ? cropUi : null };
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
  attach = false,
  onAttachClose,
  onImage,
  onGif,
  onLoopz,
  placeholder,
}: {
  text: string;
  onText: (v: string) => void;
  pic: ChatPic | null;
  onClearPic: () => void;
  /** الاقتباسُ المرسوم (`ReplyQuote`) أو لا شيء */
  quote: React.ReactNode;
  inputRef: React.RefObject<TextInputInstance | null>;
  kb: number;
  bottomInset: number;
  sending: boolean;
  canSend: boolean;
  /** «+» — غائبٌ ⇒ لا زرّ (نقاشٌ لا يخزّن صورةً ولا GIF: المنشورُ والرأي) */
  onAttach?: () => void;
  onSend: () => void;
  /** 🆕 D-1443 — نصُّ الحقل الفارغ (النقاش: «شارِك في النقاش…») */
  placeholder?: string;
  /** ارتفاعُ الخانة بلا لوحة مفاتيح وبسطرٍ واحد — الخلفيّةُ تُمطّ إلى حافّتها (D-1386) */
  onRestingHeight?: (h: number) => void;
  /** 🆕 D-1438 — لوحةُ «+» مفتوحة: تُرسم تحت الخانة مكانَ لوحة المفاتيح، و«+» يصير زرَّ الكتابة */
  attach?: boolean;
  onAttachClose?: () => void;
  onImage?: () => void;
  /** 🆕 D-1440 — GIF وعملٌ يُختاران **داخل اللوحة** ويُرسلان فوراً */
  onGif?: (id: string) => void;
  onLoopz?: (r: SearchTitle) => void;
}) {
  const { t, tokens } = useApp();
  /* 🆕 D-1440 — ما في اللوحة: الدوائرُ، أو بحثُ GIF، أو بحثُ لوبز. في البحث **خانةُ الرسالة هي خانةُ البحث** (أحمد ١٦ أكتوبر:
     «مكانُ الكتابة هو البحث») — نصُّ البحث هنا لا في الشاشة، فما كتبتَه للرسالة لا يضيع ولا يُرسل خطأً */
  const [mode, setMode] = useState<"menu" | "gif" | "loopz">("menu");
  const [q, setQ] = useState("");
  const searching = attach && mode !== "menu";
  useEffect(() => {
    if (!attach) {
      setMode("menu");
      setQ("");
    }
  }, [attach]);
  /* لوحةُ المفاتيح **تطلع** والدوائرُ ظاهرة ⇒ تُغلق اللوحة (لمستَ الحقلَ لتكتب). في البحث تبقى: لوحةُ المفاتيح لكتابة البحث.
     🔴 D-1447 (تسجيلُ أحمد ١٦ أكتوبر: «إذا ضغطت زائد ما يفتح مباشرة، لازم ينزل تحت ثم أضغط زائد مرّة ثانية»): الشرطُ كان «ظاهرة»
     لا «طلعت» — و«+» والكيبورد مفتوح يفتح اللوحةَ قبل أن ينزل الكيبورد فعلاً، فيرى الفحصُ الكيبوردَ ما زال ظاهراً ويُغلقها فوراً.
     الآن الانتقالُ وحدَه (من صفرٍ إلى ظاهر) يُغلقها */
  const prevKb = useRef(kb);
  useEffect(() => {
    const rose = prevKb.current === 0 && kb > 0;
    prevKb.current = kb;
    if (rose && attach && mode === "menu") onAttachClose?.();
  }, [kb, attach, mode, onAttachClose]);
  const pickGif = (id: string) => {
    Keyboard.dismiss();
    onAttachClose?.();
    onGif?.(id);
  };
  const pickTitle = (r: SearchTitle) => {
    Keyboard.dismiss();
    onAttachClose?.();
    onLoopz?.(r);
  };
  const panel = !attach ? null : mode === "gif" ? (
    <GifPanel term={q} compact={false} onPick={pickGif} />
  ) : mode === "loopz" ? (
    <LoopzPanel term={q} compact={false} onPick={pickTitle} />
  ) : (
    <AttachPanel
      onImage={() => {
        onAttachClose?.();
        onImage?.();
      }}
      onGif={onGif ? () => setMode("gif") : undefined}
      onLoopz={onLoopz ? () => setMode("loopz") : undefined}
    />
  );
  /* 🆕 D-1387 — الحقلُ سطرٌ واحدٌ بارتفاع «أرسل» (٤٠) ويكبر ٢٢ مع كلِّ سطرٍ حتى أربعة: النموُّ من الحقل نفسِه (`minHeight`/`maxHeight`)
     لا من `contentSize` — أندرويد يعدّ الحشوَ فيه فكان يُضاف مرّتين فيولد السطرُ الواحدُ بارتفاع ٥٨ (لقطةُ أحمد ١٤ أكتوبر) */
  const [oneLine, setOneLine] = useState(true);
  /* اللوحةُ لا تُرسم ولوحةُ المفاتيح ظاهرة — تنتظر نزولَها فتأخذ مكانَها */
  const open = attach && kb === 0;
  /* البحثُ ولوحةُ المفاتيح ظاهرة: النتائجُ صفٌّ فوق الخانة كالواتس */
  const strip = searching && kb > 0;
  return (
    <View
      onLayout={(e) => {
        if (kb === 0 && oneLine && !pic && !quote) onRestingHeight?.(Math.round(e.nativeEvent.layout.height));
      }}
      style={{ gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: open ? 0 : (kb > 0 ? kb : bottomInset) + 10, borderTopWidth: 1, borderTopColor: tokens.divider, backgroundColor: tokens.bg }}
    >
      {strip ? (
        <View style={{ marginHorizontal: -16 }}>
          {mode === "gif" ? <GifPanel term={q} compact onPick={pickGif} /> : <LoopzPanel term={q} compact onPick={pickTitle} />}
        </View>
      ) : null}
      {/* 🆕 D-1403 — المقتبَسُ فوق الحقل كالواتس، و✕ يلغيه */}
      {searching ? null : quote}
      {/* 🆕 D-1387 — الصورةُ قبل الإرسال: مصغّرةٌ فوق الحقل و✕ يلغيها؛ ودائرةُ انتظارٍ عليها وهي تُرفع */}
      {pic && !searching ? (
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
        {onAttach ? (
        <Pressable
          onPress={() => {
            haptic.pick();
            /* في البحث: ✕ يرجع إلى الدوائر (لا يُغلق اللوحة) */
            if (searching) {
              setMode("menu");
              setQ("");
              Keyboard.dismiss();
            } else onAttach();
          }}
          disabled={sending}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={searching ? t.backAria : open ? t.shareReplyPlaceholder : t.msgAttach}
          style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name={searching ? "close" : open ? "keyboard" : "plus"} size={searching ? 16 : open ? 20 : 18} color={tokens.fg} />
        </Pressable>
        ) : null}
        <TextInput
          maxFontSizeMultiplier={SYSTEM_FONT_CAP}
          ref={inputRef}
          value={searching ? q : text}
          onChangeText={(v) => (searching ? setQ(v.slice(0, 80)) : onText(v.slice(0, MSG_TEXT_MAX)))}
          multiline={!searching}
          maxLength={searching ? 80 : MSG_TEXT_MAX}
          placeholder={searching ? (mode === "gif" ? t.gifSearch : t.searchPlaceholder) : placeholder ?? t.shareReplyPlaceholder}
          placeholderTextColor={tokens.muted}
          accessibilityLabel={searching ? (mode === "gif" ? t.gifSearch : t.searchPlaceholder) : placeholder ?? t.shareReplyPlaceholder}
          returnKeyType={searching ? "search" : undefined}
          onLayout={(e) => setOneLine(e.nativeEvent.layout.height < 50)}
          style={{ flex: 1, minWidth: 0, minHeight: 22 + 18, maxHeight: 4 * 22 + 18, borderRadius: 20, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left", textAlignVertical: "center" }}
        />
        {searching ? null : (
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t.shareReplySend}
          style={({ pressed }) => ({ height: 40, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: tokens.accent, alignItems: "center", justifyContent: "center", opacity: canSend ? 1 : 0.4, transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <Text size={12} weight="700" color={tokens.onAccent}>{t.shareReplySend}</Text>
        </Pressable>
        )}
      </View>
      {open ? <View style={{ height: panelHeight(), marginHorizontal: -16, paddingBottom: bottomInset }}>{panel}</View> : null}
    </View>
  );
}

/**
 * 🆕 D-1387 — «+»: صورة · GIF. 🆕 D-1437 — شبكةُ دوائر و«بحث لوبز».
 * 🆕 D-1438 — **لوحةٌ مكانَ لوحة المفاتيح لا ورقةٌ فوق المحادثة** (أحمد ١٦ أكتوبر بصورة الواتس: «أبغاها نفس صورة الواتس داخل
 * الكيبورد»): أربعُ دوائرَ في الصفّ ٦٤ برموزٍ ذهبيّة («١ أ»: لونُ لوبز لا ألوانُ الواتس) واسمٌ تحتها. الخانةُ تبقى فوقها، و«+»
 * يصير زرَّ الكتابة. «الصوت» ينتظر البناءَ الأصليَّ القادم.
 */
export function AttachPanel({ onImage, onGif, onLoopz }: { onImage: () => void; onGif?: () => void; onLoopz?: () => void }) {
  const { t, tokens } = useApp();
  const cell = (key: string, label: string, art: React.ReactNode, run: () => void) => (
    <Pressable
      key={key}
      onPress={() => {
        haptic.pick();
        run();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: "25%", alignItems: "center", gap: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>{art}</View>
      <Text size={13} weight="600" numberOfLines={2} style={{ textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
  /* 🆕 D-1440 — «الصور» تبقى منتقيَ النظام: شبكةُ صورٍ داخل اللوحة تحتاج إذنَ قراءة المعرض (READ_MEDIA_IMAGES)، وهو محجوبٌ عمداً
     في `app.json` (`blockedPermissions`) لسياسة Google Play — فكُّه بناءٌ أصليٌّ مدفوعٌ وتصريحٌ لدى المتجر، لا تحديثٌ هوائيّ */
  return (
    <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start", paddingTop: 22, paddingHorizontal: 8, rowGap: 22, backgroundColor: tokens.bg }}>
      {cell("image", t.msgPickImage, <Icon name="image" size={26} color={tokens.accent} />, onImage)}
      {onGif ? cell("gif", t.msgPickGif, <Text size={14} weight="800" color={tokens.accent}>GIF</Text>, onGif) : null}
      {onLoopz ? cell("loopz", t.msgPickLoopz, <Icon name="search" size={26} color={tokens.accent} />, onLoopz) : null}
    </View>
  );
}
