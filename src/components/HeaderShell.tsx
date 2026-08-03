"use client";

import { usePathname } from "next/navigation";

/**
 * غلاف الشريط العلوي.
 *
 * يخفيه في الرئيسية على الجوال وحده. السبب: هناك لا يحمل الشريط إلا أيقونة
 * التطبيق — الروابط في الشريط السفلي، والبحث مخفيّ على الجوال، والصورة
 * انتقلت إلى ترويسة الصفحة. أربعة وستون بكسلاً لأيقونةٍ واحدة، والغلاف
 * تحتها ينتظر. على الشاشات الواسعة يبقى كما هو لأنه يحمل الروابط والبحث.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideOnMobile = pathname === "/";

  return <div className={hideOnMobile ? "hidden md:block" : ""}>{children}</div>;
}
