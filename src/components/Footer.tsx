"use client";

import { usePathname } from "next/navigation";

/**
 * تذييل التطبيق — سطر الشعار.
 *
 * مكوّنُ عميلٍ لسببٍ واحد: في صفحة الدخول السطرُ جزءٌ من البطل تحت زرّ
 * الدخول مباشرةً (قرارُ المالك)، فلو بقي التذييل العام هناك لتكرّر السطر
 * مرّتين في الشاشة نفسها. التخطيطُ خادميٌّ ولا يعرف المسار، والمكوّن
 * الصغير هذا يعرفه.
 */
export function Footer({ text }: { text: string }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    /* `dir="ltr"` لأن السطر إنجليزيّ في اللغتين: شعارٌ واحد لا يُترجم */
    <footer
      dir="ltr"
      className="text-center text-[13px] tracking-wide text-muted/70 py-6 pb-28 md:pb-6"
    >
      {text}
    </footer>
  );
}
