"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "./ui/Button";
import { getDict, type Locale } from "@/lib/i18n";

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
  onSend,
  onCancel,
}: {
  locale: Locale;
  hint?: string;
  autoFocus?: boolean;
  onSend: (body: string) => void;
  onCancel: () => void;
}) {
  const t = getDict(locale);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const ready = body.trim().length > 0;

  return (
    <div className="mt-3">
      {hint && <p className="text-[11px] text-muted mb-1">{hint}</p>}
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
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={() => start(() => onSend(body.trim()))}
          className={buttonClass({ size: "sm" })}
        >
          {t.shareReplySend}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[12px] text-muted hover:text-foreground transition px-2"
        >
          {t.cancelLabel}
        </button>
      </div>
    </div>
  );
}
