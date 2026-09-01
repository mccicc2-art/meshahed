"use client";

import Link from "next/link";
import { Icon } from "./Icon";

/**
 * زرُّ الإعدادات في الشريط العلويّ.
 *
 * ⚖️ 🆕 **وكان صورةَ الحساب** (`NavAvatar`) **فصار ترساً** (D-865، حكمُ
 * أحمد بلقطةٍ محوَّطة: «خلّها زر إعدادات عشان ماتتكرر الصورة مرتين في
 * نفس الصفحة»).
 *
 * 🔑 **والوجهةُ لم تتغيّر بحرف**: `‎/profile/settings` كما قرّر D-571 —
 * **الذي سقط هو الوجهُ لا الباب.**
 *
 * 🔴 **والعلّةُ التي أغلقها**: **صورةُ الحساب كانت تُرسم مرّتين في
 * الصفحة الواحدة على الشاشة الواسعة** — في الشريط وفي ترويسة الرئيسيّة —
 * **وصورتان لشخصٍ واحدٍ في مشهدٍ واحدٍ تُقرآن حسابين** (ق٦). **والشريطُ
 * هو الذي يتنازل** لأن وجهتَه إعداداتٌ لا هويّة: **الترسُ يقول ما يفعله
 * الباب، والصورةُ كانت تقول من أنت — وهو ما تقوله الترويسةُ أصلاً.**
 *
 * ⚠️ **ولم يعد يقرأ الملفَّ إطلاقاً**: لا صورةَ ولا اسم — **فسقطت
 * `Suspense` من حوله عند مستدعيه**، لأنّ ما كان يُنتظر هو الصورة.
 */
export function NavSettingsButton({
  title,
  ariaLabel,
}: {
  title: string;
  ariaLabel: string;
}) {
  return (
    <Link
      href="/profile/settings"
      prefetch={false}
      title={title}
      aria-label={ariaLabel}
      /* **الصندوقُ ٤٤ كما كان** (D-776): الجرسُ والظرفُ وهذا سواء —
         **وتغييرُ المحتوى لا يغيّر الصفّ.** */
      className="shrink-0 grid place-items-center w-11 h-11 rounded-full text-muted hover:text-accent hover:ring-2 hover:ring-accent ring-2 ring-transparent transition"
    >
      <Icon name="settings" size={22} />
    </Link>
  );
}
