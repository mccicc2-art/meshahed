"use client";

import { useTransition } from "react";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { blockUser } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * ورقةُ تأكيد الحظر — **ورقةٌ واحدة، بابان** (نمط `ShareListSheet`، D-054).
 *
 * كانت مكتوبةً داخل `ProfileMenu` وحده. ثم صار للحظر بابٌ ثانٍ من داخل
 * المحادثة — والموضع الذي يُحتاج فيه الحظر فعلاً هو المحادثة، لا صفحةُ
 * ملفٍّ يقصدها المتضايق قصداً. ونسخُ الورقة كان سيعني نصَّين للتحذير
 * يفترقان عند أوّل تعديل، فانتُزعت إلى هنا.
 *
 * وهي **استثناء D-047** (لا تأكيد على الأفعال) عن عمد: الحظر يمسّ طرفاً
 * آخر ولا يُتراجع عنه بضغطة — رفعُ الحظر لا يعيد المتابعة التي فكّها.
 */
export function BlockConfirmSheet({
  targetId,
  locale,
  onClose,
  onBlocked,
}: {
  targetId: string;
  locale: Locale;
  onClose: () => void;
  /** ماذا بعد نجاح الحظر — تُنعش الصفحة أو تُغادر الخيط */
  onBlocked: () => void;
}) {
  const t = getDict(locale);
  const [pending, start] = useTransition();

  function doBlock() {
    onClose();
    tap(12);
    start(async () => {
      try {
        await blockUser(targetId);
        toast(t.blockedToast, { tone: "info" });
        onBlocked();
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
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
          <button onClick={onClose} className={buttonClass({ variant: "ghost", size: "md" })}>
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
  );
}
