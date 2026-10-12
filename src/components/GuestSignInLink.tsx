"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClass } from "./ui/Button";

/**
 * زرُّ «دخول» في ترويسة الزائر — **ويغيب على صفحة الدخول نفسِها** (🆕 D-1374 — قرارُ أحمد «19 أ»): هناك يعيد تحميلَ الصفحة
 * التي هو فيها، وبابُ الدخول الحقيقيُّ زرُّ Google في وسطها. ويبقى في الصفحات المفتوحة الأخرى (التعريفيّة · الشروط ·
 * الخصوصيّة · الميزات) — هناك هو البابُ الوحيد. عميلٌ لأنّ الترويسةَ تُرسم على الخادم بلا مسار.
 */
export function GuestSignInLink({ label }: { label: string }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <Link href="/login" prefetch={false} className={buttonClass({ size: "sm" })}>
      {label}
    </Link>
  );
}
