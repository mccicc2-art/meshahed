import React, { useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useApp } from "../state";
import { Button, Text } from "../ui";
import { Icon } from "../icons";
import { radius } from "../theme";
import { haptic } from "../haptics";
import { ApiError, postForm } from "../api";
import { Sheet } from "../library/Sheet";
import { Chip } from "../library/Chip";
import { GifImage, GifPicker } from "./GifPicker";
import { span } from "../perfMarks";
import { REPLY_MAX } from "@/core/communityActs";
import type { ThreadImagePayload } from "../contracts";

/**
 * ====== صندوقُ الردّ الأصليّ الواحد — نسخةُ `Composer.tsx` (الويب) · Phase 11-M · M2 ⇐ M3 ======
 *
 * 🔑 **حقلٌ واحدٌ لكلِّ ردٍّ في التطبيق** (خطّة 11-M §٥، القاعدة ٣): وُلد في M2 لتعليق البطاقة في «مجتمعي»
 * (`RowComment`/`NewsComment`) **وكَمُل في M3** ليصير حقلَ النقاش نفسَه — الردُّ في الغرفة والمنشور والرأي، والردُّ على ردّ.
 * الحدُّ حدُّ الفعل (ألفُ حرف)، و«أرسل» معطّلٌ حتى يكون فيه نصٌّ أو صورةٌ أو GIF (`ready` في الويب — **المتنُ صار ثلاثةَ
 * أشكال** فلا يُشترط النصّ)، والحقلُ يتّجه من نصّه (`dir="auto"`).
 *
 * 🆕 **M3 — ما يفتحه الويبُ للغرفة وحدَها** (`allowSpoiler`/`allowImage`/`allowGif = nested`): رقاقةُ «فيها حرق» من العائلة
 * الواحدة (`Chip`) · **الصورة** بمنتقي النظام ثمّ تصغيرٌ (١٩٢٠ طرفاً، JPEG ٠٫٨٥ — نهجُ صورة الملفّ) ثمّ رفعٌ إلى المخزن نفسِه
 * (`/api/v1/thread/image`) · **GIF** من المنتقي الأصليّ. **وما يُرفع يُرى قبل أن يُرسل، وزرُّ إزالته عليه** (D-047).
 *
 * ⚖️ **منبثقٌ في الوسط لا مفتوحٌ في مكانه** — الويبُ يفتح الصندوقَ تحت الصفّ (D-227: «في نفس المكان»)، **والنيّةُ
 * نفسُها محفوظة هنا**: لا صفحةَ تُفتح ولا يضيع موضعُ القراءة. أمّا حقلٌ داخل قائمةٍ افتراضيّة فتغطّيه لوحةُ المفاتيح
 * ويُعاد تدويرُه مع التمرير — **والورقةُ الوسطى هي موضعُ «كتابة تعليق» بكلمة أحمد (D-1032)**، ولوحةُ المفاتيح فيها
 * محلولةٌ مرّةً (D-1005).
 */
export type Draft = { body: string; spoiler: boolean; image: string | null; gif: string | null };

const MAX_EDGE = 1920;

