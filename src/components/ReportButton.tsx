"use client";

import { useState, useTransition } from "react";
import { reportReview } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import type { MediaType } from "@/lib/media";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";

/**
 * الإبلاغ عن رأي — بديلُ «عدم الإعجاب».
 *
 * الديسلايك يقع على **رأي شخص** لا على العمل، والحكم على العمل موجودٌ
 * وأدقّ منه (تقييمٌ من ١ إلى ١٠). وفي مجتمعٍ صغير لا يُقرأ الديسلايك
 * إحصاءً بل رسالةً شخصية، فيصمت الناس عن الكتابة — وخطّ الآراء هو صفحة
 * المجتمع كلها. فما يبقى من حاجةٍ حقيقية هو إخفاء المسيء، وهذا فعلٌ نادر.
 *
 * ولأنه نادر: **أيقونةٌ صامتة بلا عدّاد ولا لون**، تجلس بعد زرّ الإعجاب
 * وتُقرأ حين يُبحث عنها ولا تُرى حين لا يُحتاج إليها. الإعجاب فعلٌ يوميّ
 * فله شكله الكامل؛ والإبلاغ فعلُ العمر فله حجمه.
 *
 * وورقةٌ قبل الإرسال — وهي الموضع الوحيد الذي يبقى فيه التأكيد صواباً
 * (خلافاً لـD-047): البلاغ فعلٌ يمسّ شخصاً آخر، ولا يُتراجع عنه بضغطة
 * لأنه غادر إلى طرفٍ ثالث. وسطر السبب اختياريّ: إلزامه يجعل نصف البلاغات
 * «مسيء» ولا يفيد أحداً.
 */
export function ReportButton({
  reviewUserId,
  tmdbId,
  mediaType,
  locale,
}: {
  reviewUserId: string;
  tmdbId: number;
  mediaType: MediaType;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  function send() {
    setOpen(false);
    setSent(true);
    tap(10);
    start(async () => {
      try {
        await reportReview({ reviewUserId, tmdbId, mediaType, reason });
        toast(t.reportDone, { tone: "info" });
      } catch (e) {
        flashError((e as Error).message);
        setSent(false);
      }
    });
  }

  // بعد الإبلاغ لا يعود الزرّ قابلاً للضغط: البلاغ الثاني من الشخص نفسه
  // لا يُحتسب أصلاً (المفتاح الأساسي)، وزرٌّ يقبل ضغطةً لا أثر لها يكذب
  if (sent) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-muted"
        title={t.reportDone}
      >
        <Icon name="check-line" size={13} strokeWidth={2.2} />
        {t.reportDone}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          tap(6);
          setOpen(true);
        }}
        disabled={pending}
        aria-label={t.reportLabel}
        title={t.reportLabel}
        className="grid place-items-center w-8 h-8 rounded-full text-muted/70 hover:text-[color:var(--error)] hover:bg-surface-2 active:scale-95 transition"
      >
        <Icon name="shield" size={15} strokeWidth={1.9} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="report-sheet-title"
        className="p-5"
      >
        <>
          <p id="report-sheet-title" className="font-bold text-[15px] mb-1.5">
            {t.reportTitle}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.reportBody}</p>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            maxLength={300}
            rows={2}
            placeholder={t.reportReasonPlaceholder}
            aria-label={t.reportReasonPlaceholder}
            /* ١٦ بكسلاً (D-033) */
            className="w-full resize-none rounded-xl bg-surface-2 border border-border px-3 py-2.5 text-base outline-none focus:border-accent transition"
          />

          <div className="flex items-center gap-2.5 mt-4">
            <button
              onClick={() => setOpen(false)}
              className={buttonClass({ variant: "ghost", size: "md" })}
            >
              {t.cancelLabel}
            </button>
            <button
              onClick={send}
              className={buttonClass({ variant: "danger", size: "md", className: "flex-1" })}
            >
              {t.reportSend}
            </button>
          </div>
        </>
      </Sheet>
    </>
  );
}
