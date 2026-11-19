"use client";

import { useState, useTransition } from "react";
import { Icon } from "./Icon";
import { likeList } from "@/lib/actions";
import { getDict, num, type Locale } from "@/core/i18n";
import { flashError } from "@/lib/toast";
import { tap } from "@/lib/haptics";

/**
 * 🆕 **قلبُ الإعجاب بالقائمة** (أحمد ١٩ نوفمبر ٢٠٢٦، الهجرة ٢٤٩): «مافي اعجاب حاليا للقوائم — الاعجاب الحالي
 * يضيفها ل قوائمك — لازم يكون فيه اعجاب و الاضافة للقوائم منفصله عنها».
 *
 * كان القلبُ هو الحفظ (D-324: «القلبُ هو الحفظ — لا فعلَ ثانٍ») — فنُقض بكلمة صاحبه: **القلبُ إعجابٌ وحدَه**، والحفظُ
 * صار له رمزُه (`ListSaveMark` على البطاقة، `ListSaveChip` في الصفحة). الهندسةُ هندسةُ القلب القديم حرفاً (هدفٌ ٣٢px،
 * الرقمُ داخل الزرّ، `ltr`، تفاؤليٌّ يُراجَع عند الفشل) — تغيّر ما يكتبه لا شكلُه.
 *
 * ⚠️ والبطاقةُ رابطٌ كلُّها — فالضغطةُ تُوقَف عند الزرّ، **وإلّا أعجبتْ وفتحتِ الصفحةَ في لمسةٍ واحدة.**
 */
export function ListLikeHeart({
  listId,
  liked = false,
  count,
  locale,
  size = 16,
}: {
  listId: string;
  liked?: boolean;
  /** عددُ المعجبين من الخادم — يُعرض فرقاً لا قيمةً مطلقة (D-241) */
  count?: number | null;
  locale: Locale;
  size?: number;
}) {
  const t = getDict(locale);
  const [on, setOn] = useState(liked);
  const [pending, start] = useTransition();
  const shown = (count ?? 0) + (on === liked ? 0 : on ? 1 : -1);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? t.listUnlikeLabel : t.listLikeLabel}
      title={on ? t.listUnlikeLabel : t.listLikeLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (pending) return;
        const next = !on;
        tap(next ? [12, 30] : 8);
        setOn(next);
        start(async () => {
          try {
            await likeList(listId, next);
          } catch (err) {
            setOn(!next);
            flashError((err as Error).message);
          }
        });
      }}
      className={`shrink-0 flex items-center gap-1 h-8 -mt-0.5 rounded-full px-1 text-12 font-bold tabular-nums active:scale-90 disabled:opacity-50 transition ${
        on ? "text-accent" : "text-muted hover:text-accent"
      }`}
      dir="ltr"
    >
      <Icon name={on ? "heart-filled" : "heart"} size={size} strokeWidth={2} className={on ? "fill-current" : ""} />
      {/* **والصفرُ لا يُطبع** (D-219) — كأخيه القديم: قلبٌ فارغٌ يقول «لا أحد» بلا رقم */}
      {shown > 0 && <span>{num(shown, locale)}</span>}
    </button>
  );
}
