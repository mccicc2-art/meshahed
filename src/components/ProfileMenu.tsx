"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { StartConversationSheet } from "./StartConversationSheet";
import { blockUser, reportUser } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
import type { PersonLite } from "@/lib/data";

/**
 * قائمة «المزيد» في ملفّ شخصٍ آخر — رسالة / بلاغ / حظر.
 *
 * كانت شكوى المالك: «مافيه خيار أقدر أعطيه بلوك». الحظر فعلٌ نادر
 * فلا يستحقّ زرّاً ظاهراً بجانب المتابعة؛ يستحقّ باباً — نقاطٌ ثلاث
 * تفتح ورقةً سفلية على نمط قائمة صفحة العمل (DetailTopBar) نفسه.
 *
 * ثلاثة صفوف لا أربعة: «إضافة» التي طلبها المالك موجودة أصلاً زرَّ
 * متابعةٍ بجانب النقاط — تكرارها هنا يخلق حالتين للفعل الواحد قد
 * تتعارضان على الشاشة نفسها، والزرّ الظاهر أولى من صفٍّ مطويّ.
 *
 * «رسالة» تحترم D-051: للمتبادلَين تفتح ورقة بدء المحادثة (عملٌ ثم
 * إرسال)، ولغيرهم توستُ تلميحٍ لا صفٌّ مخفيّ — الخيار الظاهر المعطَّل
 * بتفسيرٍ خيرٌ من خيارٍ يظهر ويختفي بلا سبب مرئيّ.
 *
 * والحظر بورقة تأكيدٍ كالبلاغ (استثناء D-047 نفسه): فعلٌ يمسّ طرفاً
 * آخر ولا يُتراجع عنه بضغطة — رفعُ الحظر لا يعيد المتابعة المفكوكة.
 */
export function ProfileMenu({
  person,
  mutual,
  locale,
}: {
  person: PersonLite;
  /** متابعةٌ متبادلة؟ — بوّاب خيار «رسالة» (D-051) */
  mutual: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [message, setMessage] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [pending, start] = useTransition();

  const menuItem =
    "w-full flex items-center gap-3 px-5 py-3.5 text-start text-[15px] hover:bg-surface-2 transition";

  function openMessage() {
    setMenu(false);
    if (!mutual) {
      toast(t.msgNeedsMutual, { tone: "info" });
      return;
    }
    setMessage(true);
  }

  function sendReport() {
    setReport(false);
    setReported(true);
    tap(10);
    start(async () => {
      try {
        await reportUser({ targetId: person.id, reason });
        toast(t.reportDone, { tone: "info" });
      } catch (e) {
        flashError((e as Error).message);
        setReported(false);
      }
    });
  }

  function doBlock() {
    setConfirmBlock(false);
    tap(12);
    start(async () => {
      try {
        await blockUser(person.id);
        toast(t.blockedToast, { tone: "info" });
        // الصفحة تُنعش: زرّ المتابعة يعود «تابِع» لأن الحظر فكّها
        router.refresh();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <>
      {/* نقاط القائمة — قرصُ الغلاف نفسه الذي يرسمه DetailTopBar */}
      <button
        onClick={() => {
          tap(6);
          setMenu(true);
        }}
        aria-label={t.profileMenuAria}
        title={t.profileMenuAria}
        className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-md border border-white/15 grid place-items-center text-white/90 active:scale-95 transition"
      >
        <Icon name="dots" size={18} />
      </button>

      {/* القائمة */}
      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        closeLabel={t.closeLabel}
        variant="bottom"
        labelledBy="profile-menu-title"
      >
        <p id="profile-menu-title" className="text-center font-bold text-[15px] pt-5 pb-2">
          {t.moreMenuTitle}
        </p>
        <div className="pb-3">
          <button onClick={openMessage} className={menuItem}>
            <Icon name="comment" size={18} className={mutual ? "text-accent" : "text-muted"} />
            <span className={mutual ? "" : "text-muted"}>{t.msgUserOption}</span>
          </button>

          <div className="h-px bg-[color:var(--divider)] mx-5 my-1" />

          <button
            onClick={() => {
              setMenu(false);
              if (!reported) setReport(true);
            }}
            disabled={pending}
            className={menuItem}
          >
            <Icon name="shield" size={18} className="text-muted" />
            {reported ? t.reportDone : t.reportUserOption}
          </button>

          <button
            onClick={() => {
              setMenu(false);
              setConfirmBlock(true);
            }}
            disabled={pending}
            className={menuItem}
          >
            <Icon name="close" size={18} className="text-[color:var(--error)]" />
            <span className="text-[color:var(--error)]">{t.blockOption}</span>
          </button>
        </div>
      </Sheet>

      {/* ورقة البلاغ — نمط ReportButton حرفياً: سببٌ اختياريّ ثم إرسال */}
      <Sheet
        open={report}
        onClose={() => setReport(false)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="report-user-title"
        className="p-5"
      >
        <>
          <p id="report-user-title" className="font-bold text-[15px] mb-1.5">
            {t.reportUserTitle}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-3">{t.reportUserBody}</p>
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
            <button onClick={() => setReport(false)} className={buttonClass({ variant: "ghost", size: "md" })}>
              {t.cancelLabel}
            </button>
            <button onClick={sendReport} className={buttonClass({ variant: "danger", size: "md", className: "flex-1" })}>
              {t.reportSend}
            </button>
          </div>
        </>
      </Sheet>

      {/* ورقة تأكيد الحظر */}
      <Sheet
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        closeLabel={t.closeLabel}
        variant="center"
        labelledBy="block-confirm-title"
        className="p-5"
      >
        <>
          <p id="block-confirm-title" className="font-bold text-[15px] mb-1.5">
            {t.blockConfirmTitle}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-4">{t.blockConfirmBody}</p>
          <div className="flex items-center gap-2.5">
            <button onClick={() => setConfirmBlock(false)} className={buttonClass({ variant: "ghost", size: "md" })}>
              {t.cancelLabel}
            </button>
            <button
              onClick={doBlock}
              disabled={pending}
              className={buttonClass({ variant: "danger", size: "md", className: "flex-1" })}
            >
              {t.blockConfirmButton}
            </button>
          </div>
        </>
      </Sheet>

      {message && (
        <StartConversationSheet person={person} locale={locale} onClose={() => setMessage(false)} />
      )}
    </>
  );
}
