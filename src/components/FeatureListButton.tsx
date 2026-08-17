"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { setFeaturedList } from "@/lib/actions";
import { getDict, type Locale } from "@/lib/i18n";
import { toast, flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * **تثبيتُ قائمةٍ في صفّ «قائمةُ الأسبوع»** — زرٌّ إداريٌّ في صفحة القائمة
 * (D-349، طلبُ أحمد: «تحط بعد البيك فور يو تريندينج ليست»).
 *
 * ================= لماذا هنا لا في لوحةٍ إدارية =================
 *
 * **لأن القرارَ يُتَّخذ حيث يُقرأ الشيء**: تفتح قائمةَ دووم فتقرّر أنها
 * قائمةُ الأسبوع، **ولوحةٌ ثانيةٌ تعني أن تحفظ معرّفاً وتذهب إليها**
 * (D-167: بابٌ واحدٌ لكلِّ فعل، ودفنُه في مكانٍ آخر هو العطل نفسُه).
 *
 * ================= والحارسُ ليس هذا الزرّ =================
 *
 * ⚠️ **يُرسَم للإداريّ وحدَه — وهذا رسمٌ لا حراسة** (D-011/D-193):
 * `set_featured_list` ترفع `forbidden` لغير `am_admin()` **في جسم دالّة
 * القاعدة**، فمن نادى الفعلَ بيده أخذ خطأً لا صفّاً. **ونسخةُ الحارس في
 * الواجهة وحدَها هي كيف يُفتح بابٌ ظُنَّ مغلقاً** (D-302).
 *
 * **والشكلُ شكلُ `RoomPinButton` نفسُه** (D-301/D-314): زوجُ
 * `pin`/`pin-filled`، تفاؤليٌّ، **والملءُ هو الإيصال** — لا رسالةَ نجاحٍ
 * فوق زرٍّ يقول حالتَه بنفسه.
 */
export function FeatureListButton({
  listId,
  featured = false,
  locale,
}: {
  listId: string;
  featured?: boolean;
  locale: Locale;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(featured);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? t.listUnfeature : t.listFeature}
      title={on ? t.listUnfeature : t.listFeature}
      onClick={() => {
        if (pending) return;
        const next = !on;
        tap(next ? [12, 30] : 8);
        setOn(next);
        start(async () => {
          try {
            await setFeaturedList({ listId, on: next });
            toast(next ? t.listFeaturedToast : t.listUnfeaturedToast);
          } catch (e) {
            setOn(!next);
            flashError((e as Error).message);
          }
        });
      }}
      className={`shrink-0 grid place-items-center w-9 h-9 rounded-full border transition active:scale-95 disabled:opacity-50 ${
        on
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-border bg-surface text-muted hover:border-accent hover:text-foreground"
      }`}
    >
      <Icon name={on ? "pin-filled" : "pin"} size={16} className={on ? "fill-current" : ""} />
    </button>
  );
}
