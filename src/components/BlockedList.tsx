"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { buttonClass } from "./ui/Button";
import { myBlocksList, unblockUser } from "@/lib/actions";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";
import { getDict, type Locale } from "@/lib/i18n";
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

  return (
    <section className="bg-surface border border-border rounded-2xl p-3.5 sm:p-5">
      <h2 className="text-sm font-bold mb-1">{t.blockedListTitle}</h2>
      <p className="text-xs text-muted leading-relaxed mb-3">{t.blockedListHint}</p>

      {items === null ? (
        /* هيكلٌ بهندسة الصفّ الحقيقي (D-046): لا قفزة حين تصل القائمة */
        <div className="h-12 rounded-xl bg-surface-2 animate-pulse" />
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
                  <p className="text-14 font-semibold truncate">{name}</p>
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
    </section>
  );
}
