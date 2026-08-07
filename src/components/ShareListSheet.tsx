"use client";

import { useTransition } from "react";
import { Sheet } from "./ui/Sheet";
import { buttonClass } from "./ui/Button";
import { getDict, type Locale } from "@/lib/i18n";
import { tap } from "@/lib/haptics";
import { toast, flashError } from "@/lib/toast";
import { renameList } from "@/lib/actions";

/**
 * ورقة مشاركة القائمة — رابطٌ عامّ يفتحه المجتمع، أو مشاركةٌ للخارج.
 *
 * تُفتح من مكانين: قائمة خيارات صفحة القائمة، **وزرّ المشاركة على بطاقة
 * القائمة في صفحة «قوائمي»** (طلب المالك المتكرّر: يريدها من صفحة القوائم
 * لا من داخل القائمة وحدها). مكوّنٌ واحد لا نسختان (D-016).
 *
 * لا تُشارَك قائمةٌ خاصة: رابطها لا يفتحه غير صاحبه (السياسة في SQL)، فزرّها
 * الوحيد يجعلها معلنة أوّلاً ثم ينسخ الرابط — و`onChanged` يُحدّث `isPublic`
 * فتظهر بعدها أزرار المشاركة العادية. المعلنة تظهر في ملفّك العام، وهو معنى
 * «في المجتمع»؛ والرابط هو «خارج التطبيق».
 */
export function ShareListSheet({
  listId,
  name,
  isPublic,
  locale,
  onClose,
  onChanged,
}: {
  listId: string;
  name: string;
  isPublic: boolean;
  locale: Locale;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = getDict(locale);
  const [pending, start] = useTransition();
  const url = () =>
    typeof window !== "undefined" ? `${window.location.origin}/lists/${listId}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      toast(t.linkCopied);
    } catch {
      /* متصفّح بلا حافظة — لا رسالة تفيد هنا */
    }
  }

  async function systemShare() {
    const link = url();
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url: link });
        return;
      }
    } catch {
      return; // أغلق المستخدم ورقة المشاركة — ليس خطأً
    }
    await copy();
  }

  function makePublicThenCopy() {
    tap([12, 30]);
    start(async () => {
      try {
        await renameList(listId, name, true);
        onChanged();
        try {
          await navigator.clipboard.writeText(url());
        } catch {
          /* الحافظة تحتاج إيماءةً في بعض المتصفّحات — الرابط عامٌّ على أي حال */
        }
        toast(t.listMadePublicCopied);
      } catch (e) {
        flashError((e as Error).message);
      }
    });
  }

  return (
    <Sheet open onClose={onClose} closeLabel={t.closeLabel} labelledBy="list-share-title">
      <p id="list-share-title" className="text-center font-bold text-[15px] pt-5 pb-1">
        {t.listShareSheetTitle}
      </p>
      <p className="text-center text-xs text-muted px-6 pb-1 leading-relaxed">
        {isPublic ? t.listSharePublicHint : t.listSharePrivateHint}
      </p>
      <div className="p-4 space-y-2">
        {isPublic ? (
          <>
            <button onClick={systemShare} className={buttonClass({ size: "lg", full: true })}>
              {t.listShareLinkBtn}
            </button>
            <button
              onClick={copy}
              className={buttonClass({ variant: "surface", size: "lg", full: true })}
            >
              {t.shareCopyLink}
            </button>
          </>
        ) : (
          <button
            onClick={makePublicThenCopy}
            disabled={pending}
            className={buttonClass({ size: "lg", full: true })}
          >
            {t.listMakePublicShare}
          </button>
        )}
      </div>
    </Sheet>
  );
}
