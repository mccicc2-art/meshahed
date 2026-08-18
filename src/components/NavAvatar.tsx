"use client";

import Link from "next/link";
import { Avatar } from "./Avatar";

/**
 * صورة الشريط العلوي.
 *
 * **تظهر في كل الصفحات بلا استثناء** — وهي مدخلُ المستخدم إلى ملفّه
 * وإعداداته على الشاشة الواسعة. **وكانت تختفي في الرئيسية** يومَ كانت
 * ترويسةُ الحساب تعرض الصورةَ كبيرةً على غلافها؛ انظر حجّةَ سقوط الاستثناء
 * في جسد المكوّن.
 */
export function NavAvatar({
  src,
  name,
  title,
  alt,
  ariaLabel,
}: {
  src: string | null | undefined;
  name: string;
  title: string;
  alt: string;
  ariaLabel: string;
}) {
  /* ⚖️ 🆕 **وسقط استثناءُ الجذر** (D-434): كانت تختفي في الرئيسية لأن
     ترويسةَ الحساب هناك تعرض الصورةَ كبيرةً على الغلاف — **وقد غادرت
     الترويسةُ إلى الملفّ العامّ**، **فبقي استثناءٌ يحرس شيئاً لم يعد
     موجوداً**، وثمنُه أن مستخدمَ الشاشة الواسعة لا يجد باباً إلى ملفّه
     ولا إلى إعداداته في أكثر صفحاتِ التطبيق زيارةً.
     **وصورةُ الترحيب في `HomeHeader` `md:hidden`** — **صورةٌ واحدةٌ في
     كلّ عرض** (قاعدة ٦). */

  return (
    <Link
      href="/profile/edit"
      title={title}
      aria-label={ariaLabel}
      className="shrink-0 rounded-full ring-2 ring-transparent hover:ring-accent transition"
    >
      <Avatar src={src} name={name} size={36} alt={alt} />
    </Link>
  );
}