export function Composer({
  title,
  hint,
  allowSpoiler = false,
  allowImage = false,
  allowGif = false,
  onSend,
  onClose,
}: {
  title: string;
  /** سطرٌ فوق الحقل يقول لمن الردّ — `hint` في الويب */
  hint?: string;
  allowSpoiler?: boolean;
  allowImage?: boolean;
  allowGif?: boolean;
  /** يعيد `true` إن أُرسل فتُغلق الورقة؛ والفشلُ يُبقيها بمسوّدتها (رسالتُه عند المستدعي) */
  onSend: (d: Draft) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t, tokens } = useApp();
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [gif, setGif] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = body.trim().length > 0 || !!image || !!gif;

  const send = async () => {
    if (!ready || busy || uploading) return;
    setBusy(true);
    const ok = await onSend({ body: body.trim(), spoiler, image, gif });
    setBusy(false);
    if (ok) onClose();
  };

  /* الصورةُ والـGIF بديلان في المنشور الواحد (الويب: اختيارُ أحدهما يُبقي الآخر، والقاعدةُ تقبلهما) — نُبقي سلوكَه */
  const pickImage = async () => {
    if (uploading) return;
    setErr(null);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: false, quality: 1 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    if (a.mimeType && !a.mimeType.startsWith("image/")) return setErr(t.errPickImage);
    setUploading(true);
    /* 🆕 M3-fix — **كلُّ محاولةٍ تُقاس ومرحلتُها تُسمّى** (بلاغُ خالد ٢٨ سبتمبر: «تعذّر رفع الصورة:» بلا سبب، ولا أثرَ
       للطلب في المخزن ولا في السجلّ). الرسالةُ كانت تبتلع السببَ فلا يُعرف: تصغيرٌ على الجهاز؟ شبكة؟ رفضٌ من الخادم؟
       الآن السببُ يُكتب بعد النقطتين (`errUpload` صُمّم لذلك) ويصل القياسَ (`src` المرحلة · `why` الرمز · `count` الحالة). */
    const done = span("thread.image");
    let stage = "shrink";
    try {
      /* 🔑 الأبعادُ من الصورة المرسومة لا من المنتقي: منتقي أندرويد قد يعيد `width/height` صفراً، فتُرفع الصورةُ بحجمها
         الأصليّ (١٢–٥٠ ميجابكسل) فيتجاوز حدَّ الخادم (٢ ميجابايت) أو حدَّ المنصّة (٤٫٥) فيعود جوابٌ ليس JSON */
      const raw = await ImageManipulator.manipulate(a.uri).renderAsync();
      const long = Math.max(raw.width, raw.height);
      const ctx = ImageManipulator.manipulate(raw);
      if (long > MAX_EDGE) ctx.resize(raw.width >= raw.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
      const img = await (await ctx.renderAsync()).saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
      stage = "send";
      const form = new FormData();
      /* RN يقبل `{uri,name,type}` جزءاً في النموذج — يقرأ الملفَّ من القرص بنفسه */
      form.append("file", { uri: img.uri, name: "talk.jpg", type: "image/jpeg" } as unknown as Blob);
      const out = await postForm<ThreadImagePayload>("/api/v1/thread/image", form);
      setImage(out.url);
      haptic.pick();
      done({ result: "ok" });
    } catch (e) {
      const api = e instanceof ApiError ? e : null;
      const known = api ? (t as unknown as Record<string, unknown>)[api.error.message_key] : null;
      const why = api ? api.error.code : stage === "send" ? "net" : "local";
      done({ result: "fail", src: stage, why, ...(api ? { count: api.status } : {}) });
      const reason = typeof known === "string" ? known : api ? `${api.error.code} ${api.status}` : e instanceof Error ? e.message.slice(0, 80) : why;
      setErr(api?.error.message_key === "apiImageTooLarge" ? t.errTooLarge : `${t.errUpload}${reason}`);
    } finally {
      setUploading(false);
    }
  };

  const attachment = (uri: React.ReactNode, onRemove: () => void, label: string) => (
    <View style={{ width: 112, height: 112, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2 }}>
      {uri}
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        accessibilityLabel={label}
        style={{ position: "absolute", top: 4, end: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="close" size={14} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <>
      <Sheet title={title} onClose={onClose} placement="center">
        <View style={{ gap: 12 }}>
          {hint ? <Text size={12} muted numberOfLines={1}>{hint}</Text> : null}
          <TextInput
            value={body}
            onChangeText={(v) => setBody(v.slice(0, REPLY_MAX))}
            multiline
            autoFocus
            maxLength={REPLY_MAX}
            placeholder={t.shareReplyPlaceholder}
            placeholderTextColor={tokens.muted}
            accessibilityLabel={t.shareReplyPlaceholder}
            textAlignVertical="top"
            style={{ minHeight: 3 * 22 + 24, maxHeight: 6 * 22 + 24, borderRadius: radius.control, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, padding: 12, fontSize: 15, lineHeight: 22, color: tokens.fg, textAlign: "left" }}
          />
          {image || gif || uploading ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {uploading ? (
                <View style={{ width: 112, height: 112, borderRadius: radius.md, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface2, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={tokens.accent} />
                </View>
              ) : image ? (
                attachment(<Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />, () => setImage(null), t.talkRemoveImage)
              ) : null}
              {gif ? attachment(<GifImage id={gif} />, () => setGif(null), t.talkRemoveGif) : null}
            </View>
          ) : null}
          {err ? <Text size={12} color={tokens.error}>{err}</Text> : null}
          {allowSpoiler || allowImage || allowGif ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {allowSpoiler ? (
                <Chip label={t.spoilerMark} active={spoiler} onPress={() => setSpoiler((v) => !v)} leading={<Icon name={spoiler ? "eye-off" : "eye"} size={14} color={spoiler ? tokens.onAccent : tokens.muted} />} />
              ) : null}
              {allowImage ? (
                <Pressable onPress={() => void pickImage()} disabled={uploading} hitSlop={6} accessibilityLabel={t.talkAddImage} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: tokens.border, alignItems: "center", justifyContent: "center", opacity: uploading ? 0.5 : 1 }}>
                  <Icon name="image" size={16} color={tokens.muted} />
                </Pressable>
              ) : null}
              {allowGif ? <Chip label="GIF" active={!!gif} onPress={() => setGifOpen(true)} /> : null}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Button label={t.cancelLabel} variant="ghost" onPress={onClose} />
            <Button label={t.shareReplySend} busy={busy} disabled={!ready || uploading} style={{ flex: 1 }} onPress={() => void send()} />
          </View>
        </View>
      </Sheet>
      {gifOpen ? <GifPicker onPick={setGif} onClose={() => setGifOpen(false)} /> : null}
    </>
  );
}
