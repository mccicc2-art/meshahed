"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { fitForUpload, UPLOAD_MAX_BYTES } from "@/lib/imageFile";
import { buttonClass } from "./ui/Button";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { GifPicker } from "./GifPicker";
import { gifUrl } from "@/lib/media";

/**
 * **صندوقُ الكتابة — واحدٌ لكل ردّ في التطبيق** (D-227).
 *
 * `Enter` لا يُرسل: الردُّ قد يكون سطرين، و«إرسالٌ بالخطأ» في سطحٍ عامّ
 * أسوأُ من ضغطةٍ إضافية على زرّ.
 *
 * **وكان يعيش داخل `TalkThread` باسم `Composer`** يخدم الردَّ على رأيٍ
 * والردَّ على ردّ. ثم طلب أحمد أن يفتح «تعليق» في خطّ النشاط **صندوقاً في
 * مكانه لا صفحةً جديدة** — **فصار له قارئٌ ثالث في ملفٍّ آخر**، ونسخُه
 * كان يجعل «١٠٠٠ حرف» و«Enter لا يُرسل» حقيقتين في موضعين تفترقان عند
 * أوّل تعديل. **فخرج إلى ملفّه وحُذفت نسخةُ الأصل في الدفعة نفسها**
 * (D-159/D-166: العلاج عند المصدر، وتُحذف نسخُه معه).
 */
