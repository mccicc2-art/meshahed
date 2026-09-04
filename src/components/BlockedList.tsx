"use client";

import { useEffect, useState, useTransition } from "react";
import { AccountBadges } from "./AccountIdentity";
import { Avatar } from "./Avatar";
import { buttonClass } from "./ui/Button";
import { myBlocksList, unblockUser } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/core/i18n";
import { SettingsRow } from "./settings/SettingsRow";
import { SettingsBottomSheet } from "./settings/SettingsBottomSheet";
import { sheetScroll } from "./ui/controls";
import type { PersonLite } from "@/lib/data";

/**
 * «المحظورون» — قسمٌ في إعدادات الخصوصية.
 *
 * الحظر بلا هذا القسم فعلٌ بلا رجعة: الملفّ المحظور يختفي من دائرتك
 * فلا طريق تعود منه إليه. فالقائمة هنا هي باب الرجوع الوحيد — تُجلب
 * عند الفتح بفعل خادمٍ (نمط SendShareSheet مع myMutualFollows) لا
 * بتمرير خصائص عبر SettingsShell: بياناتٌ لا تلزم إلا من فتح القسم.
 *
 * رفع الحظر متفائل (D-007) مع تراجُعٍ عند الخطأ — والمتابعة لا تعود
 * تلقائياً معه، وهذا مكتوبٌ في تلميح القسم كي لا يُفهم الزرّ وعداً.
 *
 * 🆕 **وصار صفّاً يقول العدد وورقةً تفتح القائمة** (D-555، مواصفةُ
 * أحمد: «صفّ المحظورين مع العدد»). **وأكثرُ الحسابات لا محظورَ فيها** —
 * **وبطاقةٌ بعنوانٍ وشرحٍ وسطرِ «لا أحد» تحتلّ ثلث شاشةٍ لتقول لا شيء.**
 * **والصفُّ يقول «٠» في سطرٍ واحد.**
 *
 * ⚠️ **والجلبُ باقٍ عند التركيب لا عند فتح الورقة**: **العددُ نفسُه هو
 * ما يُعرض في الصفّ** — **وصفٌّ لا يقول عددَه لا يستحقّ أن يُقرأ.**
 * **والكلفةُ هي كلفةُ اليوم بعينها** فلا انحدارَ في الأداء.
 */
export function BlockedList({ locale }: { locale: Locale }) {
  const t = getDict(locale);
  const [items, setItems] = useState<PersonLite[] | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    let alive = true;
    myBlocksList()
      .then((rows) => alive && setItems(rows))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  function unblock(p: PersonLite) {
    tap(8);
    const prev = items;
    setItems((cur) => (cur ?? []).filter((x) => x.id !== p.id));
    start(async () => {
      try {
        await unblockUser(p.id);
        toast(t.unblockedToast, { tone: "info" });
      } catch (e) {
        setItems(prev);
        flashError((e as Error).message);
      }
    });
  }

  const [open, setOpen] = useState(false);

  return (
    <>
      <SettingsRow
        icon="shield"
        title={t.blockedListTitle}
        value={items === null ? undefined : String(items.length)}
        onClick={() => setOpen(true)}
      />

      <SettingsBottomSheet
        open={open}
        title={t.blockedListTitle}
        onCancel={() => setOpen(false)}
        onDone={() => setOpen(false)}
        cancelLabel={t.cancelLabel}
        doneLabel={t.doneLabel}
      >
        <div className={`${sheetScroll} px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]`}>
          {items === null ? (
            /* هيكلٌ بهندسة الصفّ الحقيقي (D-046): لا قفزة حين تصل القائمة */
            <div className="h-12 rounded-control bg-surface-2 animate-pulse" />
          ) : items.length === 0 ? (
            <p className="text-12 text-muted">{t.blockedEmpty}</p>
          ) : (
            <ul className="divide-y divide-[color:var(--divider)]">
              {items.map((p) => {
                const name = p.hide_name ? t.anonymousUser : p.nickname || p.username || "—";
                return (
                  <li key={p.id} className="flex items-center gap-3 py-2.5">
                    <Avatar src={p.avatar_url} name={name} size={36} alt="" />
                    <div className="min-w-0 flex-1">
                      {/* 🆕 **والمحظورُ يُعرَف كما يُعرَف غيرُه** (D-773ب):
                          **رفعُ الحظر قرارٌ** — ومن أراد أن يميّز الحسابَ
                          قبله يحتاج علامتَه لا اسمَه وحدَه. */}
                      <p className="flex items-center min-w-0" style={{ gap: 4 }}>
                        <span className="min-w-0 truncate text-14 font-semibold">{name}</span>
                        {p.hide_name ? null : <AccountBadges profile={p} t={t} />}
                      </p>
                      {p.username && !p.hide_name && (
                        <p className="text-12 text-muted truncate" dir="ltr">
                          @{p.username}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => unblock(p)}
                      className={buttonClass({ variant: "surface", size: "sm" })}
                    >
                      {t.unblockButton}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SettingsBottomSheet>
    </>
  );
}
