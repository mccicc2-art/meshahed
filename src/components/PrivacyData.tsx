"use client";

import { useRef, useState, useTransition } from "react";
import { exportMyData, deleteMyAccount } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { Icon } from "./Icon";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";

/**
 * قسم «بياناتك» في الخصوصية: تصديرٌ وحذف.
 *
 * التصدير ينزّل ملف JSON مبنيّاً على الخادم تحت سياسات RLS نفسها —
 * لا يمرّ بطرفٍ ثالث. والحذف على ضغطتين: الأولى تسلّح الزرّ والثانية
 * تنفّذ — التأكيد في الزرّ نفسه لا في نافذةٍ يُنقر «موافق» فيها بلا
 * قراءة، وخمس ثوانٍ من الصمت تُعيده لحاله.
 */
/** أيُّ نصفَي البطاقة يُعرض — **والغيابُ يعني الاثنين** (نمطُ `only`
    في `ProfileForm` و`AccountSettings` حرفياً، فلا عرفٌ ثالث) */
export type PrivacyDataSection = "export" | "delete";

export function PrivacyData({
  locale,
  only,
}: {
  locale: Locale;
  /** 🆕 **التصديرُ والحذفُ افترقا صفحتين** (D-462): **التصديرُ بياناتٌ
      تُنقل** فمكانُه «الاستيراد والتصدير»، **والحذفُ نهايةُ حساب** فمكانُه
      «الحساب» في منطقة خطرٍ معلَّمة — **وفعلٌ يومئٌ وفعلٌ لا رجعةَ فيه لا
      يجلسان متلاصقين** (مواصفةُ أحمد). */
  only?: PrivacyDataSection[];
}) {
  const show = (k: PrivacyDataSection) => !only || only.includes(k);
  const t = getDict(locale);
  const [busy, startBusy] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [armed, setArmed] = useState(false);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    startBusy(async () => {
      try {
        const json = await exportMyData();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `loopz-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function onDelete() {
    setError(null);
    if (!armed) {
      setArmed(true);
      if (disarm.current) clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(false), 5000);
      return;
    }
    if (disarm.current) clearTimeout(disarm.current);
    startDelete(async () => {
      try {
        await deleteMyAccount();
        window.location.href = "/login";
      } catch (e) {
        setArmed(false);
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* التصدير */}
      {show("export") && (
      <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1">{t.dataExportTitle}</h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.dataExportDesc}</p>
        <button
          onClick={download}
          disabled={busy}
          className={buttonClass({ variant: "surface" })}
        >
          <Icon name="download" size={16} />
          {busy ? t.dataExportBusy : t.dataExportBtn}
        </button>
      </section>
      )}

      {/* الحذف */}
      {show("delete") && (
      <section className="bg-surface border border-[color:var(--error)]/30 rounded-2xl p-3.5 sm:p-5">
        <h2 className="text-sm font-bold mb-1 text-[color:var(--error)]">
          {t.deleteAccountTitle}
        </h2>
        <p className="text-xs text-muted leading-relaxed mb-3">{t.deleteAccountDesc}</p>
        <button
          onClick={onDelete}
          disabled={deleting}
          className={buttonClass({
            variant: armed ? "danger" : "surface",
            className: armed
              ? ""
              : "border-[color:var(--error)]/40 text-[color:var(--error)] hover:border-[color:var(--error)] hover:bg-[color:var(--error)]/10",
          })}
        >
          <Icon name="trash" size={16} />
          {deleting ? t.deleteAccountBusy : armed ? t.deleteAccountConfirm : t.deleteAccountBtn}
        </button>
      </section>
      )}

      {error && <Alert inline>{error}</Alert>}
    </div>
  );
}
