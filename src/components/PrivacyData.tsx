"use client";

import { useRef, useState, useTransition } from "react";
import { exportMyData, deleteMyAccount } from "@/lib/actions";
import { getDict, type Locale } from "@/core/i18n";
import { Icon } from "./Icon";
import { Alert } from "./ui/Alert";
import { buttonClass } from "./ui/Button";
import { SettingsGroup } from "./settings/SettingsGroup";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";

/**
 * قسم «بياناتك» في الخصوصية: تصديرٌ وحذف.
 *
 * التصدير ينزّل ملف JSON مبنيّاً على الخادم تحت سياسات RLS نفسها —
 * لا يمرّ بطرفٍ ثالث. والحذف على ضغطتين: الأولى تسلّح الزرّ والثانية
 * تنفّذ — التأكيد في الزرّ نفسه لا في نافذةٍ يُنقر «موافق» فيها بلا
 * قراءة، وخمس ثوانٍ من الصمت تُعيده لحاله.
 */
/** أيُّ نصفَي البطاقة يُعرض — **والغيابُ يعني الاثنين** (نمطُ `only`
    في `AccountSettings` حرفياً، فلا عرفٌ ثالث) */
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
  const [deleteOpen, setDeleteOpen] = useState(false);
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
        /* 🆕 **تحميلٌ كاملٌ لا تنقّلُ موجِّه** (D-869، قاعدةٌ جديدةٌ في
           `eslint-config-next@16.3.0`): **الحسابُ حُذف للتوّ** —
           **و`router.push` يُبقي شجرةَ العميل ومخبأَ الموجِّه لحسابٍ لم
           يعد له وجود**، فتُعرض بقاياه حتى أوّل تحديث. **والتحميلُ
           الكاملُ يُسقط الحالةَ كلَّها**، وهو المقصود هنا لا سهو. */
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      } catch (e) {
        setArmed(false);
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {show("export") && (
        <SettingsGroup>
          <SettingsRow
            icon="download"
            title={t.dataExportTitle}
            value={busy ? t.dataExportBusy : undefined}
            onClick={download}
          />
        </SettingsGroup>
      )}

      {show("delete") && (
        <>
          <SettingsGroup label={t.setDangerZone}>
            <SettingsRow
              icon="trash"
              title={t.deleteAccountTitle}
              danger
              onClick={() => setDeleteOpen(true)}
            />
          </SettingsGroup>

          <SettingsBottomSheet
            open={deleteOpen}
            title={t.deleteAccountTitle}
            onCancel={() => {
              setDeleteOpen(false);
              setArmed(false);
            }}
            onDone={() => {
              setDeleteOpen(false);
              setArmed(false);
            }}
            cancelLabel={t.cancelLabel}
            doneLabel={t.doneLabel}
          >
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <p className="text-12 text-muted leading-relaxed mb-4">{t.deleteAccountDesc}</p>
              <button
                onClick={onDelete}
                disabled={deleting}
                className={buttonClass({
                  variant: armed ? "danger" : "surface",
                  full: true,
                  className: armed
                    ? "h-11"
                    : "h-11 text-[color:var(--error)] hover:bg-[color:var(--error)]/10",
                })}
              >
                <Icon name="trash" size={16} />
                {deleting ? t.deleteAccountBusy : armed ? t.deleteAccountConfirm : t.deleteAccountBtn}
              </button>
            </div>
          </SettingsBottomSheet>
        </>
      )}

      {error && <Alert inline>{error}</Alert>}
    </div>
  );
}
