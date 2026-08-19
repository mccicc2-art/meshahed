"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { markSignalsSeen } from "@/lib/actions";

/**
 * ختمُ «رأيتُها» — **يُكتب عند العرض لا عند المغادرة** (D-463).
 *
 * **وهي قاعدةُ الجرس نفسُها منقولةً** (D-125): من فتح فقد رأى، **ومن
 * خرج بسرعةٍ لا يجب أن تلاحقه الشارةُ بنفس الخبر**.
 *
 * ⚠️ **والحارسُ شرطٌ لا احتياط**: `router.refresh()` يُعيد رسمَ الصفحة
 * **وقد يُعيد تشغيلَ الأثر في وضع التطوير المزدوج** — **وختمان في نفس
 * اللحظة نداءان لا معنى للثاني**. المرجعُ يمنع الثاني.
 */
export function MarkSignalsSeen({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    markSignalsSeen()
      .then(() => router.refresh())
      .catch(() => {
        /* الختمُ ليس حَمْلَ الصفحة: فشلُه يُبقي الشارةَ ولا يمنع القراءة */
      });
  }, [enabled, router]);

  return null;
}