export function Composer({
  locale,
  hint,
  autoFocus = true,
  allowSpoiler = false,
  allowImage = false,
  allowGif = false,
  onSend,
  onCancel,
}: {
  locale: Locale;
  hint?: string;
  autoFocus?: boolean;
  /**
   * 🆕 **مفتاحُ «فيها حرق»** (D-271، طلبُ أحمد: «ضِف له زرّ يختاره إذا
   * رسالته فيها حرق») — **ولا يظهر إلا حيث يُخزَّن**: النقاشُ وحدَه اليوم
   * (`title_posts.has_spoiler`، الهجرة ٨٤). **وزرٌّ يُضغط ولا أثرَ له
   * أسوأُ من زرٍّ غائب** (D-217)، **والريفيو في دفعةٍ ثانية باختيار أحمد**
   * لأن `ratings` بلا عمود ونصُّها يُقرأ من ستّ دوالَّ حيّة.
   */
  allowSpoiler?: boolean;
  /**
   * 🆕 **زرُّ الصورة** (D-298، طلبُ أحمد: «نحتاج نحطّ خيار رفع صورة»).
   *
   * **ولا يظهر إلا حيث تُخزَّن** — كحجّة `allowSpoiler` حرفاً: النقاشُ
   * وحدَه اليوم (`title_posts.data`)، **وزرٌّ يُضغط ولا أثرَ له أسوأُ من
   * زرٍّ غائب** (D-217).
   */
  allowImage?: boolean;
  /**
   * 🆕 **خيارُ GIF جنبَ الصورة** (D-362، طلبُ أحمد: «خيار سريع وبديل عن
   * الصور») — **ولا يظهر إلا حيث يُقبل** كحجّة `allowImage` حرفاً
   * (D-217: لا زرَّ يَعِد بما يمنعه الفعل).
   */
  allowGif?: boolean;
  /** **والعَلَمُ يصحب المتن** — لا حالةٌ ثانيةٌ عند المستدعي تفترق عنه */
  /* 🆕 **ووسيطٌ رابعٌ للـGIF** (D-362) — **اختياريٌّ فالقرّاءُ الثلاثة
     القدامى يبقون على توقيعهم** (D-028: الحقلُ الجديد اختياريٌّ حتى يصل
     مستهلكُه). */
  onSend: (
    body: string,
    hasSpoiler: boolean,
    imageUrl?: string | null,
    gifId?: string | null,
  ) => void;
  onCancel: () => void;
}) {
  const t = getDict(locale);
  const [body, setBody] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [img, setImg] = useState<string | null>(null);
  /* 🆕 **معرّفُ الـGIF لا رابطُه** (D-362) — والرابطُ يُركَّب للعرض وحدَه */
  const [gif, setGif] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  /* **وصورةٌ وحدَها مشاركة** (D-298): **الصورةُ متنٌ كالمتن**، **وشرطٌ
     يطلب نصّاً بعد أن صار للمتن شكلان يرفض نصفَ ما يُرسَل.** */
  const ready = body.trim().length > 0 || !!img || !!gif;

  /**
   * 🆕 **الرفعُ في المتصفّح إلى مخزننا القائم** (D-298).
   *
   * ================= ولا مخزنَ جديد ولا سياسةَ جديدة =================
   *
   * **`avatars` قائمٌ منذ `profile.sql` بسياستين**: قراءةٌ عامّةٌ
   * (`bucket_id = 'avatars'`) **وكتابةٌ في مجلّدك أنت وحدَه**
   * (`foldername[1] = auth.uid()`). **وصورةُ غلاف المجتمع تسكنه أصلاً**
   * — **فهو مخزنُ «صور المستخدمين» لا مخزنُ الأفاتار وحده** (D-002:
   * مخزنٌ ثانٍ لمعنًى واحدٍ عائلةٌ ثانية).
   *
   * **✅ وثلاثةُ مكاسبَ تُقاس، لا ذوق:**
   * **١) لا سياسةَ خامسة** — عددُ السياسات المفتوحة لا يُمَسّ (D-013).
   * **٢) وحذفُ الحساب يمسحها معه** — `account_deletion.sql` يحذف
   *    `bucket_id='avatars'` تحت مجلّد صاحبه، **فصورُ نقاشه تسقط بلا
   *    سطرٍ واحدٍ يُكتب** (D-247: وعدُ الخصوصية يُراجَع في دفعته).
   * **٣) ومخزنٌ جديد كان سيحتاج تعديلَ `account_deletion.sql`
   *    و`security.sql` معاً** — **موضعان يفترقان يومَ يُنسى أحدهما**
   *    (D-145).
   *
   * **والمجلّدُ `talk/` داخل مجلّد صاحبه**: تمييزٌ للعين عند المراجعة،
   * **والسياسةُ لا تراه أصلاً** لأنها تحرس المستوى الأوّل وحدَه.
   *
   * ⚠️ **والهويّةُ تُقرأ من الجلسة لا من وسيط**: تمريرُها عبر ثلاثة أسطح
   * كان يجعلها **مُدخَلاً يُصدَّق**، **وهنا هي عائدُ `getUser()`** —
   * ونداءٌ واحدٌ لا يقع إلا عند أوّل رفع (D-194).
   */
  async function pick(picked: File) {
    setErr(null);
    if (!picked.type.startsWith("image/")) return setErr(t.errPickImage);
    setBusy(true);
    try {
      /* 🆕 **تُصغَّر قبل أن تُقاس** (D-837) — **والمنتقياتُ الثلاثةُ
         على مصفاةٍ واحدة**: هنا وفي `Communities` وفي تعديل الملفّ. */
      const f = await fitForUpload(picked);
      if (f.size > UPLOAD_MAX_BYTES) {
        setErr(t.errTooLarge);
        return;
      }
      const supabase = await createClient();
      const { data: who } = await supabase.auth.getUser();
      const uid = who.user?.id;
      if (!uid) throw new Error("no session");
      const ext = f.name.split(".").pop()?.toLowerCase().slice(0, 5) || "jpg";
      const path = `${uid}/talk/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, f, { upsert: true, contentType: f.type });
      if (error) throw new Error(error.message);
      setImg(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setErr(t.errUpload + (e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      {hint && <p className="text-12 text-muted mb-1">{hint}</p>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 1000))}
        placeholder={t.shareReplyPlaceholder}
        aria-label={t.shareReplyPlaceholder}
        rows={2}
        autoFocus={autoFocus}
        /* `dir="auto"` هنا صحيحٌ بلا تحفّظ: الحقلُ فارغٌ ثم يمتلئ بكلام
           صاحبه وحدَه — **لا نجمةَ تسبقه فتُفسد الحسم** (قارِن `ActivityFeed`) */
        dir="auto"
        className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-base resize-y outline-none focus:border-accent/60"
      />
      {/* **والمعاينةُ فوق الصفّ لا داخله** — **ما يُرفع يُرى قبل أن
          يُرسل**، **وزرُّ إزالتها عليها** (D-047: تراجَع بعد لا أكِّد قبل). */}
      {img && (
        <div className="mt-2 relative w-28 h-28 rounded-xl overflow-hidden border border-border bg-surface-2">
          <Image src={img} alt="" fill sizes="112px" className="object-cover" />
          <button
            type="button"
            onClick={() => setImg(null)}
            aria-label={t.talkRemoveImage}
            title={t.talkRemoveImage}
            className="absolute top-1 end-1 w-7 h-7 rounded-full bg-black/60 grid place-items-center text-white drop-shadow active:scale-95 transition"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {/* 🆕 **ومعاينةُ الـGIF بوصفةِ معاينة الصورة حرفاً** (D-362) —
          **ما يُرسل يُرى قبل أن يُرسل، وزرُّ إزالته عليه** (D-047)،
          **ولا وصفةَ ثانيةً لمعنًى واحد** (D-002). */}
      {gif && (
        <div className="mt-2 relative w-28 h-28 rounded-xl overflow-hidden border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifUrl(gif, "small") ?? ""} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => setGif(null)}
            aria-label={t.talkRemoveGif}
            title={t.talkRemoveGif}
            className="absolute top-1 end-1 w-7 h-7 rounded-full bg-black/60 grid place-items-center text-white drop-shadow active:scale-95 transition"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-1.5 text-12 text-[color:var(--error)]">{err}</p>}

      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={!ready || pending || busy}
          onClick={() => start(() => onSend(body.trim(), spoiler, img, gif))}
          className={buttonClass({ size: "sm" })}
        >
          {t.shareReplySend}
        </button>

        {/* **رقاقةٌ تُضغط فتَقِف** (D-271) — **عائلةُ الرقاقات نفسُها**
            (`rounded-full` وحدٌّ وحالةُ تشغيلٍ باللون) لا عائلةٌ ثالثة
            (D-002/D-222). **ولا `checkbox` عارٍ**: مربّعُ النظام يختلف
            شكلاً بين المتصفّحات ولا يرث الثيم.
            **والرمزُ يقول الفعلَ**: عينٌ مشطوبةٌ = «سيُحجب». */}
        {allowSpoiler && (
          <button
            type="button"
            onClick={() => setSpoiler((v) => !v)}
            aria-pressed={spoiler}
            className={
              spoiler
                ? "inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-12 font-bold text-accent transition"
                : "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-12 text-muted transition hover:text-foreground"
            }
          >
            <Icon name={spoiler ? "eye-off" : "eye"} size={14} className="shrink-0" />
            <span>{t.spoilerMark}</span>
          </button>
        )}
        {/* 🆕 **زرُّ الصورة — رمزٌ في صفِّ الأفعال نفسِه** (D-298):
            **صفٌّ واحدٌ لأفعال هذا الصندوق** (D-288)، **ولا سطرَ ثانٍ
            لزرٍّ واحد.**
            ⚠️ **ولا يُضغط حقلُ الملفّ مباشرةً**: `input[type=file]` عارياً
            يختلف شكلُه بين المتصفّحات ولا يرث الثيم — **فيُخفى ويُنادى من
            زرٍّ من عائلتنا** (نفسُ حجّة الرقاقة أعلاه، D-016/D-002). */}
        {allowImage && (
          <>
            <input
              ref={file}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pick(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => file.current?.click()}
              aria-label={t.talkAddImage}
              title={t.talkAddImage}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-12 text-muted transition hover:text-foreground disabled:opacity-50"
            >
              <Icon name="image" size={14} className="shrink-0" />
            </button>
          </>
        )}
        {/* 🆕 **وGIF جنبَ الصورة في الصفّ نفسِه** (D-362، طلبُ أحمد:
            «خيار جنب الصور… سريع وبديل عن الصور») — **صفٌّ واحدٌ لأفعال
            هذا الصندوق** (D-288)، **ووصفةُ الزرّ وصفةُ أخيه حرفاً**
            (D-002). **والكلمةُ مكتوبةٌ لأن الرمزَ وحدَه لا عُرفَ له**
            (D-138/D-177: رمزٌ بلا عُرفٍ يحتاج كلمة). */}
        {allowGif && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setGifOpen(true)}
            aria-label={t.talkAddGif}
            title={t.talkAddGif}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-12 font-bold text-muted transition hover:text-foreground disabled:opacity-50"
          >
            GIF
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="text-12 text-muted hover:text-foreground transition px-2"
        >
          {t.cancelLabel}
        </button>
      </div>
      {allowGif && (
        <GifPicker
          open={gifOpen}
          onClose={() => setGifOpen(false)}
          onPick={(id) => setGif(id)}
          locale={locale}
        />
      )}
    </div>
  );
}
